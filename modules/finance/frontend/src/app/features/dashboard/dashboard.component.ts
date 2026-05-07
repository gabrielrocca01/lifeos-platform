import { Component, OnInit, OnDestroy, signal, computed, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AccountService, Account } from '../../core/services/account.service';
import { TransactionService, MonthlyFlow } from '../../core/services/transaction.service';
import { AuthService } from '../../core/services/auth.service';

declare const Chart: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flowChart') flowChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('catChart')  catChartRef!: ElementRef<HTMLCanvasElement>;

  private accountService = inject(AccountService);
  private txService      = inject(TransactionService);
  readonly auth          = inject(AuthService);

  accounts    = signal<Account[]>([]);
  monthlyFlow = signal<MonthlyFlow[]>([]);
  recentTx    = signal<any[]>([]);
  loading     = signal(true);
  error       = signal(false);

  selectedYear = new Date().getFullYear().toString();
  years = Array.from({ length: 4 }, (_, i) => (new Date().getFullYear() - i).toString());
  currentMonth = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  totalBalance = computed(() =>
    this.accounts().reduce((s, a) => s + (a.balance_computed || a.balance || 0), 0)
  );
  yearIn  = computed(() => this.monthlyFlow().reduce((s, m) => s + m.total_in,  0));
  yearOut = computed(() => this.monthlyFlow().reduce((s, m) => s + m.total_out, 0));
  yearNet = computed(() => this.yearIn() - this.yearOut());
  txCount     = computed(() => this.monthlyFlow().reduce((s, m) => s + m.tx_count,  0));
  displayName = computed(() => {
    const u = this.auth.user();
    return u?.name || u?.email?.split('@')?.[0] || '';
  });

  private flowChart: any = null;
  private catChart:  any = null;
  private chartsReady = false;

  ngOnInit(): void { this.load(this.selectedYear); }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    if (!this.loading()) this.buildCharts();
  }

  ngOnDestroy(): void {
    this.flowChart?.destroy();
    this.catChart?.destroy();
  }

  changeYear(year: string): void {
    if (year === this.selectedYear) return;
    this.selectedYear = year;
    this.load(year);
  }

  private load(year: string): void {
    this.loading.set(true);
    this.error.set(false);

    forkJoin({
      accounts: this.accountService.getAll(),
      flow:     this.txService.getMonthlyFlow(year),
      recent:   this.txService.getAll({ page_size: 10 }),
    }).subscribe({
      next: ({ accounts, flow, recent }) => {
        this.accounts.set(accounts);
        this.monthlyFlow.set(flow);
        this.recentTx.set(recent.data ?? []);
        this.loading.set(false);
        if (this.chartsReady) this.buildCharts();
      },
      error: (e) => {
        console.error('[Dashboard] Errore caricamento:', e);
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private buildCharts(): void {
    this.flowChart?.destroy();
    this.catChart?.destroy();
    this.flowChart = null;
    this.catChart  = null;
    setTimeout(() => { this.buildFlowChart(); this.buildCatChart(); }, 80);
  }

  private buildFlowChart(): void {
    const el = this.flowChartRef?.nativeElement;
    if (!el || this.monthlyFlow().length === 0) return;
    const ABBR = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    this.flowChart = new Chart(el, {
      type: 'bar',
      data: {
        labels: this.monthlyFlow().map(f => ABBR[parseInt(f.month.split('-')[1]) - 1]),
        datasets: [
          { label: 'Entrate', data: this.monthlyFlow().map(f => f.total_in),  backgroundColor: 'rgba(74,222,128,.5)', borderColor: '#4ade80', borderWidth: 1, borderRadius: 3 },
          { label: 'Uscite',  data: this.monthlyFlow().map(f => f.total_out), backgroundColor: 'rgba(248,113,113,.5)', borderColor: '#f87171', borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#555', font: { family: 'DM Mono', size: 11 } } } },
        scales: {
          x: { grid: { color: '#1e1e1e' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 11 } } },
          y: { grid: { color: '#1e1e1e' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 11 },
               callback: (v: number) => `€${v.toLocaleString('it-IT')}` } },
        },
      },
    });
  }

  private buildCatChart(): void {
    const el = this.catChartRef?.nativeElement;
    if (!el) return;
    const groups: Record<string, number> = {};
    for (const tx of this.recentTx()) {
      if (tx.direction === 'out' && tx.status !== 'excluded') {
        const key = tx.category_name ?? 'Altro';
        groups[key] = (groups[key] ?? 0) + tx.amount;
      }
    }
    const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (entries.length === 0) return;
    const COLORS = ['#f87171','#fbbf24','#4ade80','#60a5fa','#a78bfa','#2dd4bf','#fb923c','#e879f9'];
    this.catChart = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ data: entries.map(e => e[1]), backgroundColor: COLORS.slice(0, entries.length), borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%', animation: false,
        plugins: { legend: { position: 'right', labels: { color: '#555', font: { family: 'DM Mono', size: 11 }, padding: 12 } } },
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
  }
  accountColor(id: string): string {
    return this.accounts().find(a => a.id === id)?.color_tag ?? '#555';
  }
}