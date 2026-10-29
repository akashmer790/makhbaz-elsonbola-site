import { api, notice } from '/app.js';

// لو داخل أصلاً، يروح لحسابه على طول
const me = await api('/api/me');
if (me.data.signedIn) location.replace('/account');

// السيرفر بيرجّع ?error=1 بس، من غير أي تفاصيل، عشان ما نعرضش نص جاي من برة
if (new URLSearchParams(location.search).has('error')) {
  notice(document.getElementById('error'), 'الدخول ما كملش. جرّب تاني، ولو المشكلة فضلت كلّمنا على الموبايل.', true);
}
