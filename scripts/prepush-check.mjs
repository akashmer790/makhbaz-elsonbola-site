#!/usr/bin/env node
// بيشتغل قبل كل push (من .githooks/pre-push). أي push على main بيتنشر على الموقع على طول،
// فالفحص ده بيوقف الـ push لو:
//   1. السيرفر بيحفظ أو بيقرا عمود مش موجود في supabase/messages.sql أو مش موجود في جدول Supabase نفسه
//      (لو اترفع كده، كل رسالة من الفورم أو صفحة الأدمن هتفشل)
//   2. بناء الموقع من ملف المحل (business.json) فشل
//   3. أي test فشل (node --test)
// تشغيل يدوي: node scripts/prepush-check.mjs
// الـ tests بتنده prepushCheck بـ run و fetch مزيّفين (test/prepush.test.mjs)

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// المفتاح الـ publishable عام ومش سر، وصلاحياته على الجدول مقفولة (RLS من غير سياسات)
const PUBLISHABLE_KEY = 'sb_publishable_kqjTJ47hRpfz8hEQeYGyeQ_TE0JNWq1';

// بيشغّل node بالـ args دي من جذر الريبو، وبيرمي error فيه stdout و stderr لو فشل
const runNode = args => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });

export async function prepushCheck({ root = ROOT, run = runNode, fetch = globalThis.fetch, console: out = console } = {}) {
  let failed = false;
  const fail = msg => { failed = true; out.error(`✗ ${msg}`); };
  const ok = msg => out.log(`✓ ${msg}`);

  // 1) الأعمدة اللي السيرفر بيحفظها (الفورم) وبيقراها ويعدّلها (صفحة الأدمن)
  const fn = readFileSync(join(root, 'functions/api/message.js'), 'utf8');
  const rowMatch = fn.match(/const row = \{([^}]*)\}/);
  const adminFn = readFileSync(join(root, 'functions/api/admin/messages.js'), 'utf8');
  const fieldsMatch = adminFn.match(/const FIELDS = '([^']*)'/);
  if (!rowMatch || !fieldsMatch) {
    fail('مش لاقي `const row = { ... }` في functions/api/message.js أو `const FIELDS` في functions/api/admin/messages.js، حدّث scripts/prepush-check.mjs');
  } else {
    const columns = [...new Set([
      ...rowMatch[1].split(',').map(s => s.trim().split(':')[0].trim()),
      ...fieldsMatch[1].split(','),
    ].filter(Boolean))];
    const sql = readFileSync(join(root, 'supabase/messages.sql'), 'utf8');
    const missingInSql = columns.filter(c => !new RegExp(`\\b${c}\\b`).test(sql));
    if (missingInSql.length) fail(`الأعمدة دي مش موجودة في supabase/messages.sql: ${missingInSql.join(', ')}`);
    else ok(`supabase/messages.sql فيه كل الأعمدة: ${columns.join(', ')}`);

    // رابط المشروع من .mcp.json (project_ref)
    const ref = existsSync(join(root, '.mcp.json'))
      && readFileSync(join(root, '.mcp.json'), 'utf8').match(/project_ref=([a-z0-9]+)/)?.[1];
    if (!ref) {
      out.warn('! مش لاقي project_ref في .mcp.json، هتخطّى فحص الجدول نفسه');
    } else {
      // الرد الوحيد المقبول هو "permission denied" (42501): العمود موجود والمفتاح العام ممنوع.
      // "undefined column" (42703) معناها إن العمود مش موجود.
      // أي رد تاني (الجدول مش موجود PGRST205، مفتاح غلط 401، الجدول مفتوح للزوار 200...) يوقّف الـ push.
      const missingInDb = [];
      const unexpected = [];
      let offline = false;
      for (const c of columns) {
        try {
          const res = await fetch(`https://${ref}.supabase.co/rest/v1/messages?select=${c}&limit=0`, { headers: { apikey: PUBLISHABLE_KEY } });
          const body = await res.json().catch(() => ({}));
          if (body?.code === '42703') missingInDb.push(c);
          else if (body?.code !== '42501') unexpected.push(`${c}: HTTP ${res.status} ${body?.code ?? ''} ${body?.message ?? ''}`.trim());
        } catch {
          offline = true;
          break;
        }
      }
      if (offline) out.warn('! مفيش اتصال بـ Supabase، هتخطّى فحص الجدول نفسه');
      else if (missingInDb.length) {
        // بنطبع جمل الـ SQL نفسها من الملف اللي على الجهاز، عشان ما تتشغّلش نسخة قديمة منه من GitHub أو من تاب قديم
        const statements = sql.split(';')
          .filter(s => missingInDb.some(c => new RegExp(`add column if not exists ${c}\\b`).test(s)))
          .map(s => s.split('\n').filter(line => line.trim() && !line.trim().startsWith('--')).join('\n') + ';');
        fail(`الأعمدة دي مش موجودة في جدول Supabase: ${missingInDb.join(', ')}\n`
          + `  الصق ده في SQL Editor على مشروع ${ref} وشغّله (آمن لو اتشغّل أكتر من مرة)، وبعدين اعمل push تاني:\n\n`
          + statements.join('\n\n') + '\n');
      }
      else if (unexpected.length) fail(`جدول messages في Supabase ردّ رد مش متوقع (لازم يكون permission denied 42501):\n  ${unexpected.join('\n  ')}\n  اتأكد إن الجدول موجود، وإن المفتاح الـ publishable صح، وإن RLS شغال.`);
      else ok('جدول messages في Supabase فيه كل الأعمدة، ومقفول قدام الزباين');
    }
  }

  // 2) الموقع بيتبني من ملف المحل؛ لو البناء فشل هنا هيفشل على Cloudflare كمان
  try {
    run([join(root, 'scripts/build.mjs')]);
    ok('الموقع اتبنى من business.json في dist/');
  } catch (e) {
    fail(`بناء الموقع فشل (node scripts/build.mjs):\n${String(e.stderr || e.stdout)}`);
  }

  // 3) كل الـ tests، ومعاهم تشغيل سكريبتات الصفحات (test/pages.test.mjs)
  try {
    run(['--test']);
    ok('كل الـ tests نجحت (node --test)');
  } catch (e) {
    const failures = String(e.stdout).split('\n').filter(line => line.startsWith('✖')).join('\n');
    fail(`فيه tests فشلت (شغّل node --test عشان تشوف التفاصيل):\n${failures}`);
  }

  if (failed) out.error('\nالـ push اتوقف. صلّح اللي فوق وجرّب تاني.');
  return { ok: !failed };
}

// لما يتشغّل من الـ hook أو بإيدك (مش لما test يعمله import)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { ok } = await prepushCheck();
  if (!ok) process.exit(1);
}
