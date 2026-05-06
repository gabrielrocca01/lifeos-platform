// ============================================================
// Finance OS — Route /api/fiscal
// Archivio documenti fiscali per anno (CU, 730, fatture, ecc.)
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run } from '../db/database.js';

export const fiscalRouter = Router();

// GET /api/fiscal/records?fiscal_year=2024
fiscalRouter.get('/records', (req: Request, res: Response) => {
  try {
    const { fiscal_year } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions = ['user_id = @uid'];
    if (fiscal_year) conditions.push('fiscal_year = @fiscal_year');
    const data = findMany(
      `SELECT * FROM tax_records WHERE ${conditions.join(' AND ')} ORDER BY fiscal_year DESC, uploaded_at DESC`,
      fiscal_year ? { uid, fiscal_year } : { uid }
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/fiscal/records
fiscalRouter.post('/records', (req: Request, res: Response) => {
  try {
    const { fiscal_year, document_type, filename, notes } = req.body;
    if (!fiscal_year || !document_type) {
      return res.status(400).json({ success: false, error: 'fiscal_year e document_type obbligatori' });
    }
    const id = `tax_${uuid().replace(/-/g, '').slice(0, 12)}`;
    run(
      `INSERT INTO tax_records (id, user_id, fiscal_year, document_type, filename, notes)
       VALUES (@id, @uid, @fiscal_year, @document_type, @filename, @notes)`,
      { id, uid: req.user!.id, fiscal_year, document_type, filename: filename || null, notes: notes || null }
    );
    res.status(201).json({ success: true, data: findOne('SELECT * FROM tax_records WHERE id = @id', { id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// DELETE /api/fiscal/records/:id
fiscalRouter.delete('/records/:id', (req: Request, res: Response) => {
  try {
    const record = findOne('SELECT id FROM tax_records WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    if (!record) return res.status(404).json({ success: false, error: 'Documento non trovato' });
    run('DELETE FROM tax_records WHERE id = @id AND user_id = @uid', { id: req.params.id, uid: req.user!.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});
