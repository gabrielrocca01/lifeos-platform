// ============================================================
// Finance OS — Route /api/kakebo
// ============================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { findMany, findOne, run, getDb, transaction } from '../db/database.js';
import { ReconciliationEngine } from '../services/reconciliation.engine.js';

export const kakeboRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/kakebo/entries?month=2025-04
kakeboRouter.get('/entries', (req: Request, res: Response) => {
  try {
    const { month, fiscal_year } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions: string[] = ['k.user_id = @uid'];
    const params: Record<string, unknown> = { uid };

    if (month)       { conditions.push('k.month = @month');             params.month = month; }
    if (fiscal_year) { conditions.push('k.fiscal_year = @fiscal_year'); params.fiscal_year = fiscal_year; }

    const data = getDb().prepare(`
      SELECT k.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kakebo_entries k
      LEFT JOIN categories c ON k.category_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY k.date ASC
    `).all(params);

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/kakebo/entries — inserimento manuale singola voce
kakeboRouter.post('/entries', (req: Request, res: Response) => {
  try {
    const { date, account_hint, category_id, description, amount, direction, notes, is_cash = false } = req.body;
    if (!date || !description || !amount || !direction) {
      return res.status(400).json({ success: false, error: 'date, description, amount, direction obbligatori' });
    }
    const month = date.slice(0, 7);
    const fiscal_year = date.slice(0, 4);
    const id = `kak_${uuid().replace(/-/g, '').slice(0, 12)}`;
    run(`
      INSERT INTO kakebo_entries (id, user_id, date, fiscal_year, month, account_hint, category_id, description, amount, direction, notes, is_cash)
      VALUES (@id, @uid, @date, @fiscal_year, @month, @account_hint, @category_id, @description, @amount, @direction, @notes, @is_cash)
    `, { id, uid: req.user!.id, date, fiscal_year, month, account_hint: account_hint || null, category_id: category_id || null, description, amount, direction, notes: notes || null, is_cash: is_cash ? 1 : 0 });
    res.status(201).json({ success: true, data: findOne('SELECT * FROM kakebo_entries WHERE id = @id', { id }) });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/kakebo/import-csv
kakeboRouter.post('/import-csv', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'File CSV mancante' });

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return res.status(422).json({ success: false, error: 'File vuoto o solo intestazioni' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const uid = req.user!.id;
    let imported = 0;
    let skipped = 0;

    const CATEGORY_MAP: Record<string, string> = {
      alimentari: 'cat_alimentari', trasporti: 'cat_trasporti',
      casa: 'cat_casa', salute: 'cat_salute', istruzione: 'cat_istruzione',
      sport: 'cat_sport', assicurazioni: 'cat_assicurazioni', mutuo: 'cat_mutuo',
      stipendio: 'cat_stipendio', bonus: 'cat_bonus', investimenti: 'cat_investimenti',
      ristorazione: 'cat_ristorazione', abbonamenti: 'cat_abbonamenti',
      svago: 'cat_svago', altro: 'cat_altro',
    };

    transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const rawDate = row['data'] || '';
        const amount = parseFloat(row['importo'] || '0');
        const direction = (row['tipo'] || '').toLowerCase().includes('entrata') ? 'in' : 'out';
        const description = row['descrizione'] || '';

        if (!rawDate || isNaN(amount) || !description) { skipped++; continue; }

        let date = rawDate;
        if (rawDate.includes('/')) {
          const [d, m, y] = rawDate.split('/');
          date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        const month = date.slice(0, 7);
        const fiscal_year = date.slice(0, 4);
        const category_id = CATEGORY_MAP[row['categoria']?.toLowerCase()] || 'cat_altro';
        const is_cash = (row['conto'] || '').toLowerCase() === 'contanti' ? 1 : 0;
        const id = `kak_${uuid().replace(/-/g, '').slice(0, 12)}`;

        run(`
          INSERT OR IGNORE INTO kakebo_entries
            (id, user_id, date, fiscal_year, month, account_hint, category_id, description, amount, direction, notes, is_cash)
          VALUES
            (@id, @uid, @date, @fiscal_year, @month, @account_hint, @category_id, @description, @amount, @direction, @notes, @is_cash)
        `, {
          id, uid, date, fiscal_year, month,
          account_hint: row['conto'] || null,
          category_id, description,
          amount: Math.abs(amount), direction,
          notes: row['note'] || null, is_cash,
        });
        imported++;
      }
    });

    res.status(201).json({ success: true, data: { imported, skipped } });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/kakebo/reconcile
kakeboRouter.post('/reconcile', (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    const uid = req.user!.id;
    if (!month) return res.status(400).json({ success: false, error: 'month obbligatorio (es: 2025-04)' });

    const kakeboEntries = findMany(`SELECT * FROM kakebo_entries WHERE month = @month AND user_id = @uid`, { month, uid });
    const bankTransactions = getDb().prepare(`
      SELECT t.*, a.name as account_name, a.bank_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE strftime('%Y-%m', t.date) = @month
        AND t.user_id = @uid
        AND t.status != 'excluded'
        AND t.is_transfer = 0
    `).all({ month, uid });

    if (kakeboEntries.length === 0) {
      return res.status(422).json({ success: false, error: 'Nessuna voce kakebo trovata per questo mese.' });
    }

    const engine = new ReconciliationEngine();
    const report = engine.reconcile(kakeboEntries as any, bankTransactions as any, month);

    transaction(() => {
      for (const match of report.matched) {
        run(`UPDATE kakebo_entries SET reconciliation_status = 'matched', matched_transaction_id = @tx_id, match_confidence = @confidence, updated_at = datetime('now') WHERE id = @id AND user_id = @uid`,
          { id: match.kakeboEntry.id, tx_id: match.bankTransaction?.id || null, confidence: match.confidence, uid });
      }
      for (const unmatched of report.kakeboOnly) {
        run(`UPDATE kakebo_entries SET reconciliation_status = @status, updated_at = datetime('now') WHERE id = @id AND user_id = @uid`,
          { id: unmatched.kakeboEntry.id, status: unmatched.kakeboEntry.isCash ? 'ignored' : 'unmatched', uid });
      }
      run(`
        INSERT INTO reconciliation_sessions
          (id, user_id, month, fiscal_year, kakebo_count, bank_count, matched_count, unmatched_kakebo, unmatched_bank, discrepancy_sum)
        VALUES
          (@id, @uid, @month, @fiscal_year, @kakebo_count, @bank_count, @matched_count, @unmatched_kakebo, @unmatched_bank, @discrepancy_sum)
        ON CONFLICT(month) DO UPDATE SET
          kakebo_count = excluded.kakebo_count,
          bank_count = excluded.bank_count,
          matched_count = excluded.matched_count,
          unmatched_kakebo = excluded.unmatched_kakebo,
          unmatched_bank = excluded.unmatched_bank,
          discrepancy_sum = excluded.discrepancy_sum
      `, {
        id: `rec_${uuid().replace(/-/g, '').slice(0, 12)}`, uid, month,
        fiscal_year: month.split('-')[0],
        kakebo_count: report.session.kakeboCount,
        bank_count: report.session.bankCount,
        matched_count: report.session.matchedCount,
        unmatched_kakebo: report.session.unmatchedKakebo,
        unmatched_bank: report.session.unmatchedBank,
        discrepancy_sum: report.session.discrepancySum,
      });
    });

    res.json({ success: true, data: report });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// GET /api/kakebo/sessions
kakeboRouter.get('/sessions', (req: Request, res: Response) => {
  try {
    const data = findMany(`SELECT * FROM reconciliation_sessions WHERE user_id = @uid ORDER BY month DESC`, { uid: req.user!.id });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});
