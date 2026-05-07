import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { requireAuth }    from './middleware/auth.middleware.js';
import { habitsRouter }   from './routes/habits.js';
import { goalsRouter }    from './routes/goals.js';
import { ideasRouter }    from './routes/ideas.js';
import { projectsRouter } from './routes/projects.js';

const dbPath = process.env.LIFE_DB_PATH ?? './data/life.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    label       TEXT NOT NULL,
    icon        TEXT NOT NULL DEFAULT '◉',
    type        TEXT NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean','counter','number')),
    unit        TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    habit_id    TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    date        TEXT NOT NULL,
    value       REAL NOT NULL DEFAULT 1,
    notes       TEXT,
    UNIQUE(habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    horizon     TEXT NOT NULL DEFAULT 'week' CHECK (horizon IN ('day','week','month','year')),
    done        INTEGER NOT NULL DEFAULT 0,
    due_date    TEXT,
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','archived')),
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const router = express.Router();
router.use(requireAuth);
router.use('/habits',   habitsRouter);
router.use('/goals',    goalsRouter);
router.use('/ideas',    ideasRouter);
router.use('/projects', projectsRouter);

if (process.env.STANDALONE === 'true') {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' }));
  app.use(express.json());
  app.use('/', router);
  app.listen(3002, () => console.log('[life-api] :3002'));
}
