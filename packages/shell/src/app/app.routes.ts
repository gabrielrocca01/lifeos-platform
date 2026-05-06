import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/layout/layout').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'finance',
        loadChildren: () => import('../../../../modules/finance/frontend/src/app/finance.routes').then(m => m.FINANCE_ROUTES),
      },
      {
        path: 'life',
        loadChildren: () => import('../../../../modules/life/frontend/src/app/life.routes').then(m => m.LIFE_ROUTES),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
