import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createDb } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const db = createDb(process.env.DB_PATH ?? './data/platform.db');
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Troppi tentativi — riprova tra 15 minuti' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Troppi tentativi di registrazione — riprova tra un'ora" },
});

authRouter.post('/register', registerLimiter, (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email e password obbligatorie' });
    if (password.length < 8)
      return res.status(400).json({ ok: false, error: 'La password deve avere almeno 8 caratteri' });

    const existing = db.prepare('SELECT id FROM users WHERE email = @email').get({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ ok: false, error: 'Email già registrata' });

    const hash = bcrypt.hashSync(password, 12);
    const user = db.prepare(
      'INSERT INTO users (email, password, name) VALUES (@email, @password, @name) RETURNING id, email, name'
    ).get({ email: email.toLowerCase(), password: hash, name: name || null }) as { id: string; email: string; name: string | null };

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({ ok: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

authRouter.post('/login', loginLimiter, (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email e password obbligatorie' });

    const user = db.prepare(
      'SELECT id, email, name, password FROM users WHERE email = @email'
    ).get({ email: email.toLowerCase() }) as { id: string; email: string; name: string | null; password: string } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ ok: false, error: 'Credenziali non valide' });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ ok: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

authRouter.post('/refresh', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const token = jwt.sign({ sub: user.sub, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ ok: true, data: { token } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = @id').get({ id: (req as any).user.sub });
    if (!user) return res.status(404).json({ ok: false, error: 'Utente non trovato' });
    return res.json({ ok: true, data: user });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

authRouter.patch('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const { name, password, current_password } = req.body;
    const userId = (req as any).user.sub;
    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;

    if (password) {
      if (!current_password)
        return res.status(400).json({ ok: false, error: 'Inserisci la password attuale per cambiarla' });
      if (password.length < 8)
        return res.status(400).json({ ok: false, error: 'La nuova password deve avere almeno 8 caratteri' });
      const row = db.prepare('SELECT password FROM users WHERE id = @id').get({ id: userId }) as { password: string } | undefined;
      if (!row || !bcrypt.compareSync(current_password, row.password))
        return res.status(401).json({ ok: false, error: 'Password attuale non corretta' });
      updates.password = bcrypt.hashSync(password, 12);
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ ok: false, error: 'Nessun campo da aggiornare' });

    const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE users SET ${setClauses} WHERE id = @id`).run({ ...updates, id: userId });

    const updated = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = @id').get({ id: userId });
    return res.json({ ok: true, data: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});
