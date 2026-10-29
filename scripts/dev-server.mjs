// بديل محلي لـ Cloudflare Pages عشان تجرّب الحساب والأدمن في المتصفح: بيعرض dist/، وبيشغّل الـ Functions الحقيقية،
// و Supabase و GitHub و Turnstile فيه fake (ما بيلمسش الجدول الحقيقي).
// التشغيل: node scripts/build.mjs && node scripts/dev-server.mjs [port]  (أو preview_start باسم accounts-dev)
// الدخول للتجربة بس: /dev-login?as=customer أو /dev-login?as=admin
// أي endpoint جديد في functions/api/ لازم يتضاف في routes تحت.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8790);
const mod = p => import(pathToFileURL(join(ROOT, p)).href);

const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', TURNSTILE_SECRET_KEY: 'x',
  GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main' };
const users = {
  'tok-customer': { id: '11111111-1111-4111-8111-111111111111', email: 'zabon@example.com', user_metadata: { full_name: 'منى أحمد' }, app_metadata: {} },
  'tok-admin': { id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.com', user_metadata: { full_name: 'صاحب المحل' }, app_metadata: { role: 'admin' } },
};
let nextId = 4;
const messages = [
  { id: 3, name: 'منى أحمد', phone: '01011111111', message: 'عايزة تورتة عيد ميلاد يوم الخميس <b>كبيرة</b> <img src=x onerror=alert(1)>', wants_updates: true, created_at: '2026-10-28T09:00:00Z', status: 'new', reply: null, replied_at: null, user_id: users['tok-customer'].id },
  { id: 2, name: 'كريم', phone: '01222222222', message: 'بتوصّلوا بورفؤاد؟', wants_updates: false, created_at: '2026-10-27T15:00:00Z', status: 'done', reply: 'لأ للأسف، حدود 3 كيلو بس.', replied_at: '2026-10-27T16:00:00Z', user_id: null },
  { id: 1, name: 'سارة', phone: '01533333333', message: 'السلام عليكم', wants_updates: true, created_at: '2026-10-20T10:00:00Z', status: 'new', reply: null, replied_at: null, user_id: null },
];
let fileSha = 'sha-1';
let businessText = readFileSync(join(ROOT, 'business.json'), 'utf8');

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method ?? 'GET'; const h = new Headers(init.headers);
  if (u.pathname === '/auth/v1/user') { const user = users[h.get('Authorization')?.slice(7)]; return user ? json(user) : json({}, 401); }
  if (u.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
  if (u.pathname === '/rest/v1/messages') {
    const q = u.searchParams;
    if (method === 'GET') {
      let rows = [...messages];
      if (q.get('user_id')) rows = rows.filter(r => r.user_id === q.get('user_id').slice(3));
      if (q.get('status')) rows = rows.filter(r => r.status === q.get('status').slice(3));
      const off = Number(q.get('offset') ?? 0); rows = rows.slice(off, off + Number(q.get('limit') ?? 1000));
      const cols = q.get('select').split(',');
      return json(rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))));
    }
    if (method === 'PATCH') { const m = messages.find(r => r.id === Number(q.get('id').slice(3))); if (!m) return json([]); Object.assign(m, JSON.parse(init.body)); return json([m]); }
    if (method === 'POST') { messages.unshift({ id: nextId++, status: 'new', reply: null, replied_at: null, created_at: new Date().toISOString(), ...JSON.parse(init.body) }); return new Response(null, { status: 201 }); }
  }
  if (u.hostname === 'challenges.cloudflare.com') return json({ success: true });
  if (u.hostname === 'api.github.com') {
    if (method === 'GET') return json({ sha: fileSha, content: Buffer.from(businessText).toString('base64') });
    const b = JSON.parse(init.body); if (b.sha !== fileSha) return json({}, 409);
    businessText = Buffer.from(b.content, 'base64').toString('utf8'); fileSha = 'sha-' + Date.now();
    console.log('[github] committed business.json:', b.message); return json({ content: { sha: fileSha } });
  }
  return json({ error: 'unknown fake route ' + url }, 404);
};

const routes = {
  '/api/auth/login': ['functions/api/auth/login.js'], '/api/auth/callback': ['functions/api/auth/callback.js'],
  '/api/auth/logout': ['functions/api/auth/logout.js'], '/api/me': ['functions/api/me.js'], '/api/health': ['functions/api/health.js'], '/api/message': ['functions/api/message.js'],
  '/api/my/messages': ['functions/api/my/messages.js'], '/api/admin/messages': ['functions/api/admin/messages.js', true],
  '/api/admin/subscribers': ['functions/api/admin/subscribers.js', true], '/api/admin/products': ['functions/api/admin/products.js', true],
};
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = []; for await (const c of req) body.push(c); body = Buffer.concat(body);
  const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  let response;
  if (url.pathname === '/dev-login') {
    response = new Response(null, { status: 302, headers: { Location: '/account', 'Set-Cookie': `__Host-sb-access=tok-${url.searchParams.get('as')}; Path=/; HttpOnly; Secure; SameSite=Lax` } });
  } else if (routes[url.pathname]) {
    const [file, isAdmin] = routes[url.pathname];
    const m = await mod(file);
    const handler = m[`onRequest${req.method[0] + req.method.slice(1).toLowerCase()}`] ?? m.onRequest;
    const ctx = { request, env, params: {}, data: {}, waitUntil() {} };
    response = !handler ? new Response('405', { status: 405 })
      : isAdmin ? await (await mod('functions/api/admin/_middleware.js')).onRequest({ ...ctx, next: () => handler(ctx) }) : await handler(ctx);
  } else {
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!extname(p)) p += '.html';
    try {
      const headers = { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' };
      if (['/login.html', '/account.html', '/admin.html'].includes(p)) headers['Content-Security-Policy'] = STRICT;
      response = new Response(await readFile(join(ROOT, 'dist', p)), { headers });
    } catch { response = new Response('not found', { status: 404 }); }
  }
  res.statusCode = response.status;
  for (const [k, v] of response.headers) if (k !== 'set-cookie') res.setHeader(k, v);
  const cookies = response.headers.getSetCookie(); if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`dev server on http://localhost:${PORT}`));
