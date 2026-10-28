// جلسة الدخول: Supabase Auth بحساب جوجل، والتوكنات في cookies نوعها HttpOnly (الجافاسكريبت في الصفحة ما يشوفهاش).
// المتغيرات في إعدادات Cloudflare Pages:
//   SUPABASE_URL               رابط المشروع
//   SUPABASE_PUBLISHABLE_KEY   المفتاح العام (sb_publishable_...)، مش سر

import { getCookie, cookie, clearCookie } from './http.js';

export const ACCESS = '__Host-sb-access';
export const REFRESH = '__Host-sb-refresh';
export const PKCE = '__Host-sb-pkce';

// التوكن نفسه بيخلص بعد ساعة، والكوكي بتفضل 30 يوم عشان نقدر نجدّده من غير ما الزبون يدخل تاني
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

const authHeaders = (env, token) => ({
  apikey: env.SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const sessionCookies = ({ access_token, refresh_token }) => [
  cookie(ACCESS, access_token, SESSION_MAX_AGE),
  cookie(REFRESH, refresh_token, SESSION_MAX_AGE),
];

export const clearSessionCookies = () => [clearCookie(ACCESS), clearCookie(REFRESH)];

// Supabase بيقول إن التوكن نفسه باطل (مش مجرد مشغول)
const rejected = status => status === 400 || status === 401 || status === 403;

// بيرجّع { user } أو { invalid: true } أو { busy: true }.
// busy (429 أو 5xx أو مفيش اتصال) معناها عطل مؤقت: ما نمسحش الجلسة بسببه.
async function fetchUser(env, token) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders(env, token) });
    if (res.ok) return { user: await res.json() };
    return rejected(res.status) ? { invalid: true } : { busy: true };
  } catch (err) {
    console.error('Supabase user check error', err);
    return { busy: true };
  }
}

// بيرجّع { session } أو { invalid: true } أو { busy: true }، زي fetchUser
export async function exchangeToken(env, grantType, body) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    });
    if (!res.ok) return rejected(res.status) ? { invalid: true } : { busy: true };
    const session = await res.json();
    return session?.access_token && session?.refresh_token ? { session } : { invalid: true };
  } catch (err) {
    console.error('Supabase token error', err);
    return { busy: true };
  }
}

// بيرجّع { user, cookies }: user = null لو مش داخل. cookies لازم تتضاف للرد
// (توكنات جديدة بعد التجديد، أو مسح جلسة ماتت).
// المستخدم بيتجاب من Supabase نفسه في كل طلب، فالتوكن ما بيتصدّقش من غير ما Supabase يأكّده.
// الجلسة بتتمسح بس لما Supabase يقول إنها باطلة؛ لو مشغول أو واقع، الزبون يفضل داخل ويجرّب كمان شوية.
export async function getSession(request, env) {
  const access = getCookie(request, ACCESS);
  const refresh = getCookie(request, REFRESH);
  const none = { user: null, cookies: [] };
  if (!access && !refresh) return none;

  if (access) {
    const checked = await fetchUser(env, access);
    if (checked.user) return { user: checked.user, cookies: [] };
    if (checked.busy) return none;
  }
  if (!refresh) return { user: null, cookies: clearSessionCookies() };

  const renewed = await exchangeToken(env, 'refresh_token', { refresh_token: refresh });
  if (renewed.busy) return none;
  if (renewed.invalid) return { user: null, cookies: clearSessionCookies() };
  // Supabase بيبدّل الـ refresh token مع كل تجديد، فالجديد لازم يتحفظ حتى لو حصل عطل بعدها.
  // رد التجديد فيه المستخدم من Supabase نفسه، فمش محتاجين نسأل تاني
  const cookies = sessionCookies(renewed.session);
  if (renewed.session.user) return { user: renewed.session.user, cookies };
  const checked = await fetchUser(env, renewed.session.access_token);
  return { user: checked.user ?? null, cookies };
}

// الأدمن بيتحدد من app_metadata بس، لأن user_metadata المستخدم يقدر يعدّلها بنفسه.
// app_metadata بتتغيّر من SQL Editor في Supabase (supabase/make-admin.sql)
export const isAdmin = user => user?.app_metadata?.role === 'admin';

export const displayName = user => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';

// بيقفل الجلسة عند Supabase (الـ refresh token ما يتجدّدش تاني). لو التوكن خلص، بنجدّده الأول،
// وإلا Supabase هيرفض الخروج والـ refresh token يفضل شغال لو حد سرقه
export async function signOut(env, accessToken, refreshToken) {
  const logout = async token => {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: authHeaders(env, token) });
      return res.status;
    } catch (err) {
      console.error('Supabase logout error', err);
      return 0;
    }
  };
  const status = accessToken ? await logout(accessToken) : 401;
  if (status !== 401 || !refreshToken) return;
  const renewed = await exchangeToken(env, 'refresh_token', { refresh_token: refreshToken });
  if (renewed.session) await logout(renewed.session.access_token);
}
