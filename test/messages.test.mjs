import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as myMessages } from '../functions/api/my/messages.js';
import { onRequestPost as sendMessage } from '../functions/api/message.js';
import { onRequest as adminGate } from '../functions/api/admin/_middleware.js';
import { env, customer, admin, fakeFetch, json, supabaseAuth, withFetch, request, signedIn, call } from './helpers.mjs';

const REST = `${env.SUPABASE_URL}/rest/v1/messages`;

test('a Customer who is not signed in gets no messages', async () => {
  const res = await withFetch(fakeFetch(supabaseAuth()), () => call(myMessages, request('/api/my/messages')));
  assert.equal(res.status, 401);
});

test('a signed-in Customer gets only their own messages, whatever they put in the link', async () => {
  const stored = [{ id: 7, message: 'عايز تورتة', created_at: '2026-10-28T10:00:00Z', status: 'done', reply: 'جاهزة الخميس', replied_at: '2026-10-28T11:00:00Z' }];
  const fake = fakeFetch(call => call.url.startsWith(REST) ? json(stored) : supabaseAuth()(call));
  const res = await withFetch(fake, () => call(myMessages, request(`/api/my/messages?user_id=eq.${admin.id}`, { cookies: signedIn('token-customer') })));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, messages: stored });

  const query = new URL(fake.calls.find(c => c.url.startsWith(REST)).url).searchParams;
  assert.deepEqual(query.getAll('user_id'), [`eq.${customer.id}`]);
  assert.ok(!query.get('select').includes('phone'), 'the account page never needs phone numbers');
  assert.equal(fake.calls.find(c => c.url.startsWith(REST)).headers.get('apikey'), env.SUPABASE_SECRET_KEY);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

function messageFake() {
  return fakeFetch(call => {
    if (call.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return json({ success: true });
    if (call.url === REST && call.method === 'POST') return new Response(null, { status: 201 });
    return supabaseAuth()(call);
  });
}
const form = { name: 'زبون', phone: '01012345678', message: 'سلام', token: 'turnstile-ok' };
const savedRow = fake => JSON.parse(fake.calls.find(c => c.url === REST).body);

test('a message sent while signed in is linked to the Customer\'s account', async () => {
  const fake = messageFake();
  const res = await withFetch(fake, () => call(sendMessage, request('/api/message', { method: 'POST', body: form, cookies: signedIn('token-customer') })));
  assert.equal(res.status, 200);
  assert.equal(savedRow(fake).user_id, customer.id);
});

test('a message can\'t be linked to someone else\'s account by sending user_id', async () => {
  const fake = messageFake();
  await withFetch(fake, () => call(sendMessage, request('/api/message', { method: 'POST', body: { ...form, user_id: admin.id } })));
  assert.equal(savedRow(fake).user_id, null);

  const signedFake = messageFake();
  await withFetch(signedFake, () => call(sendMessage, request('/api/message', { method: 'POST', body: { ...form, user_id: admin.id }, cookies: signedIn('token-customer') })));
  assert.equal(savedRow(signedFake).user_id, customer.id);
});

test('every /api/admin request needs a signed-in admin before it reaches the endpoint', async () => {
  let reached = null;
  const next = () => { reached = true; return new Response('secret data'); };
  const fake = fakeFetch(supabaseAuth());
  const gate = async cookies => {
    reached = false;
    const data = {};
    const res = await withFetch(fake, () => call(adminGate, request('/api/admin/messages', { cookies }), { next, data }));
    return { res, data };
  };

  assert.equal((await gate({})).res.status, 401);
  assert.equal(reached, false);
  assert.equal((await gate(signedIn('token-customer'))).res.status, 403);
  assert.equal(reached, false);

  const { res, data } = await gate(signedIn('token-admin'));
  assert.equal(reached, true);
  assert.equal(await res.text(), 'secret data');
  assert.equal(data.user.id, admin.id);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('admin requests that change something must come from this site', async () => {
  let reached = false;
  const next = () => { reached = true; return new Response('ok'); };
  const res = await withFetch(fakeFetch(supabaseAuth()), () =>
    call(adminGate, request('/api/admin/messages', { method: 'POST', body: {}, cookies: signedIn('token-admin'), origin: 'https://evil.example' }), { next }));
  assert.equal(res.status, 403);
  assert.equal(reached, false);
});
