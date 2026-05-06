import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface Investment {
  id: string;
  account_id: string;
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  currency: string;
  asset_type: 'etf' | 'stock' | 'bond' | 'crypto' | 'other';
  notes?: string;
  last_updated: string;
  // calcolati
  total_cost: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
}

export interface InvestmentOperation {
  id: string;
  investment_id: string;
  type: 'buy' | 'sell' | 'dividend';
  quantity: number;
  price: number;
  date: string;
  fees: number;
  notes?: string;
}

export interface CreateInvestmentDto {
  account_id: string;
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  currency?: string;
  asset_type: Investment['asset_type'];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  constructor(private api: ApiService) {}

  getAll(): Observable<Investment[]> {
    return this.api.get<Investment[]>('/investments');
  }

  create(dto: CreateInvestmentDto): Observable<Investment> {
    return this.api.post<Investment>('/investments', dto);
  }

  update(id: string, dto: Partial<CreateInvestmentDto & {current_price: number}>): Observable<Investment> {
    return this.api.patch<Investment>(`/investments/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/investments/${id}`);
  }

  getOperations(investmentId?: string): Observable<InvestmentOperation[]> {
    return this.api.get<InvestmentOperation[]>('/investments/operations', investmentId ? {investment_id: investmentId} : {});
  }

  addOperation(dto: Partial<InvestmentOperation>): Observable<InvestmentOperation> {
    return this.api.post<InvestmentOperation>('/investments/operations', dto);
  }

  totalValue(investments: Investment[]): number {
    return investments.reduce((s, i) => s + i.current_value, 0);
  }
  totalCost(investments: Investment[]): number {
    return investments.reduce((s, i) => s + i.total_cost, 0);
  }
  totalPnl(investments: Investment[]): number {
    return investments.reduce((s, i) => s + i.pnl, 0);
  }
}
