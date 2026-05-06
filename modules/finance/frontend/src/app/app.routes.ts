import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    title: 'Accedi — Finance OS',
  },

  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Dashboard — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'conti',
    loadComponent: () => import('./features/accounts/accounts.component').then(m => m.AccountsComponent),
    title: 'Conti — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'transazioni',
    loadComponent: () => import('./features/transactions/transactions.component').then(m => m.TransactionsComponent),
    title: 'Transazioni — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.component').then(m => m.ImportComponent),
    title: 'Import CSV — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'pianificate',
    loadComponent: () => import('./features/planned/planned.component').then(m => m.PlannedComponent),
    title: 'Spese pianificate — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'kakebo',
    loadComponent: () => import('./features/kakebo/kakebo.component').then(m => m.KakeboComponent),
    title: 'Kakebo — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'investimenti',
    loadComponent: () => import('./features/investments/investments.component').then(m => m.InvestmentsComponent),
    title: 'Investimenti — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'fiscalita',
    loadComponent: () => import('./features/fiscal/fiscal.component').then(m => m.FiscalComponent),
    title: 'Cassetto fiscale — Finance OS',
    canActivate: [authGuard],
  },
  {
    path: 'profilo',
    loadComponent: () => import('./features/profilo/profilo.component').then(m => m.ProfiloComponent),
    title: 'Profilo — Finance OS',
    canActivate: [authGuard],
  },

  { path: '**', redirectTo: 'dashboard' },
];
