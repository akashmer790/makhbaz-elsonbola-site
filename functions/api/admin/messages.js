// /api/admin/messages — صفحة الأدمن (الصلاحية في _middleware.js)
//   GET  ?status=new|all&offset=0  ← الرسايل، الأحدث الأول، 50 في المرة
//   POST { id, status?, reply? }    ← "اتعامل معاها" أو رد يظهر للزبون في صفحة حسابه

import { reply, fail, readJson } from '../../../lib/http.js';
import { db } from '../../../lib/db.js';

const PAGE = 50;
const STATUSES = ['new', 'done'];
const FIELDS = 'id,name,phone,message,wants_updates,created_at,status,reply,replied_at,user_id';

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const status = params.get('status') ?? 'new';
  const offsetText = params.get('offset') ?? '0';
  // قيم ثابتة بس، عشان ما يتبعتش فلتر غريب لـ Supabase من اللينك
  if (status !== 'all' && !STATUSES.includes(status)) return fail(400, 'bad_status');
  if (!/^\d{1,5}$/.test(offsetText)) return fail(400, 'bad_offset');

  const query = new URLSearchParams({ select: FIELDS, order: 'created_at.desc', limit: String(PAGE + 1), offset: offsetText });
  if (status !== 'all') query.set('status', `eq.${status}`);
  const result = await db(env, `messages?${query}`);
  if (!result.ok) return fail(502, 'load_failed');

  // بنطلب واحدة زيادة عشان نعرف فيه صفحة بعدها ولا لأ
  return reply(200, { ok: true, messages: result.data.slice(0, PAGE), more: result.data.length > PAGE });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'bad_request');
  if (Object.keys(body).some(k => !['id', 'status', 'reply'].includes(k))) return fail(400, 'unknown_field');
  if (!Number.isSafeInteger(body.id) || body.id < 1) return fail(400, 'bad_id');

  const change = {};
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return fail(400, 'bad_status');
    change.status = body.status;
  }
  if ('reply' in body) {
    if (typeof body.reply !== 'string') return fail(400, 'bad_reply');
    const text = body.reply.trim();
    if (text.length > 2000) return fail(400, 'too_long');
    // رد فاضي معناه شيل الرد
    change.reply = text || null;
    change.replied_at = text ? new Date().toISOString() : null;
  }
  if (!Object.keys(change).length) return fail(400, 'nothing_to_change');

  const result = await db(env, `messages?id=eq.${body.id}`, { method: 'PATCH', body: change, prefer: 'return=representation' });
  if (!result.ok) return fail(502, 'save_failed');
  if (!result.data?.length) return fail(404, 'not_found');
  return reply(200);
}
