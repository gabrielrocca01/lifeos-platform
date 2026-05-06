import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export function createDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT,
      modules_enabled TEXT NOT NULL DEFAULT '["life","finance"]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
