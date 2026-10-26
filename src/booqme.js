// Klient pre verejný rezervačný formulár Booqme (booqme.app/sk/rezervacia/beauty-by-lex).
// Čítame len verejne dostupné údaje: zoznam služieb, povolené dni a voľné časy.

import { db } from './db.js';

export const SLUG = process.env.BOOQME_SLUG || 'beauty-by-lex';
export const BOOKING_URL = `https://booqme.app/sk/rezervacia/${SLUG}`;
const API = 'https://booqme.app/sk/Reservation';
const SLOT_TTL_MS = 5 * 60 * 1000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LexBeautyWeb/1.0)',
  'Accept-Language': 'sk',
};

let slugToken = null;

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&amp;/g, '&')
   .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function fetchBookingPage() {
  const res = await fetch(BOOKING_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`Booqme stránka vrátila ${res.status}`);
  return res.text();
}

// Z HTML formulára vytiahne kategórie a služby v poradí, v akom ich zobrazuje Booqme.
export function parseServices(html) {
  const token = html.match(/name="slugToken" value="([a-f0-9]+)"/);
  const re = /custom-subheader-color">\s*([^<]+?)\s*<\/span>|<div class="card[^"]*js-checkServiceCard[^"]*"([^>]*)>([\s\S]*?)Dĺžka trvania:<\/span><span class="fw-medium">(\d+) min/g;
  const services = [];
  let category = 'Ostatné';
  let categoryOrder = -1;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      category = decode(m[1]);
      categoryOrder++;
      continue;
    }
    const attrs = m[2];
    const attr = (name) => attrs.match(new RegExp(`data-${name}="([^"]*)"`))?.[1] ?? '';
    const id = Number(attr('service_id').split('-').pop());
    const workers = m[3].match(/data-allowed-workers="([^"]*)"/)?.[1] ?? '';
    services.push({
      id,
      name: decode(attr('service_name')),
      category,
      categoryOrder: Math.max(categoryOrder, 0),
      sortOrder: services.length,
      durationMin: Number(m[4]),
      price: Number(attr('price-raw')),
      priceFrom: attr('price-pointer').includes('od') ? 1 : 0,
      workerIds: workers,
    });
  }
  return { services, slugToken: token?.[1] ?? null };
}

async function post(endpoint, data) {
  if (!slugToken) await syncServices();
  const body = new URLSearchParams({ slug: SLUG, slugToken, groupSize: '1', ...data });
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { ...HEADERS, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!json || json.status !== 'ok') throw new Error(`Booqme ${endpoint}: ${json?.text || res.status}`);
  return json;
}

const workerOf = (serviceId) =>
  db.prepare('SELECT worker_ids FROM services WHERE id = ?').get(serviceId)?.worker_ids.split(',')[0] || 'rand';

export async function syncServices() {
  const { services, slugToken: token } = parseServices(await fetchBookingPage());
  if (!services.length) throw new Error('Na stránke Booqme sa nenašli žiadne služby');
  slugToken = token;

  const upsert = db.prepare(`
    INSERT INTO services (id, name, category, category_order, sort_order, duration_min, price, price_from, worker_ids, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, category_order = excluded.category_order,
      sort_order = excluded.sort_order, duration_min = excluded.duration_min, price = excluded.price,
      price_from = excluded.price_from, worker_ids = excluded.worker_ids, active = 1, updated_at = excluded.updated_at
  `);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE services SET active = 0').run();
    for (const s of services) {
      upsert.run(s.id, s.name, s.category, s.categoryOrder, s.sortOrder, s.durationMin, s.price, s.priceFrom, s.workerIds);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return services;
}

export async function syncDates(serviceId) {
  const data = await post('getAllowedDates', { userId: workerOf(serviceId), serviceId: String(serviceId) });
  const insert = db.prepare('INSERT OR REPLACE INTO available_dates (service_id, date) VALUES (?, ?)');
  db.exec('BEGIN');
  db.prepare('DELETE FROM available_dates WHERE service_id = ?').run(serviceId);
  for (const d of data.allowedDates || []) insert.run(serviceId, d);
  db.exec('COMMIT');
  return data.allowedDates || [];
}

export function parseTimes(html) {
  return [...html.matchAll(/js-checkTime"[^>]*value="(\d{1,2}:\d{2})"/g)].map((m) => m[1].padStart(5, '0'));
}

// Voľné časy pre deň – z cache v DB, ak sú čerstvé, inak živo z Booqme.
export async function getSlots(serviceId, date, { fresh = false } = {}) {
  const cached = db.prepare('SELECT fetched_at FROM slot_fetches WHERE service_id = ? AND date = ?').get(serviceId, date);
  if (!fresh && cached && Date.now() - cached.fetched_at < SLOT_TTL_MS) {
    return db.prepare('SELECT time FROM slots WHERE service_id = ? AND date = ? ORDER BY time').all(serviceId, date).map((r) => r.time);
  }
  try {
    const data = await post('getAvailableReservationTimes', {
      userId: workerOf(serviceId), serviceId: String(serviceId), waitingList: '0', date,
    });
    const times = parseTimes(data.html || '');
    const insert = db.prepare('INSERT INTO slots (service_id, date, time) VALUES (?, ?, ?)');
    db.exec('BEGIN');
    db.prepare('DELETE FROM slots WHERE service_id = ? AND date = ?').run(serviceId, date);
    for (const t of times) insert.run(serviceId, date, t);
    db.prepare('INSERT OR REPLACE INTO slot_fetches (service_id, date, fetched_at) VALUES (?, ?, ?)').run(serviceId, date, Date.now());
    db.exec('COMMIT');
    return times;
  } catch (e) {
    // Booqme nedostupné – vrátime posledný známy stav, ak existuje.
    if (cached) return db.prepare('SELECT time FROM slots WHERE service_id = ? AND date = ? ORDER BY time').all(serviceId, date).map((r) => r.time);
    throw e;
  }
}

let running = null;

// Kompletná synchronizácia: služby + povolené dni pre každú rezervovateľnú službu.
export function syncAll() {
  if (running) return running;
  running = (async () => {
    const log = db.prepare('INSERT INTO sync_log DEFAULT VALUES').run();
    try {
      const services = await syncServices();
      let dates = 0;
      for (const s of services) {
        if (s.price <= 0) continue; // darčekový poukaz nemá termíny
        dates += (await syncDates(s.id)).length;
      }
      const msg = `${services.length} služieb, ${dates} voľných dní`;
      db.prepare("UPDATE sync_log SET finished_at = datetime('now'), ok = 1, message = ? WHERE id = ?").run(msg, log.lastInsertRowid);
      return msg;
    } catch (e) {
      db.prepare("UPDATE sync_log SET finished_at = datetime('now'), ok = 0, message = ? WHERE id = ?").run(String(e.message), log.lastInsertRowid);
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}
