import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { validateEnv } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { createDb } from './db/database.js';

validateEnv(['JWT_SECRET', 'CORS_ORIGIN']);
const _db = createDb(process.env.DB_PATH ?? './data/platform.db');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRouter);

try {
  // @ts-ignore — moduli risolti a runtime da Node, non in compile time
  const { router: financeRouter } = await import('../../../modules/finance/backend/src/index.js');
  // @ts-ignore
  const { router: lifeRouter }    = await import('../../../modules/life/backend/src/index.js');
  app.use('/api/finance', financeRouter);
  app.use('/api/life',    lifeRouter);
  console.log('[api-core] moduli finance e life montati');
} catch (e) {
  console.error('[api-core] errore nel caricamento moduli:', e);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = parseInt(process.env.PORT ?? '3000');
app.listen(PORT, () => console.log(`[api-core] :${PORT}`));
