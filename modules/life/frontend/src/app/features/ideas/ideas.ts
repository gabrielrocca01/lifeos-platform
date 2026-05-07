import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LifeApiService } from '../../core/services/life-api.service';

interface Idea {
  id: string;
  content: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
}

@Component({
  selector: 'life-ideas',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Idee</h1>
        <span class="count">{{ filtered().length }} idee</span>
      </div>

      <div class="capture">
        <textarea class="input-area" [(ngModel)]="draft" placeholder="Cattura un'idea..."
                  rows="2" (keydown.control.enter)="capture()" (keydown.meta.enter)="capture()"></textarea>
        <button class="btn-primary" (click)="capture()" [disabled]="saving() || !draft.trim()">
          {{ saving() ? '...' : 'Salva' }}
        </button>
      </div>

      <div class="search-bar">
        <input class="search-input" [(ngModel)]="query" placeholder="Cerca nelle idee..." />
        @if (query) {
          <button class="btn-clear" (click)="query = ''">✕</button>
        }
      </div>

      @if (loading()) {
        <div class="skeleton"></div>
        <div class="skeleton" style="width:80%"></div>
        <div class="skeleton" style="width:60%"></div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <p>{{ query ? 'Nessun risultato per "' + query + '"' : 'Nessuna idea ancora. Cattura la prima!' }}</p>
        </div>
      } @else {
        <div class="ideas-list">
          @for (idea of filtered(); track idea.id) {
            <div class="idea-card" [class.pinned]="idea.pinned">
              <div class="idea-body">
                <p class="idea-content">{{ idea.content }}</p>
                @if (idea.tags.length > 0) {
                  <div class="tags">
                    @for (tag of idea.tags; track tag) {
                      <span class="tag">{{ tag }}</span>
                    }
                  </div>
                }
                <span class="idea-date">{{ formatDate(idea.created_at) }}</span>
              </div>
              <div class="idea-actions">
                <button class="btn-icon" [class.pinned]="idea.pinned" (click)="togglePin(idea)"
                        [title]="idea.pinned ? 'Rimuovi pin' : 'Fissa'">
                  {{ idea.pinned ? '⭐' : '☆' }}
                </button>
                <button class="btn-icon delete" (click)="deleteIdea(idea.id)" title="Elimina">✕</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 40px; max-width: 700px; }
    .page-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 24px; }
    .page-title { font-size: 24px; color: #fff; margin: 0; }
    .count { color: #555; font-size: 13px; }

    .skeleton { background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; height: 80px; margin-bottom: 8px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .capture { display: flex; gap: 10px; margin-bottom: 16px; align-items: flex-start; }
    .input-area { flex: 1; background: #111; border: 1px solid #1e1e1e; color: #fff; border-radius: 8px; padding: 14px 16px; font-family: inherit; font-size: 14px; outline: none; resize: none; line-height: 1.5; }
    .input-area:focus { border-color: #A78BFA; }
    .btn-primary { background: #A78BFA; color: #000; border: none; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-primary:hover { background: #c4b5fd; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }

    .search-bar { position: relative; margin-bottom: 20px; }
    .search-input { width: 100%; background: #111; border: 1px solid #1e1e1e; color: #fff; border-radius: 6px; padding: 9px 36px 9px 14px; font-family: inherit; font-size: 13px; outline: none; box-sizing: border-box; }
    .search-input:focus { border-color: #A78BFA44; }
    .btn-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 2px 4px; }
    .btn-clear:hover { color: #ccc; }

    .ideas-list { display: flex; flex-direction: column; gap: 8px; }
    .idea-card { display: flex; gap: 12px; background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 16px; transition: border-color 0.15s; }
    .idea-card.pinned { border-color: #A78BFA44; background: #A78BFA08; }
    .idea-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .idea-content { color: #ccc; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap; word-break: break-word; }
    .tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag { background: #1a1a1a; border: 1px solid #2a2a2a; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
    .idea-date { font-size: 11px; color: #444; }
    .idea-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
    .btn-icon { background: none; border: none; color: #444; cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px; line-height: 1; }
    .btn-icon:hover { color: #A78BFA; }
    .btn-icon.pinned { color: #A78BFA; }
    .btn-icon.delete:hover { color: #f87171; }

    .empty { text-align: center; padding: 40px 20px; color: #555; }
  `],
})
export class IdeasComponent implements OnInit {
  private api = inject(LifeApiService);

  ideas   = signal<Idea[]>([]);
  loading = signal(true);
  saving  = signal(false);
  draft   = '';
  query   = '';

  filtered = computed(() => {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.ideas();
    return this.ideas().filter(i =>
      i.content.toLowerCase().includes(q) ||
      i.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<Idea[]>('/ideas').subscribe({
      next: i => { this.ideas.set(i ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  capture(): void {
    const content = this.draft.trim();
    if (!content) return;
    this.saving.set(true);
    this.api.post<Idea>('/ideas', { content }).subscribe({
      next: () => { this.draft = ''; this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  togglePin(idea: Idea): void {
    this.api.patch(`/ideas/${idea.id}`, { pinned: !idea.pinned }).subscribe(() => this.load());
  }

  deleteIdea(id: string): void {
    this.api.delete(`/ideas/${id}`).subscribe(() => this.load());
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
