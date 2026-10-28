// بيشتغل قبل أي لينك تحت /api/admin. مكان واحد للصلاحية، عشان أي endpoint أدمن جديد يبقى محمي
// من غير ما حد يفتكر يضيف الفحص بنفسه.
//   مش داخل ← 401، داخل ومش أدمن ← 403، طلب بيغيّر حاجة من موقع تاني ← 403

import { fail, sameOrigin } from '../../../lib/http.js';
import { getSession, isAdmin } from '../../../lib/session.js';

export async function onRequest({ request, env, data, next }) {
  if (request.method !== 'GET' && !sameOrigin(request)) return fail(403, 'bad_origin');

  const { user, cookies } = await getSession(request, env);
  if (!user) return fail(401, 'signed_out', cookies);
  if (!isAdmin(user)) return fail(403, 'not_admin', cookies);

  data.user = user;
  const res = await next();
  // نسخة من الرد عشان نقدر نضيف هيدرز (الرد الأصلي ممكن يكون headers بتاعته مقفولة)
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  for (const c of cookies) out.headers.append('Set-Cookie', c);
  return out;
}
