---
name: bakery-content-update
description: Update what the Al-Sanbola bakery site says or shows by editing its Business file (business.json): prices, products, units, hours, address, phone, delivery terms, the "what we don't have" notes, tagline, about text, Brand colors/font/logo icon, or turning a section on or off. Never invents a missing detail and asks before publishing. Use whenever the user wants to change, add or remove anything the bakery sells or states about itself, even casually in Egyptian Arabic ("غيّر سعر الكرواسون", "ضيف منتج", "شيل البسبوسة", "الجمعة هنفتح بدري", "غيّر رقم الموبايل", "اقفل الفورم"). Not for the contact form, Supabase, Turnstile or Telegram code.
---

# Updating the bakery's content

**`business.json` is the Business file (ملف المحل): the single source of truth.** Every fact, color and section switch on the site comes from it. `node scripts/build.mjs` renders it through the Template (`template/`) into `dist/`, and Cloudflare Pages runs that build on every push to `main`, so a push is a publish. You edit this one file and nothing else.

Talk to the user in their language (usually Egyptian Arabic) and in plain words.

## 1. Read the Business file first

Run `git pull` first: the admin page commits product edits to `business.json` on `main` directly, so the local copy may be behind. Then read `business.json`. The current wording and structure tell you where the change goes and how to write it.

## 2. Pin down exactly what changes, and ask instead of guessing

These are real prices and promises people act on, so a guessed detail is worse than a short question. Before editing, have every value you'll write:

- **New product:** name, unit (القطعة / الكيلو / 5 أرغفة / حسب الطلب...), and price. Ask for whichever is missing; a similar product's price is not this product's price.
- **Ambiguous name:** "الكرواسون" matches both كرواسون سادة and كرواسون شوكولاتة. Ask which one, or whether both.
- **Hours:** the day(s) plus both opening and closing time. If the user gives a start date ("من الشهر الجاي"), the page can't schedule a change: say so and ask whether to change it now or wait.
- **Removing something:** confirm the exact item when there's any doubt.

When a value is missing, ask one short, specific question, leave the file untouched, and stop.

Change only what was asked: every other value, its wording and its order stay byte-for-byte as they were. If something elsewhere looks wrong, mention it in your reply.

## 3. Edit `business.json`

Follow the patterns already in the file:

- Text is stored exactly as Customers read it: Western digits, `جنيه`, casual Egyptian wording (`7 الصبح`, `11 بالليل`), prices as written (`من 450 جنيه`). A condition on a price (`بالحجز قبلها بيومين`) goes in the product's `note`, not in `price`.
- Products appear on the page in file order.
- **Icons:** a product's `icon` names a hand-drawn symbol from the Template's set, listed in `PRODUCT_ICONS` in `template/products.mjs`. For a new product, reuse the closest one and tell the user which; drawing a new icon is a separate design task.
- **Brand** (colors, font, logo icon) and **section switches** (on/off per section) live in the Business file too, under their own keys. Change the key the user means; the build rejects a bad hex color, a faint form-border color, or an unknown name, with a message naming the field.
- The renderer derives the call link from `phone`, the meta and link-preview descriptions from `tagline`, the title from `name`, and the card animation order from product position. One edit to the source field updates all of them.
- Save as UTF-8 without a BOM; `JSON.parse` in the build rejects a BOM.

## 4. Verify with the tests and the build

From the project root, run both:

```bash
node --test
node scripts/build.mjs
```

Both must pass. A build failure prints the field at fault: fix your edit and rerun. Then search `dist/index.html` for the new text (for example the new price) to see it on the built page. If a test fails over something you didn't touch, leave it and tell the user.

## 5. Show the change and ask before publishing

Show the user:

- a short before → after table of the values that changed (not raw diffs, unless they ask), and
- that the tests and the build passed.

Ask one direct question, such as «أرفع التعديل على الموقع؟», and wait for a clear yes. If they want changes, adjust and show it again.

## 6. After the user says yes: commit, push, confirm it's live

1. Commit `business.json` alone, by name (`git add business.json`), with a short message saying what changed, in the repo's commit style.
2. Push `main`. The pre-push hook reruns the tests and the build and checks the Supabase columns; if it stops the push, show the user its message.
3. Wait for the Cloudflare Pages deployment of that commit, using the `cf` CLI (project `makhbaz-elsonbola-site`): the latest deployment's commit hash is yours and its last stage succeeded.
4. Fetch `https://makhbaz-elsonbola-site.pages.dev/` and confirm the new text is there.
5. Tell the user it's live and what changed. `AGENTS.md` asks for a test message from the form after any change; remind them in one line that this part is theirs, because the form's Turnstile check needs a real person.
