// tests تشغيل سكريبتات الصفحات (template/static/*.js) زي ما المتصفح بيشغّلها، على DOM و fetch مزيّفين.
// الهدف إن أي error وقت التشغيل يوقع هنا مش في المتصفح بس، زي bug صفحة الأدمن
// (Cannot access 'offset' before initialization: الـ await في أول الملف كان بينده start قبل let offset).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const STATIC = join(import.meta.dirname, '..', 'template', 'static');

// عنصر مزيّف: الخصائص المعروفة ليها قيم، وأي method تانية بترجّع عنصر مزيّف كمان
function fakeElement() {
  const node = { hidden: true, value: '', textContent: '', className: '', dataset: {}, children: [] };
  return new Proxy(node, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'then') return undefined;
      return () => fakeElement();
    },
  });
}

const responses = {
  '/api/me': { signedIn: true, isAdmin: true, name: 'صاحب المحل' },
  '/api/my/messages': { messages: [] },
  '/api/admin/messages': { messages: [], more: false },
  '/api/admin/subscribers': { subscribers: [], more: false },
};

// بيشغّل سكريبت الصفحة كـ module، وبيرجّع أي error حصل وقت التحميل أو في الـ promises اللي بدأها
async function runPage(file) {
  const errors = [];
  const onRejection = e => errors.push(e);
  process.on('unhandledRejection', onRejection);
  Object.assign(globalThis, {
    document: { getElementById: () => fakeElement(), createElement: () => fakeElement(), querySelectorAll: () => [] },
    location: { search: '', replace() {}, assign() {} },
    fetch: async url => Response.json(responses[new URL(url, 'https://x').pathname] ?? {}),
  });
  try {
    const source = readFileSync(join(STATIC, file), 'utf8')
      .replace(`'/app.js'`, `'${pathToFileURL(join(STATIC, 'app.js')).href}'`);
    // التعليق في الآخر بيخلّي كل تحميل module جديد
    await import(`data:text/javascript,${encodeURIComponent(`${source}\n// ${file} ${Math.random()}`)}`);
    for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
  } catch (e) {
    errors.push(e);
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  return errors;
}

for (const file of ['admin.js', 'account.js', 'login.js']) {
  test(`${file} بيشتغل من غير errors لما الأدمن يفتح الصفحة`, async () => {
    assert.deepEqual((await runPage(file)).map(String), []);
  });
}
