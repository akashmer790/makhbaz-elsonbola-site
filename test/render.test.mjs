// الـ tests بتشوف الصفحة الناتجة بس (النص والـ attributes)، مش طريقة بناها جوه الـ renderer.
// تشغيل: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../template/render.mjs';

// المحتوى (المنتجات والأسعار والمواعيد...) متجمّد في fixtures/bakery-content.json زي ما الموقع كان بيعرضه
// قبل القالب، عشان تعديل سعر في ملف المحل ما يكسرش الـ tests. الهوية والأقسام والإعدادات من business.json نفسه
const bakery = {
  ...JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8')),
  ...JSON.parse(readFileSync(new URL('./fixtures/bakery-content.json', import.meta.url), 'utf8')),
};
const home = business => render(business)['index.html'];

// النص الظاهر من غير tags، عشان نقارن بالكلام اللي الزبون بيشوفه
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (html, start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const productCards = html => [...html.matchAll(/<li class="product"[^>]*>[\s\S]*?<\/li>/g)].map(m => m[0]);

test('the bakery home page shows every product with its unit, price and note, in order', () => {
  const cards = productCards(home(bakery)).map(text);
  assert.deepEqual(cards, [
    'عيش فينو 5 أرغفة 15 جنيه',
    'عيش بلدي مخصوص 5 أرغفة 10 جنيه',
    'كرواسون سادة القطعة 20 جنيه',
    'كرواسون شوكولاتة القطعة 28 جنيه',
    'بسبوسة الكيلو 160 جنيه',
    'تورتة عيد ميلاد حسب الطلب من 450 جنيه بالحجز قبلها بيومين',
  ]);
});

test('the bakery home page shows every hours row', () => {
  const rows = [...between(home(bakery), '<section id="hours"', '</section>').matchAll(/<tr>\s*<td>[\s\S]*?<\/tr>/g)].map(m => text(m[0]));
  assert.deepEqual(rows, ['السبت للخميس 7 الصبح 11 بالليل', 'الجمعة 2 الضهر 11 بالليل']);
});

test('the bakery home page shows the address, phone and delivery terms, without editor remarks', () => {
  const contact = text(between(home(bakery), '<section id="contact"', '</section>'));
  assert.match(contact, /العنوان: 12 شارع النخيل، جنب الصيدلية الموبايل/);
  assert.match(contact, /الموبايل: 0100 000 0000 التوصيل/);
  assert.match(contact, /التوصيل: بنوصّل في حدود 3 كيلو، والطلب الأقل 100 جنيه$/);
  assert.doesNotMatch(contact, /خيالي/);
});

test('the bakery home page shows the notes, tagline and about text', () => {
  const html = home(bakery);
  const notes = [...between(html, '<section id="notes"', '</section>').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  assert.deepEqual(notes, [
    'مفيش أكل من غير جلوتين.',
    'مفيش دفع أونلاين: الدفع كاش أو إنستاباي عند الاستلام.',
    'مفيش منيو إنجليزي.',
  ]);
  assert.match(html, /<h1 class="brand-name">مخبز السنبلة<\/h1>/);
  assert.match(html, /<p class="tagline">عيش وحلويات طازة كل يوم، من فرننا لبيتك.<\/p>/);
  assert.match(html, /<p class="about">مخبز عيلة صغير. بنخبز كل يوم الصبح بدري، ومفيش حاجة عندنا بايتة.<\/p>/);
});

test('a different Business shows its own facts, not the bakery\'s', () => {
  const shop = {
    ...bakery,
    name: 'فول الأمانة',
    tagline: 'فول وطعمية سخنة من الفجر.',
    about: 'عربية فول في شارع الجمهورية.',
    hours: [{ days: 'كل يوم', from: '5 الفجر', to: '12 الضهر' }],
    address: 'ناصية شارع الجمهورية',
    phone: '0111 222 3333',
    delivery: 'مفيش توصيل',
    notes: ['الدفع كاش بس.'],
  };
  const page = text(home(shop));
  for (const fact of ['فول الأمانة', 'فول وطعمية سخنة من الفجر.', 'عربية فول في شارع الجمهورية.', 'كل يوم 5 الفجر 12 الضهر',
    'ناصية شارع الجمهورية', '0111 222 3333', 'مفيش توصيل', 'الدفع كاش بس.']) {
    assert.ok(page.includes(fact), `missing: ${fact}`);
  }
  for (const old of ['مخبز السنبلة', 'السبت للخميس', 'شارع النخيل', '0100 000 0000', 'جلوتين']) {
    assert.ok(!page.includes(old), `still shows: ${old}`);
  }
});

const attr = (html, tagPattern) => html.match(new RegExp(`<meta ${tagPattern} content="([^"]*)"`))?.[1];

test('the title and link-preview tags come from the name, tagline and site address', () => {
  const html = home(bakery);
  assert.match(html, /<title>مخبز السنبلة<\/title>/);
  assert.equal(attr(html, 'property="og:title"'), 'مخبز السنبلة');
  assert.equal(attr(html, 'name="description"'), 'عيش وحلويات طازة كل يوم، من فرننا لبيتك.');
  assert.equal(attr(html, 'property="og:description"'), 'عيش وحلويات طازة كل يوم، من فرننا لبيتك.');
  assert.equal(attr(html, 'property="og:url"'), 'https://makhbaz-elsonbola-site.pages.dev/');
});

test('the meta and link-preview descriptions always equal the tagline', () => {
  const html = home({ ...bakery, tagline: 'جملة تانية خالص.' });
  assert.equal(attr(html, 'name="description"'), 'جملة تانية خالص.');
  assert.equal(attr(html, 'property="og:description"'), 'جملة تانية خالص.');
});

test('the call link dials the phone number shown on the page', () => {
  const tel = html => html.match(/href="tel:([^"]+)"/)[1];
  assert.equal(tel(home(bakery)), '+201000000000');
  assert.equal(tel(home({ ...bakery, phone: '0111 222 3333' })), '+201112223333');
  assert.equal(tel(home({ ...bakery, phone: '01551234567' })), '+201551234567');
});

test('the product cards\' stagger counts up from 0 in product order', () => {
  const stagger = productCards(home(bakery)).map(card => card.match(/style="--i:(\d+)"/)[1]);
  assert.deepEqual(stagger, ['0', '1', '2', '3', '4', '5']);
});

test('the message form uses the Business\'s Turnstile site key', () => {
  assert.match(home(bakery), /class="cf-turnstile" data-sitekey="0x4AAAAAAFm2mFH3_zmq5k6W"/);
  assert.match(home({ ...bakery, turnstileSiteKey: '0xOTHER' }), /data-sitekey="0xOTHER"/);
});

test('Business text with <, & and quotes comes out as literal text', () => {
  const tricky = 'كيك <b>"شوكو" & \'فانيليا\'</b>';
  const html = home({ ...bakery, name: tricky, products: [{ ...bakery.products[0], name: tricky }] });
  assert.ok(!html.includes('<b>'), 'raw markup leaked into the page');
  const escaped = 'كيك &lt;b&gt;&quot;شوكو&quot; &amp; &#39;فانيليا&#39;&lt;/b&gt;';
  assert.ok(productCards(html)[0].includes(`<span class="name">${escaped}<span class="unit">`));
  assert.equal(attr(html, 'property="og:title"'), escaped);
});
