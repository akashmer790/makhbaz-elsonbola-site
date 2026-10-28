---
name: bakery-content-update
description: Update the Al-Sanbola bakery site's business info — prices, products, units, opening hours, address, phone, delivery terms, the "what we don't have" notes, tagline or about text — keeping bakery-facts.md and sanbola.html in sync, never inventing missing details, and asking before publishing. Use this whenever the user wants to change, add or remove anything the bakery sells or states about itself, even casually in Egyptian Arabic ("غيّر سعر الكرواسون", "ضيف منتج", "شيل البسبوسة", "الجمعة هنفتح بدري", "غيّر رقم الموبايل", "بقينا نوصّل لحد 5 كيلو"), or asks whether the page and the facts file still match. Not for the contact form, Supabase, Turnstile or Telegram code.
---

# Updating the bakery's content

The site has two copies of the same facts, and they drift apart easily:

- **`bakery-facts.md`**: the source of truth. Every fact on the site comes from here. It is listed in `.gitignore` and lives only on this machine, so it is never committed or pushed.
- **`public/sanbola.html`**: the public page. Cloudflare Pages publishes only the `public/` folder, and every push to `main` goes live within a minute or two, so a push is a publish.

The job is to change both the same way, change nothing else, and get the user's go-ahead before anything goes live. Talk to the user in their language (usually Egyptian Arabic) and in plain words.

## 1. Read both files first

Read `bakery-facts.md` and the matching parts of `sanbola.html` before deciding anything. You need the current wording and the page's markup to place the change correctly.

If `bakery-facts.md` is missing, don't rebuild it from the page: the page may already be wrong, and the facts file also holds remarks the page leaves out. It has been restored from git history before. Find the last commit that had it (`git log --all --format=%h -- bakery-facts.md`, then check which of those still has the file with `git show <hash>:bakery-facts.md`), tell the user, and ask before restoring it with `git restore --source=<hash> --worktree -- bakery-facts.md`. That keeps it untracked.

## 2. Pin down exactly what changes, and ask instead of guessing

These are real prices and promises people will act on, so a guessed detail is worse than a short question. Before editing, make sure you have every value you'd write:

- **New product:** name, unit (القطعة / الكيلو / 5 أرغفة / حسب الطلب...), and price. If any is missing, ask for it. Don't borrow a price from a similar product.
- **Ambiguous name:** "الكرواسون" matches both كرواسون سادة and كرواسون شوكولاتة. Ask which one, or whether both.
- **Hours:** you need the day(s) and both the opening and closing time. If the user gives a start date ("من الشهر الجاي"), the page can't schedule a change, so say so and ask whether to change it now or wait.
- **Removing something:** confirm the exact item if there's any doubt.

When something is missing, ask one short, specific question, make no edits, and stop. Change only what was asked. Don't tidy up wording, reorder items or "fix" other facts on the side. If you notice something that looks wrong elsewhere, mention it instead of changing it.

## 3. Edit both files the same way

Copy the patterns already in the files rather than inventing new ones:

| Fact | In `bakery-facts.md` | In `sanbola.html` |
| --- | --- | --- |
| Product | a row in the `## المنتجات والأسعار` table: `\| name \| unit \| price \|` | an `<li class="product">` in `#products`, same order as the table |
| Extra condition on a price | same cell, after a comma: `من 450 جنيه، بالحجز قبلها بيومين` | the price in `.price`, the condition in `<p class="note">` |
| Hours | a row in the `## المواعيد` table | a `<tr>` in the `#hours` table |
| Address / phone / delivery | bullets under `## العنوان والتواصل` | the `<li>` items in `#contact` |
| What we don't have | bullets under `## اللي مش عندنا` | `<li>` items in `#notes` |
| Tagline | `جملة التعريف: «...»` | `<p class="tagline">` **and** `<meta name="description">` |

Details that matter:

- Write numbers and prices the way the file already does: Western digits, `جنيه`, and casual Egyptian wording (`7 الصبح`, `11 بالليل`).
- A phone number change has three places on the page: the visible text, and the `tel:` link (`+20` plus the number without the leading 0 and without spaces).
- Remarks in parentheses in the facts file, like `(عنوان خيالي)`, are notes for whoever edits the file. They don't go on the page.
- The page's about line leaves out the leading `مخبز السنبلة،` because the name is already in the `<h1>`.

## 4. Check the two files match

Run the bundled checker from the project root:

```bash
node .claude/skills/bakery-content-update/scripts/check-consistency.mjs .
```

It compares products, units, prices, hours, address, phone and the `tel:` link, delivery, notes, tagline, meta description and about text, and lists every difference. Fix anything it reports until it prints `"ok": true`. If it reports a difference you didn't cause, leave it alone and tell the user.

## 5. Show the change and ask before publishing

Pushing publishes the page right away, so show the user what will change and wait for a clear yes. Show:

- a short before → after table of the facts that changed (not raw diffs, unless they ask), and
- that the checker passed.

Ask one direct question, such as «أرفع التعديل على الموقع؟». If they decline or want changes, adjust and show it again.

## 6. After the user says yes: commit, push, confirm it's live

1. Commit only `public/sanbola.html`, plus any other tracked file you changed. Never `git add -A` here, and never commit `bakery-facts.md` or the `.cloudflare/` folder. Write a short commit message saying what changed, following the repo's existing commit style.
2. Push `main`.
3. Wait for the Cloudflare Pages deployment of that commit, using the `cf` CLI (project `makhbaz-elsonbola-site`). Check that the latest deployment's commit hash is yours and its last stage succeeded.
4. Fetch `https://makhbaz-elsonbola-site.pages.dev/sanbola` and confirm the new text is there. Use that address: `/sanbola.html` answers with a 308 redirect that some tools don't follow.
5. Tell the user it's live and what changed. The project's `AGENTS.md` asks for a test message from the form after any change. Remind them in one line that this part is theirs, because the form's Turnstile check needs a real person.
