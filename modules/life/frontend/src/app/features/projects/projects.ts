import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LifeApiService } from '../../core/services/life-api.service';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'paused' | 'done' | 'archived';
  tags: string[];
  created_at: string;
  updated_at: string;
}

type ProjectStatus = Project['status'];

const STATUS_COLS: Array<{ key: ProjectStatus; label: string; color: string }> = [
  { key: 'active', label: 'Attivi',     color: '#A78BFA' },
  { key: 'paused', label: 'In pausa',   color: '#fbbf24' },
  { key: 'done',   label: 'Completati', color: '#4ade80' },
];

const NEXT_STATUS: Record<ProjectStatus, ProjectStatus> = {
  active:   'paused',
  paused:   'done',
  done:     'active',
  archived: 'active',
};

@Component({
  selector: 'life-projects',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Progetti</h1>
        <button class="btn-primary" (click)="showForm.set(!showForm())">
          {{ showForm() ? '✕' : '+ Progetto' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="form-card">
          <div class="form-col">
            <input class="input" [(ngModel)]="form.title" placeholder="Nome progetto..." autofocus (keydown.enter)="addProject()" />
            <textarea class="input" [(ngModel)]="form.description" placeholder="Descrizione (opzionale)" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn-ghost" (click)="showForm.set(false)">Annulla</button>
            <button class="btn-primary" (click)="addProject()" [disabled]="saving() || !form.title">
              {{ saving() ? '...' : 'Crea' }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <p class="muted">Caricamento...</p>
      } @else {
        <div class="kanban">
          @for (col of cols; track col.key) {
            <div class="col">
              <div class="col-header">
                <span class="col-dot" [style.background]="col.color"></span>
                <span class="col-label">{{ col.label }}</span>
                <span class="col-count">{{ projectsFor(col.key).length }}</span>
              </div>
              <div class="col-cards">
                @for (proj of projectsFor(col.key); track proj.id) {
                  <div class="project-card">
                    <div class="card-body">
                      <div class="card-title">{{ proj.title }}</div>
                      @if (proj.description) {
                        <div class="card-desc">{{ proj.description }}</div>
                      }
                    </div>
                    <div class="card-actions">
                      <button class="btn-status" (click)="cycleStatus(proj)"
                              [title]="'→ ' + statusLabel(nextStatus(proj.status))">
                        {{ statusLabel(nextStatus(proj.status)) }} →
                      </button>
                      <button class="btn-icon-sm" (click)="archiveProject(proj)" title="Archivia">⊗</button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-empty">Nessuno</div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 40px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 24px; color: #fff; margin: 0; }
    .muted { color: #555; }

    .form-card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 20px; margin-bottom: 24px; max-width: 500px; }
    .form-col { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .input { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; padding: 8px 12px; font-family: inherit; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; resize: vertical; }
    .input:focus { border-color: #A78BFA; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .btn-primary { background: #A78BFA; color: #000; border: none; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #c4b5fd; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-ghost { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; cursor: pointer; }
    .btn-ghost:hover { color: #ccc; border-color: #555; }

    .kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
    .col { background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; padding: 16px; }
    .col-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .col-label { flex: 1; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
    .col-count { font-size: 12px; color: #444; }
    .col-cards { display: flex; flex-direction: column; gap: 8px; }
    .col-empty { font-size: 12px; color: #333; padding: 8px 0; text-align: center; }

    .project-card { background: #111; border: 1px solid #1e1e1e; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .card-body { flex: 1; }
    .card-title { color: #ccc; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
    .card-desc { color: #555; font-size: 12px; line-height: 1.4; }
    .card-actions { display: flex; align-items: center; gap: 6px; }
    .btn-status { background: #1a1a1a; border: 1px solid #2a2a2a; color: #666; border-radius: 4px; padding: 4px 8px; font-family: inherit; font-size: 11px; cursor: pointer; flex: 1; text-align: left; }
    .btn-status:hover { color: #A78BFA; border-color: #A78BFA44; }
    .btn-icon-sm { background: none; border: none; color: #333; cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px; }
    .btn-icon-sm:hover { color: #f87171; }
  `],
})
export class ProjectsComponent implements OnInit {
  private api = inject(LifeApiService);

  cols     = STATUS_COLS;
  projects = signal<Project[]>([]);
  loading  = signal(true);
  saving   = signal(false);
  showForm = signal(false);

  form = { title: '', description: '' };

  projectsFor = (status: ProjectStatus) => this.projects().filter(p => p.status === status);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<Project[]>('/projects').subscribe({
      next: p => { this.projects.set(p ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  addProject(): void {
    if (!this.form.title) return;
    this.saving.set(true);
    this.api.post<Project>('/projects', {
      title: this.form.title,
      description: this.form.description || null,
    }).subscribe({
      next: () => {
        this.form = { title: '', description: '' };
        this.showForm.set(false);
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  cycleStatus(proj: Project): void {
    const next = NEXT_STATUS[proj.status];
    this.api.patch(`/projects/${proj.id}`, { status: next }).subscribe(() => this.load());
  }

  archiveProject(proj: Project): void {
    this.api.patch(`/projects/${proj.id}`, { status: 'archived' }).subscribe(() => this.load());
  }

  nextStatus(status: ProjectStatus): ProjectStatus {
    return NEXT_STATUS[status];
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = { active: 'Attivo', paused: 'Pausa', done: 'Fatto', archived: 'Archiviato' };
    return labels[status] ?? status;
  }
}
