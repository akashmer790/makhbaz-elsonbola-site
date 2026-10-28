// GET /api/auth/login — بيودّي الزبون لجوجل عن طريق Supabase.
// PKCE: الـ verifier بيتحفظ في كوكي HttpOnly، والـ challenge بتاعه بيروح لـ Supabase. لما يرجع،
// الكود ما ينفعش يتبدّل بجلسة غير بنفس الـ verifier، فكود متسرّق أو مبعوت من حد تاني ما ينفعش.

import { redirect, cookie } from '../../../lib/http.js';
import { PKCE } from '../../../lib/session.js';

const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function onRequestGet({ request, env }) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

  const to = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
  to.searchParams.set('provider', 'google');
  to.searchParams.set('redirect_to', `${new URL(request.url).origin}/api/auth/callback`);
  to.searchParams.set('code_challenge', challenge);
  to.searchParams.set('code_challenge_method', 's256');

  // 10 دقايق كفاية يخلص فيهم الدخول بجوجل
  return redirect(to.toString(), [cookie(PKCE, verifier, 600)]);
}
