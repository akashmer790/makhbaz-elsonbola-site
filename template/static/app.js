// أدوات مشتركة لصفحات الدخول والحساب والأدمن.
// كل نص جاي من زبون بيتحط بـ textContent بس (من خلال el)، عشان رسالة فيها <script> تتعرض كنص عادي.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

// بيرجّع { ok, status, data }، ومش بيرمي errors، عشان كل صفحة تقرر تعرض إيه
export async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

export const formatDate = iso => new Date(iso).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' });

export function notice(box, text, isError = false) {
  box.textContent = text;
  box.className = isError ? 'notice error' : 'notice';
  box.hidden = !text;
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  location.replace('/');
}
