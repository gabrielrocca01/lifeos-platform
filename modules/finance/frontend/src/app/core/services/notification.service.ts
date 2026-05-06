// ============================================================
// Finance OS — NotificationService
// Toast leggeri senza dipendenze esterne
// ============================================================

import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  toasts = signal<Toast[]>([]);

  success(message: string): void { this.add('success', message); }
  error(message: string): void   { this.add('error', message); }
  info(message: string): void    { this.add('info', message); }
  warning(message: string): void { this.add('warning', message); }

  dismiss(id: string): void {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }

  private add(type: Toast['type'], message: string): void {
    const id = Math.random().toString(36).slice(2);
    this.toasts.update(t => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
