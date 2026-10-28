// GET /api/auth/callback — Supabase بيرجّع الزبون هنا بعد جوجل ومعاه ?code=
// بنبدّل الكود بجلسة (بالـ verifier اللي في الكوكي)، ونحفظها في cookies، ونفتح صفحة حسابه.
// أي فشل يرجّع /login?error=1 من غير ما نعرض أي نص جاي من برة.

import { redirect, getCookie, clearCookie } from '../../../lib/http.js';
import { PKCE, exchangeToken, sessionCookies } from '../../../lib/session.js';

export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get('code');
  const verifier = getCookie(request, PKCE);
  const failed = () => redirect('/login?error=1', [clearCookie(PKCE)]);
  if (!code || !verifier) return failed();

  const { session } = await exchangeToken(env, 'pkce', { auth_code: code, code_verifier: verifier });
  if (!session) return failed();

  // مكان ثابت بعد الدخول (من غير ?next=)، عشان اللينك ما يتستعملش يودّي الناس لموقع تاني
  return redirect('/account', [...sessionCookies(session), clearCookie(PKCE)]);
}
