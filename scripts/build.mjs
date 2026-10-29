#!/usr/bin/env node
// بيبني الموقع: يقرا ملف المحل (business.json)، يدّيه للـ renderer، ويكتب الناتج في dist/
// ومعاه ملفات القالب الثابتة (template/static: الهيدرز والـ redirects وسكريبتات وستايل صفحات الحساب).
// الصفحات و brand.css و favicon.svg بيطلّعهم الـ renderer من ملف المحل.
// Cloudflare Pages بيشغّله في كل push: Build command = node scripts/build.mjs، Build output = dist
// تشغيل يدوي: node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, BusinessFileError } from '../template/render.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

const business = JSON.parse(readFileSync(join(root, 'business.json'), 'utf8'));
// الـ renderer بيرفض ملف المحل الغلط برسالة فيها الخانة؛ بنطبعها لوحدها من غير stack trace.
// أي غلطة تانية (bug في الكود) بتطلع زي ما هي بالـ stack trace
let files;
try {
  files = render(business);
} catch (e) {
  if (!(e instanceof BusinessFileError)) throw e;
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

// dist/ ناتج بناء بيتعمل من الأول كل مرة (ومش في git)، فمسحه مش مسح لبيانات
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'template/static'), out, { recursive: true });
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), content);
}
console.log(`✓ اتبنى ${Object.keys(files).length} ملف من business.json، والموقع في dist/`);
