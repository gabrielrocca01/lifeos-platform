import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name?: string;
  modules_enabled: string[];
}

interface LoginResponse { token: string; user: User; }

const TOKEN_KEY = 'lifeos_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _user  = signal<User | null>(null);
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user       = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(email: string, password: string) {
    return this.http.post<{ ok: true; data: LoginResponse }>('/api/auth/login', { email, password }).pipe(
      tap(res => this.setSession(res.data))
    );
  }

  register(email: string, password: string, name?: string) {
    return this.http.post<{ ok: true; data: LoginResponse }>('/api/auth/register', { email, password, name }).pipe(
      tap(res => this.setSession(res.data))
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken() { return this._token(); }

  updateToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  updateProfile(data: { name?: string; password?: string; current_password?: string }) {
    return this.http.patch<{ ok: boolean; data: { id: string; email: string; name: string | null } }>(
      '/api/auth/me', data
    ).pipe(
      tap(res => {
        if (res.ok) this._user.update(u => u ? { ...u, name: res.data.name ?? undefined } : u);
      })
    );
  }

  private setSession({ token, user }: LoginResponse) {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
    this._user.set(user);
  }
}
