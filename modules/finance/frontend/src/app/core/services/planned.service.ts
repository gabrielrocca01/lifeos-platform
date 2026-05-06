import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PlannedExpense {
  id: string;
  name: string;
  total_amount: number;
  month_due: number;       // 1-12
  monthly_rate: number;    // total_amount / 12
  account_id: string;
  category_id?: string;
  fiscal_year: string;
  is_deductible: number;
  notes?: string;
  created_at: string;
  // calcolati frontend
  account_name?: string;
  months_covered?: number; // quanti mesi già accantonati
}

export interface CreatePlannedExpenseDto {
  name: string;
  total_amount: number;
  month_due: number;
  account_id: string;
  category_id?: string;
  fiscal_year?: string;
  is_deductible?: boolean;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class PlannedService {
  constructor(private api: ApiService) {}

  getAll(fiscal_year?: string): Observable<PlannedExpense[]> {
    return this.api.get<PlannedExpense[]>('/planned', fiscal_year ? { fiscal_year } : {});
  }

  create(dto: CreatePlannedExpenseDto): Observable<PlannedExpense> {
    return this.api.post<PlannedExpense>('/planned', dto);
  }

  update(id: string, dto: Partial<CreatePlannedExpenseDto>): Observable<PlannedExpense> {
    return this.api.patch<PlannedExpense>(`/planned/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/planned/${id}`);
  }

  monthName(n: number): string {
    return ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
            'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][n] ?? '';
  }

  monthsCovered(monthDue: number): number {
    const now = new Date();
    const current = now.getMonth() + 1; // 1-12
    if (monthDue >= current) return monthDue - current;
    return 12 - current + monthDue;
  }
}
