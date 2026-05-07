import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Impostazioni</h1>

      <!-- PROFILO -->
      <section class="section">
        <h2 class="section-title">Profilo</h2>
        <div class="card">
          <div class="avatar">{{ initials() }}</div>
          <div class="profile-info">
            <div class="field-label">Email</div>
            <div class="field-value">{{ user()?.email }}</div>
            @if (createdAt()) {
              <div class="field-label" style="margin-top:8px">Iscritto il</div>
              <div class="field-value muted">{{ createdAt() }}</div>
            }
            <div class="field-label" style="margin-top:16px">Nome</div>
            <div class="input-row">
              <input class="input" [(ngModel)]="nameValue" placeholder="Il tuo nome" />
              <button class="btn-primary" (click)="saveName()" [disabled]="profileSaving()">
                {{ profileSaving() ? '...' : 'Salva' }}
              </button>
            </div>
            @if (profileMsg()) {
              <p class="msg" [class.err]="profileMsg().startsWith('Err') || profileMsg().startsWith('Pass')">{{ profileMsg() }}</p>
            }
          </div>
        </div>
      </section>

      <!-- SICUREZZA -->
      <section class="section">
        <h2 class="section-title">Sicurezza</h2>
        <div class="card">
          <div class="form-col">
            <div>
              <div class="field-label">Password attuale</div>
              <input class="input" type="password" [(ngModel)]="pwForm.current_password" placeholder="••••••••" />
            </div>
            <div>
              <div class="field-label">Nuova password</div>
              <input class="input" type="password" [(ngModel)]="pwForm.password" placeholder="Min. 8 caratteri" />
            </div>
            <div>
              <div class="field-label">Conferma password</div>
              <input class="input" type="password" [(ngModel)]="pwForm.confirm" placeholder="Ripeti la nuova password"
                     (keydown.enter)="changePassword()" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" (click)="changePassword()" [disabled]="pwSaving() || !pwForm.current_password || !pwForm.password">
              {{ pwSaving() ? '...' : 'Cambia password' }}
            </button>
          </div>
          @if (pwMsg()) {
            <p class="msg" [class.err]="!pwMsg().startsWith('Password aggiorn')">{{ pwMsg() }}</p>
          }
        </div>
      </section>

      <!-- ACCOUNT -->
      <section class="section">
        <h2 class="section-title">Account</h2>
        <div class="card">
          @if (!showLogoutConfirm()) {
            <div class="logout-row">
              <div>
                <div class="field-label">Sessione attiva</div>
                <div class="field-value" style="color:#555">{{ user()?.email }}</div>
              </div>
              <button class="btn-danger" (click)="showLogoutConfirm.set(true)">Logout</button>
            </div>
          } @else {
            <div class="confirm-row">
              <span class="confirm-msg">Sicuro di voler uscire?</span>
              <button class="btn-ghost" (click)="showLogoutConfirm.set(false)">Annulla</button>
              <button class="btn-danger" (click)="logout()">Sì, esci</button>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page { padding: 40px; max-width: 560px; }
    .page-title { font-size: 24px; color: #fff; margin: 0 0 32px; }

    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin: 0 0 12px; }

    .card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 24px; }

    .avatar { width: 48px; height: 48px; border-radius: 50%; background: #A78BFA22; border: 2px solid #A78BFA44; color: #A78BFA; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; margin-bottom: 20px; }

    .profile-info { display: flex; flex-direction: column; }
    .field-label { font-size: 11px; color: #555; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    .field-value { color: #ccc; font-size: 14px; margin-bottom: 4px; }
    .field-value.muted { color: #555; font-size: 12px; }

    .input-row { display: flex; gap: 10px; align-items: center; }
    .input { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; padding: 8px 12px; font-family: inherit; font-size: 13px; outline: none; flex: 1; min-width: 0; }
    .input:focus { border-color: #E8C547; }

    .form-col { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
    .form-col .input { width: 100%; box-sizing: border-box; flex: none; }
    .form-actions { display: flex; }

    .btn-primary { background: #E8C547; color: #000; border: none; border-radius: 4px; padding: 8px 18px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-primary:hover { background: #f0d060; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-ghost { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; cursor: pointer; }
    .btn-ghost:hover { color: #ccc; border-color: #555; }
    .btn-danger { background: none; border: 1px solid #f87171; color: #f87171; border-radius: 4px; padding: 8px 16px; font-family: inherit; font-size: 13px; cursor: pointer; }
    .btn-danger:hover { background: #f871711a; }

    .msg { font-size: 12px; color: #4ade80; margin: 8px 0 0; }
    .msg.err { color: #f87171; }

    .logout-row { display: flex; justify-content: space-between; align-items: center; }
    .confirm-row { display: flex; align-items: center; gap: 12px; }
    .confirm-msg { flex: 1; color: #ccc; font-size: 13px; }
  `],
})
export class SettingsComponent implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  user = this.auth.user;

  nameValue  = '';
  createdAt  = signal('');

  profileSaving    = signal(false);
  profileMsg       = signal('');
  pwSaving         = signal(false);
  pwMsg            = signal('');
  showLogoutConfirm = signal(false);

  pwForm = { current_password: '', password: '', confirm: '' };

  ngOnInit(): void {
    this.nameValue = this.user()?.name ?? '';
    this.http.get<{ ok: boolean; data: { id: string; email: string; name: string | null; created_at: string } }>(
      '/api/auth/me'
    ).subscribe({
      next: res => {
        if (res.ok && res.data.created_at) {
          this.createdAt.set(
            new Date(res.data.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
          );
        }
      },
    });
  }

  initials(): string {
    const u = this.user();
    const n = u?.name || u?.email || '?';
    return n.slice(0, 2).toUpperCase();
  }

  saveName(): void {
    this.profileSaving.set(true);
    this.profileMsg.set('');
    this.auth.updateProfile({ name: this.nameValue }).subscribe({
      next: ()  => { this.profileMsg.set('Salvato!'); this.profileSaving.set(false); },
      error: (e) => { this.profileMsg.set(e.error?.error ?? 'Errore nel salvataggio'); this.profileSaving.set(false); },
    });
  }

  changePassword(): void {
    if (this.pwForm.password !== this.pwForm.confirm) {
      this.pwMsg.set('Le password non coincidono');
      return;
    }
    if (this.pwForm.password.length < 8) {
      this.pwMsg.set('La password deve avere almeno 8 caratteri');
      return;
    }
    this.pwSaving.set(true);
    this.pwMsg.set('');
    this.auth.updateProfile({ current_password: this.pwForm.current_password, password: this.pwForm.password }).subscribe({
      next: ()  => {
        this.pwMsg.set('Password aggiornata con successo');
        this.pwSaving.set(false);
        this.pwForm = { current_password: '', password: '', confirm: '' };
      },
      error: (e) => { this.pwMsg.set(e.error?.error ?? 'Errore'); this.pwSaving.set(false); },
    });
  }

  logout(): void { this.auth.logout(); }
}
