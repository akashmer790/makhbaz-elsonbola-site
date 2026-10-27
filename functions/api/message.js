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

// تنبيه تيليجرام: لو فشل، الرسالة برضه اتحفظت والزائر مش هيشوف خطأ
async function notifyTelegram(env, { name, phone, message }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const time = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' });
  // نص عادي من غير parse_mode، عشان أي رموز يكتبها الزائر ما تبوّظش الرسالة
  const text = `📩 رسالة جديدة من الموقع\n\n👤 ${name}\n📞 ${phone}\n🕒 ${time}\n\n${message}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
    });
    if (!res.ok) console.error('Telegram notify failed', res.status, await res.text());
  } catch (err) {
    console.error('Telegram notify error', err);
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

  // الحفظ في Supabase بالمفتاح الـ secret (بيعدّي RLS، والزوار مالهمش صلاحية مباشرة)
  const res = await fetch(env.SUPABASE_URL + '/rest/v1/messages', {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ name, phone, message })
  });
  if (!res.ok) {
    console.error('Supabase insert failed', res.status, await res.text());
    return reply(502, 'save_failed');
  }

  // الرد على الزائر ما يستناش تيليجرام
  waitUntil(notifyTelegram(env, { name, phone, message }));

  return reply(200);
}
