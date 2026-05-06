// ============================================================
// Finance OS — Connettore Revolut
// Supporta CSV italiano e inglese
// IT headers: Tipo,Prodotto,Data di inizio,Data di completamento,
//             Descrizione,Importo,Costo,Valuta,State,Saldo
// EN headers: Type,Product,Started Date,Completed Date,
//             Description,Amount,Fee,Currency,State,Balance
// ============================================================

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../shared/models/index.js';

const COMPLETED_STATES = new Set([
  'completato', 'completed', 'cleared', 'revertita', 'reverted'
]);

const CATEGORY_MAP: Record<string, string> = {
  // Tipi italiani
  'pagamento':         'cat_altro',
  'ricarica':          'cat_altro',
  'trasferimento':     'cat_altro',
  'prelievo bancomat': 'cat_altro',
  'cambio':            'cat_altro',
  'rimborso':          'cat_altro',
  'cashback':          'cat_bonus',
  'interesse':         'cat_investimenti',
  'abbonamento':       'cat_abbonamenti',
  // Tipi inglesi
  'payment':           'cat_altro',
  'transfer':          'cat_altro',
  'topup':             'cat_altro',
  'atm':               'cat_altro',
  'exchange':          'cat_altro',
  'refund':            'cat_altro',
  'reward':            'cat_bonus',
  'interest':          'cat_investimenti',
  'subscription':      'cat_abbonamenti',
};

const MERCHANT_PATTERNS: Array<{ pattern: RegExp; category: string; deductible: boolean }> = [
  { pattern: /farmac|parafarmac/i,             category: 'cat_salute',       deductible: true  },
  { pattern: /medic|dottore|laborat|clinica/i, category: 'cat_salute',       deductible: true  },
  { pattern: /palestra|fitness|piscina|swim/i, category: 'cat_sport',        deductible: true  },
  { pattern: /superm|esselunga|carrefour|coop|lidl|eurospin|conad/i, category: 'cat_alimentari', deductible: false },
  { pattern: /netflix|spotify|amazon prime|disney|dazn/i, category: 'cat_abbonamenti', deductible: false },
  { pattern: /uber|taxi|trenitalia|italo|ryanair|easyjet/i, category: 'cat_trasporti', deductible: false },
  { pattern: /ristorante|pizzeria|bar |trattoria|sushi|caffe/i, category: 'cat_ristorazione', deductible: false },
  { pattern: /amazon|zalando|zara|h&m|ikea/i, category: 'cat_svago',       deductible: false },
  { pattern: /enel|eni|a2a|acqua|gas|luce|tim |vodafone|wind/i, category: 'cat_casa', deductible: false },
];

const SELF_TRANSFER_KEYWORDS = [
  'fineco', 'intesa', 'trade republic', 'unicredit', 'paypal',
  'bonifico a me', 'giroconto', 'trasferimento a se',
];

export class RevolutConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'revolut',
    displayName: 'Revolut',
    bankName: 'Revolut Ltd',
    logoColor: '#191C1F',
    csvDelimiter: ',',
    csvEncoding: 'UTF-8',
    skipRows: 1,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    supportedFileTypes: ['.csv'],
    notes: 'App Revolut → Profilo (in basso a dx) → Estratti conto → Seleziona periodo → CSV',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const rawHeaders = this.parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim().replace(/"/g, '').toLowerCase());

    // Rileva lingua dal primo header
    const isItalian = headers[0] === 'tipo' || headers.includes('importo');

    const parsed: ParsedRow[] = [];
    const skipped: { row: RawCsvRow; reason: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const row: RawCsvRow = {};
      // Mappa sia con chiavi originali che lowercase
      rawHeaders.forEach((h, idx) => {
        const key = h.trim().replace(/"/g, '');
        row[key] = (values[idx] || '').trim().replace(/^"|"$/g, '');
        row[key.toLowerCase()] = row[key];
      });

      try {
        const parsedRow = isItalian
          ? this.normalizeItalian(row, accountId)
          : this.normalizeEnglish(row, accountId);

        if (parsedRow) parsed.push(parsedRow);
        else skipped.push({ row, reason: 'Transazione non completata o tipo da saltare' });
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: lines.length - 1 };
  }

  // ── CSV ITALIANO ─────────────────────────────────────────────
  private normalizeItalian(row: RawCsvRow, accountId: string): ParsedRow | null {
    // Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo
    const state = (row['State'] || row['state'] || '').toLowerCase();
    if (!COMPLETED_STATES.has(state)) return null;

    const dateRaw = row['Data di completamento'] || row['Data di inizio'] || '';
    if (!dateRaw.trim()) return null;
    const date = dateRaw.trim().split(' ')[0]; // YYYY-MM-DD

    const amountRaw = (row['Importo'] || row['importo'] || '').replace(',', '.');
    const amount = parseFloat(amountRaw);
    if (isNaN(amount)) throw new Error(`Importo non valido: "${amountRaw}"`);

    const description = row['Descrizione'] || row['descrizione'] || '';
    const tipo = (row['Tipo'] || row['tipo'] || '').toLowerCase();
    const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out';

    const { category, deductible } = this.categorize(description, tipo);

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: category,
      amount: Math.abs(amount),
      direction,
      description: description || tipo || 'Revolut',
      merchant: this.extractMerchant(description),
      date,
      isDeductible: deductible,
      isTransfer: this.isTransferIT(row),
    };

    const warnings: string[] = [];
    const fee = parseFloat((row['Costo'] || '0').replace(',', '.')) || 0;
    if (Math.abs(fee) > 0) warnings.push(`Commissione: €${Math.abs(fee).toFixed(2)}`);
    const currency = row['Valuta'] || row['valuta'] || 'EUR';
    if (currency !== 'EUR') warnings.push(`Valuta originale: ${currency}`);

    return { dto, hash: this.generateHashIT(row), rawRow: row, warnings };
  }

  // ── CSV INGLESE ──────────────────────────────────────────────
  private normalizeEnglish(row: RawCsvRow, accountId: string): ParsedRow | null {
    const state = (row['State'] || '').toLowerCase();
    if (!COMPLETED_STATES.has(state)) return null;

    const dateRaw = row['Completed Date'] || row['Started Date'] || '';
    if (!dateRaw.trim()) return null;
    const date = dateRaw.trim().split(' ')[0];

    const amountRaw = (row['Amount'] || '').replace(',', '.');
    const amount = parseFloat(amountRaw);
    if (isNaN(amount)) throw new Error(`Amount non valido: "${amountRaw}"`);

    const description = row['Description'] || '';
    const type = (row['Type'] || '').toLowerCase();
    const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out';
    const { category, deductible } = this.categorize(description, type);

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: category,
      amount: Math.abs(amount),
      direction,
      description: description || type || 'Revolut',
      merchant: this.extractMerchant(description),
      date,
      isDeductible: deductible,
      isTransfer: this.isTransfer(row),
    };

    const warnings: string[] = [];
    const fee = parseFloat(row['Fee'] || '0') || 0;
    if (Math.abs(fee) > 0) warnings.push(`Fee: €${Math.abs(fee).toFixed(2)}`);
    const currency = row['Currency'] || 'EUR';
    if (currency !== 'EUR') warnings.push(`Valuta originale: ${currency}`);

    return { dto, hash: this.generateHashEN(row), rawRow: row, warnings };
  }

  // ── HELPERS ──────────────────────────────────────────────────
  private categorize(description: string, type: string): { category: string; deductible: boolean } {
    for (const rule of MERCHANT_PATTERNS) {
      if (rule.pattern.test(description)) return { category: rule.category, deductible: rule.deductible };
    }
    const fromType = CATEGORY_MAP[type.toLowerCase()];
    return { category: fromType ?? 'cat_altro', deductible: false };
  }

  private extractMerchant(description: string): string {
    return description
      .replace(/^pagamento a favore di /i, '')
      .replace(/^pagamento a /i, '')
      .replace(/^payment to /i, '')
      .trim()
      .slice(0, 60);
  }

  generateHash(row: RawCsvRow): string {
    // Prova prima formato italiano, poi inglese
    if (row['Importo'] !== undefined) return this.generateHashIT(row);
    return this.generateHashEN(row);
  }

  private generateHashIT(row: RawCsvRow): string {
    // Usa datetime completo + tipo per massima unicità
    const datetime = row['Data di completamento'] || row['Data di inizio'] || '';
    const amount = parseFloat((row['Importo'] || '0').replace(',', '.'));
    const desc = row['Descrizione'] || '';
    const tipo = row['Tipo'] || '';
    return generateTransactionHash(datetime, amount, desc + tipo, 'revolut');
  }

  private generateHashEN(row: RawCsvRow): string {
    const datetime = row['Completed Date'] || row['Started Date'] || '';
    const amount = parseFloat((row['Amount'] || '0').replace(',', '.'));
    const desc = row['Description'] || '';
    const type = row['Type'] || '';
    return generateTransactionHash(datetime, amount, desc + type, 'revolut');
  }

  isTransfer(row: RawCsvRow): boolean {
    const desc = (row['Description'] || row['Descrizione'] || '').toLowerCase();
    const type = (row['Type'] || row['Tipo'] || '').toLowerCase();
    if (type === 'transfer' || type === 'trasferimento') return true;
    return SELF_TRANSFER_KEYWORDS.some(kw => desc.includes(kw));
  }

  private isTransferIT(row: RawCsvRow): boolean {
    return this.isTransfer(row);
  }

  suggestCategory(description: string): string | undefined {
    const { category } = this.categorize(description, '');
    return category !== 'cat_altro' ? category : undefined;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { result.push(current); current = ''; continue; }
      current += char;
    }
    result.push(current);
    return result;
  }
}