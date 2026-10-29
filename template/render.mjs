// الـ renderer: بياخد المحل (ملف المحل بعد ما يتقرا) ويرجّع ملفات الموقع كـ { 'مسار': 'محتوى' }.
// قبل ما يبني بيتأكد إن ملف المحل سليم، ولو فيه غلطة بيرمي BusinessFileError فيها اسم الخانة.
// بيطلّع: الصفحة الرئيسية وصفحة 404 وصفحات الدخول والحساب والأدمن، و brand.css و favicon.svg من "brand".
// ما بيقراش وما بيكتبش أي ملف وقت الشغل؛ ملفات القالب (home.html وأخواتها) بتتقرا مرة واحدة لما الموديول يتحمّل.
// البناء الفعلي (قراية ملف المحل وكتابة dist/) في scripts/build.mjs

import { readFileSync } from 'node:fs';
import { PRODUCT_ICONS, PRODUCT_LIMITS, MAX_PRODUCTS, validateProducts } from './products.mjs';
import { productSymbols } from './product-icons.mjs';
import { LOGOS, logoSymbol, logoFavicon } from './logos.mjs';

const templateFile = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const homeTemplate = templateFile('home.html');
const brandTemplate = templateFile('brand.css');
const notFoundTemplate = templateFile('404.html');
// صفحات الدخول والحساب والأدمن ثابتة لكل محل، غير رابط الخط
const accountPages = Object.fromEntries(['login.html', 'account.html', 'admin.html'].map(name => [name, templateFile(name)]));

// الخطوط العربي اللي القالب بيدعمها، كلها من Google Fonts بس عشان الـ CSP في template/static/_headers.
// الاسم هو اللي بيتكتب في "brand.font"، والقيمة هي الـ family في رابط Google Fonts
export const FONTS = {
  'Tajawal': 'Tajawal:wght@400;700',
  'Cairo': 'Cairo:wght@400;700',
  'Almarai': 'Almarai:wght@400;700',
  'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic:wght@400;700',
  'Noto Kufi Arabic': 'Noto+Kufi+Arabic:wght@400;700',
};
const fontUrl = font => `https://fonts.googleapis.com/css2?family=${FONTS[font]}&display=swap`;
const fontFamily = font => `"${font}", "Segoe UI", Tahoma, Arial, sans-serif`;

// ألوان هوية المحل اللي القالب بيستعملها، بالترتيب اللي في brand.css
export const COLOR_TOKENS = ['bg', 'surface', 'ink', 'muted', 'accent', 'accent-dark', 'soft', 'line', 'field'];

// بيحط قيم الـ slots مكان {{key}}. function مش string في replace، عشان $& و $1 في نص المحل ما يتفهموش كأوامر.
// slot مكتوب غلط في القالب يوقّف البناء، بدل ما الصفحة تعرض "undefined". الـ slot ممكن يبقى قيمة أو function بتتحسب لما تتطلب
const fill = (template, slots) => template.replace(/\{\{([\w-]+)\}\}/g, (_, key) => {
  if (!(key in slots)) throw new Error(`القالب فيه {{${key}}} والـ renderer ما يعرفوش`);
  return typeof slots[key] === 'function' ? slots[key]() : slots[key];
});

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

// الأقسام الاختيارية في القالب، وكل واحد ليه مفتاح في "sections" بملف المحل
const SECTIONS = ['products', 'hours', 'contact', 'message', 'notes'];

// الخانات النصية المطلوبة. اللي ليها قسم بتظهر فيه بس، فمطلوبة طول ما القسم ده شغال
// (التليفون كمان: لو قسم العنوان والتواصل مقفول، الصفحة ما فيهاش تليفون خالص)
const REQUIRED_TEXT = {
  name: null, tagline: null, about: null, siteUrl: null,
  phone: 'contact', address: 'contact', delivery: 'contact',
};

const isText = value => typeof value === 'string' && value.trim() !== '';

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

// خانة فيها مفتاح لكل اسم من "keys" ومفيش غيرهم: مفتاح مش معروف غالباً غلطة في الاسم،
// وكل مفتاح معروف لازم يتكتب وقيمته تعدّي isValid
function requireEachKey(object, field, { keys, missing, unknown, isValid, expected }) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) fail(`الخانة "${field}" ${missing}`);
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) fail(`الخانة "${field}.${key}" ${unknown}: ${keys.join(', ')}`);
  }
  for (const key of keys) {
    const value = object[key];
    if (!isValid(value)) fail(`الخانة "${field}.${key}" لازم تبقى ${expected}، مش ${value === undefined ? 'فاضية' : JSON.stringify(value)}`);
  }
}

// منتجات المحل بنفس قواعد صفحة الأدمن (validateProducts)، والرسالة فيها رقم المنتج واسمه والخانة
function validateProductList(products) {
  const result = validateProducts(products);
  if (result.ok) return;
  if (result.field === 'products') {
    fail(`الخانة "products" لازم يبقى فيها من 1 لـ ${MAX_PRODUCTS} منتج طول ما قسم المنتجات شغال`);
  }
  const [, number, key] = result.field.match(/^product (\d+)(?:: (\w+))?$/);
  const product = products[number - 1];
  const which = `المنتج رقم ${number}${isText(product?.name) ? ` ("${product.name}")` : ''}`;
  if (!key) fail(`${which} لازم يبقى فيه name و unit و price و icon`);
  if (key === 'icon') {
    fail(`${which}: الخانة "icon" فيها "${product.icon}"، والأيقونات الموجودة في القالب: ${PRODUCT_ICONS.join(', ')}`);
  }
  fail(`${which}: الخانة "${key}" لازم تبقى نص مش فاضي ومش أطول من ${PRODUCT_LIMITS[key]} حرف`);
}

// قايمة مش فاضية، وكل عنصر فيها بيعدّي check (اللي بيرجّع وصف الغلطة، أو لا حاجة لو سليم)
function requireList(list, field, [what, one], check) {
  if (!Array.isArray(list) || list.length === 0) fail(`الخانة "${field}" لازم يبقى فيها ${what} ${one} على الأقل طول ما القسم بتاعها شغال`);
  for (const [i, item] of list.entries()) {
    const problem = check(item);
    if (problem) fail(`الخانة "${field}"، ${what} رقم ${i + 1}: ${problem}`);
  }
}

const HOURS_KEYS = ['days', 'from', 'to'];
const hoursRowProblem = row => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return `لازم يبقى فيه ${HOURS_KEYS.join(' و ')}`;
  const key = HOURS_KEYS.find(k => !isText(row[k]));
  return key && `الخانة "${key}" ناقصة أو فاضية`;
};

function validate(business) {
  // كل قسم اختياري لازم مفتاحه يتكتب صريح: true (شغال) أو false (مقفول)، عشان القسم ما يتقفلش أو يتفتح بالغلط
  requireEachKey(business.sections, 'sections', {
    keys: SECTIONS,
    missing: `لازم تبقى فيها مفتاح لكل قسم (${SECTIONS.join(', ')})، كل واحد true أو false`,
    unknown: 'مش قسم في القالب؛ الأقسام الموجودة',
    isValid: value => value === true || value === false,
    expected: 'true (شغال) أو false (مقفول)',
  });
  const on = business.sections;
  for (const [field, section] of Object.entries(REQUIRED_TEXT)) {
    if ((section === null || on[section]) && !isText(business[field])) fail(`الخانة "${field}" ناقصة أو فاضية`);
  }
  // موبايل مصري: 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015، والمسافات بين الأرقام مسموحة
  if (on.contact && !/^01[0125]\d{8}$/.test(business.phone.replace(/\s/g, ''))) {
    fail(`الخانة "phone" لازم تبقى موبايل مصري (11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015)، مش "${business.phone}"`);
  }
  if (on.products) validateProductList(business.products);
  if (on.hours) requireList(business.hours, 'hours', ['سطر', 'واحد'], hoursRowProblem);
  if (on.notes) requireList(business.notes, 'notes', ['ملاحظة', 'واحدة'], note => !isText(note) && 'لازم تبقى نص مش فاضي');
  // هوية المحل: كل لون من ألوان القالب موجود وhex، ومفيش لون القالب ما بيستعملوش (غالباً غلطة في الاسم)
  const { brand } = business;
  if (!brand || typeof brand !== 'object') fail('الخانة "brand" (ألوان المحل وخطه ولوجو) ناقصة');
  const { colors } = brand;
  requireEachKey(colors, 'brand.colors', {
    keys: COLOR_TOKENS,
    missing: `ناقصة، ولازم يبقى فيها: ${COLOR_TOKENS.join(', ')}`,
    unknown: 'القالب ما بيستعملهاش؛ الألوان المعروفة',
    isValid: value => typeof value === 'string' && HEX_COLOR.test(value),
    expected: 'لون hex زي #b8692b',
  });
  // حدود خانات الفورم لازم تبان على خلفية الصفحة (تباين 3:1 على الأقل)
  const fieldContrast = contrast(colors.field, colors.bg);
  if (fieldContrast < 3) {
    // بنقرّب لتحت، عشان 2.996 ما تطلعش "3.00:1" في رسالة بتقول إنها أقل من 3
    fail(`الخانة "brand.colors.field" تباينها مع "brand.colors.bg" ${Math.floor(fieldContrast * 100) / 100}:1، ولازم يبقى 3:1 على الأقل`);
  }
  // Object.hasOwn عشان "toString" وأخواتها ما يعدّوش كخط أو لوجو
  if (!Object.hasOwn(FONTS, brand.font)) {
    fail(`الخانة "brand.font" فيها "${brand.font}"، والخطوط اللي القالب بيدعمها: ${Object.keys(FONTS).join(', ')}`);
  }
  if (!Object.hasOwn(LOGOS, brand.logo)) {
    fail(`الخانة "brand.logo" فيها "${brand.logo}"، واللوجوهات الموجودة في القالب: ${Object.keys(LOGOS).join(', ')}`);
  }
}

// الأقسام الاختيارية؛ كل واحد في القالب محطوط بين {{#قسم}} و {{/قسم}}، كل علامة في سطر لوحدها.
// القسم الشغال بيفضل من غير العلامتين، والمقفول بيتشال كله ومعاه السطر الفاضي اللي بعده.
// قسم ممكن يبقى ليه أكتر من بلوك: أيقوناته في الـ sprite أول الصفحة، والقسم نفسه، وقسم الفورم (message) كمان سكريبت
// Turnstile وسكريبت الفورم آخر الصفحة. {{#anySection}} للحاجات المشتركة بين الأقسام (الـ squiggle تحت كل عنوان).
const SECTION_BLOCK = /^\{\{#(\w+)\}\}\r?\n[\s\S]*?^\{\{\/\1\}\}\r?\n(?:\r?\n)?/gm;
const SECTION_MARK = /^\{\{[#/]\w+\}\}\r?\n/gm;
const keepSections = (template, sections) => {
  const shown = { ...sections, anySection: SECTIONS.some(id => sections[id]) };
  return template.replace(SECTION_BLOCK, (block, id) => {
    if (!Object.hasOwn(shown, id)) throw new Error(`القالب فيه قسم {{#${id}}} والـ renderer ما يعرفوش`);
    return shown[id] ? block.replace(SECTION_MARK, '') : '';
  });
};

export function render(business) {
  validate(business);
  // قيم الهوية اتأكدنا منها في validate (hex، خط من FONTS، لوجو من LOGOS)، فمش محتاجة escape
  const { colors, font, logo } = business.brand;
  // رابط الخط هو الحاجة الوحيدة من الهوية اللي في كل الصفحات
  const pageSlots = { fontUrl: fontUrl(font) };
  const brandSlots = {
    ...pageSlots,
    bg: colors.bg,
    logo,
    logoSymbol: logoSymbol(logo),
  };
  // كل slot بيتحسب بس لو اتطلب، عشان قسم مقفول ممكن ما يبقاش ليه بيانات في ملف المحل خالص
  const slots = {
    name: () => escape(business.name),
    tagline: () => escape(business.tagline),
    about: () => escape(business.about),
    products: () => business.products.map(productCard).join('\n'),
    productSymbols: () => productSymbols(business.products.map(p => p.icon)),
    hours: () => business.hours.map(hoursRow).join('\n'),
    address: () => escape(business.address),
    phone: () => escape(business.phone),
    tel: () => escape(telLink(business.phone)),
    delivery: () => escape(business.delivery),
    notes: () => business.notes.map(noteItem).join('\n'),
    siteUrl: () => escape(business.siteUrl),
    turnstileSiteKey: () => escape(business.turnstileSiteKey),
    disclaimer: () => disclaimerComment(business.disclaimer),
    ...brandSlots,
  };
  return {
    'index.html': fill(keepSections(homeTemplate, business.sections), slots),
    'brand.css': fill(brandTemplate, { ...colors, fontFamily: fontFamily(font) }),
    'favicon.svg': logoFavicon(logo, colors),
    '404.html': fill(notFoundTemplate, { ...pageSlots, name: slots.name }),
    ...Object.fromEntries(Object.entries(accountPages).map(([name, page]) => [name, fill(page, pageSlots)])),
  };
}
