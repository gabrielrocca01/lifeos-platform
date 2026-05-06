import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlannedService, PlannedExpense } from '../../core/services/planned.service';
import { AccountService, Account } from '../../core/services/account.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-planned',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './planned.component.html',
  styleUrls: ['./planned.component.scss'],
})
export class PlannedComponent implements OnInit {
  private plannedService = inject(PlannedService);
  private accountService = inject(AccountService);
  private notify         = inject(NotificationService);

  items    = signal<PlannedExpense[]>([]);
  accounts = signal<Account[]>([]);
  loading  = signal(true);
  saving   = signal(false);
  showModal       = signal(false);
  showDeleteModal = signal(false);
  editingItem  = signal<PlannedExpense | null>(null);
  deletingItem = signal<PlannedExpense | null>(null);

  totalMonthly = computed(() => this.items().reduce((s, i) => s + i.monthly_rate, 0));
  totalAnnual  = computed(() => this.items().reduce((s, i) => s + i.total_amount, 0));

  months = [
    {value:1,label:'Gennaio'},{value:2,label:'Febbraio'},{value:3,label:'Marzo'},
    {value:4,label:'Aprile'},{value:5,label:'Maggio'},{value:6,label:'Giugno'},
    {value:7,label:'Luglio'},{value:8,label:'Agosto'},{value:9,label:'Settembre'},
    {value:10,label:'Ottobre'},{value:11,label:'Novembre'},{value:12,label:'Dicembre'},
  ];

  form = { name:'', total_amount:0, month_due:1, account_id:'', is_deductible:false, notes:'' };

  ngOnInit(): void {
    this.accountService.getAll().subscribe(a => this.accounts.set(a));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.plannedService.getAll().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  openModal(): void {
    this.editingItem.set(null);
    this.form = { name:'', total_amount:0, month_due:1, account_id:'', is_deductible:false, notes:'' };
    this.showModal.set(true);
  }

  openEditModal(item: PlannedExpense): void {
    this.editingItem.set(item);
    this.form = {
      name: item.name, total_amount: item.total_amount,
      month_due: item.month_due, account_id: item.account_id || '',
      is_deductible: !!item.is_deductible, notes: item.notes || '',
    };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingItem.set(null); }

  save(): void {
    if (!this.form.name || !this.form.total_amount) {
      this.notify.error('Nome e importo obbligatori'); return;
    }
    this.saving.set(true);
    const editing = this.editingItem();
    const dto = { ...this.form, account_id: this.form.account_id || '' };
    const obs = editing
      ? this.plannedService.update(editing.id, dto)
      : this.plannedService.create(dto);

    obs.subscribe({
      next: () => {
        this.notify.success(editing ? 'Spesa aggiornata' : 'Spesa aggiunta');
        this.closeModal(); this.load(); this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  confirmDelete(item: PlannedExpense): void {
    this.deletingItem.set(item); this.showDeleteModal.set(true);
  }

  deleteItem(): void {
    const item = this.deletingItem();
    if (!item) return;
    this.plannedService.delete(item.id).subscribe({
      next: () => {
        this.notify.success('Spesa eliminata');
        this.showDeleteModal.set(false); this.load();
      },
    });
  }

  monthName(n: number): string { return this.plannedService.monthName(n); }
  monthsCovered(monthDue: number): number { return this.plannedService.monthsCovered(monthDue); }
  coveragePct(monthDue: number): number {
    return Math.round((this.monthsCovered(monthDue) / 12) * 100);
  }
}
