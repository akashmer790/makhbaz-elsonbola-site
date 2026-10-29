// فحص الـ pre-push بيتنده من غير ما يشغّل node بجد: البناء والـ tests بيعدّوا على run مزيّف،
// و Supabase على fetch مزيّف، والملفات (functions و supabase/messages.sql) هي بتاعة الريبو نفسه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepushCheck } from '../scripts/prepush-check.mjs';
import { fakeFetch, json } from './helpers.mjs';

const failing = (stdout = '') => Object.assign(new Error('exit 1'), { stdout, stderr: '' });

// run مزيّف: بيسجّل كل أمر، وبيفشل في الأوامر اللي في fails
function fakeRun(fails = []) {
  const calls = [];
  const run = args => {
    calls.push(args.join(' '));
    const hit = fails.find(f => args.join(' ').includes(f.match));
    if (hit) throw failing(hit.stdout);
    return '';
  };
  return { run, calls };
}

// جدول Supabase سليم: كل عمود موجود والمفتاح العام ممنوع (42501)
const lockedTable = fakeFetch(() => json({ code: '42501', message: 'permission denied' }, 401));
const quiet = { log() {}, warn() {}, error() {} };

test('the push goes through when the build, the tests and the Supabase columns are all fine', async () => {
  const { run, calls } = fakeRun();
  const result = await prepushCheck({ run, fetch: lockedTable.fetch, console: quiet });
  assert.equal(result.ok, true);
  assert.ok(calls.some(c => c.includes('scripts/build.mjs') || c.includes('scripts\\build.mjs')));
  assert.ok(calls.includes('--test'));
});

test('a failing build stops the push', async () => {
  const { run } = fakeRun([{ match: 'build.mjs' }]);
  const result = await prepushCheck({ run, fetch: lockedTable.fetch, console: quiet });
  assert.equal(result.ok, false);
});

test('a failing test stops the push, and the failing test is named', async () => {
  const errors = [];
  const { run } = fakeRun([{ match: '--test', stdout: '✔ fine\n✖ phone link matches the shown phone\n' }]);
  const result = await prepushCheck({ run, fetch: lockedTable.fetch, console: { ...quiet, error: m => errors.push(m) } });
  assert.equal(result.ok, false);
  assert.ok(errors.some(m => m.includes('phone link matches the shown phone')));
});

test('the Supabase column check still runs, and a column missing from the table stops the push', async () => {
  const { run } = fakeRun();
  const missing = fakeFetch(call => new URL(call.url).searchParams.get('select') === 'name'
    ? json({ code: '42703', message: 'column does not exist' }, 400)
    : json({ code: '42501', message: 'permission denied' }, 401));
  const result = await prepushCheck({ run, fetch: missing.fetch, console: quiet });
  assert.equal(result.ok, false);
  assert.ok(missing.calls.some(c => c.url.includes('/rest/v1/messages?select=name')));
});
