-- جدول رسائل فورم التواصل في موقع مخبز السنبلة.
-- يتشغّل من SQL Editor في لوحة Supabase، وينفع يتشغّل أكتر من مرة.

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 100),
  phone      text not null check (phone ~ '^01[0125][0-9]{8}$'),
  message    text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Row Level Security شغال ومن غير ولا سياسة:
-- المفتاح الـ publishable (anon) ما يقدرش يقرا ولا يضيف ولا يعدّل ولا يمسح.
alter table public.messages enable row level security;

-- لو كنت شغّلت النسخة القديمة من الملف، دي بتشيل سياسة الإضافة المباشرة للزوار،
-- لأن أي حد كان هيقدر يضيف رسائل من غير ما يعدّي على تحقق Turnstile.
drop policy if exists "Visitors can send messages" on public.messages;

revoke all on public.messages from anon, authenticated;

-- الإضافة بتحصل بس من functions/api/message.js على Cloudflare بعد تحقق Turnstile،
-- بالمفتاح الـ secret (service_role) اللي متخزّن في إعدادات Cloudflare مش في أي ملف.
grant insert (name, phone, message) on public.messages to service_role;
