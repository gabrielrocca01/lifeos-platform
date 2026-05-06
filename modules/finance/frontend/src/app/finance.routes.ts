export const FINANCE_ROUTES = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'conti',
    loadComponent: () => import('./features/accounts/accounts.component').then(m => m.AccountsComponent),
  },
  {
    path: 'transazioni',
    loadComponent: () => import('./features/transactions/transactions.component').then(m => m.TransactionsComponent),
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.component').then(m => m.ImportComponent),
  },
  {
    path: 'pianificate',
    loadComponent: () => import('./features/planned/planned.component').then(m => m.PlannedComponent),
  },
  {
    path: 'kakebo',
    loadComponent: () => import('./features/kakebo/kakebo.component').then(m => m.KakeboComponent),
  },
  {
    path: 'investimenti',
    loadComponent: () => import('./features/investments/investments.component').then(m => m.InvestmentsComponent),
  },
  {
    path: 'fiscalita',
    loadComponent: () => import('./features/fiscal/fiscal.component').then(m => m.FiscalComponent),
  },
  {
    path: 'profilo',
    loadComponent: () => import('./features/profilo/profilo.component').then(m => m.ProfiloComponent),
  },
];
