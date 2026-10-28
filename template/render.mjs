// الـ renderer: بياخد المحل (ملف المحل بعد ما يتقرا) ويرجّع ملفات الموقع كـ { 'مسار': 'محتوى' }.
// ما بيقراش وما بيكتبش أي ملف وقت الشغل؛ القالب نفسه (home.html) بيتقرا مرة واحدة لما الموديول يتحمّل.
// البناء الفعلي (قراية ملف المحل وكتابة dist/) في scripts/build.mjs

import { readFileSync } from 'node:fs';

const homeTemplate = readFileSync(new URL('./home.html', import.meta.url), 'utf8');

const escape = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// --i هو ترتيب الكارت، وبيحدد تأخير ظهوره (كل كارت بيظهر بعد اللي قبله بشوية)
const productCard = (p, i) => `        <li class="product" data-reveal style="--i:${i}">
          <svg class="icon" aria-hidden="true"><use href="#i-${escape(p.icon)}"/></svg>
          <span class="name">${escape(p.name)}<span class="unit">${escape(p.unit)}</span></span>
          <span class="price">${escape(p.price)}</span>${p.note ? `
          <p class="note">${escape(p.note)}</p>` : ''}
        </li>`;

const hoursRow = h => `          <tr><td>${escape(h.days)}</td><td>${escape(h.from)}</td><td>${escape(h.to)}</td></tr>`;

// لينك الاتصال من الرقم الظاهر نفسه، عشان الاتنين ما يختلفوش: "0100 000 0000" ← "+201000000000"
const telLink = phone => '+20' + String(phone).replace(/\D/g, '').replace(/^0/, '');

const noteItem = n => `        <li>${escape(n)}</li>`;

// تنبيه البيانات الخيالية بيفضل تعليق في الصفحة، مش نص ظاهر. "--" ممنوعة جوه تعليق HTML
const disclaimerComment = disclaimer => disclaimer ? `    <!-- ${escape(disclaimer).replace(/--/g, '- -')} -->\n` : '';

export function render(business) {
  const slots = {
    name: escape(business.name),
    tagline: escape(business.tagline),
    about: escape(business.about),
    products: business.products.map(productCard).join('\n'),
    hours: business.hours.map(hoursRow).join('\n'),
    address: escape(business.address),
    phone: escape(business.phone),
    tel: escape(telLink(business.phone)),
    delivery: escape(business.delivery),
    notes: business.notes.map(noteItem).join('\n'),
    siteUrl: escape(business.siteUrl),
    turnstileSiteKey: escape(business.turnstileSiteKey),
    disclaimer: disclaimerComment(business.disclaimer),
  };
  // function مش string في replace، عشان $& و $1 في نص المحل ما يتفهموش كأوامر.
  // slot مكتوب غلط في القالب يوقّف البناء، بدل ما الصفحة تعرض "undefined"
  const html = homeTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in slots)) throw new Error(`القالب فيه {{${key}}} والـ renderer ما يعرفوش`);
    return slots[key];
  });
  return { 'index.html': html };
}
