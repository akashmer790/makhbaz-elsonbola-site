// POST /api/message — بيستقبل رسالة فورم التواصل، يتأكد من Turnstile، ويحفظها في Supabase.
// المتغيرات دي متخزّنة في إعدادات مشروع Cloudflare Pages، مش في أي ملف:
//   TURNSTILE_SECRET_KEY  (secret)
//   SUPABASE_URL          (رابط المشروع، مثلاً https://xxxx.supabase.co)
//   SUPABASE_SECRET_KEY   (secret، المفتاح اللي بيبدأ بـ sb_secret_)
// اختياري، لتنبيه تيليجرام مع كل رسالة جديدة:
//   TELEGRAM_BOT_TOKEN    (secret، من @BotFather)
//   TELEGRAM_CHAT_ID      (رقم حسابك على تيليجرام)

const PHONE_RE = /^01[0125][0-9]{8}$/;

function reply(status, error) {
  return Response.json(error ? { ok: false, error } : { ok: true }, { status });
}

// تنبيه تيليجرام. بيرجّع true لو التنبيه وصل.
// saved = false معناها إن الحفظ في Supabase فشل، فالتنبيه هو النسخة الوحيدة من الرسالة.
async function notifyTelegram(env, { name, phone, message, wants_updates }, { saved = true } = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const time = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' });
  // نص عادي من غير parse_mode، عشان أي رموز يكتبها الزائر ما تبوّظش الرسالة
  const updates = wants_updates ? '✅ عايز يتابع العروض الجديدة' : '— مش عايز عروض';
  const header = saved ? '📩 رسالة جديدة من الموقع' : '⚠️ رسالة جديدة ما اتحفظتش في الجدول، دي النسخة الوحيدة منها';
  const text = `${header}\n\n👤 ${name}\n📞 ${phone}\n🕒 ${time}\n${updates}\n\n${message}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
    });
    if (!res.ok) console.error('Telegram notify failed', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Telegram notify error', err);
    return false;
  }
}

// الحفظ في Supabase بالمفتاح الـ secret (بيعدّي RLS، والزوار مالهمش صلاحية مباشرة)
async function saveMessage(env, row) {
  try {
    const res = await fetch(env.SUPABASE_URL + '/rest/v1/messages', {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SECRET_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) console.error('Supabase insert failed', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Supabase insert error', err);
    return false;
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return reply(400, 'bad_request');
  }

  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const message = String(body.message ?? '').trim();
  const token = String(body.token ?? '');
  // الموافقة على العروض لازم تكون true صريحة، أي حاجة غير كده تبقى false
  const wants_updates = body.wants_updates === true;

  if (!name || !phone || !message) return reply(400, 'missing_fields');
  if (name.length > 100 || message.length > 2000) return reply(400, 'too_long');
  if (!PHONE_RE.test(phone)) return reply(400, 'bad_phone');
  if (!token) return reply(400, 'turnstile_missing');

  // التأكد إن اللي باعت إنسان
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') ?? ''
    })
  }).then(r => r.json());
  if (!verify.success) return reply(403, 'turnstile_failed');

  const row = { name, phone, message, wants_updates };
  if (!(await saveMessage(env, row))) {
    // شبكة أمان: لو الحفظ فشل، الرسالة توصل على تيليجرام بدل ما تضيع.
    // لو وصلت، الزائر ما يحتاجش يعيد الإرسال.
    const delivered = await notifyTelegram(env, row, { saved: false });
    return delivered ? reply(200) : reply(502, 'save_failed');
  }

  // الرد على الزائر ما يستناش تيليجرام
  waitUntil(notifyTelegram(env, row));

  return reply(200);
}
