// ============================================================
// Finance OS — Database wrapper
// better-sqlite3: sincrono, zero dipendenze esterne.
// Quando passerai a PostgreSQL → swap qui.
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(__dirname, '../../data/finance-os.db');
const SCHEMA_DIR = path.join(__dirname);

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    console.log(`[DB] Connesso: ${DB_PATH}`);
  }
  return _db;
}

// ------------------------------------------------------------
// Inizializza schema + esegue migration pendenti
// Chiamato all'avvio — idempotente
// ------------------------------------------------------------
export function initDb(): void {
  const db = getDb();

  const schemaFiles = [
    path.join(SCHEMA_DIR, 'schema.sql'),
    path.join(SCHEMA_DIR, 'schema.reconciliation.sql'),
    path.join(SCHEMA_DIR, 'schema.users.sql'),
  ];

  for (const file of schemaFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`[DB] Schema non trovato: ${file}`);
      continue;
    }
    db.exec(fs.readFileSync(file, 'utf-8'));
    console.log(`[DB] Schema applicato: ${path.basename(file)}`);
  }

  runMigrations(db);
  seedDefaultData(db);
  console.log('[DB] Inizializzazione completata.');
}

// ------------------------------------------------------------
// Migration runner — usa PRAGMA user_version come versione
// Ogni migration è idempotente: eseguita solo una volta
// ------------------------------------------------------------
function runMigrations(db: Database.Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number);
  const migrationsDir = path.join(SCHEMA_DIR, 'migrations');

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0]);
    if (version <= currentVersion) continue;

    console.log(`[DB] Migration: ${file}`);
    try {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      // Esegui ogni statement separatamente per gestire errori parziali
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          db.prepare(stmt).run();
        } catch (e) {
          // Ignora "duplicate column" — migration già parzialmente applicata
          if (!(e as Error).message.includes('duplicate column')) throw e;
        }
      }
      db.pragma(`user_version = ${version}`);
      console.log(`[DB] Migration ${file} applicata.`);
    } catch (e) {
      console.error(`[DB] Migration ${file} fallita:`, (e as Error).message);
      throw e;
    }
  }
}

// ------------------------------------------------------------
// Seed: inserisce i 5 conti default se il DB è nuovo
// I conti vengono assegnati a user_id = 1 (primo utente)
// ------------------------------------------------------------
function seedDefaultData(db: Database.Database): void {
  // Controlla se esiste già la colonna user_id sugli accounts
  const hasUserCol = (db.pragma('table_info(accounts)') as { name: string }[])
    .some(col => col.name === 'user_id');

  const count = (db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number }).c;
  if (count > 0) return;

  console.log('[DB] Seed: inserimento conti default...');

  const insertAccount = hasUserCol
    ? db.prepare(`INSERT INTO accounts (id, name, bank_name, iban, type, currency, balance, color_tag, notes, user_id)
                  VALUES (@id, @name, @bank_name, @iban, @type, @currency, @balance, @color_tag, @notes, 1)`)
    : db.prepare(`INSERT INTO accounts (id, name, bank_name, iban, type, currency, balance, color_tag, notes)
                  VALUES (@id, @name, @bank_name, @iban, @type, @currency, @balance, @color_tag, @notes)`);

  const accounts = [
    { id: 'acc_fineco',  name: 'FinecoBank — Principale',         bank_name: 'FinecoBank',         iban: '', type: 'checking',   currency: 'EUR', balance: 0, color_tag: '#FF6600', notes: 'Stipendio + portafoglio azionario.' },
    { id: 'acc_revolut', name: 'Revolut — Spese discrezionali',   bank_name: 'Revolut',             iban: '', type: 'prepaid',    currency: 'EUR', balance: 0, color_tag: '#191C1F', notes: 'Svago, ristoranti, viaggi.' },
    { id: 'acc_intesa',  name: 'Intesa San Paolo — Spese fisse',  bank_name: 'Intesa San Paolo',    iban: '', type: 'checking',   currency: 'EUR', balance: 0, color_tag: '#E31837', notes: 'Affitto, bollette, abbonamenti.' },
    { id: 'acc_tr',      name: 'Trade Republic — Cuscinetto',     bank_name: 'Trade Republic',      iban: '', type: 'savings',    currency: 'EUR', balance: 0, color_tag: '#00B140', notes: 'Deposito non vincolato 4%.' },
    { id: 'acc_paypal',  name: 'PayPal',                          bank_name: 'PayPal',              iban: '', type: 'prepaid',    currency: 'EUR', balance: 0, color_tag: '#003087', notes: 'Paga in 3 rate, pagamenti tra amici.' },
  ];

  db.transaction(() => {
    for (const acc of accounts) insertAccount.run(acc);
  })();

  console.log(`[DB] Seed: ${accounts.length} conti inseriti.`);
}

// ------------------------------------------------------------
// Helper query tipizzati
// ------------------------------------------------------------
export function findOne<T>(sql: string, params: unknown = {}): T | undefined {
  return getDb().prepare(sql).get(params) as T | undefined;
}

export function findMany<T>(sql: string, params: unknown = {}): T[] {
  return getDb().prepare(sql).all(params) as T[];
}

export function run(sql: string, params: unknown = {}): Database.RunResult {
  return getDb().prepare(sql).run(params);
}

export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}
