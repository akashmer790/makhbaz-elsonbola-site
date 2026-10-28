// الـ renderer: بياخد المحل (ملف المحل بعد ما يتقرا) ويرجّع ملفات الموقع كـ { 'مسار': 'محتوى' }.
// قبل ما يبني بيتأكد إن ملف المحل سليم، ولو فيه غلطة بيرمي BusinessFileError فيها اسم الخانة.
// ما بيقراش وما بيكتبش أي ملف وقت الشغل؛ القالب نفسه (home.html) بيتقرا مرة واحدة لما الموديول يتحمّل.
// البناء الفعلي (قراية ملف المحل وكتابة dist/) في scripts/build.mjs

import { readFileSync } from 'node:fs';
import { PRODUCT_ICONS } from './products.mjs';

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

// ملف المحل الغلط بيوقّف البناء قبل ما يوصل للزباين، والرسالة فيها اسم الخانة اللي تتصلّح
export class BusinessFileError extends Error {}
const fail = message => { throw new BusinessFileError(`ملف المحل (business.json) فيه غلطة: ${message}`); };

const REQUIRED_TEXT = ['name', 'tagline', 'about', 'siteUrl', 'phone'];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// نسبة التباين بتاعة WCAG بين لونين hex (من 1 لـ 21)
const luminance = hex => {
  const digits = hex.slice(1).length === 3 ? [...hex.slice(1)].map(d => d + d).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(digits.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function validate(business) {
  for (const field of REQUIRED_TEXT) {
    const value = business[field];
    if (typeof value !== 'string' || !value.trim()) fail(`الخانة "${field}" ناقصة أو فاضية`);
  }
  // موبايل مصري: 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015، والمسافات بين الأرقام مسموحة
  if (!/^01[0125]\d{8}$/.test(business.phone.replace(/\s/g, ''))) {
    fail(`الخانة "phone" لازم تبقى موبايل مصري (11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015)، مش "${business.phone}"`);
  }
  // مفاتيح الأقسام لسه جاية؛ لحد ما تيجي، قسم من غير مفتاح يعتبر شغال
  const productsOn = business.sections?.products !== false;
  if (productsOn && (!Array.isArray(business.products) || business.products.length === 0)) {
    fail('الخانة "products" لازم يبقى فيها منتج واحد على الأقل طول ما قسم المنتجات شغال');
  }
  // هوية المحل لسه مش في ملف المحل؛ لما تيجي، كل لون لازم يبقى hex
  const colors = business.brand?.colors ?? {};
  for (const [token, value] of Object.entries(colors)) {
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
      fail(`الخانة "brand.colors.${token}" لازم تبقى لون hex زي #b8692b، مش "${value}"`);
    }
  }
  // حدود خانات الفورم لازم تبان على خلفية الصفحة (تباين 3:1 على الأقل)
  const fieldContrast = colors.field && colors.bg ? contrast(colors.field, colors.bg) : Infinity;
  if (fieldContrast < 3) {
    // بنقرّب لتحت، عشان 2.996 ما تطلعش "3.00:1" في رسالة بتقول إنها أقل من 3
    fail(`الخانة "brand.colors.field" تباينها مع "brand.colors.bg" ${Math.floor(fieldContrast * 100) / 100}:1، ولازم يبقى 3:1 على الأقل`);
  }
  for (const [i, product] of (business.products ?? []).entries()) {
    if (!product || typeof product !== 'object') fail(`المنتج رقم ${i + 1} لازم يبقى فيه name و unit و price و icon`);
    if (!PRODUCT_ICONS.includes(product.icon)) {
      fail(`المنتج "${product.name}": الخانة "icon" فيها "${product.icon}"، والأيقونات الموجودة في القالب: ${PRODUCT_ICONS.join(', ')}`);
    }
  }
}

export function render(business) {
  validate(business);
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
