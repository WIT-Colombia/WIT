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
    { path: '/pioneers', label: 'Negocios Pioneros', icon: 'star', group: 'plataforma', description: 'Registro y asignaciones de pioneros.' },
    { path: '/zones', label: 'Zonas', icon: 'globe', group: 'plataforma', description: 'Control real de aperturas y programación territorial.' },
    { path: '/categories', label: 'Categorías', icon: 'grid', group: 'plataforma', description: 'Consulta del catálogo real.' },
  ] },
  { id: 'crecimiento', label: 'Suscripciones y crecimiento', items: [
    { path: '/plans', label: 'Planes y suscripciones', icon: 'crown', group: 'crecimiento', description: 'Consulta real de Business PRO y decisiones administrativas de plan.' },
    { path: '/business-pro', label: 'Business PRO', icon: 'store', group: 'crecimiento', description: 'Seguimiento real de vigencias, vencimientos y activaciones especiales Business PRO.' },
    { path: '/xamuko-plus', label: 'XAMUKO Plus', icon: 'users', group: 'crecimiento', description: 'Activación y desactivación de XAMUKO Plus.' },
  ] },
  { id: 'finanzas', label: 'Finanzas y contabilidad', items: [
    { path: '/billing', label: 'Ingresos y facturación', icon: 'card', group: 'finanzas', description: 'Consulta de fuentes reales de ingresos y contexto comercial sin inventar cobros.' },
    { path: '/transactions', label: 'Transacciones', icon: 'clock', group: 'finanzas', description: 'Registro real de pagos a proveedores con indicadores, filtros y auditoría.' },
    { path: '/refunds', label: 'Reembolsos', icon: 'refresh', group: 'finanzas', description: 'Expedientes de reembolso con seguimiento, permisos y auditoría; sin transferencias automáticas.' },
    { path: '/financial-reports', label: 'Gastos y contabilidad', icon: 'chart', group: 'finanzas', description: 'Control real de consumos, facturas, pagos, presupuestos y auditoría.' }
  ] },
  { id: 'tecnologia', label: 'Operación tecnológica', items: [
    { path: '/service-status', label: 'Estado de servicios', icon: 'heart-pulse', group: 'tecnologia', description: 'Comprobación real de API y MySQL; seguimiento de incidentes y eventos sin uptime ficticio.' },
    { path: '/deployments', label: 'Despliegues y mantenimiento', icon: 'layers', group: 'tecnologia', description: 'GitHub Actions verificable, programación de mantenimiento y necesidades tecnológicas.' },
  ] },
  { id: 'soporte', label: 'Atención y soporte', items: [
    { path: '/verifications', label: 'Verificaciones', icon: 'shield', group: 'soporte', description: 'Revisión documental de negocios.' },
    { path: '/user-needs', label: 'Necesidades de usuarios', icon: 'search', group: 'soporte', description: 'Solicitudes reales enviadas desde Usuarios.' },
    { path: '/business-reports', label: 'Reportes de negocios', icon: 'flag', group: 'soporte', description: 'Bandeja de denuncias reales sobre negocios.' },
    { path: '/offer-reports', label: 'Reportes de productos', icon: 'flag', group: 'soporte', description: 'Bandeja de reportes reales de productos y servicios.' },
    { path: '/reports', label: 'Reportes de comentarios', icon: 'flag', group: 'soporte', description: 'Revisión y moderación de opiniones reportadas por negocios y usuarios.' },
    { path: '/support', label: 'Mensajes de soporte', icon: 'message', group: 'soporte', description: 'Bandeja de soporte recibida desde Business.' },
    { path: '/suggestions', label: 'Sugerencias', icon: 'message', group: 'soporte', description: 'Gestión de sugerencias recibidas desde Business.' },
  ] },
  { id: 'juridica', label: 'Jurídica y corporativa', items: [
    { path: '/legal-overview', label: 'Centro jurídico', icon: 'scales', group: 'juridica', description: 'Vista general verificable de los archivos jurídicos y guía para su gestión.' },
    { path: '/corporate', label: 'Sociedad y gobierno', icon: 'book-open', group: 'juridica', description: 'Estatutos, actas, decisiones y soportes societarios en archivo privado.' },
    { path: '/legal-documents', label: 'Contratos y documentos', icon: 'file', group: 'juridica', description: 'Contratos y documentos legales con almacenamiento privado y auditoría.' },
    { path: '/legal-cases', label: 'Expedientes y procesos', icon: 'shield', group: 'juridica', description: 'Soportes de reclamaciones y procesos; no sustituye el seguimiento judicial.' },
  ] },
  { id: 'configuracion', label: 'Configuración y seguridad', items: [
    { path: '/parameters', label: 'Parámetros y políticas', icon: 'settings', group: 'configuracion', description: 'Comprobación de identidad y estado verificable de la configuración administrativa.' },
    { path: '/administrators', label: 'Administradores y accesos', icon: 'users', group: 'configuracion', description: 'Gestión real de roles y permisos con autorización y auditoría.' },
    { path: '/audit', label: 'Auditoría', icon: 'shield', group: 'configuracion', description: 'Historial verificable de visibilidad, verificación y suscripciones de negocios.' },
  ] },
];

export const navigation = navigationGroups.flatMap(group => group.items);
// Kept as an empty compatibility export while the app and search use one unified navigation tree.
export const auxiliaryNavigation: NavigationItem[] = [];
