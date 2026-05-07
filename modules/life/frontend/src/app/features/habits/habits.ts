import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LifeApiService } from '../../core/services/life-api.service';

interface Habit {
  id: string;
  label: string;
  icon: string;
  type: 'boolean' | 'counter' | 'number';
  sort_order: number;
  active: number;
  log_id: string | null;
  value: number | null;
}

@Component({
  selector: 'life-habits',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Habits</h1>
          <p class="page-sub">{{ today }}</p>
        </div>
        <div class="header-right">
          <span class="badge">{{ done() }}/{{ total() }} oggi</span>
          <button class="btn-primary" (click)="showForm.set(!showForm())">
            {{ showForm() ? '✕' : '+ Habit' }}
          </button>
        </div>
      </div>

      @if (showForm()) {
        <div class="form-card">
          <div class="form-row">
            <input class="input" [(ngModel)]="form.label" placeholder="Nome habit..."
                   (keydown.enter)="addHabit()" autofocus />
            <input class="input icon-input" [(ngModel)]="form.icon"
                   placeholder="🎯" maxlength="2" />
            <select class="input" [(ngModel)]="form.type">
              <option value="boolean">Si/No</option>
              <option value="counter">Contatore</option>
              <option value="number">Numero</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn-ghost" (click)="showForm.set(false)">Annulla</button>
            <button class="btn-primary" (click)="addHabit()" [disabled]="saving() || !form.label">
              {{ saving() ? '...' : 'Aggiungi' }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="skeleton"></div>
        <div class="skeleton" style="width:70%"></div>
        <div class="skeleton" style="width:85%"></div>
      } @else if (habits().length === 0) {
        <div class="empty">
          <p>Nessun habit ancora.</p>
          <button class="btn-primary" (click)="showForm.set(true)">Crea il primo habit →</button>
        </div>
      } @else {
        @if (total() > 0) {
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progress()"></div>
          </div>
        }
        <div class="habits-list">
          @for (habit of habits(); track habit.id) {
            <div class="habit-card" [class.is-done]="!!habit.log_id">
              <button class="toggle" (click)="toggle(habit)" [class.checked]="!!habit.log_id">
                {{ habit.log_id ? '✓' : '' }}
              </button>
              <span class="habit-icon">{{ habit.icon }}</span>
              <span class="habit-label">{{ habit.label }}</span>
              <span class="habit-type">{{ typeLabel(habit.type) }}</span>
              @if (streaks()[habit.id]) {
                <span class="streak" title="Streak corrente">
                  🔥 {{ streaks()[habit.id] }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 40px; max-width: 700px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title { font-size: 24px; color: #fff; margin: 0 0 4px; }
    .page-sub { color: #555; font-size: 13px; margin: 0; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .badge { background: #1e1e1e; color: #A78BFA; font-size: 12px; padding: 4px 10px; border-radius: 12px; border: 1px solid #A78BFA44; }
    .muted { color: #555; }

    .skeleton { background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; height: 56px; margin-bottom: 8px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .form-card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .form-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .input { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; padding: 8px 12px; font-family: inherit; font-size: 13px; outline: none; flex: 1; min-width: 120px; }
    .input:focus { border-color: #A78BFA; }
    .icon-input { flex: 0 0 56px; text-align: center; font-size: 18px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .btn-primary { background: #A78BFA; color: #000; border: none; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #c4b5fd; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-ghost { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; cursor: pointer; }
    .btn-ghost:hover { color: #ccc; border-color: #555; }

    .progress-bar { height: 3px; background: #1e1e1e; border-radius: 2px; margin-bottom: 20px; }
    .progress-fill { height: 100%; background: #A78BFA; border-radius: 2px; transition: width 0.4s ease; }

    .habits-list { display: flex; flex-direction: column; gap: 8px; }
    .habit-card { display: flex; align-items: center; gap: 12px; background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 14px 16px; transition: border-color 0.15s; }
    .habit-card.is-done { border-color: #A78BFA44; background: #A78BFA08; }
    .toggle { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #333; background: none; color: #4ade80; font-size: 14px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .toggle.checked { background: #A78BFA; border-color: #A78BFA; color: #000; }
    .toggle:not(.checked):hover { border-color: #A78BFA; }
    .habit-icon { font-size: 20px; }
    .habit-label { flex: 1; color: #ccc; font-size: 14px; }
    .habit-type { font-size: 11px; color: #444; }
    .streak { font-size: 12px; color: #f97316; font-weight: 600; }

    .empty { text-align: center; padding: 60px 20px; color: #555; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  `],
})
export class HabitsComponent implements OnInit {
  private api = inject(LifeApiService);

  habits   = signal<Habit[]>([]);
  streaks  = signal<Record<string, number>>({});
  loading  = signal(true);
  saving   = signal(false);
  showForm = signal(false);

  form  = { label: '', icon: '◉', type: 'boolean' as Habit['type'] };
  today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  done     = computed(() => this.habits().filter(h => !!h.log_id).length);
  total    = computed(() => this.habits().length);
  progress = computed(() => this.total() ? Math.round(this.done() / this.total() * 100) : 0);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<Habit[]>('/habits/today').subscribe({
      next: h => {
        const habits = h ?? [];
        this.habits.set(habits);
        this.loading.set(false);
        this.loadStreaks(habits);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadStreaks(habits: Habit[]): void {
    if (habits.length === 0) return;
    const requests = habits.reduce((acc, habit) => {
      acc[habit.id] = this.api.get<{ streak: number }>(`/habits/${habit.id}/streak`).pipe(
        catchError(() => of({ streak: 0 }))
      );
      return acc;
    }, {} as Record<string, ReturnType<typeof this.api.get<{ streak: number }>>>);

    forkJoin(requests).subscribe(results => {
      const map: Record<string, number> = {};
      for (const [id, data] of Object.entries(results)) {
        if ((data as any)?.streak > 1) map[id] = (data as any).streak;
      }
      this.streaks.set(map);
    });
  }

  toggle(habit: Habit): void {
    if (habit.log_id) {
      this.api.delete(`/habits/${habit.id}/log`).subscribe(() => this.load());
    } else {
      this.api.post<unknown>(`/habits/${habit.id}/log`, { value: 1 }).subscribe(() => this.load());
    }
  }

  addHabit(): void {
    if (!this.form.label) return;
    this.saving.set(true);
    this.api.post<Habit>('/habits', { ...this.form }).subscribe({
      next: () => {
        this.form = { label: '', icon: '◉', type: 'boolean' };
        this.showForm.set(false);
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = { boolean: 'si/no', counter: 'conta', number: 'numero' };
    return map[type] ?? type;
  }
}
