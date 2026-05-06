-- ============================================================
-- Finance OS — Schema Database
-- SQLite (dev) | PostgreSQL-ready (Jarvis migration)
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- ACCOUNTS — conti bancari, carte, wallet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,                          -- es. "Conto Principale Fineco"
  bank_name    TEXT NOT NULL,                          -- es. "Fineco", "N26", "Revolut"
  iban         TEXT,
  type         TEXT NOT NULL CHECK (type IN (
                 'checking',    -- conto corrente
                 'savings',     -- conto risparmio
                 'credit_card', -- carta di credito
                 'prepaid',     -- carta prepagata
                 'investment',  -- conto titoli
                 'cash'         -- contante
               )),
  currency     TEXT NOT NULL DEFAULT 'EUR',
  balance      REAL NOT NULL DEFAULT 0,               -- saldo attuale (aggiornato manualmente o via import)
  color_tag    TEXT DEFAULT '#4A90D9',                -- colore UI per distinguere i conti
  is_active    INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- CATEGORIES — categorie di spesa/entrata
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name                TEXT NOT NULL,
  parent_id           TEXT REFERENCES categories(id),  -- per sottocategorie
  icon                TEXT DEFAULT '📁',
  color               TEXT DEFAULT '#888',
  is_deductible       INTEGER NOT NULL DEFAULT 0,
  deductible_code_730 TEXT,   -- codice sezione 730 (es. "E1", "E8", "19")
  is_system           INTEGER NOT NULL DEFAULT 0,      -- 1 = categoria di sistema non eliminabile
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorie di default (sistema)
INSERT OR IGNORE INTO categories (id, name, icon, color, is_deductible, deductible_code_730, is_system) VALUES
  ('cat_alimentari',    'Alimentari',           '🛒', '#4CAF50', 0, NULL,  1),
  ('cat_trasporti',     'Trasporti',            '🚗', '#2196F3', 0, NULL,  1),
  ('cat_casa',          'Casa & Utenze',        '🏠', '#FF9800', 0, NULL,  1),
  ('cat_salute',        'Salute & Farmaci',     '💊', '#E91E63', 1, 'E1',  1),
  ('cat_istruzione',    'Istruzione',           '📚', '#9C27B0', 1, 'E8',  1),
  ('cat_sport',         'Sport & Fitness',      '🏃', '#00BCD4', 1, '19',  1),
  ('cat_assicurazioni', 'Assicurazioni',        '🛡️', '#607D8B', 1, 'E13', 1),
  ('cat_mutuo',         'Mutuo & Interessi',    '🏦', '#795548', 1, 'B1',  1),
  ('cat_stipendio',     'Stipendio',            '💼', '#8BC34A', 0, NULL,  1),
  ('cat_bonus',         'Bonus & Premi',        '🎁', '#FFC107', 0, NULL,  1),
  ('cat_investimenti',  'Investimenti',         '📈', '#3F51B5', 0, NULL,  1),
  ('cat_ristorazione',  'Ristorazione',         '🍽️', '#FF5722', 0, NULL,  1),
  ('cat_abbonamenti',   'Abbonamenti',          '📱', '#9E9E9E', 0, NULL,  1),
  ('cat_svago',         'Svago & Intrattenimento','🎬','#FF4081', 0, NULL,  1),
  ('cat_altro',         'Altro',                '📌', '#78909C', 0, NULL,  1);

-- ------------------------------------------------------------
-- IMPORT_BATCHES — traccia ogni import CSV
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_batches (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  format         TEXT NOT NULL CHECK (format IN ('fineco', 'n26', 'revolut', 'unicredit', 'intesa', 'trade_republic', 'paypal', 'generic')),
  rows_total     INTEGER NOT NULL DEFAULT 0,
  rows_imported  INTEGER NOT NULL DEFAULT 0,
  rows_skipped   INTEGER NOT NULL DEFAULT 0,
  period_from    TEXT,                                -- data prima transazione importata
  period_to      TEXT,                                -- data ultima transazione importata
  imported_at    TEXT NOT NULL DEFAULT (datetime('now')),
  notes          TEXT
);

-- ------------------------------------------------------------
-- TRANSACTIONS — il cuore del sistema
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id      TEXT REFERENCES categories(id),
  import_batch_id  TEXT REFERENCES import_batches(id),

  amount           REAL NOT NULL,                     -- sempre positivo
  direction        TEXT NOT NULL CHECK (direction IN ('in', 'out')),  -- entrata o uscita
  description      TEXT NOT NULL,
  merchant         TEXT,                              -- nome commerciante (estratto da CSV o manuale)
  date             TEXT NOT NULL,                     -- ISO 8601: YYYY-MM-DD
  fiscal_year      TEXT NOT NULL,                     -- anno fiscale (es. "2024")

  -- Detraibilità
  is_deductible    INTEGER NOT NULL DEFAULT 0,
  deductible_type  TEXT,                              -- es. "medica", "istruzione", "sport"
  deductible_pct   REAL DEFAULT 19,                  -- % detraibile (default 19% IRPEF)

  -- Stato
  status           TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN (
                     'pending',    -- in attesa di conferma
                     'confirmed',  -- confermata
                     'excluded'    -- esclusa dai calcoli (es. giroconto)
                   )),
  is_transfer      INTEGER NOT NULL DEFAULT 0,        -- 1 = giroconto tra conti propri
  transfer_pair_id TEXT,                              -- id della transazione gemella

  notes            TEXT,
  tags             TEXT,                              -- JSON array: ["vacanza","detraibile"]
  import_hash      TEXT,                              -- hash dedup per import CSV

  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account   ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_fiscal    ON transactions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_transactions_category  ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deductible ON transactions(is_deductible) WHERE is_deductible = 1;

-- ------------------------------------------------------------
-- TAX_RECORDS — documenti fiscali per anno (CU, 730, estratti)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_records (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  fiscal_year           TEXT NOT NULL,
  document_type         TEXT NOT NULL CHECK (document_type IN (
                          'cu',              -- Certificazione Unica
                          '730',             -- modello 730 precompilato/presentato
                          'estratto_conto',  -- estratto conto bancario
                          'fattura',         -- fattura medica/professionale
                          'ricevuta',        -- ricevuta detraibile
                          'f24',             -- modello F24
                          'altro'
                        )),
  filename              TEXT,                -- nome file originale
  file_path             TEXT,               -- path su disco o URL Jarvis storage
  total_deductible      REAL DEFAULT 0,     -- totale detraibile dichiarato nel doc
  tax_credit_estimate   REAL DEFAULT 0,     -- stima credito d'imposta (total_deductible * 19%)
  reddito_imponibile    REAL,               -- dalla CU: reddito imponibile
  irpef_trattenuta      REAL,               -- dalla CU: IRPEF già trattenuta
  notes                 TEXT,
  uploaded_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_records_year ON tax_records(fiscal_year);

-- ------------------------------------------------------------
-- DEDUCTIBLE_ITEMS — voci detraibili collegate a transazioni
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deductible_items (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  transaction_id      TEXT REFERENCES transactions(id) ON DELETE CASCADE,
  tax_record_id       TEXT REFERENCES tax_records(id),
  fiscal_year         TEXT NOT NULL,

  -- Codice 730
  code_730            TEXT NOT NULL,   -- es. "E1" spese mediche, "E8" istruzione
  category            TEXT NOT NULL,   -- etichetta leggibile
  description         TEXT,

  amount              REAL NOT NULL,
  deductible_pct      REAL NOT NULL DEFAULT 19,
  deductible_amount   REAL GENERATED ALWAYS AS (ROUND(amount * deductible_pct / 100, 2)) STORED,

  confirmed           INTEGER NOT NULL DEFAULT 0,  -- 1 = confermato per la dichiarazione
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deductible_year ON deductible_items(fiscal_year);

-- ------------------------------------------------------------
-- BUDGETS — limiti di spesa mensili per categoria
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category_id    TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  monthly_limit  REAL NOT NULL,
  fiscal_year    TEXT NOT NULL DEFAULT (strftime('%Y', 'now')),
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category_id, fiscal_year)
);

-- ------------------------------------------------------------
-- VIEWS UTILI
-- ------------------------------------------------------------

-- Riepilogo spese per categoria e mese
CREATE VIEW IF NOT EXISTS v_monthly_by_category AS
SELECT
  strftime('%Y-%m', date)  AS month,
  fiscal_year,
  c.name                   AS category,
  c.id                     AS category_id,
  c.color,
  SUM(CASE WHEN t.direction = 'out' THEN t.amount ELSE 0 END) AS total_out,
  SUM(CASE WHEN t.direction = 'in'  THEN t.amount ELSE 0 END) AS total_in,
  COUNT(*)                 AS tx_count
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.status != 'excluded'
GROUP BY month, c.id;

-- Riepilogo detraibili per anno fiscale
CREATE VIEW IF NOT EXISTS v_deductible_summary AS
SELECT
  fiscal_year,
  code_730,
  category,
  COUNT(*)                            AS item_count,
  SUM(amount)                         AS total_amount,
  SUM(deductible_amount)              AS total_deductible,
  SUM(CASE WHEN confirmed=1 THEN deductible_amount ELSE 0 END) AS confirmed_deductible
FROM deductible_items
GROUP BY fiscal_year, code_730;

-- Saldo effettivo per conto (calcolato dalle transazioni)
CREATE VIEW IF NOT EXISTS v_account_balance AS
SELECT
  a.id,
  a.name,
  a.bank_name,
  a.type,
  a.balance AS balance_manual,
  COALESCE(
    SUM(CASE WHEN t.direction='in'  AND t.status!='excluded' THEN t.amount ELSE 0 END) -
    SUM(CASE WHEN t.direction='out' AND t.status!='excluded' THEN t.amount ELSE 0 END),
    0
  ) AS balance_computed
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
WHERE a.is_active = 1
GROUP BY a.id;

-- ------------------------------------------------------------
-- PLANNED_EXPENSES — spese annuali rateizzate
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planned_expenses (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL,
  total_amount  REAL NOT NULL,
  monthly_rate  REAL NOT NULL,           -- total_amount / 12
  month_due     INTEGER NOT NULL CHECK (month_due BETWEEN 1 AND 12),
  account_id    TEXT NOT NULL REFERENCES accounts(id),
  category_id   TEXT REFERENCES categories(id),
  fiscal_year   TEXT NOT NULL DEFAULT (strftime('%Y','now')),
  is_deductible INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- INVESTMENTS — posizioni aperte portafoglio
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investments (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id    TEXT REFERENCES accounts(id),
  ticker        TEXT NOT NULL,
  name          TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 0,
  avg_price     REAL NOT NULL DEFAULT 0,
  current_price REAL NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  asset_type    TEXT NOT NULL DEFAULT 'other'
    CHECK (asset_type IN ('etf','stock','bond','crypto','other')),
  notes         TEXT,
  last_updated  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- INVESTMENT_OPERATIONS — storico buy/sell/dividendi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investment_operations (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('buy','sell','dividend')),
  quantity      REAL NOT NULL DEFAULT 0,
  price         REAL NOT NULL DEFAULT 0,
  date          TEXT NOT NULL,
  fees          REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);