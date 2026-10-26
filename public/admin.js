const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = { nova: 'Nová', potvrdena: 'Potvrdená', zrusena: 'Zrušená' };

let token = sessionStorage.getItem('lex-admin') || '';

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('Neplatný token'); }
  if (!res.ok) throw new Error(data.error || 'Chyba');
  return data;
}

function logout() {
  token = '';
  sessionStorage.removeItem('lex-admin');
  $('#app').hidden = true;
  $('#login').hidden = false;
}

async function load() {
  const status = $('#filter').value;
  const { bookings } = await api(`/api/admin/bookings${status ? `?status=${status}` : ''}`);
  $('#rows').innerHTML = bookings.length ? bookings.map((b) => `
    <tr>
      <td><strong>${esc(new Date(b.date + 'T12:00').toLocaleDateString('sk-SK'))}</strong><br>${esc(b.time)}</td>
      <td>${esc(b.service_name)}</td>
      <td>${esc(b.first_name)} ${esc(b.last_name)}</td>
      <td><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td>
      <td>${esc(b.note)}</td>
      <td><span class="badge badge--${esc(b.status)}">${STATUSES[b.status] || esc(b.status)}</span><br>
        <select data-id="${b.id}">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${k === b.status ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td class="muted">${esc(b.created_at)}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="muted">Žiadne rezervácie.</td></tr>';

  const { syncs } = await api('/api/admin/status');
  const last = syncs[0];
  $('#sync-info').textContent = last ? `Posledná synchronizácia: ${last.finished_at || last.started_at} UTC · ${last.ok ? '✓' : '✗'} ${last.message || ''}` : '';
}

async function show() {
  try {
    await load();
    $('#login').hidden = true;
    $('#app').hidden = false;
  } catch (e) {
    logout();
  }
}

$('#login').addEventListener('submit', (e) => {
  e.preventDefault();
  token = new FormData(e.target).get('token');
  sessionStorage.setItem('lex-admin', token);
  show();
});
$('#logout').addEventListener('click', logout);
$('#filter').addEventListener('change', load);
$('#rows').addEventListener('change', async (e) => {
  if (!e.target.dataset.id) return;
  await api(`/api/admin/booking?id=${e.target.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
  load();
});
$('#sync-btn').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try { await api('/api/admin/sync', { method: 'POST' }); await load(); }
  catch (err) { alert(err.message); }
  finally { e.target.disabled = false; }
});

token ? show() : logout();
