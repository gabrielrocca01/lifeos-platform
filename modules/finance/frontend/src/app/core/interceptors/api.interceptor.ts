import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Passa-attraverso per richieste non-API (assets, i18n, ecc.)
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  // Inietta Bearer token (non su login/register)
  const token = auth.token;
  const isAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');
  const apiReq = (token && !isAuthEndpoint)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(apiReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.logout();
        router.navigate(['/login']);
      } else if (error.status === 0) {
        notify.error('Backend non raggiungibile — assicurati che il server sia avviato su porta 3000');
      } else if (error.status >= 500) {
        notify.error(`Errore server: ${error.error?.error || error.message}`);
      } else if (error.status === 404) {
        notify.error('Risorsa non trovata');
      }
      return throwError(() => error);
    })
  );
};
