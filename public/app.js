const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${Number(n).toLocaleString('sk-SK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const priceText = (s) => (s.priceFrom ? 'od ' : '') + money(s.price);
const parseDate = (iso) => new Date(`${iso}T12:00:00`);
const fmtDate = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => parseDate(iso).toLocaleDateString('sk-SK', opts);
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Nastala chyba'), { status: res.status });
  return data;
}

/* ---------- Navigácia ---------- */
const nav = $('.nav');
$('.nav__toggle').addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  $('.nav__toggle').setAttribute('aria-expanded', open);
});
$$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));
addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scrollY > 10), { passive: true });
$('#year').textContent = new Date().getFullYear();

const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
}), { threshold: 0.12 });
const reveal = (els) => els.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
reveal($$('.section__head, .about__img, .about__text, .lymph__inner, .contact__card'));

/* ---------- Obsah ---------- */
function renderTreatments(treatments) {
  const tags = ['Všetko', ...new Set(treatments.flatMap((t) => t.tags))];
  const filters = $('#filters');
  filters.innerHTML = tags.map((t, i) => `<button role="tab" aria-selected="${i === 0}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $$('button', filters).forEach((b) => b.setAttribute('aria-selected', b === btn));
    $$('.card', $('#treatments')).forEach((c) => {
      c.hidden = btn.dataset.tag !== 'Všetko' && !c.dataset.tags.split('|').includes(btn.dataset.tag);
    });
  });

  $('#treatments').innerHTML = treatments.map((t) => `
    <article class="card" data-tags="${esc(t.tags.join('|'))}">
      <div class="card__img"><img src="${esc(t.image)}" alt="${esc(`${t.title} ${t.subtitle}`)}" loading="lazy"></div>
      <div class="card__body">
        <h3>${esc(t.title)}<small>${esc(t.subtitle)}</small></h3>
        ${t.concerns ? `<ul class="card__concerns">${t.concerns.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${t.intro ? `<p class="card__intro">${esc(t.intro)}</p>` : ''}
        <details>
          <summary>Priebeh ošetrenia</summary>
          <ol>${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          ${t.note ? `<p class="card__note">${esc(t.note)}</p>` : ''}
        </details>
        <div class="card__foot">
          ${t.service ? `<span class="pill">${t.service.durationMin} min</span><span class="price">${t.service.priceFrom ? '<small>od</small>' : ''}${money(t.service.price)}</span>` : ''}
        </div>
        ${t.service ? `<button class="btn btn--ghost btn--block" style="margin-top:1.2rem" data-book="${t.service.id}">Rezervovať</button>` : ''}
      </div>
    </article>`).join('');
  reveal($$('.card'));
}

function renderContact(studio) {
  const rows = [
    ['Adresa', `<a href="${esc(studio.mapsUrl)}" target="_blank" rel="noopener">${esc(studio.address)}</a>`],
    studio.phone && ['Telefón', `<a href="tel:${esc(studio.phone.replace(/\s/g, ''))}">${esc(studio.phone)}</a>`],
    ['Instagram', `<a href="${esc(studio.instagram)}" target="_blank" rel="noopener">@lexbeauty_stupava</a>`],
    ['Kozmetička', esc(studio.owner)],
  ].filter(Boolean);
  $('#contact').innerHTML = rows.map(([k, v]) => `<li><span>${k}</span>${v}</li>`).join('');
}

function renderPricing({ categories, lastSync }) {
  $('#pricing').innerHTML = categories.map((c) => `
    <div class="price-group">
      <h3>${esc(c.name)}</h3>
      ${c.services.map((s) => `
        <div class="price-row">
          <span class="price-row__name">${s.bookable ? `<button data-book="${s.id}">${esc(s.name)}</button>` : esc(s.name)}</span>
          <span class="price-row__dots"></span>
          <span class="price-row__dur">${s.bookable ? `${s.durationMin} min` : ''}</span>
          <span class="price-row__price">${s.bookable ? priceText(s) : 'na objednávku'}</span>
        </div>`).join('')}
    </div>`).join('');
  if (lastSync) {
    const d = new Date(lastSync.replace(' ', 'T') + 'Z');
    $('#pricing-sync').textContent = `Ceny synchronizované s rezervačným systémom ${d.toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }
}

/* ---------- Rezervácia ---------- */
const state = { services: new Map(), service: null, dates: [], date: null, time: null, month: null, step: 1 };

function setStep(step) {
  state.step = step;
  $$('.panel').forEach((p) => { p.hidden = Number(p.dataset.panel) !== step; });
  $$('.steps li').forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle('is-active', n === step);
    li.classList.toggle('is-done', n < step);
  });
  $('#back-btn').hidden = step === 1 || step === 5;
  updateSummary();
}

function updateSummary() {
  const s = state.service;
  const set = (k, v) => { $(`[data-sum="${k}"]`).textContent = v || '—'; };
  set('service', s?.name);
  set('duration', s && `${s.durationMin} min`);
  set('price', s && priceText(s));
  set('date', state.date && fmtDate(state.date, { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }));
  set('time', state.time);
}

function renderServiceList(categories) {
  $('#service-list').innerHTML = categories.map((c) => {
    const items = c.services.filter((s) => s.bookable);
    if (!items.length) return '';
    return `<div><h4>${esc(c.name)}</h4><div class="service-list__items">${items.map((s) => `
      <button class="opt" type="button" data-service="${s.id}" aria-pressed="false">
        <div><strong>${esc(s.name)}</strong><span>${s.durationMin} min</span></div><b>${priceText(s)}</b>
      </button>`).join('')}</div></div>`;
  }).join('');
}

async function selectService(id) {
  const s = state.services.get(Number(id));
  if (!s) return;
  Object.assign(state, { service: s, date: null, time: null, dates: [] });
  $$('[data-service]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.service) === s.id));
  setStep(2);
  $('#calendar').innerHTML = '<div class="skeleton" style="height:280px"></div>';
  try {
    const { dates } = await api(`/api/dates?serviceId=${s.id}`);
    if (state.service !== s) return;
    state.dates = dates;
    state.month = dates.length ? parseDate(dates[0]) : new Date();
    state.month.setDate(1);
    renderCalendar();
  } catch (e) {
    $('#calendar').innerHTML = `<p class="calendar__empty muted">${esc(e.message)}</p>`;
  }
}

function renderCalendar() {
  const free = new Set(state.dates);
  const m = state.month;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // pondelok = 0
  const minMonth = state.dates[0]?.slice(0, 7);
  const maxMonth = state.dates.at(-1)?.slice(0, 7);
  const cur = toIso(first).slice(0, 7);

  const cells = Array.from({ length: offset }, () => '<span></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toIso(new Date(m.getFullYear(), m.getMonth(), d));
    cells.push(free.has(iso)
      ? `<button type="button" class="day day--free" data-date="${iso}" aria-pressed="${state.date === iso}" aria-label="${fmtDate(iso)}">${d}</button>`
      : `<span class="day">${d}</span>`);
  }
  $('#calendar').innerHTML = `
    <div class="calendar__head">
      <button type="button" class="calendar__nav" data-month="-1" aria-label="Predchádzajúci mesiac" ${!minMonth || cur <= minMonth ? 'disabled' : ''}>‹</button>
      <h4>${first.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })}</h4>
      <button type="button" class="calendar__nav" data-month="1" aria-label="Nasledujúci mesiac" ${!maxMonth || cur >= maxMonth ? 'disabled' : ''}>›</button>
    </div>
    ${state.dates.length ? '' : '<p class="calendar__empty muted">Pre túto službu momentálne nie sú voľné termíny.</p>'}
    <div class="calendar__grid">
      ${['po', 'ut', 'st', 'št', 'pi', 'so', 'ne'].map((d) => `<span class="calendar__dow">${d}</span>`).join('')}
      ${cells.join('')}
    </div>`;
}

async function selectDate(iso) {
  Object.assign(state, { date: iso, time: null });
  setStep(3);
  $('#slots-label').textContent = fmtDate(iso);
  $('#slots').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" style="height:42px"></div>').join('');
  try {
    const { times } = await api(`/api/slots?serviceId=${state.service.id}&date=${iso}`);
    if (state.date !== iso) return;
    if (!times.length) {
      $('#slots').innerHTML = '<p class="muted" style="grid-column:1/-1">Tento deň je už obsadený. Vyberte prosím iný dátum.</p>';
      return;
    }
    const groups = [['Doobeda', times.filter((t) => t < '12:00')], ['Poobede', times.filter((t) => t >= '12:00')]];
    $('#slots').innerHTML = groups.filter(([, ts]) => ts.length).map(([label, ts]) =>
      `<h5>${label}</h5>${ts.map((t) => `<button type="button" class="slot" data-time="${t}" aria-pressed="false">${t}</button>`).join('')}`).join('');
  } catch (e) {
    $('#slots').innerHTML = `<p class="muted" style="grid-column:1/-1">${esc(e.message)}</p>`;
  }
}

function startBooking(serviceId) {
  $('#rezervacia').scrollIntoView({ behavior: 'smooth' });
  selectService(serviceId);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-book], [data-service], [data-date], [data-time], [data-month]');
  if (!t) return;
  if (t.dataset.book) startBooking(t.dataset.book);
  else if (t.dataset.service) selectService(t.dataset.service);
  else if (t.dataset.date) selectDate(t.dataset.date);
  else if (t.dataset.month) { state.month.setMonth(state.month.getMonth() + Number(t.dataset.month)); renderCalendar(); }
  else if (t.dataset.time) {
    state.time = t.dataset.time;
    $$('.slot').forEach((b) => b.setAttribute('aria-pressed', b === t));
    setStep(4);
    $('#booking-form [name="firstName"]').focus({ preventScroll: true });
  }
});

$('#back-btn').addEventListener('click', () => setStep(Math.max(1, state.step - 1)));
$('#done-again').addEventListener('click', () => {
  Object.assign(state, { service: null, date: null, time: null });
  $$('[data-service]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  $('#booking-form').reset();
  setStep(1);
});

$('#booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const err = $('#form-error');
  err.hidden = true;
  if (!form.checkValidity()) {
    err.textContent = 'Vyplňte prosím všetky povinné polia a potvrďte súhlas.';
    err.hidden = false;
    return;
  }
  const fd = Object.fromEntries(new FormData(form));
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  btn.textContent = 'Odosielam…';
  try {
    const res = await api('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fd, consent: !!fd.consent, serviceId: state.service.id, date: state.date, time: state.time }),
    });
    $('#done-text').innerHTML = `<strong>${esc(res.service)}</strong><br>${esc(fmtDate(res.date))} o ${esc(res.time)}`;
    $('#done-booqme').href = res.bookingUrl;
    setStep(5);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    if (ex.status === 409) selectDate(state.date);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Odoslať rezerváciu';
  }
});

/* ---------- Štart ---------- */
async function init() {
  try {
    const [site, services] = await Promise.all([api('/api/site'), api('/api/services')]);
    renderTreatments(site.treatments);
    renderContact(site.studio);
    $('#lymph').innerHTML = site.lymphBenefits.map((b) => `<li>${esc(b)}</li>`).join('');
    renderPricing(services);
    services.categories.forEach((c) => c.services.forEach((s) => state.services.set(s.id, s)));
    renderServiceList(services.categories);
  } catch (e) {
    $('#pricing').innerHTML = `<p class="muted center">Cenník sa nepodarilo načítať. ${esc(e.message)}</p>`;
  }

  api('/api/next-slot').then(({ next }) => {
    if (!next) return;
    const el = $('#next-slot');
    el.textContent = `Najbližší voľný termín: ${fmtDate(next.date)}${next.time ? ` o ${next.time}` : ''}`;
    el.hidden = false;
  }).catch(() => {});
}
init();
