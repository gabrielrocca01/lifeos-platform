// ============================================================
// Finance OS — Connettore Fineco
// Come esportare conto corrente:
//   Home Banking → Movimenti → Seleziona periodo → Esporta CSV
// Come esportare portafoglio:
//   Home Banking → Il mio portafoglio → Operazioni → Esporta CSV
// ============================================================

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../shared/models/index.js';

// Fineco usa punto e virgola e encoding ISO-8859-1
// Il CSV ha 7 righe di intestazione da saltare prima dei dati

const FINECO_MERCHANT_PATTERNS: Array<{ pattern: RegExp; category: string; deductible: boolean }> = [
  { pattern: /farmaci|farmacia|parafarmacia/i,      category: 'cat_salute',       deductible: true  },
  { pattern: /medic|dottore|studio med|laborat/i,   category: 'cat_salute',       deductible: true  },
  { pattern: /palestra|fitness|piscina|nuoto|sport/i,category: 'cat_sport',       deductible: true  },
  { pattern: /universit|scuola|corso|formazione/i,  category: 'cat_istruzione',   deductible: true  },
  { pattern: /assicura|allianz|generali|unipol/i,   category: 'cat_assicurazioni',deductible: true  },
  { pattern: /mutuo|rata|banca|interesse/i,          category: 'cat_mutuo',        deductible: true  },
  { pattern: /superm|esselunga|carrefour|coop|lidl/i,category: 'cat_alimentari',  deductible: false },
  { pattern: /enel|eni|a2a|edison|luce|gas|acqua/i, category: 'cat_casa',         deductible: false },
  { pattern: /affitto|locazione|canone/i,            category: 'cat_casa',         deductible: false },
  { pattern: /netflix|spotify|prime|disney|dazn/i,  category: 'cat_abbonamenti',  deductible: false },
  { pattern: /trenitalia|italo|ryanair|flixbus/i,   category: 'cat_trasporti',    deductible: false },
  { pattern: /ristorante|pizzeria|bar |caffe|trattoria/i, category: 'cat_ristorazione', deductible: false },
  { pattern: /stipendio|accredito salary|compenso/i,category: 'cat_stipendio',    deductible: false },
  { pattern: /dividendo|cedola/i,                   category: 'cat_investimenti', deductible: false },
];

const SELF_TRANSFER_KEYWORDS = [
  'bonifico a revolut', 'bonifico a trade', 'bonifico a paypal',
  'giroconto', 'trasf. a me', 'bonifico proprio'
];

export class FinecoConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'fineco',
    displayName: 'FinecoBank',
    bankName: 'FinecoBank S.p.A.',
    logoColor: '#FF6600',
    csvDelimiter: ';',
    csvEncoding: 'ISO-8859-1',
    skipRows: 7,
    dateFormat: 'DD/MM/YYYY',
    supportedFileTypes: ['.csv'],
    notes: 'Home Banking Fineco → Movimenti → Esporta → CSV. ' +
           'Attenzione: encoding ISO-8859-1, non UTF-8.',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const dataLines = lines.slice(this.meta.skipRows);

    // Trova la riga header (dopo le righe di intestazione Fineco)
    const headerLine = dataLines[0];
    if (!headerLine) return { parsed: [], skipped: [], totalRows: 0 };

    const headers = headerLine.split(';').map(h => h.trim().replace(/"/g, ''));
    const parsed: ParsedRow[] = [];
    const skipped: { row: RawCsvRow; reason: string }[] = [];

    for (let i = 1; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('Data')) continue;

      const values = line.split(';').map(v => v.trim().replace(/"/g, ''));
      const row: RawCsvRow = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      // Fineco mette una riga di totale alla fine
      if (row['Data'] === '' || row['Data'] === 'Totale') continue;

      try {
        const parsedRow = this.normalizeRow(row, accountId);
        if (parsedRow) parsed.push(parsedRow);
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: dataLines.length - 1 };
  }

  private normalizeRow(row: RawCsvRow, accountId: string): ParsedRow | null {
    // Fineco CSV headers:
    // Data | Orario | Descrizione operazione | Entrate | Uscite | Saldo contabile | Saldo disponibile

    const dateRaw = row['Data'];
    if (!dateRaw || dateRaw.trim() === '') return null;

    const date = this.parseDate(dateRaw);
    const description = row['Descrizione operazione'] || '';

    // Fineco separa entrate/uscite in colonne diverse
    const entrate = this.parseAmount(row['Entrate']);
    const uscite = this.parseAmount(row['Uscite']);

    if (entrate === 0 && uscite === 0) {
      return null; // riga vuota o di separazione
    }

    const amount = entrate > 0 ? entrate : uscite;
    const direction = entrate > 0 ? 'in' : 'out';

    const { category, deductible } = this.categorize(description);

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: category,
      amount,
      direction,
      description: description.trim(),
      merchant: this.extractMerchant(description),
      date,
      isDeductible: deductible,
      isTransfer: this.isTransfer(row),
      tags: [],
    };

    const warnings: string[] = [];
    if (category === 'cat_altro') {
      warnings.push('Categoria non riconosciuta — assegna manualmente');
    }

    return {
      dto,
      hash: this.generateHash(row),
      rawRow: row,
      warnings,
    };
  }

  generateHash(row: RawCsvRow): string {
    const date = this.parseDate(row['Data'] || '');
    const entrate = this.parseAmount(row['Entrate']);
    const uscite = this.parseAmount(row['Uscite']);
    const amount = entrate > 0 ? entrate : -uscite;
    return generateTransactionHash(date, amount, row['Descrizione operazione'] || '', 'fineco');
  }

  isTransfer(row: RawCsvRow): boolean {
    const desc = (row['Descrizione operazione'] || '').toLowerCase();
    return SELF_TRANSFER_KEYWORDS.some(kw => desc.includes(kw));
  }

  suggestCategory(description: string): string | undefined {
    const { category } = this.categorize(description);
    return category !== 'cat_altro' ? category : undefined;
  }

  private categorize(description: string): { category: string; deductible: boolean } {
    for (const rule of FINECO_MERCHANT_PATTERNS) {
      if (rule.pattern.test(description)) {
        return { category: rule.category, deductible: rule.deductible };
      }
    }
    return { category: 'cat_altro', deductible: false };
  }

  private parseAmount(raw: string): number {
    if (!raw || raw.trim() === '') return 0;
    // Fineco usa virgola come decimale e punto come migliaia: "1.234,56"
    const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.abs(val);
  }

  private parseDate(raw: string): string {
    // Fineco: "15/03/2024" → "2024-03-15"
    if (!raw || !raw.includes('/')) throw new Error(`Data non valida: ${raw}`);
    const [day, month, year] = raw.trim().split('/');
    if (!day || !month || !year) throw new Error(`Data malformata: ${raw}`);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private extractMerchant(description: string): string {
    // Fineco mette spesso "PAGAMENTO CARTA xxxxxx NOME NEGOZIO DATA"
    const cleaned = description
      .replace(/^pagamento carta \d+\s*/i, '')
      .replace(/^bonifico (da|a)\s*/i, '')
      .replace(/\d{2}\/\d{2}\/\d{4}.*$/, '')
      .trim();
    return cleaned.slice(0, 60);
  }
}
