import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LifeApiService {
  private http = inject(HttpClient);
  private base = '/api/life';

  get<T>(path: string): Observable<T> {
    return this.http.get<{ ok: boolean; data: T }>(`${this.base}${path}`).pipe(
      map(r => r.data)
    );
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<{ ok: boolean; data: T }>(`${this.base}${path}`, body).pipe(
      map(r => r.data)
    );
  }

  patch(path: string, body: unknown = {}): Observable<void> {
    return this.http.patch<{ ok: boolean }>(`${this.base}${path}`, body).pipe(
      map(() => void 0)
    );
  }

  delete(path: string): Observable<void> {
    return this.http.delete<{ ok: boolean }>(`${this.base}${path}`).pipe(
      map(() => void 0)
    );
  }
}
