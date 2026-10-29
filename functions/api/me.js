// GET /api/me — مين الداخل دلوقتي؟ صفحات الحساب والأدمن بتسأل هنا عشان تعرف تعرض إيه.

import { reply } from '../../lib/http.js';
import { getSession, isAdmin, displayName } from '../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const { user, cookies } = await getSession(request, env);
  if (!user) return reply(200, { signedIn: false }, cookies);
  return reply(200, { signedIn: true, name: displayName(user), email: user.email ?? '', isAdmin: isAdmin(user) }, cookies);
}
