// الـ endpoints دي بتشتغل بعد functions/api/admin/_middleware.js (اتختبر في messages.test.mjs)،
// فهنا بنندهها كأن الأدمن عدّى البوابة.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as messages from '../functions/api/admin/messages.js';
import { onRequestGet as subscribers } from '../functions/api/admin/subscribers.js';
import { env, admin, fakeFetch, json, withFetch, request, call } from './helpers.mjs';

const REST = `${env.SUPABASE_URL}/rest/v1/messages`;
const asAdmin = (handler, req, extra = {}) => call(handler, req, { ...extra, data: { user: admin } });
const restCall = fake => fake.calls.find(c => c.url.startsWith(REST));

test('the admin lists new messages first by default, 50 at a time, with phone numbers', async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: 100 - i, name: 'زبون', phone: '01012345678', message: 'سلام', status: 'new' }));
  const fake = fakeFetch(c => c.url.startsWith(REST) ? json(rows) : undefined);
  const res = await withFetch(fake, () => asAdmin(messages.onRequestGet, request('/api/admin/messages')));
  const body = await res.json();
  assert.equal(body.messages.length, 50);
  assert.equal(body.more, true);
  const query = new URL(restCall(fake).url).searchParams;
  assert.equal(query.get('status'), 'eq.new');
  assert.equal(query.get('order'), 'created_at.desc');
  assert.ok(query.get('select').includes('phone'));
});

test('the admin can list every message and page through them', async () => {
  const fake = fakeFetch(c => c.url.startsWith(REST) ? json([]) : undefined);
  const res = await withFetch(fake, () => asAdmin(messages.onRequestGet, request('/api/admin/messages?status=all&offset=50')));
  assert.deepEqual(await res.json(), { ok: true, messages: [], more: false });
  const query = new URL(restCall(fake).url).searchParams;
  assert.equal(query.get('status'), null);
  assert.equal(query.get('offset'), '50');
});

test('odd list filters are rejected instead of reaching the database', async () => {
  const fake = fakeFetch(() => json([]));
  for (const q of ['?status=eq.new', '?status=whatever', '?offset=-1', '?offset=1e9', '?offset=abc', '?status=all&offset=50;drop']) {
    const res = await withFetch(fake, () => asAdmin(messages.onRequestGet, request('/api/admin/messages' + q)));
    assert.equal(res.status, 400, q);
  }
  assert.equal(fake.calls.length, 0);
});

test('the admin marks a message as done and writes a reply the Customer will see', async () => {
  const fake = fakeFetch(c => c.url.startsWith(REST) && c.method === 'PATCH' ? json([{ id: 7 }]) : undefined);
  const res = await withFetch(fake, () => asAdmin(messages.onRequestPost, request('/api/admin/messages', { method: 'POST', body: { id: 7, status: 'done', reply: '  جاهزة الخميس  ' } })));
  assert.equal(res.status, 200);
  const patch = restCall(fake);
  assert.equal(new URL(patch.url).searchParams.get('id'), 'eq.7');
  const body = JSON.parse(patch.body);
  assert.equal(body.status, 'done');
  assert.equal(body.reply, 'جاهزة الخميس');
  assert.ok(!Number.isNaN(Date.parse(body.replied_at)));
});

test('clearing a reply removes it and its time; changing only the status leaves the reply alone', async () => {
  const fake = fakeFetch(c => c.method === 'PATCH' ? json([{ id: 7 }]) : undefined);
  await withFetch(fake, () => asAdmin(messages.onRequestPost, request('/api/admin/messages', { method: 'POST', body: { id: 7, reply: ' ' } })));
  assert.deepEqual(JSON.parse(fake.calls[0].body), { reply: null, replied_at: null });
  await withFetch(fake, () => asAdmin(messages.onRequestPost, request('/api/admin/messages', { method: 'POST', body: { id: 7, status: 'new' } })));
  assert.deepEqual(JSON.parse(fake.calls[1].body), { status: 'new' });
});

test('bad message updates are rejected, and a missing message says so', async () => {
  const fake = fakeFetch(c => c.method === 'PATCH' ? json([]) : undefined);
  const bad = [{}, { id: 7 }, { id: '7 or 1=1', status: 'done' }, { id: -1, status: 'done' }, { id: 7, status: 'deleted' },
    { id: 7, reply: 'x'.repeat(2001) }, { id: 7, reply: 5 }, { id: 7, user_id: admin.id }];
  for (const body of bad) {
    const res = await withFetch(fake, () => asAdmin(messages.onRequestPost, request('/api/admin/messages', { method: 'POST', body })));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(fake.calls.length, 0);
  const missing = await withFetch(fake, () => asAdmin(messages.onRequestPost, request('/api/admin/messages', { method: 'POST', body: { id: 999, status: 'done' } })));
  assert.equal(missing.status, 404);
});

test('the offers list has each phone once, by the Customer\'s latest choice', async () => {
  // من الأحدث للأقدم، زي ما الـ query بيطلبها
  const rows = [
    { phone: '01011111111', name: 'منى', wants_updates: true, created_at: '2026-10-28' },
    { phone: '01022222222', name: 'كريم', wants_updates: false, created_at: '2026-10-27' },
    { phone: '01011111111', name: 'منى قديم', wants_updates: false, created_at: '2026-10-20' },
    { phone: '01022222222', name: 'كريم', wants_updates: true, created_at: '2026-10-10' },
    { phone: '01533333333', name: 'سارة', wants_updates: true, created_at: '2026-10-01' },
  ];
  const fake = fakeFetch(c => c.url.startsWith(REST) ? json(rows) : undefined);
  const res = await withFetch(fake, () => asAdmin(subscribers, request('/api/admin/subscribers')));
  assert.deepEqual(await res.json(), { ok: true, subscribers: [
    { phone: '01011111111', name: 'منى', since: '2026-10-28' },
    { phone: '01533333333', name: 'سارة', since: '2026-10-01' },
  ] });
  assert.match(new URL(restCall(fake).url).searchParams.get('order'), /^created_at\.desc/);
});

test('the offers list reads past Supabase\'s 1000-row cap', async () => {
  const all = Array.from({ length: 2500 }, (_, i) => ({ phone: `010${String(i).padStart(8, '0')}`, name: 'x', wants_updates: true, created_at: '2026-10-01' }));
  const fake = fakeFetch(c => {
    if (!c.url.startsWith(REST)) return;
    const q = new URL(c.url).searchParams;
    const offset = Number(q.get('offset') ?? 0);
    return json(all.slice(offset, offset + Math.min(1000, Number(q.get('limit')))));
  });
  const res = await withFetch(fake, () => asAdmin(subscribers, request('/api/admin/subscribers')));
  assert.equal((await res.json()).subscribers.length, 2500);
});
