import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCT_ICONS, validateProducts } from '../template/products.mjs';
import { render } from '../template/render.mjs';

const fino = { name: 'عيش فينو', unit: '5 أرغفة', price: '15 جنيه', icon: 'fino' };

test('every product icon offered to the admin is drawn on the home page of a product that uses it', () => {
  const bakery = JSON.parse(readFileSync(new URL('../business.json', import.meta.url), 'utf8'));
  for (const icon of PRODUCT_ICONS) {
    const html = render({ ...bakery, products: [{ ...fino, icon }] })['index.html'];
    assert.match(html, new RegExp(`<symbol id="i-${icon}"`), icon);
    assert.match(html, new RegExp(`<use href="#i-${icon}"/>`), icon);
  }
});

test('a valid product list comes back trimmed, with only the known fields', () => {
  const result = validateProducts([
    { ...fino, name: '  عيش فينو  ', extra: 'x' },
    { name: 'تورتة', unit: 'حسب الطلب', price: 'من 450 جنيه', note: 'بالحجز قبلها بيومين', icon: 'cake' },
  ]);
  assert.deepEqual(result, {
    ok: true,
    products: [
      fino,
      { name: 'تورتة', unit: 'حسب الطلب', price: 'من 450 جنيه', note: 'بالحجز قبلها بيومين', icon: 'cake' },
    ],
  });
});

test('an empty note is dropped instead of kept as an empty line', () => {
  assert.deepEqual(validateProducts([{ ...fino, note: '  ' }]).products, [fino]);
});

test('bad product lists are rejected with the product number and field', () => {
  const cases = [
    [[], 'products'],
    ['not a list', 'products'],
    [Array(41).fill(fino), 'products'],
    [[{ ...fino, name: '' }], 'product 1: name'],
    [[fino, { ...fino, price: '   ' }], 'product 2: price'],
    [[{ ...fino, unit: 'x'.repeat(41) }], 'product 1: unit'],
    [[{ ...fino, icon: 'skull' }], 'product 1: icon'],
    [[{ ...fino, note: 'x'.repeat(121) }], 'product 1: note'],
    [[{ ...fino, name: 42 }], 'product 1: name'],
    [[null], 'product 1'],
  ];
  for (const [input, field] of cases) {
    const result = validateProducts(input);
    assert.equal(result.ok, false, JSON.stringify(input).slice(0, 60));
    assert.equal(result.field, field);
  }
});
