// ============================================================
// Finance OS — Route /api/investments
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run, getDb } from '../db/database.js';

export const investmentsRouter = Router();

// GET /api/investments/operations — prima di /:id per evitare shadowing
investmentsRouter.get('/operations', (req: Request, res: Response) => {
  try {
    const { investment_id } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions = ['i.user_id = @uid'];
    if (investment_id) conditions.push('o.investment_id = @investment_id');
    const data = getDb().prepare(`
      SELECT o.*, i.ticker, i.name as investment_name
      FROM investment_operations o
      JOIN investments i ON o.investment_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.date DESC
    `).all(investment_id ? { uid, investment_id } : { uid });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

// POST /api/investments/operations
investmentsRouter.post('/operations', (req: Request, res: Response) => {
  try {
    const { investment_id, type, quantity, price, date, fees = 0, notes } = req.body;
    if (!investment_id || !type || !quantity || !price || !date) {
      return res.status(400).json({ success: false, error: 'investment_id, type, quantity, price, date obbligatori' });
    }
    const inv = findOne('SELECT * FROM investments WHERE id = @id AND user_id = @uid', { id: investment_id, uid: req.user!.id }) as any;
    if (!inv) return res.status(404).json({ success: false, error: 'Investimento non trovato' });

    const id = `op_${uuid().replace(/-/g, '').slice(0, 12)}`;
    run(`INSERT INTO investment_operations (id, investment_id, type, quantity, price, date, fees, notes)
         VALUES (@id, @investment_id, @type, @quantity, @price, @date, @fees, @notes)`,
      { id, investment_id, type, quantity, price, date, fees, notes: notes || null });

    if (type === 'buy') {
      const newQty = inv.quantity + quantity;
      const newAvg = ((inv.quantity * inv.avg_price) + (quantity * price)) / newQty;
      run(`UPDATE investments SET quantity = @qty, avg_price = @avg, last_updated = datetime('now') WHERE id = @id`,
        { qty: newQty, avg: Math.round(newAvg * 100) / 100, id: investment_id });
    }
    res.status(201).json({ success: true, data: findOne('SELECT * FROM investment_operations WHERE id = @id', { id }) });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

// GET /api/investments
investmentsRouter.get('/', (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const data = getDb().prepare(`
      SELECT i.*,
        a.name as account_name, a.color_tag as account_color,
        ROUND(i.quantity * i.avg_price, 2) as total_cost,
        ROUND(i.quantity * i.current_price, 2) as current_value,
        ROUND(i.quantity * (i.current_price - i.avg_price), 2) as pnl,
        ROUND(((i.current_price - i.avg_price) / i.avg_price) * 100, 2) as pnl_pct
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.user_id = @uid
      ORDER BY current_value DESC
    `).all({ uid });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

// POST /api/investments
investmentsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { account_id, ticker, name, quantity, avg_price, current_price, currency = 'EUR', asset_type, notes } = req.body;
    if (!ticker || !name || !quantity || !avg_price || !current_price) {
      return res.status(400).json({ success: false, error: 'ticker, name, quantity, avg_price, current_price obbligatori' });
    }
    const id = `inv_${uuid().replace(/-/g, '').slice(0, 12)}`;
    run(`INSERT INTO investments (id, user_id, account_id, ticker, name, quantity, avg_price, current_price, currency, asset_type, notes)
         VALUES (@id, @uid, @account_id, @ticker, @name, @quantity, @avg_price, @current_price, @currency, @asset_type, @notes)`,
      { id, uid: req.user!.id, account_id: account_id || null, ticker: ticker.toUpperCase(), name, quantity, avg_price, current_price, currency, asset_type: asset_type || 'other', notes: notes || null });
    res.status(201).json({ success: true, data: findOne('SELECT * FROM investments WHERE id = @id', { id }) });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

// PATCH /api/investments/:id
investmentsRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const item = findOne('SELECT * FROM investments WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!item) return res.status(404).json({ success: false, error: 'Non trovato' });
    const allowed = ['ticker', 'name', 'quantity', 'avg_price', 'current_price', 'currency', 'asset_type', 'notes'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    const set = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    run(`UPDATE investments SET ${set}, last_updated = datetime('now') WHERE id = @id AND user_id = @uid`,
      { ...updates, id: req.params.id, uid: req.user!.id });
    res.json({ success: true, data: findOne('SELECT * FROM investments WHERE id = @id', { id: req.params.id }) });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

// DELETE /api/investments/:id
investmentsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const item = findOne('SELECT id FROM investments WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!item) return res.status(404).json({ success: false, error: 'Non trovato' });
    run('DELETE FROM investments WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});
