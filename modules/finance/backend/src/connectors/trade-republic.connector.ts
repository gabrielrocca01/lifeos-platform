// ============================================================
// Finance OS — Connettore Trade Republic
// Formato reale CSV TR (2024-2025):
// datetime,date,account_type,category,type,asset_class,name,
// symbol,shares,price,amount,fee,tax,currency,original_amount,
// original_currency,fx_rate,description,transaction_id,
// counterparty_name,counterparty_iban,payment_reference,mcc_code
// ============================================================

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../shared/models/index.js';

// Mappa type TR → categoria Finance OS
const TR_TYPE_MAP: Record<string, { category: string; deductible: boolean }> = {
  'interest_payment':        { category: 'cat_investimenti',  deductible: false },
  'interest':                { category: 'cat_investimenti',  deductible: false },
  'card_transaction':        { category: 'cat_altro',         deductible: false },
  'customer_inbound':        { category: 'cat_altro',         deductible: false },
  'customer_outbound_request': { category: 'cat_altro',       deductible: false },
  'transfer_instant_inbound':  { category: 'cat_altro',       deductible: false },
  'transfer_instant_outbound': { category: 'cat_altro',       deductible: false },
  'payment_inbound':         { category: 'cat_stipendio',     deductible: false },
  'payment_outbound':        { category: 'cat_altro',         deductible: false },
  'buy':                     { category: 'cat_investimenti',  deductible: false },
  'sell':                    { category: 'cat_investimenti',  deductible: false },
  'dividend':                { category: 'cat_investimenti',  deductible: false },
  'savings_plan_execution':  { category: 'cat_investimenti',  deductible: false },
};

// Mappa category TR → categoria Finance OS
const TR_CATEGORY_MAP: Record<string, { category: string; deductible: boolean }> = {
  'food_and_drink':       { category: 'cat_ristorazione',   deductible: false },
  'groceries':            { category: 'cat_alimentari',     deductible: false },
  'transport':            { category: 'cat_trasporti',      deductible: false },
  'health':               { category: 'cat_salute',         deductible: true  },
  'shopping':             { category: 'cat_svago',          deductible: false },
  'entertainment':        { category: 'cat_svago',          deductible: false },
  'travel':               { category: 'cat_svago',          deductible: false },
  'utilities':            { category: 'cat_casa',           deductible: false },
  'education':            { category: 'cat_istruzione',     deductible: true  },
  'sports':               { category: 'cat_sport',          deductible: true  },
  'insurance':            { category: 'cat_assicurazioni',  deductible: true  },
  'home':                 { category: 'cat_casa',           deductible: false },
  'subscriptions':        { category: 'cat_abbonamenti',    deductible: false },
};

// Tipi da saltare (operazioni interne investimenti)
const SKIP_TYPES = new Set([
  'order_buy', 'order_sell', 'order_expire',
  'split', 'corporate_action',
]);

export class TradeRepublicConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'trade_republic',
    displayName: 'Trade Republic',
    bankName: 'Trade Republic Bank GmbH',
    logoColor: '#00B140',
    csvDelimiter: ',',
    csvEncoding: 'UTF-8',
    skipRows: 1,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    supportedFileTypes: ['.csv'],
    notes: 'App TR → Profilo → Documenti → Estratto conto → Seleziona periodo → Esporta CSV',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const headers = this.parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, '').toLowerCase());
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
        if (parsedRow) {
          parsed.push(parsedRow);
        } else {
          skipped.push({ row, reason: 'Tipo operazione non rilevante (investimento puro o riga vuota)' });
        }
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: lines.length - 1 };
  }

  private normalizeRow(row: RawCsvRow, accountId: string): ParsedRow | null {
    // Colonne reali TR: datetime, date, account_type, category, type,
    // asset_class, name, symbol, shares, price, amount, fee, tax,
    // currency, original_amount, original_currency, fx_rate, description,
    // transaction_id, counterparty_name, counterparty_iban, payment_reference, mcc_code

    const type = (row['type'] || '').toLowerCase();

    // Salta operazioni di investimento pure (buy/sell ordini)
    if (SKIP_TYPES.has(type)) return null;

    // Data: usa 'date' (YYYY-MM-DD) o estrai da 'datetime'
    const dateRaw = row['date'] || row['datetime'] || '';
    if (!dateRaw.trim()) return null;
    const date = dateRaw.trim().split(' ')[0]; // YYYY-MM-DD

    // Importo: colonna 'amount'
    const amountRaw = row['amount'] || '';
    if (!amountRaw.trim()) return null;
    const amount = parseFloat(amountRaw.replace(',', '.'));
    if (isNaN(amount)) throw new Error(`Importo non valido: "${amountRaw}"`);

    const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out';

    // Descrizione: usa 'description' poi 'name' poi 'type'
    const description = (row['description'] || row['name'] || type || 'Trade Republic').trim();

    // Merchant: counterparty_name o name
    const merchant = (row['counterparty_name'] || row['name'] || 'Trade Republic').trim();

    // Categoria: prima da 'category' poi da 'type'
    const categoryKey = (row['category'] || '').toLowerCase();
    const catFromCategory = TR_CATEGORY_MAP[categoryKey];
    const catFromType     = TR_TYPE_MAP[type];
    const mapped = catFromCategory || catFromType || { category: 'cat_altro', deductible: false };

    // Fee e tax come avvisi
    const fee = parseFloat(row['fee'] || '0') || 0;
    const tax = parseFloat(row['tax'] || '0') || 0;
    const warnings: string[] = [];
    if (Math.abs(fee) > 0) warnings.push(`Commissione: €${Math.abs(fee).toFixed(2)}`);
    if (Math.abs(tax) > 0) warnings.push(`Tassa: €${Math.abs(tax).toFixed(2)}`);
    if (mapped.category === 'cat_altro') warnings.push('Categoria non riconosciuta — assegna manualmente');

    const dto: CreateTransactionDto = {
      accountId,
      categoryId: mapped.category,
      amount: Math.abs(amount),
      direction,
      description,
      merchant: merchant || undefined,
      date,
      isDeductible: mapped.deductible,
      isTransfer: this.isTransfer(row),
      tags: type ? [type] : [],
    };

    return {
      dto,
      hash: this.generateHash(row),
      rawRow: row,
      warnings,
    };
  }

  generateHash(row: RawCsvRow): string {
    // Usa transaction_id se disponibile — è già univoco
    if (row['transaction_id'] && row['transaction_id'].trim()) {
      return row['transaction_id'].trim();
    }
    const date   = (row['date'] || row['datetime'] || '').split(' ')[0];
    const amount = parseFloat((row['amount'] || '0').replace(',', '.'));
    const desc   = row['description'] || row['name'] || '';
    return generateTransactionHash(date, amount, desc, 'trade_republic');
  }

  isTransfer(row: RawCsvRow): boolean {
    const type = (row['type'] || '').toLowerCase();
    return type === 'customer_inbound' ||
           type === 'customer_outbound_request' ||
           type === 'transfer_instant_inbound' ||
           type === 'transfer_instant_outbound';
  }

  suggestCategory(description: string, type: string): string | undefined {
    const t = type.toLowerCase();
    const mapped = TR_TYPE_MAP[t] || TR_CATEGORY_MAP[t];
    return mapped?.category;
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
