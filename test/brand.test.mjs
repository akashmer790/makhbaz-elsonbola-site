// هوية المحل (الألوان والخط واللوجو) جاية من ملف المحل: الـ renderer بيطلّع منها brand.css و favicon.svg وصفحة 404.
// الـ tests بتشوف الملفات الناتجة بس. تشغيل: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../template/render.mjs';

const bakery = JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8'));

// قيمة كل متغير في brand.css: { 'bg': '#fbf5ea', 'font': '"Tajawal", ...' }
const cssVars = css => Object.fromEntries([...css.matchAll(/--brand-([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

test('the bakery\'s brand stylesheet carries today\'s colors and font', () => {
  assert.deepEqual(cssVars(render(bakery)['brand.css']), {
    font: '"Tajawal", "Segoe UI", Tahoma, Arial, sans-serif',
    bg: '#fbf5ea',
    surface: '#ffffff',
    ink: '#2b2118',
    muted: '#6b5d50',
    accent: '#b8692b',
    'accent-dark': '#8f4e1c',
    soft: '#f3dfc1',
    line: '#eadcc8',
    field: '#9c8670',
  });
});

// الرسمة بتاعة favicon.svg النهارده (سنبلة اللوجو)، حرف بحرف
const wheatPaths = [
  'M20.5 62 C20 50 21.5 34 19.5 9',
  'M19.5 9.5 C17 6.5 17.6 2.6 20 0.8 C22.3 2.8 22.6 6.4 19.5 9.5Z',
  'M19.4 19 C13.6 18.4 10.4 13.4 11.2 8 C16.4 8.8 19.6 12.6 19.4 19Z',
  'M20.2 18.6 C26 17.6 29 12.8 28 7.6 C22.8 8.6 19.9 12.4 20.2 18.6Z',
  'M19.8 29.4 C13.8 28.8 10.6 23.6 11.4 18.2 C16.8 19 20 23 19.8 29.4Z',
  'M20.6 29 C26.6 28 29.6 23 28.6 17.8 C23.2 18.8 20.3 22.8 20.6 29Z',
  'M20 39.6 C14 39 10.9 33.8 11.7 28.6 C17 29.4 20.2 33.2 20 39.6Z',
  'M20.8 39.2 C26.8 38.2 29.8 33.2 28.8 28 C23.4 29 20.5 33 20.8 39.2Z',
  'M20.6 50 C25.6 46.2 30.4 46.8 34 42.6',
];
const paths = svg => [...svg.matchAll(/<path d="([^"]+)"\/>/g)].map(m => m[1]);

test('the bakery\'s favicon is today\'s wheat, in the accent and soft colors', () => {
  const svg = render(bakery)['favicon.svg'];
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="-12 -2 64 68">/);
  assert.match(svg, /<g fill="none" stroke="#b8692b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">/);
  assert.match(svg, /<g fill="#f3dfc1">/);
  assert.deepEqual(paths(svg), wheatPaths);
  // الورق بس اللي جوه التعبئة الهادية، مش العود ولا الديل
  const leaves = svg.slice(svg.indexOf('<g fill="#f3dfc1">'), svg.indexOf('</g>'));
  assert.deepEqual(paths(leaves), wheatPaths.slice(1, 8));
});

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const body = html => html.slice(html.indexOf('<body>'));

test('the bakery\'s 404 page says what today\'s says, with the brand stylesheet and no indexing', () => {
  const page = render(bakery)['404.html'];
  assert.match(page, /<html lang="ar" dir="rtl">/);
  assert.match(page, /<title>الصفحة مش موجودة · مخبز السنبلة<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.match(page, /<link rel="stylesheet" href="\/brand.css">/);
  assert.equal(text(body(page)), 'الصفحة دي مش موجودة يمكن اللينك اتغيّر أو فيه حرف غلط. ارجع لصفحة مخبز السنبلة');
  assert.match(page, /<a href="\/">ارجع لصفحة مخبز السنبلة<\/a>/);
  for (const rule of ['background: var(--brand-bg)', 'color: var(--brand-ink)', 'font-family: var(--brand-font)',
    'color: var(--brand-accent-dark)', 'color: var(--brand-muted)', 'background: var(--brand-accent-dark)']) {
    assert.ok(page.includes(rule), `missing style: ${rule}`);
  }
});

// محل تاني باسم وألوان تانية
const shop = {
  ...bakery,
  name: 'فول الأمانة',
  brand: {
    ...bakery.brand,
    colors: {
      bg: '#f4f8f1', surface: '#fefefe', ink: '#1d2a1a', muted: '#4f5d4b', accent: '#2f7d32',
      'accent-dark': '#1e5a22', soft: '#d6ead2', line: '#cfdcca', field: '#6f826a',
    },
  },
};

test('a Business with another name and colors shows them on the home page, the 404 page and the favicon', () => {
  const site = render(shop);
  assert.match(site['index.html'], /<h1 class="brand-name">فول الأمانة<\/h1>/);
  assert.match(site['index.html'], /<meta name="theme-color" content="#f4f8f1">/);
  assert.match(site['404.html'], /<title>الصفحة مش موجودة · فول الأمانة<\/title>/);
  assert.match(site['404.html'], /<a href="\/">ارجع لصفحة فول الأمانة<\/a>/);
  assert.match(site['favicon.svg'], /stroke="#2f7d32"/);
  assert.match(site['favicon.svg'], /<g fill="#d6ead2">/);
  assert.equal(cssVars(site['brand.css']).accent, '#2f7d32');
  for (const [path, content] of Object.entries(site)) {
    assert.ok(!content.includes('مخبز السنبلة'), `${path} still shows the bakery's name`);
    for (const old of ['#fbf5ea', '#b8692b', '#f3dfc1']) assert.ok(!content.includes(old), `${path} still has the bakery's ${old}`);
  }
});

const fontLinks = html => [...html.matchAll(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)">/g)].map(m => m[1]);
const pages = site => Object.entries(site).filter(([path]) => path.endsWith('.html'));

test('the bakery\'s pages all load Tajawal from Google Fonts', () => {
  const site = render(bakery);
  assert.deepEqual(pages(site).map(([path]) => path).sort(), ['404.html', 'account.html', 'admin.html', 'index.html', 'login.html']);
  for (const [path, html] of pages(site)) {
    assert.deepEqual(fontLinks(html), ['https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap'], path);
  }
});

test('every page shows the Brand\'s favicon in the tab', () => {
  for (const [path, html] of pages(render(bakery))) {
    assert.match(html, /<link rel="icon" href="\/favicon.svg" type="image\/svg\+xml">/, path);
  }
});

test('choosing another supported font changes the font link and the font family on every page', () => {
  const site = render({ ...bakery, brand: { ...bakery.brand, font: 'IBM Plex Sans Arabic' } });
  for (const [path, html] of pages(site)) {
    assert.deepEqual(fontLinks(html), ['https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap'], path);
    assert.ok(html.includes('<link rel="stylesheet" href="/brand.css">') || html.includes('<link rel="stylesheet" href="brand.css">'), `${path} doesn't use the brand stylesheet`);
  }
  assert.equal(cssVars(site['brand.css']).font, '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif');
  assert.equal(cssVars(render({ ...bakery, brand: { ...bakery.brand, font: 'Cairo' } })['brand.css']).font, '"Cairo", "Segoe UI", Tahoma, Arial, sans-serif');
});

test('every page\'s stylesheets come only from the site or Google Fonts, as the security headers allow', () => {
  const headers = readFileSync(new URL('../template/static/_headers', import.meta.url), 'utf8');
  for (const csp of headers.match(/Content-Security-Policy: .*/g)) {
    assert.match(csp, /style-src 'self'[^;]* https:\/\/fonts.googleapis.com/);
    assert.match(csp, /font-src https:\/\/fonts.gstatic.com/);
  }
  for (const font of ['Tajawal', 'Cairo', 'Almarai', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic']) {
    for (const [path, html] of pages(render({ ...bakery, brand: { ...bakery.brand, font } }))) {
      for (const [, href] of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)) {
        assert.ok(/^\/?[\w-]+\.css$/.test(href) || href.startsWith('https://fonts.googleapis.com/css2?'), `${path} (${font}): ${href}`);
      }
    }
  }
});

test('every color token in the Business file appears in the generated stylesheet', () => {
  for (const business of [bakery, shop]) {
    const vars = cssVars(render(business)['brand.css']);
    for (const [token, value] of Object.entries(business.brand.colors)) assert.equal(vars[token], value, token);
  }
});
