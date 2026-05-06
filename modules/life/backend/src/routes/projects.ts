import { Router } from 'express';
import { db } from '../index.js';

export const projectsRouter = Router();

projectsRouter.get('/', (req, res) => {
  const userId = (req as any).user?.sub;
  const status = req.query['status'] as string | undefined;
  const rows = status
    ? db.prepare('SELECT * FROM projects WHERE user_id = ? AND status = ? ORDER BY updated_at DESC').all(userId, status)
    : db.prepare('SELECT * FROM projects WHERE user_id = ? AND status != ? ORDER BY updated_at DESC').all(userId, 'archived');
  res.json({ ok: true, data: rows.map(parseProject) });
});

projectsRouter.post('/', (req, res) => {
  const userId = (req as any).user?.sub;
  const { title, description, tags = [] } = req.body;
  if (!title) { res.status(400).json({ ok: false, error: 'title obbligatorio' }); return; }
  const row = db.prepare(
    'INSERT INTO projects (user_id, title, description, tags) VALUES (?, ?, ?, ?) RETURNING *'
  ).get(userId, title, description ?? null, JSON.stringify(tags));
  res.status(201).json({ ok: true, data: parseProject(row as any) });
});

projectsRouter.patch('/:id', (req, res) => {
  const { title, description, status, tags } = req.body;
  db.prepare(`
    UPDATE projects SET
      title       = COALESCE(?, title),
      description = COALESCE(?, description),
      status      = COALESCE(?, status),
      tags        = COALESCE(?, tags),
      updated_at  = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(title ?? null, description ?? null, status ?? null,
         tags ? JSON.stringify(tags) : null,
         req.params['id'], (req as any).user?.sub);
  res.json({ ok: true });
});

projectsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(req.params['id'], (req as any).user?.sub);
  res.json({ ok: true });
});

function parseProject(row: any) {
  return { ...row, tags: JSON.parse(row.tags ?? '[]') };
}
