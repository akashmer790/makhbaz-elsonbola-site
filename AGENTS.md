- مخبز السنبلة. المعلومات في bakery-facts.md، وما تخترعش غيرها.
- كل push على main بيتنشر على Cloudflare Pages لوحده. فحص `scripts/prepush-check.mjs` بيشتغل قبل كل push؛ بعد أي clone فعّله بـ `git config core.hooksPath .githooks`.
- أي متغير جديد في إعدادات Cloudflare Pages ما بيشتغلش غير بعد نشر جديد.
- الفورم بيحفظ في جدول messages على Supabase.
- دخول الزباين (جوجل عن طريق Supabase Auth) وصفحة الأدمن: الكود في `functions/api/` و `lib/`، والإعداد في `docs/accounts-setup.md`. أي endpoint أدمن جديد يتحط تحت `functions/api/admin/` عشان `_middleware.js` يحميه.
- بعد أي تعديل: ابعت رسالة من الفورم على لينك pages.dev، واتأكد إنها وصلت الجدول.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on akashmer790/makhbaz-elsonbola-site, used through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
