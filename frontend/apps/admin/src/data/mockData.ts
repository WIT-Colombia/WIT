import type { Admin, DashboardData, Period } from '../types/admin';
export const mockAdmin: Admin = { id: 'admin-demo', name: 'Danilo Jaramillo', email: 'danilo.jaramillo@hotmail.com', role: 'principal' };
export function dashboardMock(period: Period): DashboardData {
const scale = period === 7 ? .24 : period === 90 ? 2.7 : 1;
return {
metrics: [
{ label: 'Usuarios registrados', value: 12846, change: 12.8 * scale, icon: 'users', caption: `${Math.round(486 * scale)} nuevos en el periodo` },
{ label: 'Negocios registrados', value: 1842, change: 8.4 * scale, icon: 'store', caption: `${Math.round(124 * scale)} nuevos en el periodo` },
{ label: 'Negocios visibles', value: 1426, change: 6.2 * scale, icon: 'eye', caption: '77,4 % de los negocios registrados' },
{ label: 'Opiniones recibidas', value: 3917, change: 18.6 * scale, icon: 'message', caption: `${Math.round(218 * scale)} nuevas en el periodo` },
],
attention: [
{ title: 'Reportes de alta prioridad', description: '5 o más usuarios distintos en 30 días', count: 8, priority: 'Alta', href: '/reports?priority=high', icon: 'flag' },
{ title: 'Verificaciones pendientes', description: 'Negocios esperando una revisión', count: 24, priority: 'Media', href: '/businesses?status=pending', icon: 'shield' },
{ title: 'Reclamaciones por revisar', description: 'Solicitudes de propietarios', count: 12, priority: 'Media', href: '/businesses?claim=pending', icon: 'store' },
{ title: 'Visibilidad próxima a vencer', description: 'Vencen durante los próximos 7 días', count: 36, priority: 'Normal', href: '/businesses?visibility=expiring', icon: 'clock' },
{ title: 'Visibilidad vencida', description: 'Establecimientos sin publicación vigente', count: 58, priority: 'Normal', href: '/businesses?visibility=expired', icon: 'eye' },
],
activity: [
{ id: 'a1', title: 'Nueva solicitud de verificación', context: 'Café Horizonte · Palmira, Colombia', date: '2026-10-07T14:42:00Z', icon: 'shield', href: '/businesses/demo-cafe' },
{ id: 'a2', title: 'Reporte recibido', context: 'Servicio de reparación · Contenido reportado', date: '2026-10-07T14:28:00Z', icon: 'flag', href: '/reports/demo-report' },
{ id: 'a3', title: 'Nuevo negocio registrado', context: 'Taller Nube · Cali, Colombia', date: '2026-10-07T14:15:00Z', icon: 'store', href: '/businesses/demo-taller' },
{ id: 'a4', title: 'Necesidad registrada', context: 'Clases de cerámica · Quito, Ecuador', date: '2026-10-07T13:56:00Z', icon: 'search', href: '/needs' },
{ id: 'a5', title: 'Nuevo usuario registrado', context: 'Usuario de demostración · Palmira, Colombia', date: '2026-10-07T13:40:00Z', icon: 'users', href: '/users/demo-user' },
],
trend: [18, 24, 21, 35, 29, 43, 39, 52, 48, 61, 57, 74].map(n => Math.round(n * scale)),
breakdown: [{ label: 'Visibles', value: 1426, color: '#6D5AE6' }, { label: 'Ocultos', value: 310, color: '#BBB3F4' }, { label: 'Vencidos', value: 58, color: '#F3BB64' }, { label: 'En recuperación', value: 48, color: '#D9DCE5' }],
};
}
export const secondaryMetrics = [{ label: 'Negocios verificados', value: 1318 }, { label: 'Productos publicados', value: 8642 }, { label: 'Servicios publicados', value: 2156 }, { label: 'Reportes pendientes', value: 32 }, { label: 'Necesidades registradas', value: 287 }];
export const searchEntities = [{ name: 'Café Horizonte', type: 'Negocios', href: '/businesses/demo-cafe' }, { name: 'Taller Nube', type: 'Negocios', href: '/businesses/demo-taller' }, { name: 'Usuario de demostración', type: 'Usuarios', href: '/users/demo-user' }, { name: 'Café de origen', type: 'Productos', href: '/content?type=product' }, { name: 'Reparación de bicicletas', type: 'Servicios', href: '/content?type=service' }];
