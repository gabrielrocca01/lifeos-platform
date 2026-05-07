import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LifeApiService } from '../../core/services/life-api.service';

interface HabitToday { id: string; label: string; icon: string; log_id: string | null; }
interface Goal        { id: string; title: string; horizon: string; done: boolean; due_date: string | null; }
interface Idea        { id: string; content: string; pinned: boolean; }
interface Project     { id: string; title: string; status: string; }

@Component({
  selector: 'life-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1 class="page-title">Life OS</h1>

      @if (loading()) {
        <p class="muted">Caricamento...</p>
      } @else {
        <div class="grid">

          <a class="widget" routerLink="/life/habits">
            <div class="widget-header">
              <span class="wicon">◉</span>
              <span class="wtitle">Habits oggi</span>
              <span class="wcount">{{ habitsDone() }}/{{ habitsTotal() }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="habitsProgress()"></div>
            </div>
            <div class="icons-row">
              @for (h of habits().slice(0, 6); track h.id) {
                <span class="habit-icon" [class.done]="!!h.log_id" [title]="h.label">{{ h.icon }}</span>
              }
            </div>
          </a>

          <a class="widget" routerLink="/life/goals">
            <div class="widget-header">
              <span class="wicon">◎</span>
              <span class="wtitle">Obiettivi settimana</span>
              <span class="wcount">{{ weekGoals().length }}</span>
            </div>
            @for (g of weekGoals().slice(0, 4); track g.id) {
              <div class="list-row" [class.done]="g.done">
                <span>{{ g.done ? '✓' : '○' }}</span>
                <span class="row-text">{{ g.title }}</span>
              </div>
            }
            @if (weekGoals().length === 0) {
              <p class="empty-note">Nessun obiettivo questa settimana</p>
            }
          </a>

          <a class="widget" routerLink="/life/ideas">
            <div class="widget-header">
              <span class="wicon">◑</span>
              <span class="wtitle">Idee recenti</span>
              <span class="wcount">{{ ideas().length }}</span>
            </div>
            @for (i of ideas().slice(0, 3); track i.id) {
              <div class="list-row">
                @if (i.pinned) { <span class="pin">⭐</span> }
                <span class="row-text idea-text">{{ truncate(i.content) }}</span>
              </div>
            }
            @if (ideas().length === 0) {
              <p class="empty-note">Nessuna idea ancora</p>
            }
          </a>

          <a class="widget" routerLink="/life/projects">
            <div class="widget-header">
              <span class="wicon">◒</span>
              <span class="wtitle">Progetti attivi</span>
              <span class="wcount accent">{{ activeProjects().length }}</span>
            </div>
            @for (p of activeProjects().slice(0, 3); track p.id) {
              <div class="list-row">
                <span class="dot"></span>
                <span class="row-text">{{ p.title }}</span>
              </div>
            }
            @if (activeProjects().length === 0) {
              <p class="empty-note">Nessun progetto attivo</p>
            }
          </a>

        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 40px; max-width: 900px; }
    .page-title { font-size: 24px; color: #fff; margin: 0 0 28px; }
    .muted { color: #555; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

    .widget { display: block; background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 20px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
    .widget:hover { border-color: #A78BFA44; }

    .widget-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .wicon { font-size: 16px; color: #A78BFA; }
    .wtitle { flex: 1; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
    .wcount { font-size: 22px; color: #fff; font-weight: 600; }
    .wcount.accent { color: #A78BFA; }

    .progress-bar { height: 3px; background: #1e1e1e; border-radius: 2px; margin-bottom: 14px; }
    .progress-fill { height: 100%; background: #A78BFA; border-radius: 2px; transition: width 0.4s ease; }

    .icons-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .habit-icon { font-size: 20px; opacity: 0.25; transition: opacity 0.2s; }
    .habit-icon.done { opacity: 1; }

    .list-row { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; font-size: 13px; color: #aaa; }
    .list-row.done { color: #444; text-decoration: line-through; }
    .row-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .idea-text { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .pin { font-size: 10px; flex-shrink: 0; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; flex-shrink: 0; margin-top: 5px; }
    .empty-note { font-size: 12px; color: #333; }
  `],
})
export class LifeDashboardComponent implements OnInit {
  private api = inject(LifeApiService);

  habits   = signal<HabitToday[]>([]);
  goals    = signal<Goal[]>([]);
  ideas    = signal<Idea[]>([]);
  projects = signal<Project[]>([]);
  loading  = signal(true);

  habitsDone     = computed(() => this.habits().filter(h => !!h.log_id).length);
  habitsTotal    = computed(() => this.habits().length);
  habitsProgress = computed(() => this.habitsTotal() ? Math.round(this.habitsDone() / this.habitsTotal() * 100) : 0);

  weekGoals = computed(() =>
    this.goals().filter(g => g.horizon === 'week')
  );

  activeProjects = computed(() => this.projects().filter(p => p.status === 'active'));

  ngOnInit(): void {
    forkJoin({
      habits:   this.api.get<HabitToday[]>('/habits/today'),
      goals:    this.api.get<Goal[]>('/goals'),
      ideas:    this.api.get<Idea[]>('/ideas'),
      projects: this.api.get<Project[]>('/projects'),
    }).subscribe({
      next: ({ habits, goals, ideas, projects }) => {
        this.habits.set(habits ?? []);
        this.goals.set(goals ?? []);
        this.ideas.set(ideas ?? []);
        this.projects.set(projects ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  truncate(s: string, n = 80): string {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
}
