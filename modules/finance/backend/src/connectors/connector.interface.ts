// ============================================================
// Finance OS — AccountConnector Interface
// Ogni banca implementa questa interfaccia.
// Aggiungere un conto = creare un file che implementa questo.
// ============================================================

import { Transaction, CreateTransactionDto, ImportFormat } from '../shared/models/index.js';

// Metadati statici del connettore — descrivono la banca
export interface ConnectorMeta {
  id: ImportFormat;           // identificativo unico: 'fineco', 'revolut', ecc.
  displayName: string;        // nome leggibile: 'Fineco Bank'
  bankName: string;           // nome banca: 'FinecoBank S.p.A.'
  logoColor: string;          // colore esadecimale per la UI
  csvDelimiter: string;       // separatore CSV
  csvEncoding: string;        // 'UTF-8' | 'ISO-8859-1'
  skipRows: number;           // righe header da saltare
  dateFormat: string;         // formato data nel CSV: 'DD/MM/YYYY'
  supportedFileTypes: string[]; // ['.csv', '.xlsx']
  notes?: string;             // istruzioni su come esportare da questa banca
}

// Riga CSV grezza dopo il parsing, prima della normalizzazione
export interface RawCsvRow {
  [columnName: string]: string;
}

// Risultato della normalizzazione di una singola riga
export interface ParsedRow {
  dto: CreateTransactionDto;
  hash: string;              // hash deterministico per dedup (data+importo+descrizione)
  rawRow: RawCsvRow;         // riga originale per debugging
  warnings: string[];        // es. "categoria non riconosciuta"
}

// Risultato completo di un import
export interface ImportResult {
  parsed: ParsedRow[];
  skipped: { row: RawCsvRow; reason: string }[];
  totalRows: number;
}

// ============================================================
// INTERFACCIA PRINCIPALE — ogni connettore DEVE implementarla
// ============================================================
export interface AccountConnector {
  readonly meta: ConnectorMeta;

  // Legge e parsa il CSV grezzo, restituisce righe normalizzate
  parseFile(fileContent: string, accountId: string): ImportResult;

  // Genera un hash univoco per una transazione (usato per dedup)
  generateHash(row: RawCsvRow): string;

  // Rileva se una riga è un giroconto tra conti propri
  isTransfer(row: RawCsvRow): boolean;

  // Suggerisce una categoria in base alla descrizione (opzionale)
  suggestCategory?(description: string, merchant: string): string | undefined;
}

// ============================================================
// CONNECTOR REGISTRY
// Registro centrale di tutti i connettori disponibili.
// Non conosce le banche — conosce solo l'interfaccia.
// ============================================================
export class ConnectorRegistry {
  private static connectors = new Map<string, AccountConnector>();

  static register(connector: AccountConnector): void {
    this.connectors.set(connector.meta.id, connector);
    console.log(`[ConnectorRegistry] Registrato: ${connector.meta.displayName}`);
  }

  static get(id: string): AccountConnector {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(
        `Connettore '${id}' non trovato. Connettori disponibili: ${this.list().join(', ')}`
      );
    }
    return connector;
  }

  static has(id: string): boolean {
    return this.connectors.has(id);
  }

  static list(): string[] {
    return Array.from(this.connectors.keys());
  }

  static listMeta(): ConnectorMeta[] {
    return Array.from(this.connectors.values()).map(c => c.meta);
  }

  static remove(id: string): void {
    this.connectors.delete(id);
  }
}

// ============================================================
// HELPER — genera hash deterministico per dedup
// ============================================================
export function generateTransactionHash(
  date: string,
  amount: number,
  description: string,
  accountId: string
): string {
  const raw = `${accountId}|${date}|${amount}|${description.toLowerCase().trim()}`;
  // Hash semplice ma sufficientemente unico per dedup
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
