// ============================================================
// Finance OS — Connettore Intesa San Paolo
// Come esportare:
//   ISP Smart → Movimenti → Seleziona periodo → Scarica CSV
// ============================================================

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../shared/models/index.js';

const INTESA_PATTERNS: Array<{ pattern: RegExp; category: string; deductible: boolean }> = [
  { pattern: /farmaci|farmacia/i,                    category: 'cat_salute',        deductible: true  },
  { pattern: /medic|dottore|studio med|laborat/i,    category: 'cat_salute',        deductible: true  },
  { pattern: /palestra|fitness|piscina|sport/i,      category: 'cat_sport',         deductible: true  },
  { pattern: /universit|scuola|corso/i,              category: 'cat_istruzione',    deductible: true  },
  { pattern: /assicura|allianz|generali|unipol/i,    category: 'cat_assicurazioni', deductible: true  },
  { pattern: /mutuo|rata mutuo/i,                    category: 'cat_mutuo',         deductible: true  },
  { pattern: /affitto|locazione|canone/i,            category: 'cat_casa',          deductible: false },
  { pattern: /enel|eni|a2a|edison|luce|gas|acqua/i,  category: 'cat_casa',          deductible: false },
  { pattern: /superm|esselunga|carrefour|coop|lidl/i,category: 'cat_alimentari',    deductible: false },
  { pattern: /netflix|spotify|prime|disney|dazn/i,   category: 'cat_abbonamenti',   deductible: false },
  { pattern: /trenitalia|italo|ryanair|flixbus/i,    category: 'cat_trasporti',     deductible: false },
  { pattern: /ristorante|pizzeria|bar |caffe/i,      category: 'cat_ristorazione',  deductible: false },
  { pattern: /stipendio|accredito/i,                 category: 'cat_stipendio',     deductible: false },
  { pattern: /ricarica|telefon|tim|vodafone|wind/i,  category: 'cat_abbonamenti',   deductible: false },
];

const SELF_TRANSFER_KEYWORDS = ['revolut', 'fineco', 'trade republic', 'paypal', 'giroconto', 'bonifico a me'];

export class IntesaConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'intesa',
    displayName: 'Intesa San Paolo',
    bankName: 'Intesa Sanpaolo S.p.A.',
    logoColor: '#E31837',
    csvDelimiter: ';',
    csvEncoding: 'UTF-8',
    skipRows: 1,
    dateFormat: 'DD/MM/YYYY',
    supportedFileTypes: ['.csv'],
    notes: 'ISP Smart → Conto → Movimenti → Scarica (icona download) → CSV',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const headers = lines[0].split(this.meta.csvDelimiter).map(h => h.trim().replace(/"/g, ''));
    const parsed: ParsedRow[] = [];
    const skipped: { row: RawCsvRow; reason: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(this.meta.csvDelimiter).map(v => v.trim().replace(/"/g, ''));
      const row: RawCsvRow = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      try {
        const parsedRow = this.normalizeRow(row, accountId);
        if (parsedRow) parsed.push(parsedRow);
        else skipped.push({ row, reason: 'Riga vuota o non parsabile' });
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: lines.length - 1 };
  }

  private normalizeRow(row: RawCsvRow, accountId: string): ParsedRow | null {
    // Intesa headers tipici:
    // Data operazione;Data valuta;Descrizione;Accrediti;Addebiti;Descrizione aggiuntiva
    const dateRaw = row['Data operazione'] || row['Data'] || '';
    if (!dateRaw.trim()) return null;

    const date = this.parseDate(dateRaw);
    const description = (row['Descrizione'] || row['Causale'] || '').trim();
    if (!description) return null;

    const accrediti = this.parseAmount(row['Accrediti'] || row['Entrate'] || '');
    const addebiti  = this.parseAmount(row['Addebiti']  || row['Uscite']  || '');

    if (accrediti === 0 && addebiti === 0) return null;

    const amount    = accrediti > 0 ? accrediti : addebiti;
    const direction: 'in' | 'out' = accrediti > 0 ? 'in' : 'out';
    const { category, deductible } = this.categorize(description);

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: category,
      amount,
      direction,
      description,
      merchant: this.extractMerchant(description),
      date,
      isDeductible: deductible,
      isTransfer: this.isTransfer(row),
    };

    return {
      dto,
      hash: this.generateHash(row),
      rawRow: row,
      warnings: category === 'cat_altro' ? ['Categoria non riconosciuta — assegna manualmente'] : [],
    };
  }

  generateHash(row: RawCsvRow): string {
    const date = this.parseDate(row['Data operazione'] || row['Data'] || '');
    const acc  = this.parseAmount(row['Accrediti'] || row['Entrate'] || '');
    const add  = this.parseAmount(row['Addebiti']  || row['Uscite']  || '');
    const amount = acc > 0 ? acc : -add;
    return generateTransactionHash(date, amount, row['Descrizione'] || '', 'intesa');
  }

  isTransfer(row: RawCsvRow): boolean {
    const desc = (row['Descrizione'] || '').toLowerCase();
    return SELF_TRANSFER_KEYWORDS.some(kw => desc.includes(kw));
  }

  private categorize(description: string): { category: string; deductible: boolean } {
    for (const rule of INTESA_PATTERNS) {
      if (rule.pattern.test(description)) return { category: rule.category, deductible: rule.deductible };
    }
    return { category: 'cat_altro', deductible: false };
  }

  private parseAmount(raw: string): number {
    if (!raw || raw.trim() === '' || raw.trim() === '-') return 0;
    const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.abs(val);
  }

  private parseDate(raw: string): string {
    if (!raw || !raw.includes('/')) throw new Error(`Data non valida: ${raw}`);
    const [day, month, year] = raw.trim().split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private extractMerchant(description: string): string {
    return description.replace(/^(bonifico|pagamento|addebito|accredito)\s*/i, '').trim().slice(0, 60);
  }
}
