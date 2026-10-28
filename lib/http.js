// أدوات مشتركة لكل الـ Pages Functions (برة functions/ عشان Pages ما يعتبرهاش لينكات).

// الردود فيها بيانات شخصية، فما تتخزّنش في أي cache
export function reply(status, body = { ok: true }, cookies = []) {
  const res = Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  for (const c of cookies) res.headers.append('Set-Cookie', c);
  return res;
}

export const fail = (status, error, cookies) => reply(status, { ok: false, error }, cookies);

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

// حماية من CSRF: أي طلب بيغيّر حاجة لازم يكون جاي من صفحات الموقع نفسه.
// المتصفحات بتبعت Origin مع كل POST، فطلب من غير Origin أو من موقع تاني بيترفض.
export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  for (const part of (request.headers.get('Cookie') ?? '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

// __Host- معناها: Secure و Path=/ ومن غير Domain، فما حدش من subdomain تاني يقدر يكتب عليها.
// HttpOnly عشان أي سكريبت في الصفحة (حتى لو حصل XSS) ما يقدرش يقرا التوكن.
// SameSite=Lax لأن الرجوع من جوجل navigation من موقع تاني، و Strict كانت هتمنع الكوكي يتبعت.
export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearCookie = name => cookie(name, '', 0);
