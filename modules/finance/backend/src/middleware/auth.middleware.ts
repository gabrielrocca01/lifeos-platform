// TODO: sostituire con import da @lifeos/api-core una volta che il package ha il suo package.json
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '7d';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Token mancante' });
    return;
  }
  try {
    (req as any).user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Token non valido o scaduto' });
  }
}
