// ============================================================
// Finance OS — Route /api/planned
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run } from '../db/database.js';

export const plannedRouter = Router();

// GET /api/planned
plannedRouter.get('/', (req: Request, res: Response) => {
  try {
    const { fiscal_year } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions = ['p.user_id = @uid'];
    if (fiscal_year) conditions.push('p.fiscal_year = @fiscal_year');
    const data = findMany(`
      SELECT p.*, a.name as account_name, a.color_tag as account_color
      FROM planned_expenses p
      LEFT JOIN accounts a ON p.account_id = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.month_due ASC
    `, fiscal_year ? { uid, fiscal_year } : { uid });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/planned
plannedRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, total_amount, month_due, account_id, category_id, fiscal_year, is_deductible, notes } = req.body;
    if (!name || !total_amount || !month_due || !account_id) {
      return res.status(400).json({ success: false, error: 'name, total_amount, month_due, account_id obbligatori' });
    }
    const id = `plan_${uuid().replace(/-/g, '').slice(0, 12)}`;
    const monthly_rate = Math.round((total_amount / 12) * 100) / 100;
    const year = fiscal_year || new Date().getFullYear().toString();
    run(`
      INSERT INTO planned_expenses (id, user_id, name, total_amount, monthly_rate, month_due, account_id, category_id, fiscal_year, is_deductible, notes)
      VALUES (@id, @uid, @name, @total_amount, @monthly_rate, @month_due, @account_id, @category_id, @fiscal_year, @is_deductible, @notes)
    `, { id, uid: req.user!.id, name, total_amount, monthly_rate, month_due, account_id, category_id: category_id || null, fiscal_year: year, is_deductible: is_deductible ? 1 : 0, notes: notes || null });
    res.status(201).json({ success: true, data: findOne('SELECT * FROM planned_expenses WHERE id = @id', { id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// PATCH /api/planned/:id
plannedRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const item = findOne('SELECT * FROM planned_expenses WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!item) return res.status(404).json({ success: false, error: 'Non trovato' });
    const allowed = ['name', 'total_amount', 'month_due', 'account_id', 'category_id', 'is_deductible', 'notes'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (req.body.total_amount) updates['monthly_rate'] = Math.round((req.body.total_amount / 12) * 100) / 100;
    const set = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    run(`UPDATE planned_expenses SET ${set} WHERE id = @id AND user_id = @uid`, { ...updates, id: req.params.id, uid: req.user!.id });
    res.json({ success: true, data: findOne('SELECT * FROM planned_expenses WHERE id = @id', { id: req.params.id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// DELETE /api/planned/:id
plannedRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const item = findOne('SELECT id FROM planned_expenses WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!item) return res.status(404).json({ success: false, error: 'Non trovato' });
    run('DELETE FROM planned_expenses WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});
