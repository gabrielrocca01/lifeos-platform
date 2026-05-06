import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface Transaction {
  id: string;
  account_id: string;
  category_id?: string;
  import_batch_id?: string;
  amount: number;
  direction: 'in' | 'out';
  description: string;
  merchant?: string;
  date: string;
  fiscal_year: string;
  is_deductible: number;
  deductible_type?: string;
  deductible_pct: number;
  status: 'pending' | 'confirmed' | 'excluded';
  is_transfer: number;
  notes?: string;
  tags?: string;
  // Join fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  account_name?: string;
  bank_name?: string;
  account_color?: string;
}

export interface TransactionFilters {
  account_id?: string;
  category_id?: string;
  direction?: 'in' | 'out';
  status?: string;
  date_from?: string;
  date_to?: string;
  fiscal_year?: string;
  is_deductible?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface MonthlyFlow {
  month: string;
  total_in: number;
  total_out: number;
  tx_count: number;
}

export interface CreateTransactionDto {
  account_id: string;
  category_id?: string;
  amount: number;
  direction: 'in' | 'out';
  description: string;
  merchant?: string;
  date: string;
  is_deductible?: boolean;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  constructor(private api: ApiService) {}

  getAll(filters?: TransactionFilters): Observable<ApiResponse<Transaction[]>> {
    return this.api.getWithMeta<Transaction[]>('/transactions', filters as Record<string, string | number | boolean>);
  }

  getById(id: string): Observable<Transaction> {
    return this.api.get<Transaction>(`/transactions/${id}`);
  }

  create(dto: CreateTransactionDto): Observable<Transaction> {
    return this.api.post<Transaction>('/transactions', dto);
  }

  update(id: string, dto: Partial<Transaction>): Observable<Transaction> {
    return this.api.patch<Transaction>(`/transactions/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/transactions/${id}`);
  }

  getMonthlyFlow(fiscal_year?: string): Observable<MonthlyFlow[]> {
    return this.api.get<MonthlyFlow[]>('/transactions/analytics/monthly', fiscal_year ? { fiscal_year } : {});
  }
}
