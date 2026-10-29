// كل قسم اختياري ليه مفتاح شغال/مقفول في ملف المحل، والقسم المقفول ما بيسيبش أي أثر في الصفحة.
// تشغيل: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../template/render.mjs';
import { PRODUCT_ICONS } from '../template/products.mjs';

const bakery = JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8'));
const home = business => render(business)['index.html'];
const withSections = sections => ({ ...bakery, sections: { ...bakery.sections, ...sections } });
// ids الأيقونات اللي في الـ sprite المخفي أول الصفحة
const symbols = html => [...html.matchAll(/<symbol id="i-([\w-]+)"/g)].map(m => m[1]);
const productSymbols = html => symbols(html).filter(id => PRODUCT_ICONS.includes(id));

test('a Business with the products section off gets a home page without it', () => {
  const html = home(withSections({ products: false }));
  assert.doesNotMatch(html, /id="products"/);
  assert.doesNotMatch(html, /المنتجات والأسعار/);
  assert.doesNotMatch(html, /class="product"/);
  assert.deepEqual(productSymbols(html), []);
});

test('the home page draws only the product icons its products use (and what those icons draw on)', () => {
  const only = (...names) => home({ ...bakery, products: bakery.products.filter(p => names.includes(p.name)) });
  assert.deepEqual(productSymbols(only('بسبوسة')), ['basbousa']);
  // كرواسون الشوكولاتة مرسوم فوق رسمة الكرواسون السادة
  assert.deepEqual(productSymbols(only('كرواسون شوكولاتة')), ['croissant', 'croissant-choc']);
  assert.deepEqual(productSymbols(home(bakery)), ['fino', 'baladi', 'croissant', 'croissant-choc', 'basbousa', 'cake']);
});

test('a Business with the hours section off gets a home page without it', () => {
  const html = home(withSections({ hours: false }));
  assert.doesNotMatch(html, /id="hours"/);
  assert.doesNotMatch(html, /المواعيد<\/h2>/);
  assert.doesNotMatch(html, /href="#i-clock"/);
  assert.ok(!symbols(html).includes('clock'));
  assert.doesNotMatch(html, /السبت للخميس/);
});

test('a Business with the contact section off gets a home page without it', () => {
  const html = home(withSections({ contact: false }));
  assert.doesNotMatch(html, /id="contact"/);
  assert.doesNotMatch(html, /العنوان والتواصل/);
  assert.doesNotMatch(html, /href="#i-(pin|phone|scooter)"/);
  for (const icon of ['pin', 'phone', 'scooter']) assert.ok(!symbols(html).includes(icon), icon);
  assert.doesNotMatch(html, /href="tel:/);
  assert.doesNotMatch(html, /شارع النخيل/);
});

test('a Business with the notes section off gets a home page without it', () => {
  const html = home(withSections({ notes: false }));
  assert.doesNotMatch(html, /id="notes"/);
  assert.doesNotMatch(html, />ملاحظات<\/h2>/);
  assert.doesNotMatch(html, /class="notes"/);
  assert.doesNotMatch(html, /جلوتين/);
});

test('with the message form off, the page has no form, no Turnstile script and no form script', () => {
  const html = home(withSections({ message: false }));
  assert.doesNotMatch(html, /id="message"/);
  assert.doesNotMatch(html, /ابعتلنا رسالة/);
  assert.doesNotMatch(html, /href="#i-envelope"/);
  assert.ok(!symbols(html).includes('envelope'));
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /cf-turnstile|challenges\.cloudflare\.com/);
  assert.doesNotMatch(html, /getElementById\('contact-form'\)|\/api\/message/);
  // سكريبت ظهور العناصر مش بتاع الفورم، فبيفضل
  assert.match(html, /IntersectionObserver/);
});

const allOff = { products: false, hours: false, contact: false, message: false, notes: false };

test('with every section off, the page keeps only the header, with no empty heading or leftover marker', () => {
  const html = home({ ...bakery, sections: allOff });
  assert.doesNotMatch(html, /<section|<h2|href="#i-squiggle"/);
  // الـ sprite فيه اللوجو بس
  assert.deepEqual(symbols(html), ['wheat']);
  assert.doesNotMatch(html, /\{\{|\}\}/);
  assert.match(html, /<h1 class="brand-name">مخبز السنبلة<\/h1>/);
  assert.match(html, /<main class="wrap">[\s\S]*<\/main>/);
});

test('a turned-off section needs none of its content in the Business file', () => {
  const { products: _p, hours: _h, address: _a, phone: _ph, delivery: _d, notes: _n, turnstileSiteKey: _t, ...identity } = bakery;
  const html = home({ ...identity, sections: allOff });
  assert.doesNotMatch(html, /undefined/);
});

test('with every section on, the bakery page has all five sections, the form and its scripts', () => {
  const html = home(bakery);
  for (const id of ['products', 'hours', 'contact', 'message', 'notes']) assert.match(html, new RegExp(`<section id="${id}">`), id);
  assert.match(html, /<script src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js" async defer><\/script>/);
  assert.match(html, /document\.getElementById\('contact-form'\)/);
  assert.doesNotMatch(html, /\{\{|\}\}/);
});

test('every section switch must be explicitly on (true) or off (false), or the build fails naming it', () => {
  for (const id of ['products', 'hours', 'contact', 'message', 'notes']) {
    for (const value of ['on', 'off', 'yes', 1, 0, null, undefined]) {
      assert.throws(() => render(withSections({ [id]: value })), new RegExp(`"sections\\.${id}"`), `${id}: ${value}`);
    }
  }
  const { sections: _, ...noSwitches } = bakery;
  assert.throws(() => render(noSwitches), /"sections"/);
  assert.throws(() => render({ ...bakery, sections: [true, true] }), /"sections"/);
});

test('a switch for a section the Template doesn\'t have fails the build, naming it and the real ones', () => {
  assert.throws(() => render(withSections({ delivery: true })), err => /"sections\.delivery"/.test(err.message) && /products/.test(err.message));
});
