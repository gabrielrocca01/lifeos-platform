import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <div class="code">404</div>
      <h1 class="title">Pagina non trovata</h1>
      <p class="sub">La pagina che cerchi non esiste o è stata spostata.</p>
      <a class="btn" routerLink="/">← Torna alla home</a>
    </div>
  `,
  styles: [`
    .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40px; text-align: center; }
    .code { font-size: 96px; font-weight: 700; color: #1e1e1e; line-height: 1; margin-bottom: 16px; }
    .title { font-size: 24px; color: #fff; margin: 0 0 8px; }
    .sub { color: #555; font-size: 14px; margin: 0 0 28px; }
    .btn { background: #A78BFA; color: #000; border-radius: 6px; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; }
    .btn:hover { background: #c4b5fd; }
  `],
})
export class NotFoundComponent {}
