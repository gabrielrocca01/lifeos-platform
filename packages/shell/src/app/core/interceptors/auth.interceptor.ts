import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, throwError, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token || !req.url.includes('/api/')) return next(req);

  const authed = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(authed).pipe(
    catchError(err => {
      // Don't retry auth endpoints or non-401 errors
      if (err.status !== 401 || req.url.includes('/api/auth/')) {
        return throwError(() => err);
      }

      return from(
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(r => r.json())
      ).pipe(
        switchMap((res: { ok: boolean; data?: { token: string } }) => {
          if (!res.ok || !res.data?.token) return throwError(() => err);
          auth.updateToken(res.data.token);
          const retried = req.clone({
            setHeaders: { Authorization: `Bearer ${res.data.token}` },
          });
          return next(retried);
        }),
        catchError(() => throwError(() => err))
      );
    })
  );
};
