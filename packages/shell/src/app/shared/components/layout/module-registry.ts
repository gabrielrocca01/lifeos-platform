export const MODULE_REGISTRY = [
  {
    id: 'life',
    label: 'Life OS',
    icon: '◉',
    color: '#A78BFA',
    route: '/life',
    navItems: [
      { label: 'Dashboard', icon: '◈', route: '/life' },
      { label: 'Habits',    icon: '◐', route: '/life/habits' },
      { label: 'Goals',     icon: '◎', route: '/life/goals' },
      { label: 'Idee',      icon: '◑', route: '/life/ideas' },
      { label: 'Progetti',  icon: '◒', route: '/life/projects' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance OS',
    icon: '◈',
    color: '#E8C547',
    route: '/finance',
    navItems: [
      { label: 'Dashboard',    icon: '◈', route: '/finance' },
      { label: 'Conti',        icon: '🏦', route: '/finance/conti' },
      { label: 'Transazioni',  icon: '↕',  route: '/finance/transazioni' },
      { label: 'Import',       icon: '↑',  route: '/finance/import' },
      { label: 'Pianificate',  icon: '📅', route: '/finance/pianificate' },
      { label: 'Kakebo',       icon: '📓', route: '/finance/kakebo' },
      { label: 'Investimenti', icon: '📈', route: '/finance/investimenti' },
      { label: 'Fiscalità',    icon: '🗂',  route: '/finance/fiscalita' },
    ],
  },
];
