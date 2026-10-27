- مخبز السنبلة. المعلومات في bakery-facts.md، وما تخترعش غيرها.
- كل push على main بيتنشر على Cloudflare Pages لوحده.
- الفورم بيحفظ في جدول messages على Supabase.
- بعد أي تعديل: ابعت رسالة من الفورم على لينك pages.dev، واتأكد إنها وصلت الجدول.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on akashmer790/makhbaz-elsonbola-site, used through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
