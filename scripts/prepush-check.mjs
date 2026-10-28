#!/usr/bin/env node
// بيشتغل قبل كل push (من .githooks/pre-push). أي push على main بيتنشر على الموقع على طول،
// فالفحص ده بيوقف الـ push لو:
//   1. السيرفر بيحفظ أو بيقرا عمود مش موجود في supabase/messages.sql أو مش موجود في جدول Supabase نفسه
//      (لو اترفع كده، كل رسالة من الفورم أو صفحة الأدمن هتفشل)
//   2. بناء الموقع من business.json فشل
//   3. أي test فشل (node --test)
// وبيحذّر (من غير ما يوقف) لو bakery-facts.md بقى قديم عن الصفحة المبنية (dist/index.html)
// تشغيل يدوي: node scripts/prepush-check.mjs

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// المفتاح الـ publishable عام ومش سر، وصلاحياته على الجدول مقفولة (RLS من غير سياسات)
const PUBLISHABLE_KEY = 'sb_publishable_kqjTJ47hRpfz8hEQeYGyeQ_TE0JNWq1';

let failed = false;
const fail = msg => { failed = true; console.error(`✗ ${msg}`); };
const ok = msg => console.log(`✓ ${msg}`);

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
    console.warn('! مش لاقي project_ref في .mcp.json، هتخطّى فحص الجدول نفسه');
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
    if (offline) console.warn('! مفيش اتصال بـ Supabase، هتخطّى فحص الجدول نفسه');
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
    else ok('جدول messages في Supabase فيه كل الأعمدة، ومقفول على الزوار');
  }
}

// 2) الصفحة بتتبني من business.json؛ لو البناء فشل هنا هيفشل على Cloudflare كمان
let built = false;
try {
  execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'pipe' });
  built = true;
  ok('الموقع اتبنى من business.json في dist/');
} catch (e) {
  fail(`بناء الموقع فشل (node scripts/build.mjs):\n${String(e.stderr || e.stdout)}`);
}

// 3) كل الـ tests، ومعاهم تشغيل سكريبتات الصفحات (test/pages.test.mjs)
try {
  execFileSync(process.execPath, ['--test'], { cwd: root, stdio: 'pipe' });
  ok('كل الـ tests نجحت (node --test)');
} catch (e) {
  const failures = String(e.stdout).split('\n').filter(line => line.startsWith('✖')).join('\n');
  fail(`فيه tests فشلت (شغّل node --test عشان تشوف التفاصيل):\n${failures}`);
}

// 4) ورقة المعلومات والصفحة المبنية متطابقين (الملف ده على الجهاز بس، فلو مش موجود نتخطّى).
// تحذير بس مش وقف: الصفحة بتتبني من business.json، وصفحة الأدمن بتعدّل الأسعار فيه على GitHub مباشرة،
// فالاختلاف معناه إن ورقة المعلومات على الجهاز هي اللي قديمة، مش إن الموقع غلط
const checker = join(root, '.claude/skills/bakery-content-update/scripts/check-consistency.mjs');
if (!built) {
  console.warn('! الموقع ما اتبناش، هتخطّى مقارنة bakery-facts.md بالصفحة');
} else if (!existsSync(join(root, 'bakery-facts.md'))) {
  console.warn('! bakery-facts.md مش موجود على الجهاز، هتخطّى مقارنته بالصفحة');
} else if (existsSync(checker)) {
  try {
    execFileSync(process.execPath, [checker, root], { stdio: 'pipe' });
    ok('bakery-facts.md و dist/index.html متطابقين');
  } catch (e) {
    console.warn(`! bakery-facts.md قديم، ومختلف عن الصفحة المبنية من business.json. حدّثه من business.json:\n${String(e.stdout)}`);
  }
}

if (failed) {
  console.error('\nالـ push اتوقف. صلّح اللي فوق وجرّب تاني.');
  process.exit(1);
}
