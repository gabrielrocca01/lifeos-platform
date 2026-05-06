import { Router } from 'express';
import { db } from '../index.js';

export const goalsRouter = Router();

goalsRouter.get('/', (req, res) => {
  const userId  = (req as any).user?.sub;
  const horizon = req.query['horizon'] as string | undefined;
  const query   = horizon
    ? 'SELECT * FROM goals WHERE user_id = ? AND horizon = ? ORDER BY created_at DESC'
    : 'SELECT * FROM goals WHERE user_id = ? ORDER BY horizon, created_at DESC';
  const rows = horizon
    ? db.prepare(query).all(userId, horizon)
    : db.prepare(query).all(userId);
  res.json({ ok: true, data: rows.map(parseGoal) });
});

goalsRouter.post('/', (req, res) => {
  const userId = (req as any).user?.sub;
  const { title, description, horizon = 'week', due_date, tags = [] } = req.body;
  if (!title) { res.status(400).json({ ok: false, error: 'title obbligatorio' }); return; }
  const row = db.prepare(`
    INSERT INTO goals (user_id, title, description, horizon, due_date, tags)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *
  `).get(userId, title, description ?? null, horizon, due_date ?? null, JSON.stringify(tags));
  res.status(201).json({ ok: true, data: parseGoal(row as any) });
});

goalsRouter.patch('/:id', (req, res) => {
  const { title, description, done, horizon, due_date, tags } = req.body;
  db.prepare(`
    UPDATE goals SET
      title       = COALESCE(?, title),
      description = COALESCE(?, description),
      done        = COALESCE(?, done),
      horizon     = COALESCE(?, horizon),
      due_date    = COALESCE(?, due_date),
      tags        = COALESCE(?, tags),
      updated_at  = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(title ?? null, description ?? null, done ?? null, horizon ?? null,
         due_date ?? null, tags ? JSON.stringify(tags) : null,
         req.params['id'], (req as any).user?.sub);
  res.json({ ok: true });
});

goalsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?')
    .run(req.params['id'], (req as any).user?.sub);
  res.json({ ok: true });
});

function parseGoal(row: any) {
  return { ...row, tags: JSON.parse(row.tags ?? '[]'), done: !!row.done };
}
