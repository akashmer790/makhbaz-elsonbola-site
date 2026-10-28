import { el, api, formatDate, notice, logout } from '/app.js';

const $ = id => document.getElementById(id);

function start() {
  $('panel').hidden = false;
  $('logout').hidden = false;
  $('logout').addEventListener('click', logout);
  const tabs = { messages: loadMessages, subscribers: loadSubscribers, products: loadProducts };
  const loaded = new Set();
  for (const name of Object.keys(tabs)) {
    $(`btn-${name}`).addEventListener('click', () => {
      for (const other of Object.keys(tabs)) {
        $(`btn-${other}`).setAttribute('aria-selected', String(other === name));
        $(`tab-${other}`).hidden = other !== name;
      }
      if (!loaded.has(name)) { loaded.add(name); tabs[name](); }
    });
  }
  $('filter').addEventListener('change', () => loadMessages());
  $('more').addEventListener('click', () => loadMessages(true));
  loaded.add('messages');
  loadMessages();
}

const ERRORS = {
  0: 'مفيش اتصال بالإنترنت.',
  401: 'الجلسة خلصت. ادخل تاني.',
  403: 'الصفحة دي للأدمن بس.',
};
const errorText = (result, fallback) => ERRORS[result.status] ?? fallback;

// ---------- الرسايل ----------
let offset = 0;

async function loadMessages(append = false) {
  if (!append) { offset = 0; $('messages').replaceChildren(); }
  const status = $('filter').value;
  const result = await api(`/api/admin/messages?status=${encodeURIComponent(status)}&offset=${offset}`);
  if (!result.ok) {
    notice($('messages-status'), errorText(result, 'مش قادرين نجيب الرسايل دلوقتي.'), true);
    return;
  }
  offset += result.data.messages.length;
  $('more').hidden = !result.data.more;
  notice($('messages-status'), !append && !result.data.messages.length ? 'مفيش رسايل هنا.' : '');
  for (const m of result.data.messages) $('messages').append(messageCard(m));
}

function messageCard(m) {
  const status = el('span');
  const setStatus = value => {
    m.status = value;
    status.className = value === 'done' ? 'badge done' : 'badge';
    status.textContent = value === 'done' ? 'اتعاملنا معاها' : 'جديدة';
    toggle.textContent = value === 'done' ? 'رجّعها جديدة' : 'اتعاملت معاها';
  };
  const feedback = el('p', { class: 'notice', role: 'status', hidden: true });
  const replyBox = el('textarea', { maxlength: '2000', 'aria-label': 'الرد اللي هيظهر للزبون' });
  replyBox.value = m.reply ?? '';

  const save = async (button, change, okText) => {
    button.disabled = true;
    const result = await api('/api/admin/messages', { method: 'POST', body: { id: m.id, ...change } });
    button.disabled = false;
    notice(feedback, result.ok ? okText : errorText(result, 'الحفظ ما نجحش. جرّب تاني.'), !result.ok);
    return result.ok;
  };
  const toggle = el('button', { type: 'button', class: 'quiet', onclick: async () => {
    const next = m.status === 'done' ? 'new' : 'done';
    if (await save(toggle, { status: next }, 'اتحفظ.')) setStatus(next);
  } });
  const saveReply = el('button', { type: 'button', onclick: () =>
    save(saveReply, { reply: replyBox.value }, m.user_id ? 'الرد اتحفظ وهيظهر للزبون في حسابه.' : 'الرد اتحفظ. الزبون ده مش داخل بحساب، فكلّمه على الموبايل.') });
  saveReply.textContent = 'احفظ الرد';
  setStatus(m.status);

  return el('li', { class: 'card' },
    el('div', { class: 'meta' },
      el('strong', { text: m.name }),
      el('a', { href: `tel:${m.phone}`, dir: 'ltr', text: m.phone }),
      el('span', { text: formatDate(m.created_at) }),
      status,
      m.wants_updates && el('span', { class: 'badge', text: 'عايز عروض' }),
      m.user_id && el('span', { class: 'badge', text: 'داخل بحساب' })),
    el('p', { class: 'text', text: m.message }),
    el('div', { class: 'row' }, toggle),
    el('label', { class: 'row' }, 'الرد', replyBox),
    el('div', { class: 'row' }, saveReply),
    feedback);
}

// ---------- أرقام العروض ----------
async function loadSubscribers() {
  const result = await api('/api/admin/subscribers');
  if (!result.ok) {
    notice($('subscribers-status'), errorText(result, 'مش قادرين نجيب الأرقام دلوقتي.'), true);
    return;
  }
  const people = result.data.subscribers;
  notice($('subscribers-status'), people.length ? `${people.length} رقم` : 'لسه ما حدش وافق يستقبل عروض.');
  $('subscribers-table').hidden = !people.length;
  $('copy-phones').hidden = !people.length;
  $('subscribers').replaceChildren(...people.map(p => el('tr', {},
    el('td', { text: p.name }), el('td', { dir: 'ltr', text: p.phone }), el('td', { text: formatDate(p.since) }))));
  $('copy-phones').onclick = async () => {
    try {
      await navigator.clipboard.writeText(people.map(p => p.phone).join('\n'));
      notice($('subscribers-status'), 'الأرقام اتنسخت.');
    } catch {
      notice($('subscribers-status'), 'المتصفح ما سمحش بالنسخ. انسخهم من الجدول.', true);
    }
  };
}

// ---------- المنتجات ----------
const ICON_NAMES = { fino: 'عيش فينو', baladi: 'عيش بلدي', croissant: 'كرواسون', 'croissant-choc': 'كرواسون شوكولاتة', basbousa: 'بسبوسة', cake: 'تورتة' };
const FIELD_NAMES = { name: 'الاسم', unit: 'الوحدة', price: 'السعر', note: 'الملاحظة', icon: 'الأيقونة' };
let sha = null;
let icons = [];

async function loadProducts() {
  const result = await api('/api/admin/products');
  if (!result.ok) {
    const text = result.status === 503
      ? 'تعديل المنتجات مقفول في النسخة دي من الموقع (مفيش ربط بـ GitHub).'
      : errorText(result, 'مش قادرين نجيب المنتجات دلوقتي.');
    notice($('products-status'), text, true);
    return;
  }
  sha = result.data.sha;
  icons = result.data.icons;
  $('products').replaceChildren(...result.data.products.map(productRow));
  $('add-product').hidden = false;
  $('save-products').hidden = false;
  $('add-product').onclick = () => $('products').append(productRow({ name: '', unit: '', price: '', icon: icons[0] }));
  $('save-products').onclick = saveProducts;
}

function productRow(p) {
  const input = (field, max, label) => el('label', { class: field === 'note' ? 'wide' : undefined }, label,
    Object.assign(el('input', { 'data-field': field, maxlength: String(max) }), { value: p[field] ?? '' }));
  const select = el('select', { 'data-field': 'icon' }, ...icons.map(i => el('option', { value: i, text: ICON_NAMES[i] ?? i })));
  select.value = p.icon;
  const row = el('li', { class: 'card' },
    el('div', { class: 'product-edit' },
      input('name', 60, 'الاسم'), input('unit', 40, 'الوحدة'), input('price', 40, 'السعر (زي ما الزبون هيقراه)'),
      el('label', {}, 'الأيقونة', select), input('note', 120, 'ملاحظة (اختياري)')),
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'quiet', text: 'لفوق', onclick: () => row.previousElementSibling?.before(row) }),
      el('button', { type: 'button', class: 'quiet', text: 'لتحت', onclick: () => row.nextElementSibling?.after(row) }),
      el('button', { type: 'button', class: 'quiet', text: 'شيل المنتج', onclick: () => row.remove() })));
  return row;
}

async function saveProducts() {
  const products = [...$('products').children].map(row =>
    Object.fromEntries([...row.querySelectorAll('[data-field]')].map(f => [f.dataset.field, f.value])));
  if (!confirm(`هتنشر ${products.length} منتج على الموقع. متأكد؟`)) return;

  $('save-products').disabled = true;
  const result = await api('/api/admin/products', { method: 'PUT', body: { products, sha } });
  $('save-products').disabled = false;
  if (result.ok) {
    sha = result.data.sha;
    notice($('products-status'), 'اتحفظ. الموقع بيتبني دلوقتي، والأسعار الجديدة هتظهر خلال دقيقة أو اتنين.');
  } else if (result.status === 409) {
    notice($('products-status'), 'حد عدّل المنتجات بعد ما فتحت الصفحة. حمّل الصفحة تاني وعدّل من الأول.', true);
  } else if (result.data.error === 'bad_product') {
    const [, number, field] = result.data.field.match(/^product (\d+)(?:: (\w+))?$/) ?? [];
    notice($('products-status'), number ? `صلّح خانة «${FIELD_NAMES[field] ?? 'البيانات'}» في المنتج رقم ${number}.` : 'لازم يكون فيه منتج واحد على الأقل، و40 بالكتير.', true);
  } else {
    notice($('products-status'), errorText(result, 'الحفظ ما نجحش. جرّب تاني.'), true);
  }
}

// في الآخر: الـ await بيوقف الملف لحد ما يرد، وstart بتستعمل المتغيرات اللي فوق (let offset و sha)،
// فلو اتنده عليها قبل تعريفهم كانت بتوقع (Cannot access 'offset' before initialization)
const me = await api('/api/me');
if (!me.data.signedIn) location.replace('/login');
else if (!me.data.isAdmin) $('denied').hidden = false;
else start();
