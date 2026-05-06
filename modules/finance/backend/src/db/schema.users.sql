-- ============================================================
-- Finance OS — Schema: Users (SaaS multi-tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,         -- bcrypt hash
  name       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
