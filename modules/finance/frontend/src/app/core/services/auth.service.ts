import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

interface AuthResponse {
  success: boolean;
  data: { token: string; user: AuthUser };
}

const TOKEN_KEY = 'finance_os_token';
const USER_KEY  = 'finance_os_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthUser | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap(res => this.saveSession(res.data.token, res.data.user))
    );
  }

  register(email: string, password: string, name?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { email, password, name }).pipe(
      tap(res => this.saveSession(res.data.token, res.data.user))
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private saveSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
