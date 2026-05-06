import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface ConnectorMeta {
  id: string;
  displayName: string;
  bankName: string;
  logoColor: string;
  notes?: string;
}

export interface ImportResult {
  batch_id: string;
  imported: number;
  duplicates: number;
  skipped: number;
  total_rows: number;
  warnings: string[];
}

export interface ImportBatch {
  id: string;
  account_id: string;
  filename: string;
  format: string;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  period_from?: string;
  period_to?: string;
  imported_at: string;
  account_name?: string;
  bank_name?: string;
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  constructor(private api: ApiService) {}

  getConnectors(): Observable<ConnectorMeta[]> {
    return this.api.get<ConnectorMeta[]>('/import/connectors');
  }

  importCsv(file: File, accountId: string, format: string): Observable<ApiResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);
    formData.append('format', format);
    return this.api.postFormData<ImportResult>('/import/csv', formData);
  }

  getBatches(accountId?: string): Observable<ImportBatch[]> {
    return this.api.get<ImportBatch[]>('/import/batches', accountId ? { account_id: accountId } : {});
  }
}
