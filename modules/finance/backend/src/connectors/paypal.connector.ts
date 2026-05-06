// ============================================================
// Finance OS — Connettore PayPal
// Come esportare:
//   paypal.com → Attività → Scarica → CSV → Seleziona periodo
// ============================================================

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../shared/models/index.js';

// PayPal ha molti tipi di transazione
const PAYPAL_COMPLETED_STATUSES = ['completata', 'completed', 'cleared'];
const PAYPAL_SKIP_TYPES = ['autorizzazione', 'authorization', 'storno temporaneo', 'temporary hold'];

export class PaypalConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'paypal',
    displayName: 'PayPal',
    bankName: 'PayPal Europe',
    logoColor: '#003087',
    csvDelimiter: ',',
    csvEncoding: 'UTF-8',
    skipRows: 1,
    dateFormat: 'DD/MM/YYYY',
    supportedFileTypes: ['.csv'],
    notes: 'paypal.com → Attività (in alto) → Scarica → CSV completo → Seleziona periodo',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const headers = this.parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
    const parsed: ParsedRow[] = [];
    const skipped: { row: RawCsvRow; reason: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const row: RawCsvRow = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim().replace(/^"|"$/g, ''); });

      try {
        const parsedRow = this.normalizeRow(row, accountId);
        if (parsedRow) parsed.push(parsedRow);
        else skipped.push({ row, reason: 'Transazione non completata o tipo da saltare' });
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: lines.length - 1 };
  }

  private normalizeRow(row: RawCsvRow, accountId: string): ParsedRow | null {
    // PayPal CSV headers (IT):
    // Data,Ora,Fuso orario,Descrizione,Valuta,Lordo,Tariffa,Netto,Saldo,Codice transazione,
    // Indirizzo email mittente,Nome,Cognome,Tipo transazione,Stato,Titolo articolo,...

    const status = (row['Stato'] || row['Status'] || '').toLowerCase();
    if (!PAYPAL_COMPLETED_STATUSES.some(s => status.includes(s))) return null;

    const type = (row['Tipo transazione'] || row['Transaction Type'] || row['Tipo'] || '').toLowerCase();
    if (PAYPAL_SKIP_TYPES.some(t => type.includes(t))) return null;

    const dateRaw = row['Data'] || row['Date'] || '';
    if (!dateRaw) return null;
    const date = this.parseDate(dateRaw);

    // PayPal usa "Netto" o "Lordo" — usiamo Netto se disponibile
    const amountRaw = row['Netto'] || row['Net'] || row['Lordo'] || row['Gross'] || '0';
    const amount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount)) throw new Error(`Importo non valido: ${amountRaw}`);

    const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out';
    const description = row['Descrizione'] || row['Description'] || row['Titolo articolo'] || 'PayPal';
    const merchant = this.extractMerchant(row);

    // Rileva "Paga in 3 rate" PayPal
    const isInstallment = description.toLowerCase().includes('rata') ||
                          type.includes('installment') || type.includes('buy now pay later');

    const warnings: string[] = [];
    if (isInstallment) warnings.push('Paga in 3 rate PayPal — verifica la rata corrente');

    // Commissione PayPal
    const fee = parseFloat((row['Tariffa'] || row['Fee'] || '0').replace(/\./g, '').replace(',', '.'));
    if (fee !== 0) warnings.push(`Commissione PayPal: €${Math.abs(fee).toFixed(2)}`);

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: 'cat_altro',
      amount: Math.abs(amount),
      direction,
      description,
      merchant,
      date,
      isDeductible: false,
      isTransfer: this.isTransfer(row),
      tags: isInstallment ? ['paga-in-3-rate'] : [],
    };

    return {
      dto,
      hash: this.generateHash(row),
      rawRow: row,
      warnings,
    };
  }

  generateHash(row: RawCsvRow): string {
    const date = this.parseDate(row['Data'] || row['Date'] || '');
    const amountRaw = row['Netto'] || row['Net'] || row['Lordo'] || '0';
    const amount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'));
    const desc = row['Descrizione'] || row['Description'] || '';
    return generateTransactionHash(date, amount, desc, 'paypal');
  }

  isTransfer(row: RawCsvRow): boolean {
    const type = (row['Tipo transazione'] || row['Transaction Type'] || '').toLowerCase();
    const desc = (row['Descrizione'] || '').toLowerCase();
    return type.includes('transfer') || type.includes('trasferimento') ||
           desc.includes('trasferimento') || desc.includes('bonifico');
  }

  private extractMerchant(row: RawCsvRow): string {
    const nome    = row['Nome'] || row['First Name'] || '';
    const cognome = row['Cognome'] || row['Last Name'] || '';
    const email   = row['Indirizzo email mittente'] || row['From Email Address'] || '';
    if (nome || cognome) return `${nome} ${cognome}`.trim().slice(0, 60);
    if (email) return email.slice(0, 60);
    return 'PayPal';
  }

  private parseDate(raw: string): string {
    if (!raw) throw new Error('Data vuota');
    // PayPal IT: "31/12/2024" → "2024-12-31"
    if (raw.includes('/')) {
      const [d, m, y] = raw.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return raw.split(' ')[0]; // già ISO
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
