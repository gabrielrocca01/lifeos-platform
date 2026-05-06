import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  mode     = signal<'login' | 'register'>('login');
  email    = signal('');
  password = signal('');
  name     = signal('');
  loading  = signal(false);
  error    = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    const obs = this.mode() === 'login'
      ? this.auth.login(this.email(), this.password())
      : this.auth.register(this.email(), this.password(), this.name() || undefined);

    obs.subscribe({
      next: () => this.router.navigate(['/']),
      error: (e) => {
        this.error.set(e.error?.error ?? 'Errore di rete');
        this.loading.set(false);
      },
    });
  }
}
