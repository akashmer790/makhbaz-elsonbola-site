// ملف المحل الغلط ما يوصلش للزباين: الـ renderer بيرفضه قبل ما يبني، برسالة فيها اسم الخانة.
// تشغيل: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, BusinessFileError } from '../template/render.mjs';

const bakery = JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8'));

test('the bakery\'s real Business file passes validation', () => {
  assert.doesNotThrow(() => render(bakery));
});

test('a missing or empty required field fails the build, naming the field', () => {
  for (const field of ['name', 'tagline', 'about', 'siteUrl', 'phone']) {
    const { [field]: _, ...missing } = bakery;
    assert.throws(() => render(missing), new RegExp(`"${field}"`), `missing ${field}`);
    assert.throws(() => render({ ...bakery, [field]: '   ' }), new RegExp(`"${field}"`), `empty ${field}`);
  }
});

test('the products section needs at least one product while it is on', () => {
  assert.throws(() => render({ ...bakery, products: [] }), /"products"/);
  const { products: _, ...noProducts } = bakery;
  assert.throws(() => render(noProducts), /"products"/);
  assert.throws(() => render({ ...bakery, sections: { ...bakery.sections, products: true }, products: [] }), /"products"/);
  assert.doesNotThrow(() => render({ ...bakery, sections: { ...bakery.sections, products: false }, products: [] }));
});

test('a phone that isn\'t an Egyptian mobile number fails the build, naming the field', () => {
  for (const phone of ['0130 000 0000', '0100 000 000', '0100 000 00000', '+20 100 000 0000', '0100-abc-0000']) {
    assert.throws(() => render({ ...bakery, phone }), /"phone"/, phone);
  }
  for (const phone of ['01000000000', '0111 222 3333', '0122 333 4444', '01551234567']) {
    assert.doesNotThrow(() => render({ ...bakery, phone }), phone);
  }
});

test('a product icon outside the Template\'s icon set fails the build, naming the product', () => {
  const products = bakery.products.map(p => p.name === 'بسبوسة' ? { ...p, icon: 'skull' } : p);
  assert.throws(() => render({ ...bakery, products }), err => /"icon"/.test(err.message) && /بسبوسة/.test(err.message) && /skull/.test(err.message));
  const noIcon = bakery.products.map((p, i) => i === 0 ? { ...p, icon: undefined } : p);
  assert.throws(() => render({ ...bakery, products: noIcon }), /عيش فينو/);
});

// ألوان هوية المخبز (زي brand.css اللي كان في template/static قبل ما يتبني من ملف المحل)
const bakeryColors = {
  bg: '#fbf5ea', surface: '#ffffff', ink: '#2b2118', muted: '#6b5d50', accent: '#b8692b',
  'accent-dark': '#8f4e1c', soft: '#f3dfc1', line: '#eadcc8', field: '#9c8670',
};
const withColors = colors => ({ ...bakery, brand: { ...bakery.brand, colors: { ...bakeryColors, ...colors } } });
const withBrand = brand => ({ ...bakery, brand: { ...bakery.brand, ...brand } });

test('a Business file without a Brand fails the build, naming the field', () => {
  const { brand: _, ...noBrand } = bakery;
  assert.throws(() => render(noBrand), /"brand"/);
});

test('a missing Brand color fails the build, naming the color', () => {
  for (const token of Object.keys(bakeryColors)) {
    const { [token]: _, ...colors } = bakeryColors;
    assert.throws(() => render({ ...bakery, brand: { ...bakery.brand, colors } }), new RegExp(`"brand.colors.${token}"`), token);
  }
  assert.throws(() => render(withBrand({ colors: undefined })), /"brand.colors"/);
});

test('a Brand color the Template doesn\'t use fails the build, naming it', () => {
  assert.throws(() => render(withColors({ acent: '#b8692b' })), /"brand.colors.acent"/);
});

test('a font outside the Template\'s supported set fails the build, naming the field and the choices', () => {
  for (const font of ['Comic Sans MS', '', undefined, 'tajawal']) {
    assert.throws(() => render(withBrand({ font })), err => /"brand.font"/.test(err.message) && /Tajawal/.test(err.message) && /Cairo/.test(err.message), String(font));
  }
});

test('a logo outside the Template\'s logo set fails the build, naming the field', () => {
  for (const logo of ['skull', '', undefined, 'fino']) {
    assert.throws(() => render(withBrand({ logo })), err => /"brand.logo"/.test(err.message) && /wheat/.test(err.message), String(logo));
  }
});

test('the bakery\'s current Brand colors pass validation, in long or short hex', () => {
  assert.doesNotThrow(() => render(withColors({})));
  assert.doesNotThrow(() => render(withColors({ surface: '#FFF' })));
});

test('a color that isn\'t a valid hex color fails the build, naming the field', () => {
  for (const [token, value] of [['accent', 'b8692b'], ['ink', '#2b211'], ['soft', '#f3dfcg'], ['line', 'brown'], ['accent-dark', '']]) {
    assert.throws(() => render(withColors({ [token]: value })), new RegExp(`"brand.colors.${token}"`), `${token}: ${value}`);
  }
});

test('a form field border under 3:1 contrast with the page background fails the build, naming the field', () => {
  // #b7a796 على #fbf5ea تباينه حوالي 2.2:1
  assert.throws(() => render(withColors({ field: '#b7a796' })), /"brand.colors.field"/);
  assert.throws(() => render(withColors({ bg: '#9c8670' })), /"brand.colors.field"/);
  assert.doesNotThrow(() => render(withColors({ field: '#000', bg: '#fff' })));
});

test('a product missing its name, unit or price fails the build, naming the field and the product', () => {
  for (const field of ['name', 'unit', 'price']) {
    for (const value of [undefined, '  ', 15]) {
      const products = bakery.products.map(p => p.name === 'بسبوسة' ? { ...p, [field]: value } : p);
      assert.throws(() => render({ ...bakery, products }), err => err instanceof BusinessFileError
        && new RegExp(`"${field}"`).test(err.message) && /المنتج رقم 5/.test(err.message), `${field}: ${value}`);
    }
  }
  // المنتج اللي ليه اسم بيتذكر باسمه كمان
  const products = bakery.products.map(p => p.name === 'بسبوسة' ? { ...p, price: '' } : p);
  assert.throws(() => render({ ...bakery, products }), /بسبوسة/);
});

test('the hours section needs its rows while it is on, each with days, from and to', () => {
  const { hours: _, ...noHours } = bakery;
  for (const hours of [undefined, [], 'كل يوم', [null], [{ days: 'الجمعة', from: '2 الضهر' }], [{ days: ' ', from: '2', to: '3' }]]) {
    assert.throws(() => render({ ...noHours, ...(hours === undefined ? {} : { hours }) }), err => err instanceof BusinessFileError && /"hours/.test(err.message), JSON.stringify(hours));
  }
  assert.doesNotThrow(() => render({ ...noHours, sections: { ...bakery.sections, hours: false } }));
});

test('the notes section needs at least one non-empty note while it is on', () => {
  const { notes: _, ...noNotes } = bakery;
  for (const notes of [undefined, [], 'ملاحظة', ['  '], [5]]) {
    assert.throws(() => render({ ...noNotes, ...(notes === undefined ? {} : { notes }) }), err => err instanceof BusinessFileError && /"notes/.test(err.message), JSON.stringify(notes));
  }
  assert.doesNotThrow(() => render({ ...noNotes, sections: { ...bakery.sections, notes: false } }));
});

test('the contact section needs an address and delivery terms while it is on', () => {
  for (const field of ['address', 'delivery']) {
    const { [field]: _, ...missing } = bakery;
    assert.throws(() => render(missing), err => err instanceof BusinessFileError && new RegExp(`"${field}"`).test(err.message), `missing ${field}`);
    assert.throws(() => render({ ...bakery, [field]: ' ' }), new RegExp(`"${field}"`), `empty ${field}`);
    assert.doesNotThrow(() => render({ ...missing, sections: { ...bakery.sections, contact: false } }), field);
  }
});

test('a product that isn\'t an object fails the build, naming its position', () => {
  for (const bad of [null, 'عيش فينو']) {
    assert.throws(() => render({ ...bakery, products: [bakery.products[0], bad] }), /المنتج رقم 2/, String(bad));
  }
});
