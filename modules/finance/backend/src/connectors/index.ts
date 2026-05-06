// ============================================================
// Finance OS — Registro connettori
//
// Per aggiungere una nuova banca:
//   1. Crea il file: src/connectors/nomebanca.connector.ts
//   2. Implementa AccountConnector
//   3. Aggiungi la riga register() qui sotto
//   4. Aggiungi il record nel DB con format = 'nomebanca'
//   Fatto. Il core non va toccato.
// ============================================================

import { ConnectorRegistry } from './connector.interface.js';
import { RevolutConnector }        from './revolut.connector.js';
import { FinecoConnector }         from './fineco.connector.js';
import { IntesaConnector }         from './intesa.connector.js';
import { TradeRepublicConnector }  from './trade-republic.connector.js';
import { PaypalConnector }         from './paypal.connector.js';

export function registerAllConnectors(): void {
  ConnectorRegistry.register(new RevolutConnector());
  ConnectorRegistry.register(new FinecoConnector());
  ConnectorRegistry.register(new IntesaConnector());
  ConnectorRegistry.register(new TradeRepublicConnector());
  ConnectorRegistry.register(new PaypalConnector());

  console.log(`[Finance OS] Connettori registrati: ${ConnectorRegistry.list().join(', ')}`);
}

export { ConnectorRegistry } from './connector.interface.js';
export { RevolutConnector }       from './revolut.connector.js';
export { FinecoConnector }        from './fineco.connector.js';

// ============================================================
// TEMPLATE — per aggiungere un nuovo connettore
// Copia questo file, rinomina, implementa i metodi.
// ============================================================
/*

import {
  AccountConnector, ConnectorMeta, RawCsvRow,
  ParsedRow, ImportResult, generateTransactionHash
} from './connector.interface.js';
import { CreateTransactionDto } from '../../shared/models/index.js';

export class NomeBancaConnector implements AccountConnector {
  readonly meta: ConnectorMeta = {
    id: 'nomebanca',                    // deve corrispondere al campo 'format' nel DB
    displayName: 'Nome Banca',
    bankName: 'Banca S.p.A.',
    logoColor: '#000000',
    csvDelimiter: ';',                  // ',' o ';'
    csvEncoding: 'UTF-8',               // o 'ISO-8859-1'
    skipRows: 1,                        // quante righe di header saltare
    dateFormat: 'DD/MM/YYYY',
    supportedFileTypes: ['.csv'],
    notes: 'Come esportare: Home Banking → Movimenti → Esporta CSV',
  };

  parseFile(fileContent: string, accountId: string): ImportResult {
    const lines = fileContent.trim().split('\n');
    const headers = lines[this.meta.skipRows - 1]
      .split(this.meta.csvDelimiter)
      .map(h => h.trim());

    const parsed: ParsedRow[] = [];
    const skipped: { row: RawCsvRow; reason: string }[] = [];

    for (let i = this.meta.skipRows; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(this.meta.csvDelimiter);
      const row: RawCsvRow = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

      try {
        const dto: CreateTransactionDto = {
          accountId,
          amount: Math.abs(parseFloat(row['Importo'] || '0')),
          direction: parseFloat(row['Importo'] || '0') >= 0 ? 'in' : 'out',
          description: row['Descrizione'] || '',
          date: row['Data'] || '',       // normalizza al formato YYYY-MM-DD
        };

        parsed.push({
          dto,
          hash: this.generateHash(row),
          rawRow: row,
          warnings: [],
        });
      } catch (e) {
        skipped.push({ row, reason: (e as Error).message });
      }
    }

    return { parsed, skipped, totalRows: lines.length - this.meta.skipRows };
  }

  generateHash(row: RawCsvRow): string {
    return generateTransactionHash(
      row['Data'] || '',
      parseFloat(row['Importo'] || '0'),
      row['Descrizione'] || '',
      this.meta.id
    );
  }

  isTransfer(row: RawCsvRow): boolean {
    return false; // implementa la logica specifica
  }
}

*/
