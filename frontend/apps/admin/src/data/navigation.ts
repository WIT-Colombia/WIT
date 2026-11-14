export type NavigationItem = { path: string; label: string; icon: string; group: string; description: string; pending?: boolean };
export type NavigationGroup = { id: string; label: string; items: NavigationItem[] };

export const navigationGroups: NavigationGroup[] = [
  { id: 'inicio', label: 'Inicio', items: [
    { path: '/dashboard', label: 'Inicio', icon: 'home', group: 'inicio', description: 'Estado general de XAMUKO.' },
  ] },
  { id: 'plataforma', label: 'Gestión de la plataforma', items: [
    { path: '/businesses', label: 'Negocios', icon: 'store', group: 'plataforma', description: 'Directorio y gestión administrativa de negocios.' },
    { path: '/users', label: 'Usuarios', icon: 'users', group: 'plataforma', description: 'Consulta de cuentas reales según permisos.' },
    { path: '/content', label: 'Contenido', icon: 'box', group: 'plataforma', description: 'Consulta de productos y servicios reales.' },
    { path: '/reviews', label: 'Opiniones', icon: 'star', group: 'plataforma', description: 'Consulta de opiniones reales.' },
    { path: '/pioneers', label: 'Negocios Pioneros', icon: 'star', group: 'plataforma', description: 'Registro y asignaciones de pioneros.' },
  ] },
  { id: 'crecimiento', label: 'Suscripciones y crecimiento', items: [
    { path: '/plans', label: 'Planes y suscripciones', icon: 'crown', group: 'crecimiento', description: 'Gestión de planes pendiente de API.', pending: true },
    { path: '/business-pro', label: 'Business PRO', icon: 'store', group: 'crecimiento', description: 'Gestión de Business PRO pendiente de API.', pending: true },
    { path: '/xamuko-plus', label: 'XAMUKO Plus', icon: 'users', group: 'crecimiento', description: 'Gestión de XAMUKO Plus pendiente de API.', pending: true },
    { path: '/promotions', label: 'Promociones', icon: 'tag', group: 'crecimiento', description: 'Promociones pendientes de API.', pending: true },
    { path: '/referrals', label: 'Referidos', icon: 'users', group: 'crecimiento', description: 'Referidos pendientes de API.', pending: true },
  ] },
  { id: 'finanzas', label: 'Finanzas y contabilidad', items: [
    { path: '/billing', label: 'Ingresos y facturación', icon: 'card', group: 'finanzas', description: 'Ingresos y facturación pendientes de API.', pending: true },
    { path: '/transactions', label: 'Transacciones', icon: 'clock', group: 'finanzas', description: 'Transacciones pendientes de API.', pending: true },
    { path: '/refunds', label: 'Reembolsos', icon: 'clock', group: 'finanzas', description: 'Reembolsos pendientes de API.', pending: true },
    { path: '/financial-reports', label: 'Gastos tecnológicos', icon: 'chart', group: 'finanzas', description: 'Consulta de gastos tecnológicos desde API.' },
  ] },
  { id: 'tecnologia', label: 'Operación tecnológica', items: [
    { path: '/service-status', label: 'Estado de servicios', icon: 'shield', group: 'tecnologia', description: 'Estado de servicios pendiente de integración.', pending: true },
    { path: '/deployments', label: 'Despliegues', icon: 'box', group: 'tecnologia', description: 'Historial de despliegues pendiente de integración.', pending: true },
    { path: '/needs', label: 'Necesidades', icon: 'search', group: 'tecnologia', description: 'Consulta de necesidades pendiente de API.', pending: true },
  ] },
  { id: 'soporte', label: 'Atención y soporte', items: [
    { path: '/verifications', label: 'Verificaciones', icon: 'shield', group: 'soporte', description: 'Revisión documental de negocios.' },
    { path: '/user-needs', label: 'Necesidades de usuarios', icon: 'search', group: 'soporte', description: 'Solicitudes enviadas desde Cuéntanos qué necesitas. Pendiente de API.' },
    { path: '/business-reports', label: 'Reportes de negocios', icon: 'flag', group: 'soporte', description: 'Bandeja de denuncias sobre negocios; integración con API pendiente.', pending: true },
    { path: '/offer-reports', label: 'Reportes de productos', icon: 'flag', group: 'soporte', description: 'Bandeja de reportes de productos y servicios, con conexión a API pendiente.' },
    { path: '/reports', label: 'Reportes de comentarios', icon: 'flag', group: 'soporte', description: 'Revisión y moderación de opiniones reportadas por negocios y usuarios.' },
    { path: '/support', label: 'Mensajes de soporte', icon: 'message', group: 'soporte', description: 'Bandeja de soporte pendiente de API.', pending: true },
    { path: '/suggestions', label: 'Sugerencias', icon: 'message', group: 'soporte', description: 'Gestión de sugerencias pendiente de API.', pending: true },
  ] },
  { id: 'juridica', label: 'Jurídica y corporativa', items: [
    { path: '/legal-documents', label: 'Documentos legales', icon: 'box', group: 'juridica', description: 'Documentos legales pendientes de API.', pending: true },
    { path: '/corporate', label: 'Estatutos', icon: 'box', group: 'juridica', description: 'Información corporativa pendiente de API.', pending: true },
    { path: '/legal-cases', label: 'Procesos judiciales', icon: 'shield', group: 'juridica', description: 'Gestión jurídica pendiente de API.', pending: true },
  ] },
  { id: 'configuracion', label: 'Configuración y seguridad', items: [
    { path: '/zones', label: 'Zonas y categorías', icon: 'globe', group: 'configuracion', description: 'Configuración de zonas pendiente de API.', pending: true },
    { path: '/categories', label: 'Categorías', icon: 'grid', group: 'configuracion', description: 'Consulta del catálogo real.' },
    { path: '/parameters', label: 'Parámetros', icon: 'settings', group: 'configuracion', description: 'Parámetros pendientes de API.', pending: true },
    { path: '/administrators', label: 'Administradores y accesos', icon: 'users', group: 'configuracion', description: 'Consulta de cuentas y permisos administrativos.' },
    { path: '/audit', label: 'Auditoría', icon: 'shield', group: 'configuracion', description: 'Consulta de auditoría pendiente de API.', pending: true },
  ] },
];

export const navigation = navigationGroups.flatMap(group => group.items);
// Kept as an empty compatibility export while the app and search use one unified navigation tree.
export const auxiliaryNavigation: NavigationItem[] = [];
