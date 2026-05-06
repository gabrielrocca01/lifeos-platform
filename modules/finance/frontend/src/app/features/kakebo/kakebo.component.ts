import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KakeboService, KakeboEntry, ReconciliationReport, ReconciliationSession } from '../../core/services/kakebo.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-kakebo',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './kakebo.component.html',
  styleUrls: ['./kakebo.component.scss'],
})
export class KakeboComponent implements OnInit {
  private kakeboService = inject(KakeboService);
  private notify        = inject(NotificationService);

  selectedMonth = signal(this.kakeboService.monthKey());
  entries       = signal<KakeboEntry[]>([]);
  sessions      = signal<ReconciliationSession[]>([]);
  report        = signal<ReconciliationReport | null>(null);
  loading       = signal(false);
  reconciling   = signal(false);
  importing     = signal(false);
  activeTab     = signal<'entries'|'reconcile'|'history'>('entries');

  totalOut = computed(() => this.entries().filter(e => e.direction==='out').reduce((s,e) => s+e.amount, 0));
  totalIn  = computed(() => this.entries().filter(e => e.direction==='in').reduce((s,e) => s+e.amount, 0));
  matchedCount   = computed(() => this.entries().filter(e => e.reconciliation_status==='matched').length);
  pendingCount   = computed(() => this.entries().filter(e => e.reconciliation_status==='pending').length);

  // mesi disponibili
  months = Array.from({length: 12}, (_,i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { key, label: this.kakeboService.monthLabel(key) };
  });

  // form nuova voce manuale
  showForm = signal(false);
  form = { date: new Date().toISOString().slice(0,10), description: '', amount: 0, direction: 'out' as 'in'|'out', account_hint: '', notes: '', is_cash: false };

  ngOnInit(): void {
    this.loadEntries();
    this.kakeboService.getSessions().subscribe(s => this.sessions.set(s));
  }

  loadEntries(): void {
    this.loading.set(true);
    this.kakeboService.getEntries(this.selectedMonth()).subscribe({
      next: e => { this.entries.set(e); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changeMonth(key: string): void {
    this.selectedMonth.set(key);
    this.report.set(null);
    this.loadEntries();
  }

  onCsvImport(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.kakeboService.importCsv(file).subscribe({
      next: res => {
        if (res.success) {
          this.notify.success(`${res.data?.imported ?? 0} voci importate`);
          this.loadEntries();
        }
        this.importing.set(false);
      },
      error: () => this.importing.set(false),
    });
  }

  addEntry(): void {
    if (!this.form.description || !this.form.amount) { this.notify.error('Descrizione e importo obbligatori'); return; }
    this.kakeboService.addEntry({ ...this.form, is_cash: this.form.is_cash ? 1 : 0 } as any).subscribe({
      next: () => { this.notify.success('Voce aggiunta'); this.showForm.set(false); this.loadEntries(); },
    });
  }

  reconcile(): void {
    this.reconciling.set(true);
    this.kakeboService.reconcileMonth(this.selectedMonth()).subscribe({
      next: report => {
        this.report.set(report);
        this.reconciling.set(false);
        this.activeTab.set('reconcile');
        this.notify.success(`Riconciliazione completata — ${report.summary.accuracy}% precisione`);
        this.loadEntries();
        this.kakeboService.getSessions().subscribe(s => this.sessions.set(s));
      },
      error: () => this.reconciling.set(false),
    });
  }

  statusColor(status: string): string {
    return { matched:'#4ade80', unmatched:'#f87171', pending:'#fbbf24', ignored:'#555' }[status] ?? '#555';
  }
  statusLabel(status: string): string {
    return { matched:'match', unmatched:'mancante', pending:'in attesa', ignored:'ignorata' }[status] ?? status;
  }
  monthLabel(key: string): string { return this.kakeboService.monthLabel(key); }
}
