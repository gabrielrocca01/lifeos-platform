import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LifeApiService } from '../../core/services/life-api.service';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  horizon: 'day' | 'week' | 'month' | 'year';
  done: boolean;
  due_date: string | null;
  tags: string[];
}

const HORIZONS: Array<{ key: Goal['horizon']; label: string }> = [
  { key: 'day',   label: 'Giorno' },
  { key: 'week',  label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year',  label: 'Anno' },
];

@Component({
  selector: 'life-goals',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Obiettivi</h1>
        <button class="btn-primary" (click)="showForm.set(!showForm())">
          {{ showForm() ? '✕' : '+ Obiettivo' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="form-card">
          <div class="form-col">
            <input class="input" [(ngModel)]="form.title" placeholder="Titolo obiettivo..." (keydown.enter)="addGoal()" autofocus />
            <input class="input" [(ngModel)]="form.description" placeholder="Descrizione (opzionale)" />
            <div class="form-row">
              <select class="input" [(ngModel)]="form.horizon">
                @for (h of horizons; track h.key) {
                  <option [value]="h.key">{{ h.label }}</option>
                }
              </select>
              <input class="input" type="date" [(ngModel)]="form.due_date" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-ghost" (click)="showForm.set(false)">Annulla</button>
            <button class="btn-primary" (click)="addGoal()" [disabled]="saving() || !form.title">
              {{ saving() ? '...' : 'Aggiungi' }}
            </button>
          </div>
        </div>
      }

      <div class="tabs">
        @for (h of horizons; track h.key) {
          <button class="tab" [class.active]="activeHorizon() === h.key" (click)="setHorizon(h.key)">
            {{ h.label }}
            <span class="tab-count">{{ countFor(h.key) }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <p class="muted">Caricamento...</p>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <p>Nessun obiettivo per {{ horizonLabel(activeHorizon()) }}.</p>
        </div>
      } @else {
        <div class="goals-list">
          @for (goal of filtered(); track goal.id) {
            <div class="goal-card" [class.is-done]="goal.done">
              <button class="check" (click)="toggleDone(goal)" [class.checked]="goal.done">
                {{ goal.done ? '✓' : '' }}
              </button>
              <div class="goal-body">
                <span class="goal-title">{{ goal.title }}</span>
                @if (goal.description) {
                  <span class="goal-desc">{{ goal.description }}</span>
                }
                @if (goal.due_date) {
                  <span class="goal-due" [class.overdue]="isOverdue(goal)">
                    {{ formatDate(goal.due_date) }}
                  </span>
                }
              </div>
              <button class="btn-icon" (click)="deleteGoal(goal.id)" title="Elimina">✕</button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 40px; max-width: 700px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 24px; color: #fff; margin: 0; }
    .muted { color: #555; }

    .form-card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .form-col { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .form-row { display: flex; gap: 10px; }
    .input { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; padding: 8px 12px; font-family: inherit; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
    .input:focus { border-color: #A78BFA; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .btn-primary { background: #A78BFA; color: #000; border: none; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #c4b5fd; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-ghost { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; cursor: pointer; }
    .btn-ghost:hover { color: #ccc; border-color: #555; }
    .btn-icon { background: none; border: none; color: #333; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px; }
    .btn-icon:hover { color: #f87171; }

    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #1e1e1e; padding-bottom: 0; }
    .tab { background: none; border: none; border-bottom: 2px solid transparent; color: #555; cursor: pointer; font-family: inherit; font-size: 13px; padding: 8px 16px; display: flex; align-items: center; gap: 6px; margin-bottom: -1px; transition: color 0.15s; }
    .tab:hover { color: #ccc; }
    .tab.active { color: #A78BFA; border-bottom-color: #A78BFA; }
    .tab-count { background: #1e1e1e; border-radius: 10px; font-size: 11px; padding: 1px 6px; }

    .goals-list { display: flex; flex-direction: column; gap: 8px; }
    .goal-card { display: flex; align-items: flex-start; gap: 12px; background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 14px 16px; transition: border-color 0.15s; }
    .goal-card.is-done { opacity: 0.5; }
    .check { width: 22px; height: 22px; border-radius: 4px; border: 2px solid #333; background: none; color: #A78BFA; font-size: 13px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 1px; transition: all 0.15s; }
    .check.checked { background: #A78BFA; border-color: #A78BFA; color: #000; }
    .check:not(.checked):hover { border-color: #A78BFA; }
    .goal-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .goal-title { color: #ccc; font-size: 14px; }
    .goal-desc { color: #555; font-size: 12px; }
    .goal-due { font-size: 11px; color: #666; }
    .goal-due.overdue { color: #f87171; }

    .empty { text-align: center; padding: 40px 20px; color: #555; }
  `],
})
export class GoalsComponent implements OnInit {
  private api = inject(LifeApiService);

  horizons       = HORIZONS;
  goals          = signal<Goal[]>([]);
  loading        = signal(true);
  saving         = signal(false);
  showForm       = signal(false);
  activeHorizon  = signal<Goal['horizon']>('week');

  form = { title: '', description: '', horizon: 'week' as Goal['horizon'], due_date: '' };

  filtered = computed(() => this.goals().filter(g => g.horizon === this.activeHorizon()));
  countFor = (h: string) => this.goals().filter(g => g.horizon === h && !g.done).length;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<Goal[]>('/goals?all=true').subscribe({
      next: g => { this.goals.set(g ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setHorizon(h: Goal['horizon']): void { this.activeHorizon.set(h); }

  toggleDone(goal: Goal): void {
    this.api.patch(`/goals/${goal.id}`, { done: !goal.done }).subscribe(() => this.load());
  }

  addGoal(): void {
    if (!this.form.title) return;
    this.saving.set(true);
    this.api.post<Goal>('/goals', {
      title: this.form.title,
      description: this.form.description || null,
      horizon: this.form.horizon,
      due_date: this.form.due_date || null,
    }).subscribe({
      next: () => {
        this.form = { title: '', description: '', horizon: 'week', due_date: '' };
        this.showForm.set(false);
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  deleteGoal(id: string): void {
    this.api.delete(`/goals/${id}`).subscribe(() => this.load());
  }

  horizonLabel(h: string): string {
    return HORIZONS.find(x => x.key === h)?.label ?? h;
  }

  isOverdue(goal: Goal): boolean {
    return !goal.done && !!goal.due_date && new Date(goal.due_date) < new Date();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }
}
