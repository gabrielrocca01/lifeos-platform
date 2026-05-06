// ============================================================
// Finance OS — ApiService
// Wrapper tipizzato attorno a HttpClient.
// Tutti i servizi specifici lo usano come base.
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http.get<ApiResponse<T>>(`/api${path}`, { params: httpParams }).pipe(
      map(res => res.data as T)
    );
  }

  getWithMeta<T>(path: string, params?: Record<string, string | number | boolean>): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http.get<ApiResponse<T>>(`/api${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`/api${path}`, body).pipe(
      map(res => res.data as T)
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(`/api${path}`, body).pipe(
      map(res => res.data as T)
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(`/api${path}`).pipe(
      map(res => res.data as T)
    );
  }

  postFormData<T>(path: string, formData: FormData): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`/api${path}`, formData);
  }
}
