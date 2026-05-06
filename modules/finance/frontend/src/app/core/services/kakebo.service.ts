import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface KakeboEntry {
  id: string;
  date: string;
  fiscal_year: string;
  month: string;
  account_hint?: string;
  category_id?: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
  notes?: string;
  is_cash: number;
  reconciliation_status: 'pending' | 'matched' | 'unmatched' | 'ignored';
  matched_transaction_id?: string;
  match_confidence?: number;
  category_name?: string;
  category_icon?: string;
}

export interface ReconciliationSession {
  id: string;
  month: string;
  fiscal_year: string;
  status: string;
  kakebo_count: number;
  bank_count: number;
  matched_count: number;
  unmatched_kakebo: number;
  unmatched_bank: number;
  discrepancy_sum: number;
  created_at: string;
  completed_at?: string;
}

export interface ReconciliationReport {
  session: ReconciliationSession;
  matched: any[];
  kakeboOnly: any[];
  bankOnly: any[];
  summary: {
    kakeboTotal: number;
    bankTotal: number;
    delta: number;
    deltaPercent: number;
    cashEntries: number;
    accuracy: number;
  };
}

@Injectable({ providedIn: 'root' })
export class KakeboService {
  constructor(private api: ApiService) {}

  getEntries(month?: string, fiscal_year?: string): Observable<KakeboEntry[]> {
    const params: any = {};
    if (month) params.month = month;
    if (fiscal_year) params.fiscal_year = fiscal_year;
    return this.api.get<KakeboEntry[]>('/kakebo/entries', params);
  }

  addEntry(dto: Partial<KakeboEntry>): Observable<KakeboEntry> {
    return this.api.post<KakeboEntry>('/kakebo/entries', dto);
  }

  importCsv(file: File): Observable<ApiResponse<{imported: number; skipped: number}>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.api.postFormData('/kakebo/import-csv', fd);
  }

  reconcile(month: string): Observable<ApiResponse<ReconciliationReport>> {
    return this.api.postFormData('/kakebo/reconcile', Object.assign(new FormData(), {}) as any);
    // usa post normale
  }

  reconcileMonth(month: string): Observable<ReconciliationReport> {
    return this.api.post<ReconciliationReport>('/kakebo/reconcile', { month });
  }

  getSessions(): Observable<ReconciliationSession[]> {
    return this.api.get<ReconciliationSession[]>('/kakebo/sessions');
  }

  monthKey(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  }

  monthLabel(key: string): string {
    const [y, m] = key.split('-');
    const names = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    return `${names[parseInt(m)]} ${y}`;
  }
}
