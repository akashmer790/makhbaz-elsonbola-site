// /api/admin/products — المنتجات والأسعار من صفحة الأدمن (الصلاحية في _middleware.js).
//   GET                    ← المنتجات زي ما هي في business.json على GitHub، ومعاها sha النسخة
//   PUT { products, sha }  ← commit لـ business.json فيه المنتجات بس اتغيّرت
// ملف المحل يفضل هو المصدر الوحيد: الـ commit على main بيخلّي Cloudflare Pages يبني الموقع من جديد
// والتعديل يظهر خلال دقيقة أو اتنين، و git history بيفضل سجل لكل تعديل.
//
// المتغيرات في إعدادات Pages، في بيئة Production بس (عشان التعديل من preview ما يتنشرش على الموقع الحقيقي):
//   GITHUB_TOKEN   (secret) fine-grained token على الريبو ده بس، بصلاحية Contents: Read and write
//   GITHUB_REPO    akashmer790/makhbaz-elsonbola-site
//   GITHUB_BRANCH  main
// لو أي واحد فيهم مش موجود، التعديل بيفضل مقفول (503).

import { reply, fail, readJson } from '../../../lib/http.js';
import { PRODUCT_ICONS, validateProducts } from '../../../template/products.mjs';

const configured = env => Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO && env.GITHUB_BRANCH);

function github(env, init = {}) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/business.json`;
  return fetch(init.method === 'PUT' ? url : `${url}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub بيرفض أي طلب من غير User-Agent
      'User-Agent': 'bakery-site-admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

// base64 بتاع GitHub على bytes الملف، والملف فيه عربي، فلازم UTF-8 مش atob/btoa على النص مباشرة
const decode = base64 => new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, '')), c => c.charCodeAt(0)));
function encode(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function loadBusinessFile(env) {
  try {
    const res = await github(env);
    if (!res.ok) {
      console.error('GitHub load failed', res.status, await res.text());
      return null;
    }
    const file = await res.json();
    return { sha: file.sha, business: JSON.parse(decode(file.content)) };
  } catch (err) {
    console.error('GitHub load error', err);
    return null;
  }
}

export async function onRequestGet({ env }) {
  if (!configured(env)) return fail(503, 'editing_disabled');
  const file = await loadBusinessFile(env);
  if (!file) return fail(502, 'load_failed');
  return reply(200, { ok: true, products: file.business.products, sha: file.sha, icons: PRODUCT_ICONS });
}

export async function onRequestPut({ request, env }) {
  if (!configured(env)) return fail(503, 'editing_disabled');
  const body = await readJson(request);
  if (!body || typeof body.sha !== 'string' || !body.sha) return fail(400, 'bad_request');
  const checked = validateProducts(body.products);
  if (!checked.ok) return reply(400, { ok: false, error: 'bad_product', field: checked.field });

  const file = await loadBusinessFile(env);
  if (!file) return fail(502, 'load_failed');
  // حد تاني (أو تبويب تاني) عدّل بعد ما الصفحة اتفتحت: نوقف بدل ما نمسح تعديله
  if (file.sha !== body.sha) return fail(409, 'conflict');

  const business = { ...file.business, products: checked.products };
  let res;
  try {
    res = await github(env, {
      method: 'PUT',
      body: JSON.stringify({
        // الريبو public: من غير إيميل أو اسم الأدمن في رسالة الـ commit
        message: 'Update products from the admin page',
        content: encode(JSON.stringify(business, null, 2) + '\n'),
        sha: file.sha,
        branch: env.GITHUB_BRANCH,
      }),
    });
  } catch (err) {
    console.error('GitHub save error', err);
    return fail(502, 'save_failed');
  }
  // 409 أو 422 من GitHub معناها إن الملف اتغيّر بين القراية والحفظ
  if (res.status === 409 || res.status === 422) return fail(409, 'conflict');
  if (!res.ok) {
    console.error('GitHub save failed', res.status, await res.text());
    return fail(502, 'save_failed');
  }
  const saved = await res.json();
  return reply(200, { ok: true, sha: saved.content.sha });
}
