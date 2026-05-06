// ============================================================
// Finance OS — Route /api/import
// Riceve un file CSV, trova il connettore giusto,
// normalizza le righe, salva nel DB, gestisce i duplicati.
// ============================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { getDb, findOne, run, transaction } from '../db/database.js';
import { ConnectorRegistry, ParsedRow } from '../connectors/connector.interface.js';
import { registerAllConnectors } from '../connectors/index.js';

// Registra tutti i connettori all'avvio
registerAllConnectors();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file CSV supportati'));
    }
  },
});

export const importRouter = Router();

// GET /api/import/connectors — lista connettori disponibili
importRouter.get('/connectors', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: ConnectorRegistry.listMeta(),
  });
});

// POST /api/import/csv — import principale
// Body: multipart/form-data
//   file: il file CSV
//   account_id: ID del conto destinatario
//   format: 'fineco' | 'revolut' | 'intesa' | 'trade_republic' | 'paypal'
importRouter.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { account_id, format } = req.body;

    // Validazione input
    if (!req.file) return res.status(400).json({ success: false, error: 'File CSV mancante' });
    if (!account_id) return res.status(400).json({ success: false, error: 'account_id obbligatorio' });
    if (!format) return res.status(400).json({ success: false, error: 'format obbligatorio (es: revolut, fineco)' });

    // Verifica conto (deve appartenere all'utente corrente)
    const uid = req.user!.id;
    const account = findOne('SELECT * FROM accounts WHERE id = @id AND is_active = 1 AND user_id = @uid', { id: account_id, uid });
    if (!account) return res.status(404).json({ success: false, error: 'Conto non trovato o disattivato' });

    // Trova connettore
    if (!ConnectorRegistry.has(format)) {
      return res.status(400).json({
        success: false,
        error: `Connettore '${format}' non disponibile. Disponibili: ${ConnectorRegistry.list().join(', ')}`,
      });
    }
    const connector = ConnectorRegistry.get(format);

    // Decodifica CSV (gestisce encoding diversi)
    let fileContent: string;
    if (connector.meta.csvEncoding === 'ISO-8859-1') {
      const decoder = new TextDecoder('iso-8859-1');
      fileContent = decoder.decode(req.file.buffer);
    } else {
      fileContent = req.file.buffer.toString('utf-8');
    }

    // Parsing con il connettore specifico
    const importResult = connector.parseFile(fileContent, account_id);

    if (importResult.parsed.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Nessuna transazione valida trovata nel file',
        skipped: importResult.skipped,
      });
    }

    // Carica gli hash esistenti per questo conto (dedup)
    const existingHashes = new Set(
      (getDb().prepare(`
        SELECT import_hash FROM transactions
        WHERE account_id = @account_id AND user_id = @uid AND import_hash IS NOT NULL
      `).all({ account_id, uid }) as { import_hash: string }[])
        .map(r => r.import_hash)
    );

    // Inserimento in transazione DB
    let importedCount = 0;
    let duplicatesCount = 0;
    const batchId = `batch_${uuid().replace(/-/g, '').slice(0, 12)}`;
    const dates: string[] = [];

    transaction(() => {
      // Crea il batch
      run(`
        INSERT INTO import_batches (id, user_id, account_id, filename, format, rows_total)
        VALUES (@id, @uid, @account_id, @filename, @format, @rows_total)
      `, {
        id: batchId, uid,
        account_id,
        filename: req.file!.originalname,
        format,
        rows_total: importResult.totalRows,
      });

      // Inserisce le transazioni
      const insertTx = getDb().prepare(`
        INSERT INTO transactions (
          id, user_id, account_id, category_id, import_batch_id,
          amount, direction, description, merchant,
          date, fiscal_year, is_deductible, deductible_pct,
          is_transfer, status, import_hash
        ) VALUES (
          @id, @uid, @account_id, @category_id, @import_batch_id,
          @amount, @direction, @description, @merchant,
          @date, @fiscal_year, @is_deductible, @deductible_pct,
          @is_transfer, @status, @import_hash
        )
      `);

      for (const row of importResult.parsed) {
        if (existingHashes.has(row.hash)) {
          duplicatesCount++;
          continue;
        }

        const dto = row.dto;
        const fiscal_year = dto.date.split('-')[0];
        const txId = `tx_${uuid().replace(/-/g, '').slice(0, 12)}`;

        try {
          insertTx.run({
            id: txId,
            uid,
            account_id: dto.accountId,
            category_id: dto.categoryId || null,
            import_batch_id: batchId,
            amount: dto.amount,
            direction: dto.direction,
            description: dto.description,
            merchant: dto.merchant || null,
            date: dto.date,
            fiscal_year,
            is_deductible: dto.isDeductible ? 1 : 0,
            deductible_pct: dto.deductiblePct || 19,
            is_transfer: dto.isTransfer ? 1 : 0,
            status: 'confirmed',
            import_hash: row.hash,
          });
          importedCount++;
        } catch (insertErr: any) {
          // Hash duplicato — conta come duplicato, non bloccare l'import
          if (insertErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' || insertErr?.message?.includes('UNIQUE')) {
            duplicatesCount++;
          } else {
            throw insertErr;
          }
        }
        dates.push(dto.date);
      }

      // Aggiorna stats batch
      const sortedDates = dates.sort();
      run(`
        UPDATE import_batches SET
          rows_imported = @imported,
          rows_skipped = @skipped,
          period_from = @period_from,
          period_to = @period_to
        WHERE id = @id
      `, {
        id: batchId,
        imported: importedCount,
        skipped: importResult.skipped.length + duplicatesCount,
        period_from: sortedDates[0] || null,
        period_to: sortedDates[sortedDates.length - 1] || null,
      });
    });

    res.status(201).json({
      success: true,
      data: {
        batch_id: batchId,
        imported: importedCount,
        duplicates: duplicatesCount,
        skipped: importResult.skipped.length,
        total_rows: importResult.totalRows,
        warnings: importResult.parsed.flatMap((r: ParsedRow) => r.warnings).slice(0, 20),
      },
    });

  } catch (e) {
    console.error('[Import]', e);
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// GET /api/import/batches — storico import
importRouter.get('/batches', (req: Request, res: Response) => {
  try {
    const { account_id } = req.query as Record<string, string>;
    const uid = req.user!.id;
    const conditions = ['b.user_id = @uid'];
    if (account_id) conditions.push('b.account_id = @account_id');
    const data = getDb().prepare(`
      SELECT b.*, a.name as account_name, a.bank_name
      FROM import_batches b
      JOIN accounts a ON b.account_id = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.imported_at DESC
      LIMIT 50
    `).all(account_id ? { uid, account_id } : { uid });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// POST /api/import/debug — analizza il CSV senza salvare nulla
importRouter.post('/debug', upload.single('file'), (req: Request, res: Response) => {
  try {
    const { format } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: 'File mancante' });
    if (!format)   return res.status(400).json({ success: false, error: 'format obbligatorio' });
    if (!ConnectorRegistry.has(format)) {
      return res.status(400).json({ success: false, error: `Connettore '${format}' non trovato. Disponibili: ${ConnectorRegistry.list().join(', ')}` });
    }

    const connector = ConnectorRegistry.get(format);
    let fileContent: string;
    if (connector.meta.csvEncoding === 'ISO-8859-1') {
      const decoder = new TextDecoder('iso-8859-1');
      fileContent = decoder.decode(req.file.buffer);
    } else {
      fileContent = req.file.buffer.toString('utf-8');
    }

    const lines = fileContent.split('\n');
    const result = connector.parseFile(fileContent, 'debug_account');

    res.json({
      success: true,
      data: {
        connector: connector.meta.displayName,
        encoding: connector.meta.csvEncoding,
        delimiter: connector.meta.csvDelimiter,
        skip_rows: connector.meta.skipRows,
        file_size_kb: Math.round(req.file.size / 1024),
        total_lines: lines.length,
        first_5_lines: lines.slice(0, 5),
        parse_result: {
          total_rows: result.totalRows,
          parsed: result.parsed.length,
          skipped: result.skipped.length,
          first_parsed: result.parsed[0]?.dto ?? null,
          skipped_reasons: result.skipped.slice(0, 3).map((s: { row: unknown; reason: string }) => s.reason),
          sample_warnings: result.parsed.flatMap((r: ParsedRow) => r.warnings).slice(0, 5),
        },
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message, stack: (e as Error).stack });
  }
});