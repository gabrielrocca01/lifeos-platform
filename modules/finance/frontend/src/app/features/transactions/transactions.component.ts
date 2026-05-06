import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TransactionService, Transaction, TransactionFilters } from '../../core/services/transaction.service';
import { AccountService, Account } from '../../core/services/account.service';
import { NotificationService } from '../../core/services/notification.service';
import { RefreshService } from '../../core/services/refresh.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss'],
})
export class TransactionsComponent implements OnInit, OnDestroy {
  private txService      = inject(TransactionService);
  private accountService = inject(AccountService);
  private notify         = inject(NotificationService);
  private refresh        = inject(RefreshService);
  private sub?: Subscription;

  transactions = signal<Transaction[]>([]);
  accounts     = signal<Account[]>([]);
  loading      = signal(true);
  total        = signal(0);
  page         = signal(1);
  pageSize     = 50;

  filters = signal<TransactionFilters>({
    fiscal_year: new Date().getFullYear().toString(),
  });

  totalIn  = computed(() => this.transactions().filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0));
  totalOut = computed(() => this.transactions().filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0));
  net      = computed(() => this.totalIn() - this.totalOut());
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize));

  showModal = signal(false);
  saving    = signal(false);
  form = {
    account_id: '', category_id: '', description: '', merchant: '',
    amount: 0, direction: 'out' as 'in' | 'out',
    date: new Date().toISOString().slice(0, 10),
    is_deductible: false, notes: '',
  };

  selectedTx = signal<Transaction | null>(null);
  years = Array.from({ length: 4 }, (_, i) => (new Date().getFullYear() - i).toString());

  ngOnInit(): void {
    this.accountService.getAll().subscribe(a => this.accounts.set(a));
    this.load();
    // Ricarica automaticamente dopo ogni import
    this.sub = this.refresh.importDone$.subscribe(() => {
      this.page.set(1);
      this.load();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading.set(true);
    this.txService.getAll({ ...this.filters(), page: this.page(), page_size: this.pageSize }).subscribe({
      next: res => { this.transactions.set(res.data ?? []); this.total.set(res.total ?? 0); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  applyFilter(partial: Partial<TransactionFilters>): void {
    this.filters.update(f => ({ ...f, ...partial }));
    this.page.set(1); this.load();
  }

  clearFilters(): void {
    this.filters.set({ fiscal_year: new Date().getFullYear().toString() });
    this.page.set(1); this.load();
  }

  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  openModal(): void {
    this.form = {
      account_id: this.accounts()[0]?.id ?? '', category_id: '',
      description: '', merchant: '', amount: 0, direction: 'out',
      date: new Date().toISOString().slice(0, 10), is_deductible: false, notes: '',
    };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  saveTransaction(): void {
    if (!this.form.account_id || !this.form.description || !this.form.amount) {
      this.notify.error('Conto, descrizione e importo obbligatori'); return;
    }
    this.saving.set(true);
    this.txService.create(this.form).subscribe({
      next: () => { this.notify.success('Transazione aggiunta'); this.closeModal(); this.load(); this.saving.set(false); },
      error: () => { this.saving.set(false); },
    });
  }

  selectTx(tx: Transaction): void { this.selectedTx.update(t => t?.id === tx.id ? null : tx); }

  markExcluded(tx: Transaction): void {
    this.txService.update(tx.id, { status: 'excluded' } as any).subscribe({
      next: () => { this.notify.info('Transazione esclusa dai calcoli'); this.load(); },
    });
  }

  markDeductible(tx: Transaction): void {
    const newVal = !tx.is_deductible;
    this.txService.update(tx.id, { is_deductible: newVal ? 1 : 0 } as any).subscribe({
      next: () => { this.notify.success(newVal ? 'Marcata come detraibile' : 'Rimossa da detraibili'); this.load(); },
    });
  }

  accountColor(id: string): string { return this.accounts().find(a => a.id === id)?.color_tag ?? '#555'; }
  accountName(id: string): string  { return this.accounts().find(a => a.id === id)?.name ?? id; }
  formatDate(iso: string): string  { return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }); }
}