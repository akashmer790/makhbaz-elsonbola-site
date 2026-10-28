#!/usr/bin/env node
// Compares the bakery facts in bakery-facts.md with what public/index.html shows.
// Usage: node check-consistency.mjs [project-root]
// Prints a JSON report and exits 1 if anything differs, 0 if everything matches.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();
const factsPath = join(root, 'bakery-facts.md');
// الصفحات في public/ (هو بس اللي Cloudflare بينشره)
const htmlPath = join(root, 'public', 'index.html');

if (!existsSync(factsPath) || !existsSync(htmlPath)) {
  console.log(JSON.stringify({ ok: false, error: 'missing file', factsExists: existsSync(factsPath), htmlExists: existsSync(htmlPath) }, null, 2));
  process.exit(2);
}

const facts = readFileSync(factsPath, 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');

const clean = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// "(عنوان خيالي)" style remarks in the facts file are notes for us, not page content
const dropRemark = s => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

// --- facts.md helpers ---
function section(md, heading) {
  const re = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm');
  const m = md.match(re);
  return m ? m[1] : '';
}
function tableRows(text) {
  return text.split('\n')
    .filter(l => l.trim().startsWith('|'))
    .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
    .filter(cells => !cells.every(c => /^-+$/.test(c)))
    .slice(1); // drop header row
}
function bullets(text) {
  return text.split('\n').filter(l => /^\s*-\s+/.test(l)).map(l => l.replace(/^\s*-\s+/, '').trim());
}
function labeled(list, label) {
  const item = list.find(b => b.startsWith(label + ':'));
  return item ? item.slice(label.length + 1).trim() : null;
}

// --- html helpers ---
function htmlSection(id) {
  const m = html.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  return m ? m[1] : '';
}

const problems = [];
const check = (what, factsValue, pageValue) => {
  if (factsValue !== pageValue) problems.push({ what, facts: factsValue, page: pageValue });
};

// Products
const factProducts = tableRows(section(facts, 'المنتجات والأسعار')).map(([name, unit, price]) => ({ name, unit, price }));
const pageProducts = [...htmlSection('products').matchAll(/<li class="product"[^>]*>([\s\S]*?)<\/li>/g)].map(m => {
  const li = m[1];
  // the product icon (<svg>) sits before the name and has no text, so it doesn't affect any of these
  const unit = clean(li.match(/<span class="unit">([\s\S]*?)<\/span>/)?.[1] ?? '');
  const nameRaw = li.match(/<span class="name">([\s\S]*?)<span class="unit">/)?.[1] ?? '';
  const price = clean(li.match(/<span class="price">([\s\S]*?)<\/span>/)?.[1] ?? '');
  const note = clean(li.match(/<p class="note">([\s\S]*?)<\/p>/)?.[1] ?? '');
  // the facts table keeps price and booking note in one cell: "من 450 جنيه، بالحجز قبلها بيومين"
  return { name: clean(nameRaw), unit, price: note ? `${price}، ${note}` : price };
});
const pageByName = new Map(pageProducts.map(p => [p.name, p]));
for (const f of factProducts) {
  const p = pageByName.get(f.name);
  if (!p) { problems.push({ what: `product missing on page: ${f.name}`, facts: f, page: null }); continue; }
  check(`unit of ${f.name}`, f.unit, p.unit);
  check(`price of ${f.name}`, f.price, p.price);
}
for (const p of pageProducts) {
  if (!factProducts.some(f => f.name === p.name)) problems.push({ what: `product on page but not in facts: ${p.name}`, facts: null, page: p });
}
check('product order', factProducts.map(p => p.name).join(' / '), pageProducts.map(p => p.name).join(' / '));

// Hours
const factHours = tableRows(section(facts, 'المواعيد')).map(r => r.join(' | '));
const pageHours = [...htmlSection('hours').matchAll(/<tr>\s*<td>([\s\S]*?)<\/tr>/g)]
  .map(m => [...('<td>' + m[1]).matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => clean(c[1])).join(' | '));
check('opening hours', factHours.join(' || '), pageHours.join(' || '));

// Address, phone, delivery
const contact = bullets(section(facts, 'العنوان والتواصل'));
const pageInfo = [...htmlSection('contact').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => clean(m[1]));
const pageLabeled = label => {
  const item = pageInfo.find(i => i.startsWith(label + ':'));
  return item ? item.slice(label.length + 1).trim() : null;
};
check('address', dropRemark(labeled(contact, 'العنوان') ?? ''), pageLabeled('العنوان'));
const factPhone = dropRemark(labeled(contact, 'الموبايل') ?? '');
check('phone (shown)', factPhone, pageLabeled('الموبايل'));
const telHref = htmlSection('contact').match(/href="tel:([^"]+)"/)?.[1] ?? null;
const expectedTel = '+2' + factPhone.replace(/\s+/g, '');
check('phone (tel: link)', expectedTel, telHref);
const delivery = contact.find(b => b.startsWith('بنوصّل')) ?? null;
check('delivery', delivery, pageLabeled('التوصيل'));

// "What we don't have" notes
const factNotes = bullets(section(facts, 'اللي مش عندنا'));
const pageNotes = [...htmlSection('notes').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => clean(m[1]));
check('notes', factNotes.join(' / '), pageNotes.join(' / '));

// Tagline and about text
const tagline = facts.match(/جملة التعريف: «([^»]+)»/)?.[1] ?? null;
check('tagline', tagline, clean(html.match(/<p class="tagline">([\s\S]*?)<\/p>/)?.[1] ?? ''));
check('meta description', tagline, html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? null);
// the page already shows the name in the <h1>, so its about line starts after "مخبز السنبلة، "
const businessName = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
const aboutLine = section(facts, 'مين إحنا').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('جملة التعريف'))[0] ?? null;
const about = aboutLine && businessName ? aboutLine.replace(new RegExp(`^${businessName}،\\s*`), '') : aboutLine;
check('about', about, clean(html.match(/<p class="about">([\s\S]*?)<\/p>/)?.[1] ?? ''));

console.log(JSON.stringify({ ok: problems.length === 0, checked: { products: factProducts.length, hours: factHours.length, notes: factNotes.length }, problems }, null, 2));
process.exit(problems.length ? 1 : 0);
