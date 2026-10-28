// GET /api/health — أنهي متغيرات Cloudflare Pages ناقصة في النسخة دي (production أو preview).
// بيرجّع الأسماء بس، من غير أي قيمة. اتعمل عشان preview من غير مفاتيح Supabase كان بيرجّع 500 من غير ما يقول ليه.
// المتغيرات الجديدة ما بتشتغلش غير بعد نشر جديد، فافحصه بعد كل deploy.

import { reply } from '../../lib/http.js';

// كل خاصية والمتغيرات اللي محتاجاها. GITHUB_* على الـ production بس (docs/accounts-setup.md خطوة 5)
export const NEEDS = {
  form: ['TURNSTILE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'],
  accounts: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'],
  products: ['GITHUB_TOKEN', 'GITHUB_REPO', 'GITHUB_BRANCH'],
};

export function onRequestGet({ env }) {
  const missing = Object.fromEntries(Object.entries(NEEDS).map(([feature, names]) => [feature, names.filter(n => !env[n])]));
  return reply(200, { ok: Object.values(missing).every(m => !m.length), missing });
}
