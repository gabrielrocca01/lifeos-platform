// ============================================================
// Finance OS — Route /api/accounts
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run } from '../db/database.js';

export const accountsRouter = Router();

// GET /api/accounts
accountsRouter.get('/', (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const accounts = findMany(`
      SELECT
        a.*,
        COALESCE(
          SUM(CASE WHEN t.direction='in'  AND t.status!='excluded' THEN t.amount ELSE 0 END) -
          SUM(CASE WHEN t.direction='out' AND t.status!='excluded' THEN t.amount ELSE 0 END),
          0
        ) AS balance_computed,
        COUNT(t.id) AS transaction_count
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id AND t.user_id = @uid
      WHERE a.is_active = 1 AND a.user_id = @uid
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `, { uid });
    res.json({ success: true, data: accounts });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// GET /api/accounts/:id
accountsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const account = findOne('SELECT * FROM accounts WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!account) return res.status(404).json({ success: false, error: 'Conto non trovato' });
    res.json({ success: true, data: account });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/accounts
accountsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, bank_name, iban, type, currency = 'EUR', balance = 0, color_tag = '#4A90D9', notes } = req.body;
    if (!name || !bank_name || !type) {
      return res.status(400).json({ success: false, error: 'name, bank_name e type sono obbligatori' });
    }
    const id = `acc_${uuid().replace(/-/g, '').slice(0, 12)}`;
    run(`
      INSERT INTO accounts (id, user_id, name, bank_name, iban, type, currency, balance, color_tag, notes)
      VALUES (@id, @uid, @name, @bank_name, @iban, @type, @currency, @balance, @color_tag, @notes)
    `, { id, uid: req.user!.id, name, bank_name, iban: iban || '', type, currency, balance, color_tag, notes: notes || '' });
    res.status(201).json({ success: true, data: findOne('SELECT * FROM accounts WHERE id = @id', { id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// PATCH /api/accounts/:id
accountsRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const account = findOne('SELECT * FROM accounts WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id }) as Record<string, unknown> | undefined;
    if (!account) return res.status(404).json({ success: false, error: 'Conto non trovato' });

    const allowed = ['name', 'bank_name', 'iban', 'type', 'currency', 'balance', 'color_tag', 'notes', 'is_active'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun campo da aggiornare' });
    }
    const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    run(`UPDATE accounts SET ${setClauses}, updated_at = datetime('now') WHERE id = @id AND user_id = @uid`,
      { ...updates, id: req.params.id, uid: req.user!.id });
    res.json({ success: true, data: findOne('SELECT * FROM accounts WHERE id = @id', { id: req.params.id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// DELETE /api/accounts/:id — soft delete
accountsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const account = findOne('SELECT * FROM accounts WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!account) return res.status(404).json({ success: false, error: 'Conto non trovato' });
    run(`UPDATE accounts SET is_active = 0, updated_at = datetime('now') WHERE id = @id AND user_id = @uid`,
      { id: req.params.id, uid: req.user!.id });
    res.json({ success: true, message: 'Conto disattivato. Dati storici conservati.' });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});
