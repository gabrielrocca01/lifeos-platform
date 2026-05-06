export const LIFE_ROUTES = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.LifeDashboardComponent),
  },
  {
    path: 'habits',
    loadComponent: () => import('./features/habits/habits').then(m => m.HabitsComponent),
  },
  {
    path: 'goals',
    loadComponent: () => import('./features/goals/goals').then(m => m.GoalsComponent),
  },
  {
    path: 'ideas',
    loadComponent: () => import('./features/ideas/ideas').then(m => m.IdeasComponent),
  },
  {
    path: 'projects',
    loadComponent: () => import('./features/projects/projects').then(m => m.ProjectsComponent),
  },
];
