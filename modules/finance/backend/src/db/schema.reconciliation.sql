-- ============================================================
-- Finance OS — Estensione Schema: Kakebo & Riconciliazione
-- Aggiunge al schema.sql esistente
-- ============================================================

-- ------------------------------------------------------------
-- KAKEBO_ENTRIES — voci del kakebo fisico trascritte
-- Fonte: CSV template compilato manualmente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kakebo_entries (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date          TEXT NOT NULL,          -- YYYY-MM-DD
  fiscal_year   TEXT NOT NULL,
  month         TEXT NOT NULL,          -- YYYY-MM (per query veloci)

  account_hint  TEXT,                   -- es. "revolut", "contanti" — non FK, è un hint libero
  category_id   TEXT REFERENCES categories(id),
  description   TEXT NOT NULL,
  amount        REAL NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('in', 'out')),

  notes         TEXT,
  is_cash       INTEGER NOT NULL DEFAULT 0,  -- 1 = pagato contanti (no corrispondenza bancaria)

  -- Riconciliazione
  reconciliation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (reconciliation_status IN (
      'pending',    -- non ancora confrontato
      'matched',    -- trovata corrispondenza bancaria
      'unmatched',  -- nessuna corrispondenza (contanti o errore)
      'ignored'     -- ignorato volontariamente (es. giroconto)
    )),
  matched_transaction_id TEXT REFERENCES transactions(id),
  match_confidence       REAL,   -- 0.0-1.0: quanto è sicuro il match automatico

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kakebo_month  ON kakebo_entries(month);
CREATE INDEX IF NOT EXISTS idx_kakebo_status ON kakebo_entries(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_kakebo_year   ON kakebo_entries(fiscal_year);

-- ------------------------------------------------------------
-- RECONCILIATION_SESSIONS — ogni sessione di confronto
-- Tiene traccia di quando hai fatto la riconciliazione
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  month           TEXT NOT NULL,             -- YYYY-MM
  fiscal_year     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'archived')),

  -- Statistiche della sessione
  kakebo_count    INTEGER NOT NULL DEFAULT 0,
  bank_count      INTEGER NOT NULL DEFAULT 0,
  matched_count   INTEGER NOT NULL DEFAULT 0,
  unmatched_kakebo INTEGER NOT NULL DEFAULT 0,  -- nel kakebo ma non in banca
  unmatched_bank  INTEGER NOT NULL DEFAULT 0,   -- in banca ma non nel kakebo
  discrepancy_sum REAL NOT NULL DEFAULT 0,      -- somma totale delle differenze

  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,

  UNIQUE(month)
);

-- ------------------------------------------------------------
-- VIEW: confronto mensile kakebo vs banca
-- ------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_reconciliation_summary AS
SELECT
  k.month,
  COUNT(DISTINCT k.id)                                          AS kakebo_entries,
  COUNT(DISTINCT t.id)                                          AS bank_entries,
  COUNT(DISTINCT CASE WHEN k.reconciliation_status='matched'   THEN k.id END) AS matched,
  COUNT(DISTINCT CASE WHEN k.reconciliation_status='unmatched' THEN k.id END) AS kakebo_only,
  COUNT(DISTINCT CASE WHEN k.reconciliation_status='pending'   THEN k.id END) AS pending,
  SUM(CASE WHEN k.direction='out' THEN k.amount ELSE 0 END)    AS kakebo_total_out,
  SUM(CASE WHEN t.direction='out' AND t.status='confirmed'
      THEN t.amount ELSE 0 END)                                 AS bank_total_out,
  ABS(
    SUM(CASE WHEN k.direction='out' THEN k.amount ELSE 0 END) -
    SUM(CASE WHEN t.direction='out' AND t.status='confirmed' THEN t.amount ELSE 0 END)
  )                                                             AS delta
FROM kakebo_entries k
LEFT JOIN transactions t
  ON strftime('%Y-%m', t.date) = k.month
  AND t.status != 'excluded'
GROUP BY k.month;
