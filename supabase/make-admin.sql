-- يخلّي حساب معيّن أدمن. يتشغّل من SQL Editor في لوحة Supabase.
-- الأول: ادخل على الموقع بحساب جوجل بتاعك مرة واحدة (من صفحة /login)، عشان الحساب يتعمل.
-- بعدين: حط إيميلك مكان YOUR-EMAIL@gmail.com وشغّل الملف.
-- الصلاحية في app_metadata، ودي المستخدم نفسه ما يقدرش يعدّلها (عكس user_metadata).
-- بنختار الحساب اللي داخل بجوجل وإيميله متأكَّد بس، عشان لو حد عمل حساب تاني بنفس الإيميل بطريقة تانية
-- ما ياخدش الصلاحية بداله. (وقفّل Email و Anonymous في Authentication → Providers، الموقع مش بيستعملهم.)

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'YOUR-EMAIL@gmail.com'
  and email_confirmed_at is not null
  and raw_app_meta_data -> 'providers' ? 'google';

-- اتأكد إنها اتطبّقت (المفروض يطلع سطر واحد بس، فيه إيميلك):
select id, email, raw_app_meta_data ->> 'role' as role from auth.users where raw_app_meta_data ->> 'role' = 'admin';

-- لشيل الأدمن من حد:
-- update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = '...';
