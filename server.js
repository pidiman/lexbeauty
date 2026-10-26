import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './src/db.js';
import { BOOKING_URL, getSlots, syncAll, syncDates } from './src/booqme.js';
import { lymphBenefits, studio, treatments } from './src/content.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = new URL('./public/', import.meta.url).pathname;
const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(12).toString('hex');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s ?? '');

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 20_000) throw new HttpError(413, 'Príliš veľká požiadavka');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new HttpError(400, 'Neplatné JSON dáta'); }
}

function requireAdmin(req) {
  const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, 'Neautorizované');
}

function activeService(id) {
  const s = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(id));
  if (!s) throw new HttpError(404, 'Služba neexistuje');
  return s;
}

const serviceDto = (s) => s && {
  id: s.id, name: s.name, category: s.category, durationMin: s.duration_min,
  price: s.price, priceFrom: !!s.price_from, bookable: s.price > 0,
};

// Za reverse proxy (Caddy) je skutočná IP v poslednej položke X-Forwarded-For – tú pridáva sama proxy.
const clientIp = (req) =>
  (process.env.TRUST_PROXY && req.headers['x-forwarded-for']?.split(',').at(-1).trim()) || req.socket.remoteAddress;

// Jednoduchý limit odoslaných rezervácií na IP adresu.
const bookingHits = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const hits = (bookingHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= 5) throw new HttpError(429, 'Príliš veľa rezervácií. Skúste to neskôr.');
  hits.push(now);
  bookingHits.set(ip, hits);
}

const routes = {
  'GET /api/site': () => {
    const get = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1');
    return {
      studio,
      bookingUrl: BOOKING_URL,
      lymphBenefits,
      treatments: treatments.map((t) => ({ ...t, image: `/img/${t.slug}.jpg`, service: serviceDto(get.get(t.booqmeId)) })),
    };
  },

  'GET /api/services': () => {
    const rows = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY category_order, sort_order').all();
    const categories = [];
    for (const r of rows) {
      let cat = categories.at(-1);
      if (cat?.name !== r.category) categories.push((cat = { name: r.category, services: [] }));
      cat.services.push(serviceDto(r));
    }
    const lastSync = db.prepare('SELECT finished_at FROM sync_log WHERE ok = 1 ORDER BY id DESC LIMIT 1').get();
    return { categories, lastSync: lastSync?.finished_at ?? null };
  },

  'GET /api/dates': async (req, url) => {
    const s = activeService(url.searchParams.get('serviceId'));
    const latest = db.prepare('SELECT MAX(synced_at) AS at FROM available_dates WHERE service_id = ?').get(s.id).at;
    const stale = !latest || Date.now() - Date.parse(latest.replace(' ', 'T') + 'Z') > 15 * 60 * 1000;
    if (stale) await syncDates(s.id).catch((e) => console.warn('syncDates:', e.message));
    const today = new Date().toISOString().slice(0, 10);
    const dates = db.prepare('SELECT date FROM available_dates WHERE service_id = ? AND date >= ? ORDER BY date').all(s.id, today);
    return { serviceId: s.id, dates: dates.map((d) => d.date) };
  },

  'GET /api/slots': async (req, url) => {
    const s = activeService(url.searchParams.get('serviceId'));
    const date = url.searchParams.get('date');
    if (!isDate(date)) throw new HttpError(400, 'Neplatný dátum');
    return { serviceId: s.id, date, times: await getSlots(s.id, date) };
  },

  'GET /api/next-slot': async () => {
    const row = db.prepare(`
      SELECT a.service_id, a.date FROM available_dates a JOIN services s ON s.id = a.service_id
      WHERE s.active = 1 AND a.date >= date('now') ORDER BY a.date, s.duration_min LIMIT 1`).get();
    if (!row) return { next: null };
    const times = await getSlots(row.service_id, row.date).catch(() => []);
    return { next: { date: row.date, time: times[0] ?? null } };
  },

  'POST /api/bookings': async (req) => {
    const b = await readBody(req);
    if (b.website) throw new HttpError(400, 'Neplatná požiadavka'); // honeypot
    const s = activeService(b.serviceId);
    if (s.price <= 0) throw new HttpError(400, 'Táto služba sa nerezervuje na termín');
    const clean = (v, max) => String(v ?? '').trim().slice(0, max);
    const data = {
      firstName: clean(b.firstName, 60), lastName: clean(b.lastName, 60),
      email: clean(b.email, 120), phone: clean(b.phone, 30), note: clean(b.note, 500),
    };
    if (!data.firstName || !data.lastName) throw new HttpError(400, 'Vyplňte meno a priezvisko');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new HttpError(400, 'Neplatný email');
    if (!/^\+?[\d\s/-]{9,}$/.test(data.phone)) throw new HttpError(400, 'Neplatné telefónne číslo');
    if (!isDate(b.date) || !isTime(b.time)) throw new HttpError(400, 'Vyberte dátum a čas');
    if (!b.consent) throw new HttpError(400, 'Je potrebný súhlas so spracovaním osobných údajov');

    rateLimit(clientIp(req));
    const times = await getSlots(s.id, b.date, { fresh: true });
    if (!times.includes(b.time)) throw new HttpError(409, 'Tento termín už nie je voľný. Vyberte prosím iný.');
    const clash = db.prepare("SELECT 1 FROM bookings WHERE date = ? AND time = ? AND status != 'zrusena'").get(b.date, b.time);
    if (clash) throw new HttpError(409, 'Tento termín je už rezervovaný. Vyberte prosím iný.');

    const r = db.prepare(`
      INSERT INTO bookings (service_id, service_name, date, time, first_name, last_name, email, phone, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(s.id, s.name, b.date, b.time, data.firstName, data.lastName, data.email, data.phone, data.note);
    return { id: Number(r.lastInsertRowid), service: s.name, date: b.date, time: b.time, bookingUrl: BOOKING_URL };
  },

  'GET /api/admin/bookings': (req, url) => {
    requireAdmin(req);
    const status = url.searchParams.get('status');
    const rows = status
      ? db.prepare('SELECT * FROM bookings WHERE status = ? ORDER BY date DESC, time DESC').all(status)
      : db.prepare('SELECT * FROM bookings ORDER BY date DESC, time DESC').all();
    return { bookings: rows };
  },

  'PATCH /api/admin/booking': async (req, url) => {
    requireAdmin(req);
    const { status } = await readBody(req);
    if (!['nova', 'potvrdena', 'zrusena'].includes(status)) throw new HttpError(400, 'Neplatný stav');
    const r = db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, Number(url.searchParams.get('id')));
    if (!r.changes) throw new HttpError(404, 'Rezervácia neexistuje');
    return { ok: true };
  },

  'GET /api/admin/status': (req) => {
    requireAdmin(req);
    return {
      syncs: db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all(),
      counts: db.prepare('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').all(),
    };
  },

  'POST /api/admin/sync': async (req) => {
    requireAdmin(req);
    return { message: await syncAll() };
  },
};

async function serveStatic(res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  else if (pathname === '/admin') pathname = '/admin.html';
  const file = normalize(join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR)) throw new HttpError(403, 'Zakázané');
  try {
    const body = await readFile(file);
    const type = MIME[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('image/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(body);
  } catch {
    throw new HttpError(404, 'Stránka neexistuje');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    const handler = routes[`${req.method} ${url.pathname}`];
    if (handler) return json(res, 200, await handler(req, url));
    if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'Neznámy endpoint');
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Nepovolená metóda');
    await serveStatic(res, url.pathname);
  } catch (e) {
    const status = e.status || 502;
    if (!e.status) console.error(e);
    if (url.pathname.startsWith('/api/')) json(res, status, { error: e.status ? e.message : 'Rezervačný systém je dočasne nedostupný' });
    else { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(e.message); }
  }
});

server.listen(PORT, () => {
  console.log(`LEX web beží na http://localhost:${PORT}`);
  if (!process.env.ADMIN_TOKEN) console.log(`Admin (/admin) token pre túto reláciu: ${ADMIN_TOKEN}`);
});

const sync = () => syncAll().then((m) => console.log('Booqme sync:', m)).catch((e) => console.error('Booqme sync zlyhal:', e.message));
sync();
setInterval(sync, SYNC_INTERVAL_MS).unref();
