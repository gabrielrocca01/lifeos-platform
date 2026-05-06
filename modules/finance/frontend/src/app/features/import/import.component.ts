import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportService, ConnectorMeta, ImportResult, ImportBatch } from '../../core/services/import.service';
import { AccountService, Account } from '../../core/services/account.service';
import { NotificationService } from '../../core/services/notification.service';
import { RefreshService } from '../../core/services/refresh.service';

const BANK_FORMAT_MAP: Record<string, string> = {
  'finecobank': 'fineco', 'fineco': 'fineco',
  'revolut': 'revolut',
  'intesa': 'intesa', 'intesa san paolo': 'intesa', 'intesa sanpaolo': 'intesa',
  'trade republic': 'trade_republic',
  'paypal': 'paypal',
};

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import.component.html',
  styleUrls: ['./import.component.scss'],
})
export class ImportComponent implements OnInit {
  private importService  = inject(ImportService);
  private accountService = inject(AccountService);
  private notify         = inject(NotificationService);
  private refresh        = inject(RefreshService);

  accounts      = signal<Account[]>([]);
  connectors    = signal<ConnectorMeta[]>([]);
  batches       = signal<ImportBatch[]>([]);
  selectedAccountId = signal<string | null>(null);
  selectedFile  = signal<File | null>(null);
  isDragging    = signal(false);
  importing     = signal(false);
  importResult  = signal<ImportResult | null>(null);

  selectedConnector = computed(() => {
    const acc = this.accounts().find(a => a.id === this.selectedAccountId());
    if (!acc) return null;
    const fmt = BANK_FORMAT_MAP[acc.bank_name.toLowerCase()];
    return this.connectors().find(c => c.id === fmt) ?? null;
  });

  ngOnInit(): void {
    this.accountService.getAll().subscribe(a => this.accounts.set(a));
    this.importService.getConnectors().subscribe(c => this.connectors.set(c));
    this.loadBatches();
  }

  loadBatches(): void {
    this.importService.getBatches().subscribe(b => this.batches.set(b));
  }

  selectAccount(id: string): void {
    this.selectedAccountId.set(id);
    this.selectedFile.set(null);
    this.importResult.set(null);
  }

  connectorFor(bankName: string): ConnectorMeta | undefined {
    const fmt = BANK_FORMAT_MAP[bankName.toLowerCase()];
    return this.connectors().find(c => c.id === fmt);
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragging.set(true); }
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }
  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }
  setFile(file: File): void {
    if (!file.name.endsWith('.csv')) { this.notify.error('Solo file .csv supportati'); return; }
    this.selectedFile.set(file); this.importResult.set(null);
  }
  clearFile(e: Event): void { e.stopPropagation(); this.selectedFile.set(null); }

  doImport(): void {
    const accountId = this.selectedAccountId();
    const file = this.selectedFile();
    const connector = this.selectedConnector();
    if (!accountId || !file || !connector) return;

    this.importing.set(true);
    this.importResult.set(null);

    this.importService.importCsv(file, accountId, connector.id).subscribe({
      next: res => {
        if (res.success && res.data) {
          this.importResult.set(res.data);
          this.notify.success(`${res.data.imported} transazioni importate`);
          this.loadBatches();
          this.selectedFile.set(null);
          // Notifica tutti i componenti che ascoltano
          this.refresh.triggerImportDone();
        } else {
          this.notify.error(res.error ?? "Errore durante l'import");
        }
        this.importing.set(false);
      },
      error: () => { this.importing.set(false); },
    });
  }

  accountColor(accountId: string): string {
    return this.accounts().find(a => a.id === accountId)?.color_tag ?? '#555';
  }
  fileSize(file: File): string {
    const kb = file.size / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}