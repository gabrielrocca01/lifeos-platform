-- ============================================================
-- Migration 001 — Aggiunge user_id a tutte le tabelle dati
-- Tutti i record esistenti vengono assegnati a user_id = 1
-- (il primo utente che si registra diventa il proprietario)
--
-- NOTA: REFERENCES omesso in ALTER TABLE — SQLite non supporta
-- REFERENCES + DEFAULT non-NULL nella stessa colonna aggiunta.
-- Il vincolo FK è garantito a livello applicativo.
-- ============================================================

ALTER TABLE accounts              ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE import_batches        ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transactions          ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE kakebo_entries        ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reconciliation_sessions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE planned_expenses      ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tax_records           ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deductible_items      ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE investments           ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE investment_operations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE budgets               ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_accounts_user              ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user          ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_user        ON import_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_kakebo_entries_user        ON kakebo_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_user        ON reconciliation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_planned_expenses_user      ON planned_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_user           ON tax_records(user_id);
CREATE INDEX IF NOT EXISTS idx_deductible_items_user      ON deductible_items(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user           ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_operations_user ON investment_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user               ON budgets(user_id);
