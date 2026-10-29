// نداءات جدول messages في Supabase بالمفتاح الـ secret (SUPABASE_SECRET_KEY في إعدادات Pages).
// المفتاح ده بيعدّي RLS، فكل function بتستعمله مسؤولة عن إنها تفلتر بالمستخدم الصح بنفسها.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = value => typeof value === 'string' && UUID_RE.test(value);

// بيرجّع { ok, status, data }. أي عطل في الشبكة بيرجع ok: false بدل ما الـ function توقع
export async function db(env, path, { method = 'GET', body, prefer } = {}) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 || res.status === 201 ? null : await res.json().catch(() => null);
    // code بس، مش رسالة الخطأ كلها: أخطاء القيود بتكتب الصف نفسه (اسم وموبايل ورسالة الزبون)
    if (!res.ok) console.error('Supabase request failed', method, path.split('?')[0], res.status, data?.code ?? '');
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('Supabase request error', err);
    return { ok: false, status: 0, data: null };
  }
}
