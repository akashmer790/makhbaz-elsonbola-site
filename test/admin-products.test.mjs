import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet as getProducts, onRequestPut as putProducts } from '../functions/api/admin/products.js';
import { PRODUCT_ICONS } from '../template/products.mjs';
import { admin, fakeFetch, json, withFetch, request, call } from './helpers.mjs';

const github = { GITHUB_TOKEN: 'gh-token', GITHUB_REPO: 'owner/site', GITHUB_BRANCH: 'main' };
const FILE = 'https://api.github.com/repos/owner/site/contents/business.json';
const business = JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8'));
const asAdmin = (handler, req, extraEnv = github) => call(handler, req, { env: extraEnv, data: { user: admin } });

function githubFake({ sha = 'sha-1', putStatus = 200 } = {}) {
  return fakeFetch(c => {
    if (c.url === `${FILE}?ref=main` && c.method === 'GET') {
      return json({ sha, encoding: 'base64', content: Buffer.from(JSON.stringify(business, null, 2)).toString('base64').replace(/(.{60})/g, '$1\n') });
    }
    if (c.url === FILE && c.method === 'PUT') return putStatus === 200 ? json({ content: { sha: 'sha-2' } }) : json({ message: 'conflict' }, putStatus);
  });
}
const cake = { name: 'تورتة "خاصة" & <كبيرة>', unit: 'حسب الطلب', price: 'من 500 جنيه', note: 'بالحجز', icon: 'cake' };

test('product editing stays off until GitHub is set up for this deployment', async () => {
  const fake = githubFake();
  const get = await withFetch(fake, () => asAdmin(getProducts, request('/api/admin/products'), {}));
  const put = await withFetch(fake, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [cake], sha: 'sha-1' } }), { ...github, GITHUB_BRANCH: '' }));
  assert.equal(get.status, 503);
  assert.equal(put.status, 503);
  assert.equal(fake.calls.length, 0);
});

test('the admin loads the products as they are in the Business file on GitHub', async () => {
  const fake = githubFake();
  const res = await withFetch(fake, () => asAdmin(getProducts, request('/api/admin/products')));
  assert.deepEqual(await res.json(), { ok: true, products: business.products, sha: 'sha-1', icons: PRODUCT_ICONS });
  assert.equal(fake.calls[0].headers.get('Authorization'), 'Bearer gh-token');
  assert.ok(fake.calls[0].headers.get('User-Agent'));
});

test('saving products commits the Business file with only the products changed', async () => {
  const fake = githubFake();
  const res = await withFetch(fake, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [cake], sha: 'sha-1' } })));
  assert.deepEqual(await res.json(), { ok: true, sha: 'sha-2' });

  const put = fake.calls.find(c => c.method === 'PUT');
  const body = JSON.parse(put.body);
  assert.equal(body.sha, 'sha-1');
  assert.equal(body.branch, 'main');
  assert.ok(!body.message.includes(admin.email), 'the repo is public: no emails in commit messages');
  const saved = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  assert.deepEqual(saved, { ...business, products: [cake] });
});

test('saving over someone else\'s newer change is refused', async () => {
  const stale = githubFake({ sha: 'sha-newer' });
  const res = await withFetch(stale, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [cake], sha: 'sha-1' } })));
  assert.equal(res.status, 409);
  assert.ok(!stale.calls.some(c => c.method === 'PUT'));

  const race = githubFake({ putStatus: 409 });
  const raced = await withFetch(race, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [cake], sha: 'sha-1' } })));
  assert.equal(raced.status, 409);
});

test('invalid products never reach GitHub, and the admin is told which field', async () => {
  const fake = githubFake();
  const res = await withFetch(fake, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [{ ...cake, icon: '../../etc' }], sha: 'sha-1' } })));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, error: 'bad_product', field: 'product 1: icon' });
  const noSha = await withFetch(fake, () => asAdmin(putProducts, request('/api/admin/products', { method: 'PUT', body: { products: [cake] } })));
  assert.equal(noSha.status, 400);
  assert.equal(fake.calls.length, 0);
});
