// لوجوهات القالب المرسومة بالإيد. "brand.logo" في ملف المحل بيختار واحد منهم بالاسم.
// الرسمة مكتوبة مرة واحدة هنا: الـ renderer بيحطها symbol في sprite الصفحة الرئيسية (اللوجو اللي بيترسم)
// وبيعمل منها favicon.svg بألوان المحل.
//   viewBox: مقاس الرسمة في الصفحة؛ faviconViewBox: مربّع حواليها عشان الأيقونة ما تتمطّش في التاب.
//   markup: خطوط الرسمة. pathLength="1" لحركة الرسم، والتعبئة الهادية style="fill:var(--brand-soft)".

export const LOGOS = {
  wheat: {
    viewBox: '0 0 40 64',
    faviconViewBox: '-12 -2 64 68',
    markup: `      <path pathLength="1" d="M20.5 62 C20 50 21.5 34 19.5 9"/>
      <g style="fill:var(--brand-soft)">
        <path pathLength="1" d="M19.5 9.5 C17 6.5 17.6 2.6 20 0.8 C22.3 2.8 22.6 6.4 19.5 9.5Z"/>
        <path pathLength="1" d="M19.4 19 C13.6 18.4 10.4 13.4 11.2 8 C16.4 8.8 19.6 12.6 19.4 19Z"/>
        <path pathLength="1" d="M20.2 18.6 C26 17.6 29 12.8 28 7.6 C22.8 8.6 19.9 12.4 20.2 18.6Z"/>
        <path pathLength="1" d="M19.8 29.4 C13.8 28.8 10.6 23.6 11.4 18.2 C16.8 19 20 23 19.8 29.4Z"/>
        <path pathLength="1" d="M20.6 29 C26.6 28 29.6 23 28.6 17.8 C23.2 18.8 20.3 22.8 20.6 29Z"/>
        <path pathLength="1" d="M20 39.6 C14 39 10.9 33.8 11.7 28.6 C17 29.4 20.2 33.2 20 39.6Z"/>
        <path pathLength="1" d="M20.8 39.2 C26.8 38.2 29.8 33.2 28.8 28 C23.4 29 20.5 33 20.8 39.2Z"/>
      </g>
      <path pathLength="1" d="M20.6 50 C25.6 46.2 30.4 46.8 34 42.6"/>`,
  },
};

// الـ symbol اللي بيتحط في sprite الصفحة الرئيسية
export const logoSymbol = name => {
  const { viewBox, markup } = LOGOS[name];
  return `    <symbol id="i-${name}" viewBox="${viewBox}">\n${markup}\n    </symbol>`;
};

// favicon.svg: نفس الرسمة بألوان ثابتة، لأن الأيقونة ما بتقراش brand.css
export const logoFavicon = (name, { accent, soft }) => {
  const { faviconViewBox, markup } = LOGOS[name];
  const body = markup
    .replace(/ pathLength="1"/g, '')
    .replace(/ style="fill:var\(--brand-soft\)"/g, ` fill="${soft}"`)
    .replace(/^  /gm, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${faviconViewBox}">
  <!-- لوجو المحل (i-${name} في الصفحة الرئيسية). الـ renderer بيبنيه من ملف المحل:
       الخط = brand.colors.accent، والتعبئة = brand.colors.soft -->
  <g fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
${body}
  </g>
</svg>
`;
};
