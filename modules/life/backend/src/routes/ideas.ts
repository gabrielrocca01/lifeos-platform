import { Router } from 'express';
import { db } from '../index.js';

export const ideasRouter = Router();

ideasRouter.get('/', (req, res) => {
  const userId = (req as any).user.sub;
  const rows = db.prepare(
    'SELECT * FROM ideas WHERE user_id = ? ORDER BY pinned DESC, created_at DESC'
  ).all(userId);
  res.json({ ok: true, data: rows.map(parseIdea) });
});

ideasRouter.post('/', (req, res) => {
  const userId = (req as any).user.sub;
  const { content, tags = [], pinned = false } = req.body;
  if (!content) { res.status(400).json({ ok: false, error: 'content obbligatorio' }); return; }
  const row = db.prepare(
    'INSERT INTO ideas (user_id, content, tags, pinned) VALUES (?, ?, ?, ?) RETURNING *'
  ).get(userId, content, JSON.stringify(tags), pinned ? 1 : 0);
  res.status(201).json({ ok: true, data: parseIdea(row as any) });
});

ideasRouter.patch('/:id', (req, res) => {
  const userId = (req as any).user.sub;
  const { content, tags, pinned } = req.body;
  db.prepare(`
    UPDATE ideas SET
      content = COALESCE(?, content),
      tags    = COALESCE(?, tags),
      pinned  = COALESCE(?, pinned)
    WHERE id = ? AND user_id = ?
  `).run(content ?? null, tags ? JSON.stringify(tags) : null,
         pinned !== undefined ? (pinned ? 1 : 0) : null,
         req.params['id'], userId);
  res.json({ ok: true });
});

ideasRouter.delete('/:id', (req, res) => {
  const userId = (req as any).user.sub;
  db.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?')
    .run(req.params['id'], userId);
  res.json({ ok: true });
});

function parseIdea(row: any) {
  return { ...row, tags: JSON.parse(row.tags ?? '[]'), pinned: !!row.pinned };
}
