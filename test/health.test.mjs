import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as health, NEEDS } from '../functions/api/health.js';

const all = Object.fromEntries(Object.values(NEEDS).flat().map(n => [n, `value-of-${n}`]));

test('health says ok when every variable is set, and never shows a value', async () => {
  const res = health({ env: all });
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(text), { ok: true, missing: { form: [], accounts: [], products: [] } });
  assert.ok(!text.includes('value-of-'));
});

test('health names the missing variables per feature, like a preview without Supabase or GitHub', async () => {
  const { TURNSTILE_SECRET_KEY } = all;
  const body = await health({ env: { TURNSTILE_SECRET_KEY } }).json();
  assert.equal(body.ok, false);
  assert.deepEqual(body.missing.form, ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']);
  assert.deepEqual(body.missing.accounts, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']);
  assert.deepEqual(body.missing.products, ['GITHUB_TOKEN', 'GITHUB_REPO', 'GITHUB_BRANCH']);
});
