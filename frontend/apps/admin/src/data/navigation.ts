export type NavigationItem = { path: string; label: string; icon: string; group?: string; description: string; pending?: boolean };

export const navigation: NavigationItem[] = [
  { path: '/dashboard', label: 'Inicio', icon: 'home', description: 'Estado general de XAMUKO.' },
  { path: '/summary', label: 'Resumen', icon: 'grid', group: 'PLATAFORMA', description: 'Resumen de la plataforma.' },
  { path: '/statistics', label: 'Estadísticas', icon: 'chart', group: 'PLATAFORMA', description: 'Indicadores disponibles.' },
  { path: '/businesses', label: 'Negocios', icon: 'store', group: 'GESTIÓN', description: 'Administración de negocios.' },
  { path: '/users', label: 'Usuarios', icon: 'users', group: 'GESTIÓN', description: 'Cuentas de usuarios.' },
  { path: '/verifications', label: 'Verificaciones', icon: 'shield', group: 'GESTIÓN', description: 'Revisión documental de negocios.' },
  { path: '/content', label: 'Contenido', icon: 'message', group: 'GESTIÓN', description: 'Productos y servicios.' },
  { path: '/reports', label: 'Reportes', icon: 'flag', group: 'GESTIÓN', description: 'Reportes de opiniones.' },
  { path: '/plans', label: 'Planes y suscripciones', icon: 'crown', group: 'SUSCRIPCIONES', description: 'Configuración de planes pendiente.', pending: true },
  { path: '/business-pro', label: 'Business PRO', icon: 'store', group: 'SUSCRIPCIONES', description: 'Gestión de Business PRO pendiente.', pending: true },
  { path: '/xamuko-plus', label: 'XAMUKO Plus', icon: 'users', group: 'SUSCRIPCIONES', description: 'Gestión de XAMUKO Plus pendiente.', pending: true },
  { path: '/promotions', label: 'Promociones', icon: 'tag', group: 'SUSCRIPCIONES', description: 'Promociones pendientes de implementación.', pending: true },
  { path: '/referrals', label: 'Referidos', icon: 'users', group: 'SUSCRIPCIONES', description: 'Referidos pendientes de implementación.', pending: true },
  { path: '/billing', label: 'Pagos y facturación', icon: 'card', group: 'FINANZAS', description: 'Pagos y facturación pendientes.', pending: true },
  { path: '/transactions', label: 'Transacciones', icon: 'clock', group: 'FINANZAS', description: 'Transacciones pendientes.', pending: true },
  { path: '/refunds', label: 'Reembolsos', icon: 'clock', group: 'FINANZAS', description: 'Reembolsos pendientes.', pending: true },
  { path: '/financial-reports', label: 'Gastos tecnológicos', icon: 'chart', group: 'FINANZAS', description: 'Control de gastos AWS, Google Maps y Resend.' },
  { path: '/zones', label: 'Zonas y categorías', icon: 'globe', group: 'CONFIGURACIÓN', description: 'Zonas y categorías.' },
  { path: '/parameters', label: 'Parámetros', icon: 'settings', group: 'CONFIGURACIÓN', description: 'Parámetros pendientes.', pending: true },
  { path: '/administrators', label: 'Administradores', icon: 'users', group: 'CONFIGURACIÓN', description: 'Administradores pendientes.', pending: true },
  { path: '/audit', label: 'Auditoría', icon: 'shield', group: 'CONFIGURACIÓN', description: 'Registro de auditoría.' },
];

export const auxiliaryNavigation: NavigationItem[] = [
  { path: '/reviews', label: 'Opiniones', icon: 'message', description: 'Moderación de opiniones.' },
  { path: '/pioneers', label: 'Negocios Pioneros', icon: 'star', description: 'Reconocimientos pioneros.' },
  { path: '/needs', label: 'Necesidades', icon: 'search', description: 'Demanda local.' },
  { path: '/categories', label: 'Categorías', icon: 'grid', description: 'Categorías de negocios.' },
  { path: '/notifications', label: 'Notificaciones', icon: 'bell', description: 'Notificaciones administrativas.' },
  { path: '/settings', label: 'Mi perfil', icon: 'settings', description: 'Perfil del administrador.' },
];
