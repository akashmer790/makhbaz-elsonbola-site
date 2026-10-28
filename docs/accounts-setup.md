# إعداد حسابات الزباين وصفحة الأدمن

الكود موجود على branch `customer-accounts`. الخطوات دي بتتعمل مرة واحدة من اللوحات، وكلها ببلاش.
الترتيب مهم: فحص الـ pre-push بيوقف أي push لحد ما خطوة 1 تخلص.

## 1. Supabase: الأعمدة الجديدة

SQL Editor ← شغّل `supabase/messages.sql` كله. الملف ينفع يتشغّل أكتر من مرة، وبيضيف `user_id` و `status` و `reply` و `replied_at`.

## 2. Google Cloud: حساب الدخول بجوجل

1. [console.cloud.google.com](https://console.cloud.google.com) ← مشروع جديد.
2. APIs & Services ← OAuth consent screen ← External، واكتب اسم المحل وإيميلك.
3. Credentials ← Create credentials ← OAuth client ID ← Web application.
4. Authorized redirect URIs: `https://qrjbhjjembuuuujecojc.supabase.co/auth/v1/callback`
5. انسخ الـ Client ID والـ Client secret.

## 3. Supabase: تشغيل جوجل وقفل الباقي

- Authentication ← Sign In / Providers ← Google: شغّله، وحط الـ Client ID والـ secret.
- في نفس الصفحة: اقفل **Email** و **Anonymous**، الموقع مش بيستعملهم.
- Authentication ← URL Configuration:
  - Site URL: `https://makhbaz-elsonbola-site.pages.dev`
  - Redirect URLs (الاتنين):
    - `https://makhbaz-elsonbola-site.pages.dev/api/auth/callback`
    - `https://*.makhbaz-elsonbola-site.pages.dev/api/auth/callback` (لنسخ الـ preview)

## 4. GitHub: token لتعديل المنتجات

[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) ← Fine-grained:

- Repository access: Only select repositories ← `makhbaz-elsonbola-site` بس.
- Permissions ← Contents: **Read and write**، وغير كده ولا حاجة.
- Expiration: 90 يوم، وجدّده لما يخلص (تعديل المنتجات بيقف لحد ما تجدّده).

## 5. Cloudflare Pages: المتغيرات

Workers & Pages ← makhbaz-elsonbola-site ← Settings ← Variables and Secrets.

| المتغير | النوع | Production | Preview |
| --- | --- | --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` | Text | المفتاح اللي بيبدأ بـ `sb_publishable_` | نفس المفتاح |
| `SUPABASE_URL` | Text | موجود | `https://qrjbhjjembuuuujecojc.supabase.co` |
| `SUPABASE_SECRET_KEY` | Secret | موجود | نفس المفتاح |
| `GITHUB_TOKEN` | Secret | التوكن من خطوة 4 | **لأ** |
| `GITHUB_REPO` | Text | `akashmer790/makhbaz-elsonbola-site` | **لأ** |
| `GITHUB_BRANCH` | Text | `main` | **لأ** |

- متغيرات GitHub في Production بس. من غيرها، صفحة الأدمن في الـ preview بتقفل تعديل المنتجات، فأي تجربة هناك ما تتنشرش على الموقع الحقيقي.
- متغيرات Supabase في الـ Preview بتخلّي نسخ الـ preview تقرا وتكتب في نفس الجدول الحقيقي. ده مقبول طول ما إنت بس اللي بتعمل push.
- أي متغير جديد ما بيشتغلش غير بعد نشر جديد.
- بعد النشر، افتح `/api/health` على النسخة دي. بيقول أنهي متغيرات ناقصة لكل خاصية (الأسماء بس). في الـ preview، `products` المفروض يبقى ناقص متغيرات GitHub، والباقي فاضي.

## 6. التجربة على الـ preview

1. الـ push على `customer-accounts` بيعمل نسخة على `https://customer-accounts.makhbaz-elsonbola-site.pages.dev`.
2. افتح `/login` وادخل بحساب جوجل بتاعك.
3. SQL Editor ← شغّل `supabase/make-admin.sql` بعد ما تحط إيميلك.
4. افتح `/admin`: الرسايل، وأرقام العروض، والمنتجات (المفروض تقول إن التعديل مقفول في الـ preview).
5. ابعت رسالة من الفورم وانت داخل، واتأكد إنها ظهرت في `/account` وفي `/admin`، ورد عليها.

## ملاحظات

- **أرقام العروض مش متأكَّد منها:** أي حد يقدر يكتب رقم حد تاني في الفورم ويعلّم "عايز عروض". قبل ما تبعت عروض لرقم، اتأكد من صاحبه (مثلاً أول رسالة واتساب تسأله لو عايز يكمّل).
- **تعديل المنتجات من الأدمن** بيعمل commit على `main` على طول، والموقع بيتبني من جديد. بعدها اعمل `git pull` على اللابتوب قبل ما تعدّل `business.json` بإيدك. ولو `bakery-facts.md` اختلف، الـ pre-push بيحذّرك بس.
