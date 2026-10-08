export interface ModuleRecord {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusTone?: 'success' | 'media' | 'alta' | 'normal';
  image?: string;
  images?: string[];
  deleted?: boolean;
  deletedAt?: string;
  previousStatus?: string;
  location?: string;
  date?: string;
  meta: string[];
  detail: { label: string; value: string }[];
}

const detail = (values: Record<string, string>) => Object.entries(values).map(([label, value]) => ({ label, value }));
const record = (id: string, title: string, subtitle: string, status: string, meta: string[], values: Record<string, string>, tone?: ModuleRecord['statusTone'], image?: string, images?: string[]): ModuleRecord => ({ id, title, subtitle, status, statusTone: tone, image, images, meta, detail: detail(values) });

export const moduleMocks: Record<string, ModuleRecord[]> = {
  users: [
    record('owner-0', 'Propietario demo 01', 'propietario1@example.test', 'Activo', ['Palmira, Colombia', 'Registro · 19 jun 2026'], { Nombre: 'Propietario demo 01', Correo: 'propietario1@example.test', Teléfono: '+57 000 000 0001', 'Fecha de creación': '19 jun 2026', 'Último acceso': 'Hoy, 08:42', 'Negocios asociados': '1', Reportes: '0' }, 'success'),
    record('user-01', 'Mariana López', 'mariana.lopez@example.test', 'Activo', ['Palmira, Colombia', 'Registro · 12 jun 2026'], { Nombre: 'Mariana López', Correo: 'mariana.lopez@example.test', Teléfono: '+57 000 000 0011', 'Fecha de creación': '12 jun 2026', 'Último acceso': 'Hoy, 09:18', 'Negocios asociados': '1', Reportes: '0' }, 'success'),
    record('user-02', 'Carlos Méndez', 'carlos.mendez@example.test', 'Activo', ['Cali, Colombia', 'Registro · 08 jun 2026'], { Nombre: 'Carlos Méndez', Correo: 'carlos.mendez@example.test', Teléfono: '+57 000 000 0022', 'Fecha de creación': '8 jun 2026', 'Último acceso': 'Ayer, 18:32', 'Negocios asociados': '2', Reportes: '1' }, 'success'),
    record('user-03', 'Sofía Andrade', 'sofia.andrade@example.test', 'Bloqueado', ['Quito, Ecuador', 'Registro · 23 may 2026'], { Nombre: 'Sofía Andrade', Correo: 'sofia.andrade@example.test', Teléfono: '+593 00 000 0033', 'Fecha de creación': '23 may 2026', 'Último acceso': '29 sep 2026', 'Negocios asociados': '0', Reportes: '3' }, 'media'),
    record('user-04', 'Julián Torres', 'julian.torres@example.test', 'Activo', ['Palmira, Colombia', 'Registro · 02 abr 2026'], { Nombre: 'Julián Torres', Correo: 'julian.torres@example.test', Teléfono: '+57 000 000 0044', 'Fecha de creación': '2 abr 2026', 'Último acceso': '06 oct 2026', 'Negocios asociados': '1', Reportes: '0' }, 'success'),
  ],
  content: [
    record('content-01', 'Café de origen', 'Producto · Café Horizonte', 'Activo', ['Negocio · Café Horizonte', 'COP 18.000', '86 me gusta'], { Tipo: 'Producto', Negocio: 'Café Horizonte', Precio: 'COP 18.000', 'Me gusta': '86', Visualizaciones: '284', Reportes: '0' }, 'success', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85', ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85']),
    record('content-02', 'Asesoría personalizada', 'Servicio · Taller Nube', 'Activo', ['Negocio · Taller Nube', 'Precio a convenir', '58 me gusta'], { Tipo: 'Servicio', Negocio: 'Taller Nube', Precio: 'A convenir', 'Me gusta': '58', Interés: '76 contactos', Reportes: '0' }, 'success', 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85'),
    record('content-03', 'Producto de temporada', 'Producto · Casa Semilla', 'Inactivo', ['Negocio · Casa Semilla', 'COP 42.000', '42 me gusta'], { Tipo: 'Producto', Negocio: 'Casa Semilla', Precio: 'COP 42.000', 'Me gusta': '42', Visualizaciones: '91', Reportes: '1' }, 'media', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85'),
    record('content-04', 'Reparación de bicicletas', 'Servicio · Bicicletas Brisa', 'Inactivo', ['Negocio · Bicicletas Brisa', 'Precio a convenir', '31 me gusta'], { Tipo: 'Servicio', Negocio: 'Bicicletas Brisa', Precio: 'A convenir', 'Me gusta': '31', Interés: '34 contactos', Reportes: '5 usuarios distintos' }, 'media', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85'),
  ],
  reviews: [
    record('review-01', 'Información clara y fácil de encontrar.', 'Usuario demo 01 · Café Horizonte', 'Publicada', ['Calificación · 5 / 5', '07 oct 2026'], { Usuario: 'Usuario demo 01', Negocio: 'Café Horizonte', Calificación: '5 / 5', Opinión: 'Información clara y fácil de encontrar.', Reportes: '0', 'Reportado por': 'No reportado por el negocio', 'Motivo del reporte': 'Sin reporte' }, 'success'),
    record('review-02', 'Solo calificación', 'Usuario demo 02 · Café Horizonte', 'Publicada', ['Calificación · 2 / 5', '06 oct 2026'], { Usuario: 'Usuario demo 02', Negocio: 'Café Horizonte', Calificación: '2 / 5', Opinión: 'No dejó opinión escrita.', Reportes: '0', 'Reportado por': 'No reportado por el negocio', 'Motivo del reporte': 'Sin reporte' }, 'success'),
    record('review-03', 'El horario necesita actualización.', 'Usuario demo 03 · Bicicletas Brisa', 'Reportada', ['Sin calificación', '05 oct 2026'], { Usuario: 'Usuario demo 03', Negocio: 'Bicicletas Brisa', Calificación: 'Sin calificación', Opinión: 'El horario publicado necesita una actualización.', Reportes: '1', 'Reportado por': 'Bicicletas Brisa', 'Motivo del reporte': 'Información comercial incorrecta' }, 'media'),
  ],
  reports: [
    record('demo-report', 'La información o el precio son incorrectos', 'Servicio · Reparación de bicicletas', 'Alta prioridad', ['5 usuarios distintos · 30 días', 'Pendiente · 07 oct 2026'], { 'Usuario que reporta': 'Mariana López y 4 usuarios más', Entidad: 'Servicio · Reparación de bicicletas', Negocio: 'Bicicletas Brisa', Tipo: 'Servicio', Motivo: 'La información o el precio son incorrectos', Descripción: 'El horario y el precio publicado no coinciden con la oferta actual.', Prioridad: 'Alta: 5 usuarios diferentes dentro de 30 días', Estado: 'Pendiente', 'Administrador asignado': 'Sin asignar' }, 'alta'),
    record('report-02', 'La imagen no corresponde', 'Producto · Producto de temporada', 'En revisión', ['2 usuarios distintos · 30 días', '06 oct 2026'], { 'Usuario que reporta': 'Carlos Méndez', Entidad: 'Producto · Producto de temporada', Negocio: 'Casa Semilla', Tipo: 'Producto', Motivo: 'La imagen no corresponde', Descripción: 'La fotografía parece mostrar un producto diferente al publicado.', Prioridad: 'Normal', Estado: 'En revisión', 'Administrador asignado': 'Alex Rivera' }, 'media'),
    record('report-03', 'Está duplicado', 'Negocio · La Esquina Verde', 'Resuelto', ['1 usuario · 30 días', '02 oct 2026'], { 'Usuario que reporta': 'Julián Torres', Entidad: 'Negocio · La Esquina Verde', Negocio: 'La Esquina Verde', Tipo: 'Negocio', Motivo: 'Está duplicado', Descripción: 'Se comparó con otro registro del mismo establecimiento.', Prioridad: 'Normal', Estado: 'Resuelto', 'Administrador asignado': 'Alex Rivera' }, 'success'),
  ],
  needs: [
    record('need-01', 'Clases de cerámica', 'Demanda no satisfecha · Quito', 'Abierta', ['18 usuarios interesados', 'Frecuencia · 9 búsquedas'], { Necesidad: 'Clases de cerámica', País: 'Ecuador', Ciudad: 'Quito', Zona: 'Zona centro', Categoría: 'Arte y formación', 'Usuarios interesados': '18', Frecuencia: '9 búsquedas en 30 días' }, 'media'),
    record('need-02', 'Reparación de electrodomésticos', 'Demanda no satisfecha · Cali', 'Abierta', ['27 usuarios interesados', 'Frecuencia · 16 búsquedas'], { Necesidad: 'Reparación de electrodomésticos', País: 'Colombia', Ciudad: 'Cali', Zona: 'Zona norte', Categoría: 'Servicios técnicos', 'Usuarios interesados': '27', Frecuencia: '16 búsquedas en 30 días' }, 'media'),
    record('need-03', 'Flores para evento', 'Demanda no satisfecha · Palmira', 'Analizada', ['11 usuarios interesados', 'Frecuencia · 6 búsquedas'], { Necesidad: 'Flores para evento', País: 'Colombia', Ciudad: 'Palmira', Zona: 'Zona centro', Categoría: 'Hogar y jardín', 'Usuarios interesados': '11', Frecuencia: '6 búsquedas en 30 días' }, 'success'),
  ],
  zones: [
    record('zone-01', 'Palmira', 'Valle del Cauca · Colombia', 'Activa para publicación', ['2.540 negocios', 'Orden · 1'], { País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Palmira', Estado: 'Activa para publicación', 'Negocios registrados': '2.540', 'Orden de activación': '1' }, 'success'),
    record('zone-02', 'Cali', 'Valle del Cauca · Colombia', 'Activa para registros', ['1.842 negocios', 'Orden · 2'], { País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Cali', Estado: 'Activa para registros', 'Negocios registrados': '1.842', 'Orden de activación': '2' }, 'media'),
    record('zone-03', 'Quito', 'Pichincha · Ecuador', 'En preparación', ['0 negocios', 'Orden · 3'], { País: 'Ecuador', Región: 'Pichincha', Ciudad: 'Quito', Estado: 'En preparación', 'Negocios registrados': '0', 'Orden de activación': '3' }, 'normal'),
  ],
  categories: [
    record('cat-01', 'Cafeterías', 'Negocios · Productos · Servicios', 'Activa', ['3 negocios', '124 productos', 'Palmira'], { Nombre: 'Cafeterías', Tipo: 'Negocios, productos y servicios', Estado: 'Activa', País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Palmira', 'Negocios relacionados': '3', 'Productos relacionados': '124', 'Servicios relacionados': '16', 'Fecha de creación': '12 jun 2026', 'Última actualización': '07 oct 2026' }, 'success'),
    record('cat-02', 'Servicios técnicos', 'Negocios · Productos · Servicios', 'Activa', ['3 negocios', '89 servicios', 'Cali'], { Nombre: 'Servicios técnicos', Tipo: 'Negocios, productos y servicios', Estado: 'Activa', País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Cali', 'Negocios relacionados': '3', 'Productos relacionados': '31', 'Servicios relacionados': '89', 'Fecha de creación': '14 jun 2026', 'Última actualización': '07 oct 2026' }, 'success'),
    record('cat-03', 'Arte y formación', 'Negocios · Productos · Servicios', 'Activa', ['2 negocios', '0 productos', 'Quito'], { Nombre: 'Arte y formación', Tipo: 'Negocios, productos y servicios', Estado: 'Activa', País: 'Ecuador', Región: 'Pichincha', Ciudad: 'Quito', 'Negocios relacionados': '2', 'Productos relacionados': '0', 'Servicios relacionados': '7', 'Fecha de creación': '19 jun 2026', 'Última actualización': '07 oct 2026' }, 'success'),
    record('cat-04', 'Hogar y jardín', 'Negocios · Productos · Servicios', 'Activa', ['0 negocios', '0 productos', 'Palmira'], { Nombre: 'Hogar y jardín', Tipo: 'Negocios, productos y servicios', Estado: 'Activa', País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Palmira', 'Negocios relacionados': '0', 'Productos relacionados': '0', 'Servicios relacionados': '0' }, 'normal'),
    record('cat-05', 'Mascotas', 'Negocios · Productos · Servicios', 'Activa', ['0 negocios', '0 productos', 'Cali'], { Nombre: 'Mascotas', Tipo: 'Negocios, productos y servicios', Estado: 'Activa', País: 'Colombia', Región: 'Valle del Cauca', Ciudad: 'Cali', 'Negocios relacionados': '0', 'Productos relacionados': '0', 'Servicios relacionados': '0' }, 'normal'),
  ],
  notifications: [
    record('notification-01', 'Reporte de alta prioridad', 'Bicicletas Brisa · 5 usuarios distintos', 'No leída', ['Hace 24 min', 'Reportes'], { Tipo: 'Reporte de alta prioridad', Entidad: 'Bicicletas Brisa', Fecha: '07 oct 2026, 14:28', Estado: 'No leída' }, 'alta'),
    record('notification-02', 'Verificación pendiente', 'Café Horizonte · Palmira', 'No leída', ['Hace 1 h', 'Negocios'], { Tipo: 'Negocio pendiente de verificación', Entidad: 'Café Horizonte', Fecha: '07 oct 2026, 13:42', Estado: 'No leída' }, 'media'),
    record('notification-03', 'Negocio próximo a vencer', 'Café Sendero · 3 días restantes', 'Leída', ['Ayer', 'Visibilidad'], { Tipo: 'Negocio próximo a vencer', Entidad: 'Café Sendero', Fecha: '06 oct 2026, 09:00', Estado: 'Leída' }, 'normal'),
  ],
  audit: [
    record('audit-01', 'Aprobación de verificación', 'Alex Rivera · Café Horizonte', 'Registrada', ['Hoy, 14:42', 'Negocios'], { Administrador: 'Alex Rivera', Acción: 'Aprobación de verificación', Entidad: 'Café Horizonte', 'Estado anterior': 'Pendiente', 'Estado nuevo': 'Verificado', Motivo: 'Información revisada', Comentario: 'Validación administrativa de demostración.' }, 'success'),
    record('audit-02', 'Reporte asignado', 'Alex Rivera · Bicicletas Brisa', 'Registrada', ['Hoy, 14:31', 'Reportes'], { Administrador: 'Alex Rivera', Acción: 'Asignación de reporte', Entidad: 'Reporte demo-report', 'Estado anterior': 'Pendiente', 'Estado nuevo': 'En revisión', Motivo: 'Priorización manual', Comentario: 'Requiere revisión de contenido.' }, 'success'),
    record('audit-03', 'Cambio de zona', 'Sistema · Cali', 'Registrada', ['Ayer, 11:20', 'Zonas'], { Administrador: 'Sistema de demostración', Acción: 'Cambio de zona', Entidad: 'Cali', 'Estado anterior': 'En preparación', 'Estado nuevo': 'Activa para registros', Motivo: 'Activación operativa', Comentario: 'Cambio ficticio de demostración.' }, 'success'),
  ],
  settings: [
    record('setting-01', 'Días de recuperación', 'Reglas de eliminación', 'Configurado', ['30 días', 'Política de plataforma'], { Configuración: 'Días de recuperación', Valor: '30 días', Alcance: 'Negocios y contenido', 'Última modificación': 'Sistema de demostración' }, 'success'),
    record('setting-02', 'Días de visibilidad', 'Reglas de publicación', 'Configurado', ['90 días', 'Política de plataforma'], { Configuración: 'Días de visibilidad', Valor: '90 días', Alcance: 'Negocios publicados', 'Última modificación': 'Sistema de demostración' }, 'success'),
    record('setting-03', 'Administrador principal', 'Roles y permisos', 'Activo', ['Alex Rivera', 'Administrador principal'], { Configuración: 'Administrador principal', Valor: 'Alex Rivera · admin@example.test', Alcance: 'Todas las funciones permitidas', 'Última modificación': 'Sistema de demostración' }, 'success'),
  ],
};

export const moduleTitles: Record<string, { eyebrow: string; intro: string; singular: string }> = {
  users: { eyebrow: 'CUENTAS DEL ECOSISTEMA', intro: 'Consulta actividad, negocios asociados y estado de cada cuenta.', singular: 'usuario' },
  content: { eyebrow: 'CONTENIDO PUBLICADO', intro: 'Revisa productos y servicios sin convertir WIT en un marketplace.', singular: 'contenido' },
  reviews: { eyebrow: 'CONFIANZA Y OPINIONES', intro: 'Calificaciones y opiniones escritas se moderan como señales independientes.', singular: 'opinión' },
  reports: { eyebrow: 'MODERACIÓN Y REPORTES', intro: 'Los reportes orientan la revisión; ningún contenido se elimina automáticamente.', singular: 'reporte' },
  needs: { eyebrow: 'DEMANDA NO SATISFECHA', intro: 'Analiza búsquedas sin resultados para descubrir oportunidades locales.', singular: 'necesidad' },
  zones: { eyebrow: 'ACTIVACIÓN TERRITORIAL', intro: 'Administra dónde puede registrarse y publicarse WIT.', singular: 'zona' },
  categories: { eyebrow: 'TAXONOMÍA DE WIT', intro: 'Mantén organizadas las categorías usadas por negocios y contenido.', singular: 'categoría' },
  notifications: { eyebrow: 'CENTRO DE AVISOS', intro: 'Revisa alertas administrativas y abre rápidamente la entidad relacionada.', singular: 'notificación' },
  audit: { eyebrow: 'TRAZABILIDAD ADMINISTRATIVA', intro: 'Cada decisión queda registrada con motivo, responsable y estados.', singular: 'registro' },
  settings: { eyebrow: 'REGLAS DE LA PLATAFORMA', intro: 'Consulta los parámetros operativos y la configuración administrativa.', singular: 'configuración' },
};
