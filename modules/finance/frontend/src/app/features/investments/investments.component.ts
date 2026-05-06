import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestmentService, Investment, CreateInvestmentDto } from '../../core/services/investment.service';
import { AccountService, Account } from '../../core/services/account.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './investments.component.html',
  styleUrls: ['./investments.component.scss'],
})
export class InvestmentsComponent implements OnInit {
  private investService  = inject(InvestmentService);
  private accountService = inject(AccountService);
  private notify         = inject(NotificationService);

  investments = signal<Investment[]>([]);
  accounts    = signal<Account[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  showModal   = signal(false);
  showPriceModal = signal(false);
  editingItem    = signal<Investment | null>(null);
  updatingItem   = signal<Investment | null>(null);
  newPrice       = signal(0);

  totalValue = computed(() => this.investService.totalValue(this.investments()));
  totalCost  = computed(() => this.investService.totalCost(this.investments()));
  totalPnl   = computed(() => this.investService.totalPnl(this.investments()));
  totalPnlPct = computed(() => {
    const cost = this.totalCost();
    return cost > 0 ? (this.totalPnl() / cost) * 100 : 0;
  });

  assetTypes = ['etf','stock','bond','crypto','other'];
  assetLabels: Record<string,string> = { etf:'ETF', stock:'Azione', bond:'Obbligazione', crypto:'Crypto', other:'Altro' };

  form: CreateInvestmentDto = { account_id:'', ticker:'', name:'', quantity:0, avg_price:0, current_price:0, currency:'EUR', asset_type:'etf' };

  ngOnInit(): void {
    this.accountService.getAll().subscribe(a => this.accounts.set(a));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.investService.getAll().subscribe({
      next: i => { this.investments.set(i); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openModal(item?: Investment): void {
    this.editingItem.set(item ?? null);
    this.form = item
      ? { account_id: item.account_id??'', ticker: item.ticker, name: item.name, quantity: item.quantity, avg_price: item.avg_price, current_price: item.current_price, currency: item.currency, asset_type: item.asset_type }
      : { account_id:'', ticker:'', name:'', quantity:0, avg_price:0, current_price:0, currency:'EUR', asset_type:'etf' };
    this.showModal.set(true);
  }

  save(): void {
    if (!this.form.ticker || !this.form.name) { this.notify.error('Ticker e nome obbligatori'); return; }
    this.saving.set(true);
    const editing = this.editingItem();
    const obs = editing ? this.investService.update(editing.id, this.form) : this.investService.create(this.form);
    obs.subscribe({
      next: () => { this.notify.success(editing ? 'Posizione aggiornata' : 'Posizione aggiunta'); this.showModal.set(false); this.load(); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  openPriceModal(item: Investment): void {
    this.updatingItem.set(item);
    this.newPrice.set(item.current_price);
    this.showPriceModal.set(true);
  }

  updatePrice(): void {
    const item = this.updatingItem();
    if (!item) return;
    this.investService.update(item.id, { current_price: this.newPrice() }).subscribe({
      next: () => { this.notify.success('Prezzo aggiornato'); this.showPriceModal.set(false); this.load(); },
    });
  }

  delete(item: Investment): void {
    if (!confirm(`Eliminare ${item.ticker}?`)) return;
    this.investService.delete(item.id).subscribe({
      next: () => { this.notify.success('Posizione eliminata'); this.load(); },
    });
  }

  pnlColor(pnl: number): string { return pnl >= 0 ? '#4ade80' : '#f87171'; }
  assetLabel(type: string): string { return this.assetLabels[type] ?? type; }
}
