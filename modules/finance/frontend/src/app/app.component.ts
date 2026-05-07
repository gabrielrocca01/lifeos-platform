import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationService } from './core/services/notification.service';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';

interface NavItem {
  label: string;
  route: string;
  section?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app">

      <!-- SIDEBAR — visibile solo se autenticato -->
      @if (auth.isLoggedIn()) {
        <nav class="sidebar">
          <div class="sidebar-logo">
            <span class="logo-text">Finance OS</span>
            <small class="logo-sub">v2.0 — SaaS</small>
          </div>

          @for (item of navItems; track item.route) {
            @if (item.section) {
              <div class="nav-section">{{ item.section }}</div>
            }
            <a class="nav-item" [routerLink]="item.route" routerLinkActive="active">
              <span class="nav-dot"></span>
              {{ item.label }}
            </a>
          }

          <div class="sidebar-footer">
            <div class="user-info">
              <span class="user-email">{{ auth.user()?.email }}</span>
            </div>
            <button class="btn-logout" (click)="auth.logout()">Esci</button>
          </div>
        </nav>
      }

      <!-- MAIN CONTENT -->
      <main class="main" [class.no-sidebar]="!auth.isLoggedIn()">
        <router-outlet />
      </main>

      <!-- TOAST NOTIFICATIONS -->
      <div class="toast-container">
        @for (toast of toasts(); track toast.id) {
          <div class="toast" [class]="'toast-' + toast.type">
            <span>{{ toast.message }}</span>
            <button class="toast-close" (click)="notify.dismiss(toast.id)">✕</button>
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --bg:      #0f0f0f;
      --bg2:     #161616;
      --bg3:     #1e1e1e;
      --bg4:     #252525;
      --border:  #2a2a2a;
      --border2: #333;
      --text:    #e8e6e0;
      --text2:   #888;
      --text3:   #555;
      --accent:  #e8c547;
      --green:   #4ade80;
      --red:     #f87171;
      --amber:   #fbbf24;
      --blue:    #60a5fa;
      --font-display: 'Fraunces', serif;
      --font-mono:    'DM Mono', monospace;
    }

    .app {
      display: flex;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 13px;
    }

    /* SIDEBAR */
    .sidebar {
      width: 200px;
      min-width: 200px;
      background: var(--bg2);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 24px 0 16px;
      position: fixed;
      top: 0; left: 0; bottom: 0;
    }

    .sidebar-logo {
      padding: 0 20px 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }

    .logo-text {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
      letter-spacing: -0.5px;
      display: block;
    }

    .logo-sub {
      color: var(--text3);
      font-size: 10px;
      margin-top: 2px;
      display: block;
    }

    .nav-section {
      padding: 16px 20px 4px;
      font-size: 10px;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 20px;
      cursor: pointer;
      color: var(--text2);
      transition: all .15s;
      border-left: 2px solid transparent;
      font-size: 12px;
      text-decoration: none;

      &:hover {
        color: var(--text);
        background: var(--bg3);
      }

      &.active {
        color: var(--accent);
        border-left-color: var(--accent);
        background: var(--bg3);
      }
    }

    .nav-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      opacity: .6;
      flex-shrink: 0;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-info { overflow: hidden; }

    .user-email {
      font-size: 10px;
      color: var(--text3);
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-logout {
      background: none;
      border: 1px solid var(--border2);
      color: var(--text2);
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 11px;
      cursor: pointer;
      font-family: var(--font-mono);
      transition: all .15s;

      &:hover { color: var(--red); border-color: var(--red); }
    }

    /* MAIN */
    .main {
      flex: 1;
      margin-left: 200px;
      min-height: 100vh;
      overflow: auto;

      &.no-sidebar { margin-left: 0; }
    }

    /* TOAST */
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 12px;
      max-width: 360px;
      animation: slideIn .2s ease;
      border: 1px solid;

      &.toast-success { background: #052e16; color: var(--green); border-color: #166534; }
      &.toast-error   { background: #7f1d1d; color: var(--red);   border-color: #991b1b; }
      &.toast-warning { background: #78350f; color: var(--amber); border-color: #92400e; }
      &.toast-info    { background: #1e3a5f; color: var(--blue);  border-color: #1e40af; }
    }

    .toast-close {
      background: none;
      border: none;
      color: currentColor;
      cursor: pointer;
      font-size: 12px;
      margin-left: auto;
      opacity: .7;
      &:hover { opacity: 1; }
    }

    @keyframes slideIn {
      from { transform: translateX(20px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
  `]
})
export class AppComponent {
  toasts = computed(() => this.notify.toasts());

  navItems: NavItem[] = [
    { label: 'Dashboard',    route: '/dashboard',    section: 'Panoramica' },
    { label: 'Conti',        route: '/conti' },
    { label: 'Transazioni',  route: '/transazioni',  section: 'Movimenti' },
    { label: 'Importa',      route: '/import' },
    { label: 'Pianificate',  route: '/pianificate' },
    { label: 'Kakebo',       route: '/kakebo',       section: 'Analisi' },
    { label: 'Investimenti', route: '/investimenti' },
    { label: 'Fiscalità',    route: '/fiscalita',    section: 'Fisco' },
    { label: 'Profilo',      route: '/profilo',      section: 'Account' },
  ];

  constructor(public notify: NotificationService, public auth: AuthService, lang: LanguageService) {
    lang.init();
  }
}
