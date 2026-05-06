import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Account {
  id: string;
  name: string;
  bank_name: string;
  iban?: string;
  type: 'checking' | 'savings' | 'credit_card' | 'prepaid' | 'investment' | 'cash';
  currency: string;
  balance: number;
  balance_computed: number;
  color_tag: string;
  is_active: number;
  notes?: string;
  transaction_count: number;
  created_at: string;
}

export interface CreateAccountDto {
  name: string;
  bank_name: string;
  iban?: string;
  type: Account['type'];
  currency?: string;
  balance?: number;
  color_tag?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  constructor(private api: ApiService) {}

  getAll(): Observable<Account[]> {
    return this.api.get<Account[]>('/accounts');
  }

  getById(id: string): Observable<Account> {
    return this.api.get<Account>(`/accounts/${id}`);
  }

  create(dto: CreateAccountDto): Observable<Account> {
    return this.api.post<Account>('/accounts', dto);
  }

  update(id: string, dto: Partial<CreateAccountDto>): Observable<Account> {
    return this.api.patch<Account>(`/accounts/${id}`, dto);
  }

  deactivate(id: string): Observable<void> {
    return this.api.delete<void>(`/accounts/${id}`);
  }

  getTotalBalance(accounts: Account[]): number {
    return accounts.reduce((sum, a) => sum + (a.balance_computed || a.balance), 0);
  }
}
