// ============================================================
// Finance OS — Route /api/transactions
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run, getDb } from '../db/database.js';

export const transactionsRouter = Router();

// GET /api/transactions — lista con filtri e paginazione
transactionsRouter.get('/', (req: Request, res: Response) => {
  try {
    const {
      account_id, category_id, direction, status,
      date_from, date_to, fiscal_year,
      is_deductible, is_transfer, search,
      page = '1', page_size = '50',
    } = req.query as Record<string, string>;

    const uid = req.user!.id;
    const conditions: string[] = ['t.user_id = @uid'];
    const params: Record<string, unknown> = { uid };

    if (account_id)    { conditions.push('t.account_id = @account_id');      params.account_id = account_id; }
    if (category_id)   { conditions.push('t.category_id = @category_id');    params.category_id = category_id; }
    if (direction)     { conditions.push('t.direction = @direction');         params.direction = direction; }
    if (status)        { conditions.push('t.status = @status');               params.status = status; }
    if (date_from)     { conditions.push('t.date >= @date_from');             params.date_from = date_from; }
    if (date_to)       { conditions.push('t.date <= @date_to');               params.date_to = date_to; }
    if (fiscal_year)   { conditions.push('t.fiscal_year = @fiscal_year');     params.fiscal_year = fiscal_year; }
    if (is_deductible) { conditions.push('t.is_deductible = @is_deductible'); params.is_deductible = is_deductible === 'true' ? 1 : 0; }
    if (is_transfer)   { conditions.push('t.is_transfer = @is_transfer');     params.is_transfer = is_transfer === 'true' ? 1 : 0; }
    if (search) {
      conditions.push('(t.description LIKE @search OR t.merchant LIKE @search)');
      params.search = `%${search}%`;
    }

    const where = conditions.join(' AND ');
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * size;

    const total = (getDb().prepare(`SELECT COUNT(*) as c FROM transactions t WHERE ${where}`).get(params) as { c: number }).c;

    const data = getDb().prepare(`
      SELECT
        t.*,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        a.name as account_name, a.bank_name, a.color_tag as account_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT @size OFFSET @offset
    `).all({ ...params, size, offset });

    res.json({ success: true, data, total, page: pageNum, page_size: size, total_pages: Math.ceil(total / size) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// GET /api/transactions/analytics/monthly — prima di /:id per evitare shadowing
transactionsRouter.get('/analytics/monthly', (req: Request, res: Response) => {
  try {
    const { fiscal_year, account_id } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions = [`t.status != 'excluded'`, 't.user_id = @uid'];
    const params: Record<string, unknown> = { uid };

    if (fiscal_year) { conditions.push('t.fiscal_year = @fiscal_year'); params.fiscal_year = fiscal_year; }
    if (account_id)  { conditions.push('t.account_id = @account_id');   params.account_id = account_id; }

    const data = findMany(`
      SELECT
        strftime('%Y-%m', t.date) AS month,
        SUM(CASE WHEN t.direction='in'  THEN t.amount ELSE 0 END) AS total_in,
        SUM(CASE WHEN t.direction='out' THEN t.amount ELSE 0 END) AS total_out,
        COUNT(*) AS tx_count
      FROM transactions t
      WHERE ${conditions.join(' AND ')}
      GROUP BY month
      ORDER BY month ASC
    `, params);

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// GET /api/transactions/:id
transactionsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const tx = findOne(`
      SELECT t.*, c.name as category_name, c.icon as category_icon,
             a.name as account_name, a.bank_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = @id AND t.user_id = @uid
    `, { id: req.params.id, uid: req.user!.id });
    if (!tx) return res.status(404).json({ success: false, error: 'Transazione non trovata' });
    res.json({ success: true, data: tx });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/transactions — inserimento manuale
transactionsRouter.post('/', (req: Request, res: Response) => {
  try {
    const {
      account_id, category_id, amount, direction,
      description, merchant, date, is_deductible = false,
      deductible_type, deductible_pct = 19,
      is_transfer = false, transfer_pair_id,
      notes, tags,
    } = req.body;

    if (!account_id || !amount || !direction || !description || !date) {
      return res.status(400).json({ success: false, error: 'account_id, amount, direction, description, date sono obbligatori' });
    }

    const fiscal_year = date.split('-')[0];
    const id = `tx_${uuid().replace(/-/g, '').slice(0, 12)}`;

    run(`
      INSERT INTO transactions (
        id, user_id, account_id, category_id, amount, direction, description,
        merchant, date, fiscal_year, is_deductible, deductible_type,
        deductible_pct, is_transfer, transfer_pair_id, notes, tags
      ) VALUES (
        @id, @uid, @account_id, @category_id, @amount, @direction, @description,
        @merchant, @date, @fiscal_year, @is_deductible, @deductible_type,
        @deductible_pct, @is_transfer, @transfer_pair_id, @notes, @tags
      )
    `, {
      id, uid: req.user!.id, account_id, category_id: category_id || null,
      amount, direction, description, merchant: merchant || null, date, fiscal_year,
      is_deductible: is_deductible ? 1 : 0, deductible_type: deductible_type || null,
      deductible_pct, is_transfer: is_transfer ? 1 : 0,
      transfer_pair_id: transfer_pair_id || null, notes: notes || null,
      tags: tags ? JSON.stringify(tags) : null,
    });

    res.status(201).json({ success: true, data: findOne('SELECT * FROM transactions WHERE id = @id', { id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// PATCH /api/transactions/:id
transactionsRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const tx = findOne('SELECT * FROM transactions WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!tx) return res.status(404).json({ success: false, error: 'Transazione non trovata' });

    const allowed = ['category_id', 'description', 'merchant', 'is_deductible',
                     'deductible_type', 'deductible_pct', 'status', 'notes', 'tags'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun campo da aggiornare' });
    }
    const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    run(`UPDATE transactions SET ${setClauses}, updated_at = datetime('now') WHERE id = @id AND user_id = @uid`,
      { ...updates, id: req.params.id, uid: req.user!.id });
    res.json({ success: true, data: findOne('SELECT * FROM transactions WHERE id = @id', { id: req.params.id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// DELETE /api/transactions/:id — solo manuali
transactionsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const tx = findOne('SELECT * FROM transactions WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id }) as Record<string, unknown> | undefined;
    if (!tx) return res.status(404).json({ success: false, error: 'Transazione non trovata' });
    if (tx.import_batch_id) {
      return res.status(400).json({
        success: false,
        error: 'Le transazioni da import non si eliminano singolarmente. Usa status=excluded per escluderle.',
      });
    }
    run('DELETE FROM transactions WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    res.json({ success: true, message: 'Transazione eliminata.' });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});
