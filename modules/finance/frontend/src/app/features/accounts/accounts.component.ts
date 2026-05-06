import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService, Account } from '../../core/services/account.service';
import { NotificationService } from '../../core/services/notification.service';

type AccountType = 'checking' | 'savings' | 'credit_card' | 'prepaid' | 'investment' | 'cash';

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conto corrente', savings: 'Conto risparmio',
  credit_card: 'Carta di credito', prepaid: 'Prepagata',
  investment: 'Investimenti', cash: 'Contante',
};
const TYPE_ICONS: Record<AccountType, string> = {
  checking: '🏦', savings: '🏛', credit_card: '💳',
  prepaid: '💳', investment: '📈', cash: '💵',
};

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
})
export class AccountsComponent implements OnInit {
  private accountService = inject(AccountService);
  private notify = inject(NotificationService);

  accounts    = signal<Account[]>([]);
  loading     = signal(true);
  error       = signal(false);
  saving      = signal(false);
  selectedId  = signal<string | null>(null);
  showModal   = signal(false);
  showDeactivateModal = signal(false);
  editingAccount      = signal<Account | null>(null);
  deactivatingAccount = signal<Account | null>(null);

  selectedAccount = computed(() => this.accounts().find(a => a.id === this.selectedId()) ?? null);
  totalBalance    = computed(() => this.accountService.getTotalBalance(this.accounts()));

  colorOptions = [
    '#FF6600','#191C1F','#E31837','#00B140','#003087',
    '#4A90D9','#E8C547','#A78BFA','#2DD4BF','#F87171',
  ];

  form = { name:'', bank_name:'', iban:'', type:'checking' as Account['type'], color_tag:'#4A90D9', notes:'' };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(false);
    this.accountService.getAll().subscribe({
      next: accounts => { this.accounts.set(accounts); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  reload(): void { this.load(); }
  select(account: Account): void { this.selectedId.update(id => id === account.id ? null : account.id); }

  openAddModal(): void {
    this.editingAccount.set(null);
    this.form = { name:'', bank_name:'', iban:'', type:'checking', color_tag:'#4A90D9', notes:'' };
    this.showModal.set(true);
  }

  openEditModal(account: Account, event: Event): void {
    event.stopPropagation();
    this.editingAccount.set(account);
    this.form = { name: account.name, bank_name: account.bank_name, iban: account.iban||'', type: account.type, color_tag: account.color_tag, notes: account.notes||'' };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingAccount.set(null); }

  saveAccount(): void {
    if (!this.form.name || !this.form.bank_name) { this.notify.error('Nome e banca sono obbligatori'); return; }
    this.saving.set(true);
    const editing = this.editingAccount();
    const obs = editing ? this.accountService.update(editing.id, this.form) : this.accountService.create(this.form);
    obs.subscribe({
      next: () => { this.notify.success(editing ? 'Conto aggiornato' : 'Conto creato'); this.closeModal(); this.load(); this.saving.set(false); },
      error: () => { this.saving.set(false); },
    });
  }

  confirmDeactivate(account: Account, event: Event): void {
    event.stopPropagation(); this.deactivatingAccount.set(account); this.showDeactivateModal.set(true);
  }

  deactivateAccount(): void {
    const account = this.deactivatingAccount();
    if (!account) return;
    this.accountService.deactivate(account.id).subscribe({
      next: () => { this.notify.success(`${account.name} disattivato`); this.showDeactivateModal.set(false); this.load(); },
    });
  }

  typeLabel(type: string): string { return TYPE_LABELS[type as AccountType] ?? type; }
  typeIcon(type: string): string  { return TYPE_ICONS[type as AccountType] ?? '🏦'; }
  effectiveBalance(account: Account): number { return account.balance_computed !== 0 ? account.balance_computed : account.balance; }
  maskIban(iban: string): string { if (iban.length < 8) return iban; return iban.slice(0,4)+' •••• •••• '+iban.slice(-4); }
}
