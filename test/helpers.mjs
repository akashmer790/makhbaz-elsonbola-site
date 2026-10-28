// أدوات مشتركة لـ tests الـ API: Supabase و GitHub بيتعملوا fake على حدود النظام بس (fetch)،
// والـ handlers نفسها بتتنده زي ما Cloudflare Pages بينده عليها.

export const ORIGIN = 'https://makhbaz-elsonbola-site.pages.dev';

export const env = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

export const customer = { id: '11111111-1111-4111-8111-111111111111', email: 'zabon@example.com', user_metadata: { full_name: 'زبون تجربة' }, app_metadata: { provider: 'google' } };
export const admin = { id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.com', user_metadata: { full_name: 'صاحب المحل' }, app_metadata: { provider: 'google', role: 'admin' } };

// fetch مزيّف: routes بترجّع Response أو undefined (يعني 404)، وكل نداء بيتسجّل في calls
export function fakeFetch(route) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body };
    calls.push(call);
    return (await route(call)) ?? new Response('{}', { status: 404 });
  };
  return { fetch, calls };
}

export const json = (body, status = 200) => Response.json(body, { status });

// Supabase Auth مزيّف: توكن صالح لكل مستخدم، والباقي 401
export function supabaseAuth(users = { 'token-customer': customer, 'token-admin': admin }) {
  return call => {
    if (call.url === `${env.SUPABASE_URL}/auth/v1/user`) {
      const user = users[call.headers.get('Authorization')?.replace('Bearer ', '')];
      return user ? json(user) : json({ msg: 'invalid JWT' }, 401);
    }
  };
}

export async function withFetch(fake, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

export function request(path, { method = 'GET', cookies = {}, body, origin = ORIGIN, headers = {} } = {}) {
  const h = new Headers(headers);
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) h.set('Cookie', cookie);
  if (origin && method !== 'GET') h.set('Origin', origin);
  if (body !== undefined) h.set('Content-Type', 'application/json');
  return new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const signedIn = token => ({ '__Host-sb-access': token, '__Host-sb-refresh': 'refresh-' + token });

// Set-Cookie كـ { اسم: { value, attrs } }
export function setCookies(res) {
  return Object.fromEntries(res.headers.getSetCookie().map(line => {
    const [pair, ...attrs] = line.split(/;\s*/);
    const i = pair.indexOf('=');
    return [pair.slice(0, i), { value: pair.slice(i + 1), attrs: attrs.map(a => a.toLowerCase()) }];
  }));
}

// بيشغّل handler بنفس الـ context اللي Pages بيدّيه
export const call = (handler, req, extra = {}) =>
  handler({ request: req, env: { ...env, ...extra.env }, params: extra.params ?? {}, data: extra.data ?? {}, waitUntil() {}, next: extra.next });
