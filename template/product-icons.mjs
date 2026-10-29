// أيقونات المنتجات المرسومة بالإيد. "icon" في كل منتج بملف المحل بيختار واحدة منهم بالاسم.
// الرسمة مكتوبة مرة واحدة هنا، والـ renderer بيحط في sprite الصفحة الرئيسية الأيقونات اللي المنتجات بتستعملها بس.
//   markup: خطوط الرسمة. pathLength="1" لحركة الرسم، والتعبئة الهادية style="fill:var(--brand-soft)".
//   أيقونة ممكن تترسم فوق أيقونة تانية بـ <use href="#i-..."/>، وساعتها التانية بتتحط معاها.

export const PRODUCT_ICON_DRAWINGS = {
  fino: {
    viewBox: '0 0 48 48',
    markup: `      <path pathLength="1" style="fill:var(--brand-soft)" d="M6.5 30.5 C5.6 22.2 14 16.6 24.4 16.8 C34.6 17 42.8 22.4 41.4 30.6 C40.4 35.4 33 36.4 24 36.2 C14.6 36 7.4 35.4 6.5 30.5Z"/>
      <path pathLength="1" d="M14.6 22.4 L19.2 30.6"/>
      <path pathLength="1" d="M21.8 21.2 L26.4 30.2"/>
      <path pathLength="1" d="M29.2 21.8 L33.4 29.4"/>`,
  },
  baladi: {
    viewBox: '0 0 48 48',
    markup: `      <path pathLength="1" style="fill:var(--brand-soft)" d="M7.6 26.4 C7.8 17.2 15.8 12.2 24.2 12.6 C33.4 13 40.6 18.4 40.4 26.6 C40.2 34.6 32 38.4 23.8 38.2 C14.8 38 7.4 34.2 7.6 26.4Z"/>
      <path pathLength="1" d="M13.8 24.6 C16.2 19.6 21.6 17.6 27.4 18.8"/>
      <path pathLength="1" d="M19.6 28.6 h0.6"/>
      <path pathLength="1" d="M26.8 30.8 h0.6"/>
      <path pathLength="1" d="M31.2 24.2 h0.6"/>
      <path pathLength="1" d="M22.6 33.6 h0.6"/>`,
  },
  croissant: {
    viewBox: '0 0 48 48',
    markup: `      <path pathLength="1" style="fill:var(--brand-soft)" d="M5.8 30.4 C7.8 20.4 15.6 14 24 14 C32.6 14 40.4 20.2 42.4 30.2 C38.4 28.2 35.2 29.2 33.2 32.4 C30.2 27.4 27.2 26.2 24 26.2 C20.8 26.2 17.8 27.4 14.8 32.2 C12.8 29 9.8 28.4 5.8 30.4Z"/>
      <path pathLength="1" d="M17.6 16.4 C19.2 20.2 20.2 23.2 20.8 26.4"/>
      <path pathLength="1" d="M30.4 16.2 C28.8 20 27.8 23.2 27.2 26.4"/>`,
  },
  'croissant-choc': {
    viewBox: '0 0 48 48',
    markup: `      <use href="#i-croissant"/>
      <path pathLength="1" style="stroke:var(--brand-accent-dark)" d="M11.6 23.4 L15.8 19.6 L19.8 23.8 L24.6 18.6 L28.8 23 L33.4 19.4 L37.2 23.2"/>`,
  },
  basbousa: {
    viewBox: '0 0 48 48',
    markup: `      <path pathLength="1" style="fill:var(--brand-soft)" d="M6.6 15.4 L41.2 13.2 L42 35 L6 36.2Z"/>
      <path pathLength="1" d="M6.4 24.8 L20.8 14.4"/>
      <path pathLength="1" d="M6.4 35.6 L35.4 13.6"/>
      <path pathLength="1" d="M21.6 35.6 L41.6 22.4"/>
      <path pathLength="1" d="M13.6 15 L41.6 33.6"/>
      <path pathLength="1" d="M6.4 21.6 L28 35.4"/>
      <path pathLength="1" d="M23.4 24.6 h0.6"/>`,
  },
  cake: {
    viewBox: '0 0 48 48',
    markup: `      <path pathLength="1" style="fill:var(--brand-soft)" d="M8 38.4 L40.2 38 L39.2 26.8 L9 27.2Z"/>
      <path pathLength="1" style="fill:var(--brand-soft)" d="M14.4 27 L33.8 26.8 L33 19 L15.2 19.2Z"/>
      <path pathLength="1" d="M9 30.4 C12 32.4 14.2 29 17.2 31 C20.2 33 22.2 29 25.2 31 C28.2 33 31 29 34 31 C36.2 32.4 38 30.4 39.4 30.2"/>
      <path pathLength="1" d="M24.2 19 L24 12.2"/>
      <path pathLength="1" style="stroke:var(--brand-accent-dark)" d="M24 10.2 C22.2 8.2 22.8 5.4 24.2 4 C25.8 5.8 26 8.4 24 10.2Z"/>`,
  },
};

// الأيقونات اللي أيقونة بترسم فوقها (<use href="#i-...">)
const drawnOn = icon => [...PRODUCT_ICON_DRAWINGS[icon].markup.matchAll(/<use href="#i-([\w-]+)"/g)].map(m => m[1]);

// الـ symbols بتاعة الأيقونات دي واللي بترسم فوقها، كل واحدة مرة، بترتيب PRODUCT_ICON_DRAWINGS.
// أول سطر من غير مسافات لأن القالب حاططه في مكانه
export const productSymbols = icons => {
  const needed = new Set();
  const add = icon => { if (!needed.has(icon)) { needed.add(icon); drawnOn(icon).forEach(add); } };
  icons.forEach(add);
  return Object.keys(PRODUCT_ICON_DRAWINGS)
    .filter(icon => needed.has(icon))
    .map(icon => {
      const { viewBox, markup } = PRODUCT_ICON_DRAWINGS[icon];
      return `<symbol id="i-${icon}" viewBox="${viewBox}">\n${markup}\n    </symbol>`;
    })
    .join('\n\n    ');
};
