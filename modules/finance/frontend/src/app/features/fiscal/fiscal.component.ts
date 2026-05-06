import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FiscalService, TaxRecord, CreateTaxRecordDto } from '../../core/services/fiscal.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-fiscal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fiscal.component.html',
  styleUrls: ['./fiscal.component.scss'],
})
export class FiscalComponent implements OnInit {
  private fiscalService = inject(FiscalService);
  private notify        = inject(NotificationService);

  selectedYear = signal(new Date().getFullYear().toString());
  records      = signal<TaxRecord[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  showModal    = signal(false);

  years = this.fiscalService.availableYears();

  docTypes = [
    { value: 'cu',             label: 'Certificazione Unica' },
    { value: '730',            label: 'Modello 730' },
    { value: 'estratto_conto', label: 'Estratto conto' },
    { value: 'fattura',        label: 'Fattura' },
    { value: 'ricevuta',       label: 'Ricevuta' },
    { value: 'f24',            label: 'Modello F24' },
    { value: 'altro',          label: 'Altro documento' },
  ];

  form: CreateTaxRecordDto = {
    fiscal_year:   new Date().getFullYear().toString(),
    document_type: 'cu',
    filename:      '',
    notes:         '',
  };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.fiscalService.getRecords(this.selectedYear()).subscribe({
      next: r => { this.records.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changeYear(year: string): void { this.selectedYear.set(year); this.load(); }

  openModal(): void {
    this.form = { fiscal_year: this.selectedYear(), document_type: 'cu', filename: '', notes: '' };
    this.showModal.set(true);
  }

  saveRecord(): void {
    if (!this.form.document_type) { this.notify.error('Tipo documento obbligatorio'); return; }
    this.saving.set(true);
    this.fiscalService.createRecord(this.form).subscribe({
      next: () => {
        this.notify.success('Documento registrato');
        this.showModal.set(false);
        this.load();
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteRecord(record: TaxRecord): void {
    if (!confirm(`Eliminare ${this.fiscalService.docLabel(record.document_type)}?`)) return;
    this.fiscalService.deleteRecord(record.id).subscribe({
      next: () => { this.notify.success('Documento eliminato'); this.load(); },
    });
  }

  docLabel(type: string): string { return this.fiscalService.docLabel(type); }
  docIcon(type: string): string  { return this.fiscalService.docIcon(type); }
}