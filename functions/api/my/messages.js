// GET /api/my/messages — رسايل الزبون الداخل وردود المحل عليها.
// الفلترة بالـ id اللي Supabase أكّده من الجلسة، مش بأي حاجة جاية في الطلب.

import { reply, fail } from '../../../lib/http.js';
import { getSession } from '../../../lib/session.js';
import { db, isUuid } from '../../../lib/db.js';

// من غير phone و name: الزبون عارفهم، والأقل في الرد أأمن
const FIELDS = 'id,message,created_at,status,reply,replied_at';

export async function onRequestGet({ request, env }) {
  const { user, cookies } = await getSession(request, env);
  if (!user || !isUuid(user.id)) return fail(401, 'signed_out', cookies);

  const query = new URLSearchParams({ select: FIELDS, user_id: `eq.${user.id}`, order: 'created_at.desc', limit: '100' });
  const result = await db(env, `messages?${query}`);
  if (!result.ok) return fail(502, 'load_failed', cookies);
  return reply(200, { ok: true, messages: result.data }, cookies);
}
