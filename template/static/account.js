import { el, api, formatDate, notice, logout } from '/app.js';

const me = await api('/api/me');
if (!me.data.signedIn) location.replace('/login');
else show(me.data);

async function show(user) {
  document.getElementById('hello').textContent = `أهلاً ${user.name}`;
  document.getElementById('admin-link').hidden = !user.isAdmin;
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('page').hidden = false;

  const result = await api('/api/my/messages');
  if (!result.ok) {
    notice(document.getElementById('error'), 'مش قادرين نجيب رسايلك دلوقتي. جرّب كمان شوية.', true);
    return;
  }
  const list = document.getElementById('messages');
  document.getElementById('empty').hidden = result.data.messages.length > 0;
  for (const m of result.data.messages) {
    const done = m.status === 'done';
    list.append(el('li', { class: 'card' },
      el('div', { class: 'meta' },
        el('span', { text: formatDate(m.created_at) }),
        el('span', { class: done ? 'badge done' : 'badge', text: done ? 'اتعاملنا معاها' : 'وصلتنا' })),
      el('p', { class: 'text', text: m.message }),
      m.reply && el('div', { class: 'reply' }, el('strong', { text: 'ردّنا:' }), el('span', { text: m.reply }))));
  }
}
