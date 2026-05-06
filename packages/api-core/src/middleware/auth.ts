import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Token mancante' });
    return;
  }
  try {
    (req as any).user = jwt.verify(header.slice(7), process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Token non valido o scaduto' });
  }
}

export function validateEnv(required: string[]): void {
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[env] Variabili mancanti: ${missing.join(', ')}`);
    process.exit(1);
  }
}
