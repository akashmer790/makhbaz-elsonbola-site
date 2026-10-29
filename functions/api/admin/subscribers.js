// GET /api/admin/subscribers — الأرقام اللي عايزة تستقبل عروض (الصلاحية في _middleware.js).
// الموافقة بتتسجّل مع كل رسالة، فبناخد آخر اختيار لكل رقم: لو آخر رسالة قال فيها لأ، ما يظهرش.

import { reply, fail } from '../../../lib/http.js';
import { db } from '../../../lib/db.js';

// Supabase بيرجّع 1000 صف بالكتير في الطلب الواحد، فبنقرا صفحة ورا صفحة.
// 20 صفحة (20 ألف رسالة) حد أقصى، عشان الـ function ما تقعدش تلف للأبد.
const PAGE = 1000;
const MAX_PAGES = 20;

export async function onRequestGet({ env }) {
  const latest = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ select: 'phone,name,wants_updates,created_at', order: 'created_at.desc,id.desc', limit: String(PAGE), offset: String(page * PAGE) });
    const result = await db(env, `messages?${query}`);
    if (!result.ok) return fail(502, 'load_failed');
    for (const row of result.data) if (!latest.has(row.phone)) latest.set(row.phone, row);
    if (result.data.length < PAGE) break;
  }
  const subscribers = [...latest.values()]
    .filter(row => row.wants_updates)
    .map(row => ({ phone: row.phone, name: row.name, since: row.created_at }));
  return reply(200, { ok: true, subscribers });
}
