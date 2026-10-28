-- جدول رسائل فورم التواصل في موقع مخبز السنبلة.
-- يتشغّل من SQL Editor في لوحة Supabase، وينفع يتشغّل أكتر من مرة.

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 100),
  phone      text not null check (phone ~ '^01[0125][0-9]{8}$'),
  message    text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- العميل وافق إننا نبعتله العروض والمنتجات الجديدة؟ (اختياري، والافتراضي لأ)
alter table public.messages
  add column if not exists wants_updates boolean not null default false;

-- Row Level Security شغال ومن غير ولا سياسة:
-- المفتاح الـ publishable (anon) ما يقدرش يقرا ولا يضيف ولا يعدّل ولا يمسح.
alter table public.messages enable row level security;

-- لو كنت شغّلت النسخة القديمة من الملف، دي بتشيل سياسة الإضافة المباشرة للزوار،
-- لأن أي حد كان هيقدر يضيف رسائل من غير ما يعدّي على تحقق Turnstile.
drop policy if exists "Visitors can send messages" on public.messages;

revoke all on public.messages from anon, authenticated;

-- الإضافة بتحصل بس من functions/api/message.js على Cloudflare بعد تحقق Turnstile،
-- بالمفتاح الـ secret (service_role) اللي متخزّن في إعدادات Cloudflare مش في أي ملف.
grant insert (name, phone, message, wants_updates) on public.messages to service_role;

-- ===== حسابات الزباين وصفحة الأدمن =====

-- الرسالة مربوطة بحساب الزبون لو كان داخل وهو بيبعتها (null لو مش داخل).
-- لو الحساب اتمسح، الرسالة بتفضل والربط بس اللي بيتشال.
alter table public.messages
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- حالة الرسالة في صفحة الأدمن، والرد اللي بيظهر للزبون في صفحة حسابه
alter table public.messages
  add column if not exists status text not null default 'new' check (status in ('new', 'done')),
  add column if not exists reply text check (char_length(reply) <= 2000),
  add column if not exists replied_at timestamptz;

create index if not exists messages_user_id_idx on public.messages (user_id, created_at desc);
create index if not exists messages_status_idx on public.messages (status, created_at desc);

-- برضه من غير ولا سياسة RLS، والزوار والحسابات (anon و authenticated) مالهمش أي صلاحية على الجدول.
-- الزبون مش بيقرا الجدول مباشرة: functions/api/my/messages.js بتقراه بالمفتاح الـ secret
-- وبتفلتر بالـ id اللي Supabase أكّده من جلسته. المفتاح ده (service_role) عنده صلاحية كاملة من Supabase نفسه،
-- فالحماية كلها في الـ functions، وعشان كده المفتاح لازم يفضل في إعدادات Cloudflare وبس.
revoke all on public.messages from anon, authenticated;
