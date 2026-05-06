import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface TaxRecord {
  id: string;
  fiscal_year: string;
  document_type: 'cu' | '730' | 'estratto_conto' | 'fattura' | 'ricevuta' | 'f24' | 'altro';
  filename?: string;
  notes?: string;
  uploaded_at: string;
}

export interface CreateTaxRecordDto {
  fiscal_year: string;
  document_type: TaxRecord['document_type'];
  filename?: string;
  notes?: string;
}

const DOC_LABELS: Record<string, string> = {
  cu:             'Certificazione Unica',
  '730':          'Modello 730',
  estratto_conto: 'Estratto conto',
  fattura:        'Fattura',
  ricevuta:       'Ricevuta',
  f24:            'Modello F24',
  altro:          'Altro',
};

const DOC_ICONS: Record<string, string> = {
  cu:             '📄',
  '730':          '📊',
  estratto_conto: '🏦',
  fattura:        '🧾',
  ricevuta:       '🧾',
  f24:            '📋',
  altro:          '📁',
};

@Injectable({ providedIn: 'root' })
export class FiscalService {
  constructor(private api: ApiService) {}

  getRecords(fiscal_year?: string): Observable<TaxRecord[]> {
    return this.api.get<TaxRecord[]>('/fiscal/records', fiscal_year ? { fiscal_year } : {});
  }

  createRecord(dto: CreateTaxRecordDto): Observable<TaxRecord> {
    return this.api.post<TaxRecord>('/fiscal/records', dto);
  }

  deleteRecord(id: string): Observable<void> {
    return this.api.delete<void>(`/fiscal/records/${id}`);
  }

  docLabel(type: string): string { return DOC_LABELS[type] ?? type; }
  docIcon(type: string): string  { return DOC_ICONS[type] ?? '📁'; }

  availableYears(): string[] {
    const cur = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (cur - i).toString());
  }
}