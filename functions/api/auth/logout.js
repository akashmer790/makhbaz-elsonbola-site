// POST /api/auth/logout — بيقفل الجلسة عند Supabase ويمسح الـ cookies.
// POST مش GET، عشان صورة أو لينك في موقع تاني ما يقدرش يخرّج الزبون.

import { reply, fail, sameOrigin, getCookie } from '../../../lib/http.js';
import { ACCESS, REFRESH, clearSessionCookies, signOut } from '../../../lib/session.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return fail(403, 'bad_origin');
  await signOut(env, getCookie(request, ACCESS), getCookie(request, REFRESH));
  return reply(200, { ok: true }, clearSessionCookies());
}
