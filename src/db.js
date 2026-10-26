import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || new URL('../data/lexbeauty.db', import.meta.url).pathname;

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS services (
    id             INTEGER PRIMARY KEY,           -- ID služby v Booqme
    name           TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    category_order INTEGER NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    duration_min   INTEGER,
    price          REAL,
    price_from     INTEGER NOT NULL DEFAULT 0,    -- 1 = "Cena od"
    worker_ids     TEXT    NOT NULL DEFAULT '',
    active         INTEGER NOT NULL DEFAULT 1,
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS available_dates (
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date       TEXT    NOT NULL,                  -- YYYY-MM-DD
    synced_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (service_id, date)
  );

  CREATE TABLE IF NOT EXISTS slots (
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date       TEXT    NOT NULL,
    time       TEXT    NOT NULL,                  -- HH:MM
    synced_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (service_id, date, time)
  );

  CREATE TABLE IF NOT EXISTS slot_fetches (
    service_id INTEGER NOT NULL,
    date       TEXT    NOT NULL,
    fetched_at INTEGER NOT NULL,                  -- unix ms
    PRIMARY KEY (service_id, date)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id   INTEGER NOT NULL,
    service_name TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    time         TEXT    NOT NULL,
    first_name   TEXT    NOT NULL,
    last_name    TEXT    NOT NULL,
    email        TEXT    NOT NULL,
    phone        TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'nova', -- nova | potvrdena | zrusena
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    ok          INTEGER,
    message     TEXT
  );
`);
