import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { LanguageService, SUPPORTED_LANGS, Lang } from '../../core/services/language.service';

@Component({
  selector: 'app-profilo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profilo.component.html',
  styleUrl: './profilo.component.css',
})
export class ProfiloComponent implements OnInit {
  private auth    = inject(AuthService);
  private notify  = inject(NotificationService);
  private http    = inject(HttpClient);
  readonly lang   = inject(LanguageService);

  readonly user = this.auth.user;
  readonly langs = SUPPORTED_LANGS;

  // Form nome
  newName     = '';
  savingName  = signal(false);

  // Form password
  currentPwd  = '';
  newPwd      = '';
  confirmPwd  = '';
  savingPwd   = signal(false);

  // Info account da backend
  createdAt   = signal<string | null>(null);

  ngOnInit(): void {
    this.newName = this.user()?.name ?? '';
    this.http.get<{ success: boolean; data: { created_at: string } }>('/api/auth/me').subscribe({
      next: res => this.createdAt.set(res.data.created_at),
    });
  }

  saveName(): void {
    if (!this.newName.trim()) return;
    this.savingName.set(true);
    this.http.patch<{ success: boolean; data: { id: number; email: string; name: string } }>(
      '/api/auth/me', { name: this.newName.trim() }
    ).subscribe({
      next: res => {
        const stored = localStorage.getItem('finance_os_user');
        if (stored) {
          const u = JSON.parse(stored);
          u.name = res.data.name;
          localStorage.setItem('finance_os_user', JSON.stringify(u));
          (this.auth as any)._user.set(u);
        }
        this.notify.success('Nome aggiornato');
        this.savingName.set(false);
      },
      error: e => {
        this.notify.error(e.error?.error || 'Errore nel salvataggio');
        this.savingName.set(false);
      },
    });
  }

  savePassword(): void {
    if (!this.currentPwd || !this.newPwd || !this.confirmPwd) {
      this.notify.error('Compila tutti i campi password'); return;
    }
    if (this.newPwd !== this.confirmPwd) {
      this.notify.error('Le password non coincidono'); return;
    }
    if (this.newPwd.length < 8) {
      this.notify.error('La nuova password deve avere almeno 8 caratteri'); return;
    }
    this.savingPwd.set(true);
    this.http.patch('/api/auth/me', { current_password: this.currentPwd, password: this.newPwd }).subscribe({
      next: () => {
        this.notify.success('Password aggiornata');
        this.currentPwd = ''; this.newPwd = ''; this.confirmPwd = '';
        this.savingPwd.set(false);
      },
      error: e => {
        this.notify.error(e.error?.error || 'Errore nel cambio password');
        this.savingPwd.set(false);
      },
    });
  }

  setLang(code: Lang): void { this.lang.use(code); }

  logout(): void { this.auth.logout(); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
