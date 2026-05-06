import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from './db/database.js';
import { accountsRouter }     from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { importRouter }       from './routes/import.js';
import { plannedRouter }      from './routes/planned.js';
import { kakeboRouter }       from './routes/kakebo.js';
import { investmentsRouter }  from './routes/investments.js';
import { fiscalRouter }       from './routes/fiscal.js';

const dbPath = process.env.FINANCE_DB_PATH ?? './data/finance.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

initDb();

export const router = express.Router();
router.use('/accounts',     accountsRouter);
router.use('/transactions', transactionsRouter);
router.use('/import',       importRouter);
router.use('/planned',      plannedRouter);
router.use('/kakebo',       kakeboRouter);
router.use('/investments',  investmentsRouter);
router.use('/fiscal',       fiscalRouter);

if (process.env.STANDALONE === 'true') {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' }));
  app.use(express.json());
  app.use('/', router);
  app.listen(3001, () => console.log('[finance-api] :3001'));
}
