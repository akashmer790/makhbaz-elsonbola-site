#!/usr/bin/env node
// بيشتغل قبل كل push (من .githooks/pre-push). أي push على main بيتنشر على الموقع على طول،
// فالفحص ده بيوقف الـ push لو:
//   1. السيرفر بيحفظ عمود مش موجود في supabase/messages.sql أو مش موجود في جدول Supabase نفسه
//      (لو اترفع كده، كل رسالة من الفورم هتفشل)
//   2. bakery-facts.md و sanbola.html مش متطابقين
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

// 1) الأعمدة اللي السيرفر بيحفظها
const fn = readFileSync(join(root, 'functions/api/message.js'), 'utf8');
const rowMatch = fn.match(/const row = \{([^}]*)\}/);
if (!rowMatch) {
  fail('مش لاقي `const row = { ... }` في functions/api/message.js، حدّث scripts/prepush-check.mjs');
} else {
  const columns = rowMatch[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
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
    // "permission denied" (42501) معناها إن العمود موجود والمفتاح العام ممنوع، وده المطلوب.
    // "undefined column" (42703) معناها إن العمود مش موجود.
    const missingInDb = [];
    let offline = false;
    for (const c of columns) {
      try {
        const res = await fetch(`https://${ref}.supabase.co/rest/v1/messages?select=${c}&limit=0`, { headers: { apikey: PUBLISHABLE_KEY } });
        const body = res.ok ? null : await res.json().catch(() => ({}));
        if (body?.code === '42703') missingInDb.push(c);
      } catch {
        offline = true;
        break;
      }
    }
    if (offline) console.warn('! مفيش اتصال بـ Supabase، هتخطّى فحص الجدول نفسه');
    else if (missingInDb.length) fail(`الأعمدة دي مش موجودة في جدول Supabase: ${missingInDb.join(', ')}\n  شغّل supabase/messages.sql في SQL Editor الأول، وبعدين اعمل push تاني.`);
    else ok('جدول messages في Supabase فيه كل الأعمدة');
  }
}

// 2) ورقة المعلومات والصفحة متطابقين (الملف ده على الجهاز بس، فلو مش موجود نتخطّى)
const checker = join(root, '.claude/skills/bakery-content-update/scripts/check-consistency.mjs');
if (!existsSync(join(root, 'bakery-facts.md'))) {
  console.warn('! bakery-facts.md مش موجود على الجهاز، هتخطّى مقارنته بالصفحة');
} else if (existsSync(checker)) {
  try {
    execFileSync(process.execPath, [checker, root], { stdio: 'pipe' });
    ok('bakery-facts.md و sanbola.html متطابقين');
  } catch (e) {
    fail(`bakery-facts.md و sanbola.html مختلفين:\n${String(e.stdout)}`);
  }
}

if (failed) {
  console.error('\nالـ push اتوقف. صلّح اللي فوق وجرّب تاني.');
  process.exit(1);
}
