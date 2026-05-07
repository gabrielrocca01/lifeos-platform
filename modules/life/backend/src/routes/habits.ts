import { Router } from 'express';
import { db } from '../index.js';

export const habitsRouter = Router();

habitsRouter.get('/', (req, res) => {
  const userId = (req as any).user.sub;
  const habits = db.prepare(
    'SELECT * FROM habits WHERE user_id = ? AND active = 1 ORDER BY sort_order'
  ).all(userId);
  res.json({ ok: true, data: habits });
});

habitsRouter.get('/today', (req, res) => {
  const userId = (req as any).user.sub;
  const today  = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT h.*, hl.value, hl.id as log_id
    FROM habits h
    LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ? AND hl.user_id = ?
    WHERE h.user_id = ? AND h.active = 1
    ORDER BY h.sort_order
  `).all(today, userId, userId);
  res.json({ ok: true, data: rows });
});

habitsRouter.get('/:id/streak', (req, res) => {
  const userId = (req as any).user.sub;
  const logs = db.prepare(
    'SELECT date FROM habit_logs WHERE habit_id = ? AND user_id = ? ORDER BY date DESC'
  ).all(req.params['id'], userId) as { date: string }[];

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const log of logs) {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((current.getTime() - logDate.getTime()) / 86400000);
    if (diff <= 1) { streak++; current = logDate; }
    else break;
  }
  res.json({ ok: true, data: { streak } });
});

habitsRouter.post('/', (req, res) => {
  const userId = (req as any).user.sub;
  const { label, icon = '◉', type = 'boolean', unit, sort_order = 0 } = req.body;
  if (!label) { res.status(400).json({ ok: false, error: 'label obbligatorio' }); return; }
  const row = db.prepare(
    'INSERT INTO habits (user_id,label,icon,type,unit,sort_order) VALUES (?,?,?,?,?,?) RETURNING *'
  ).get(userId, label, icon, type, unit ?? null, sort_order);
  res.status(201).json({ ok: true, data: row });
});

habitsRouter.post('/:id/log', (req, res) => {
  const userId  = (req as any).user.sub;
  const today   = new Date().toISOString().slice(0, 10);
  const { value = 1, notes } = req.body;
  const row = db.prepare(`
    INSERT INTO habit_logs (habit_id, user_id, date, value, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, notes = excluded.notes
    RETURNING *
  `).get(req.params['id'], userId, today, value, notes ?? null);
  res.json({ ok: true, data: row });
});

habitsRouter.delete('/:id/log', (req, res) => {
  const userId = (req as any).user.sub;
  const today  = new Date().toISOString().slice(0, 10);
  db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ? AND date = ?')
    .run(req.params['id'], userId, today);
  res.json({ ok: true });
});

habitsRouter.patch('/:id', (req, res) => {
  const userId = (req as any).user.sub;
  const { label, icon, sort_order, active } = req.body;
  db.prepare(`
    UPDATE habits SET
      label      = COALESCE(?, label),
      icon       = COALESCE(?, icon),
      sort_order = COALESCE(?, sort_order),
      active     = COALESCE(?, active)
    WHERE id = ? AND user_id = ?
  `).run(label ?? null, icon ?? null, sort_order ?? null, active ?? null,
         req.params['id'], userId);
  res.json({ ok: true });
});
