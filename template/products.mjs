// قواعد منتجات المحل اللي صفحة الأدمن بتعدّلها (functions/api/admin/products.js)، والـ renderer بيتأكد بيها من ملف المحل.
// الأيقونات هي المرسومة في template/product-icons.mjs.

import { PRODUCT_ICON_DRAWINGS } from './product-icons.mjs';

export const PRODUCT_ICONS = Object.keys(PRODUCT_ICON_DRAWINGS);

export const MAX_PRODUCTS = 40;
// أطول نص مسموح في كل خانة من خانات المنتج
export const PRODUCT_LIMITS = { name: 60, unit: 40, price: 40, note: 120 };

// بيرجّع { ok: true, products } بالحقول المعروفة بس ومن غير مسافات زيادة،
// أو { ok: false, field } باسم الخانة الغلط عشان صفحة الأدمن تقول للمستخدم يصلّح إيه
export function validateProducts(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_PRODUCTS) {
    return { ok: false, field: 'products' };
  }
  const products = [];
  for (const [i, raw] of input.entries()) {
    const where = `product ${i + 1}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, field: where };

    const product = {};
    for (const key of ['name', 'unit', 'price', 'note']) {
      const value = raw[key];
      if (key === 'note' && (value === undefined || value === null)) continue;
      if (typeof value !== 'string') return { ok: false, field: `${where}: ${key}` };
      const trimmed = value.trim();
      if (key === 'note' && !trimmed) continue;
      if (!trimmed || trimmed.length > PRODUCT_LIMITS[key]) return { ok: false, field: `${where}: ${key}` };
      product[key] = trimmed;
    }
    if (!PRODUCT_ICONS.includes(raw.icon)) return { ok: false, field: `${where}: icon` };
    product.icon = raw.icon;
    products.push(product);
  }
  return { ok: true, products };
}
