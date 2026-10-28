import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestGet as login } from '../functions/api/auth/login.js';
import { onRequestGet as callback } from '../functions/api/auth/callback.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as me } from '../functions/api/me.js';
import { ORIGIN, env, customer, fakeFetch, json, supabaseAuth, withFetch, request, signedIn, setCookies, call } from './helpers.mjs';

const SESSION_ATTRS = ['path=/', 'httponly', 'secure', 'samesite=lax'];
const hasAttrs = (cookie, attrs) => attrs.every(a => cookie.attrs.includes(a));

test('login sends the Customer to Google through Supabase, bound to a PKCE verifier cookie', async () => {
  const res = await call(login, request('/api/auth/login'));
  assert.equal(res.status, 302);
  const to = new URL(res.headers.get('Location'));
  assert.equal(to.origin + to.pathname, `${env.SUPABASE_URL}/auth/v1/authorize`);
  assert.equal(to.searchParams.get('provider'), 'google');
  assert.equal(to.searchParams.get('redirect_to'), `${ORIGIN}/api/auth/callback`);
  assert.equal(to.searchParams.get('code_challenge_method'), 's256');

  const pkce = setCookies(res)['__Host-sb-pkce'];
  assert.ok(hasAttrs(pkce, SESSION_ATTRS), pkce.attrs.join(';'));
  assert.ok(pkce.value.length >= 43, 'verifier too short for PKCE');
  // RFC 7636: challenge = BASE64URL(SHA256(verifier))
  assert.equal(to.searchParams.get('code_challenge'), createHash('sha256').update(pkce.value).digest('base64url'));
});

test('two logins get different PKCE verifiers', async () => {
  const a = setCookies(await call(login, request('/api/auth/login')))['__Host-sb-pkce'].value;
  const b = setCookies(await call(login, request('/api/auth/login')))['__Host-sb-pkce'].value;
  assert.notEqual(a, b);
});

test('the callback trades the code for a session in HttpOnly cookies and opens the account page', async () => {
  const fake = fakeFetch(call => {
    if (call.url === `${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`) {
      const body = JSON.parse(call.body);
      if (body.auth_code === 'good-code' && body.code_verifier === 'my-verifier') {
        return json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: customer });
      }
      return json({ error: 'invalid_grant' }, 400);
    }
  });
  const res = await withFetch(fake, () => call(callback, request('/api/auth/callback?code=good-code', { cookies: { '__Host-sb-pkce': 'my-verifier' } })));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), '/account');
  const cookies = setCookies(res);
  assert.equal(cookies['__Host-sb-access'].value, 'new-access');
  assert.equal(cookies['__Host-sb-refresh'].value, 'new-refresh');
  assert.ok(hasAttrs(cookies['__Host-sb-access'], SESSION_ATTRS));
  assert.ok(hasAttrs(cookies['__Host-sb-refresh'], SESSION_ATTRS));
  assert.ok(cookies['__Host-sb-pkce'].attrs.includes('max-age=0'), 'the one-time verifier must be cleared');
  assert.equal(fake.calls[0].headers.get('apikey'), env.SUPABASE_PUBLISHABLE_KEY);
});

test('the callback refuses to sign in without the verifier cookie, after an error, or with a bad code', async () => {
  const fake = fakeFetch(() => json({ error: 'invalid_grant' }, 400));
  const cases = [
    request('/api/auth/callback?code=good-code'),
    request('/api/auth/callback?error=access_denied&error_description=<script>', { cookies: { '__Host-sb-pkce': 'v' } }),
    request('/api/auth/callback?code=stolen-code', { cookies: { '__Host-sb-pkce': 'other-verifier' } }),
  ];
  for (const req of cases) {
    const res = await withFetch(fake, () => call(callback, req));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/login?error=1', 'no Supabase text is reflected back');
    const cookies = setCookies(res);
    assert.ok(!cookies['__Host-sb-access']?.value, 'no session for a failed sign-in');
  }
});

test('me says who is signed in, and only app_metadata can make someone an admin', async () => {
  const fake = fakeFetch(supabaseAuth({
    'token-customer': customer,
    'token-admin': { ...customer, app_metadata: { role: 'admin' } },
    // user_metadata يقدر المستخدم نفسه يعدّلها، فما ينفعش تدّيه صلاحية
    'token-sneaky': { ...customer, user_metadata: { role: 'admin', full_name: 'x' } },
  }));
  const ask = async token => (await withFetch(fake, () => call(me, request('/api/me', { cookies: token ? signedIn(token) : {} })))).json();
  assert.deepEqual(await ask(), { signedIn: false });
  assert.deepEqual(await ask('token-customer'), { signedIn: true, name: 'زبون تجربة', email: 'zabon@example.com', isAdmin: false });
  assert.equal((await ask('token-admin')).isAdmin, true);
  assert.equal((await ask('token-sneaky')).isAdmin, false);
});

test('an expired access token is refreshed once and the new tokens are stored', async () => {
  const fake = fakeFetch(call => {
    if (call.url === `${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`) {
      return JSON.parse(call.body).refresh_token === 'refresh-ok'
        ? json({ access_token: 'token-customer', refresh_token: 'refresh-2', expires_in: 3600, user: customer })
        : json({ error: 'invalid_grant' }, 400);
    }
    return supabaseAuth()(call);
  });
  const res = await withFetch(fake, () => call(me, request('/api/me', { cookies: { '__Host-sb-access': 'expired', '__Host-sb-refresh': 'refresh-ok' } })));
  assert.equal((await res.json()).signedIn, true);
  assert.equal(setCookies(res)['__Host-sb-access'].value, 'token-customer');
  assert.equal(setCookies(res)['__Host-sb-refresh'].value, 'refresh-2');

  const dead = await withFetch(fake, () => call(me, request('/api/me', { cookies: { '__Host-sb-access': 'expired', '__Host-sb-refresh': 'revoked' } })));
  assert.deepEqual(await dead.json(), { signedIn: false });
  assert.ok(setCookies(dead)['__Host-sb-access'].attrs.includes('max-age=0'), 'dead session cookies are cleared');
});

test('logout clears the session, but only when the request comes from this site', async () => {
  const fake = fakeFetch(call => call.url === `${env.SUPABASE_URL}/auth/v1/logout?scope=local` ? new Response(null, { status: 204 }) : undefined);
  const evil = await withFetch(fake, () => call(logout, request('/api/auth/logout', { method: 'POST', cookies: signedIn('token-customer'), origin: 'https://evil.example' })));
  assert.equal(evil.status, 403);
  assert.equal(fake.calls.length, 0);

  const res = await withFetch(fake, () => call(logout, request('/api/auth/logout', { method: 'POST', cookies: signedIn('token-customer') })));
  assert.equal(res.status, 200);
  assert.equal(fake.calls[0].headers.get('Authorization'), 'Bearer token-customer');
  const cookies = setCookies(res);
  assert.ok(cookies['__Host-sb-access'].attrs.includes('max-age=0'));
  assert.ok(cookies['__Host-sb-refresh'].attrs.includes('max-age=0'));
});

test('a Supabase outage or rate limit never signs anyone out', async () => {
  for (const status of [429, 500, 503]) {
    const fake = fakeFetch(() => json({ msg: 'busy' }, status));
    const res = await withFetch(fake, () => call(me, request('/api/me', { cookies: signedIn('token-customer') })));
    assert.deepEqual(await res.json(), { signedIn: false });
    assert.deepEqual(res.headers.getSetCookie(), [], `cookies cleared on ${status}`);
  }
});

test('a refreshed session is kept even if Supabase stumbles right after', async () => {
  let userCalls = 0;
  const fake = fakeFetch(c => {
    if (c.url.endsWith('grant_type=refresh_token')) return json({ access_token: 'token-customer', refresh_token: 'refresh-2', expires_in: 3600, user: customer });
    if (c.url.endsWith('/auth/v1/user')) return ++userCalls === 1 ? json({}, 401) : json({}, 503);
  });
  const res = await withFetch(fake, () => call(me, request('/api/me', { cookies: { '__Host-sb-access': 'expired', '__Host-sb-refresh': 'refresh-ok' } })));
  assert.equal((await res.json()).signedIn, true);
  assert.equal(setCookies(res)['__Host-sb-refresh'].value, 'refresh-2', 'the rotated refresh token must not be lost');
});

test('logging out with an expired access token still revokes the session at Supabase', async () => {
  const fake = fakeFetch(c => {
    if (c.url.endsWith('grant_type=refresh_token')) return json({ access_token: 'fresh', refresh_token: 'r2', expires_in: 3600, user: customer });
    if (c.url.endsWith('/auth/v1/logout?scope=local')) return new Response(null, { status: c.headers.get('Authorization') === 'Bearer fresh' ? 204 : 401 });
  });
  await withFetch(fake, () => call(logout, request('/api/auth/logout', { method: 'POST', cookies: { '__Host-sb-access': 'expired', '__Host-sb-refresh': 'r1' } })));
  const logouts = fake.calls.filter(c => c.url.endsWith('/logout?scope=local')).map(c => c.headers.get('Authorization'));
  assert.deepEqual(logouts, ['Bearer expired', 'Bearer fresh']);
});
