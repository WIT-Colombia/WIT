import type { BusinessStatus, ManagedBusiness } from '../types/business';
import { BUSINESS_RECOVERY_DAYS, BUSINESS_VISIBILITY_DAYS } from '../services/visibilityPolicy';
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();
const seeds: { id: string; name: string; category: string; city: string; status: BusinessStatus; days: number }[] = [
  { id: 'demo-cafe', name: 'La Arepería de Majo', category: 'Restaurantes', city: 'Palmira', status: 'pending', days: 28 },
  { id: 'demo-taller', name: 'Droguería San Jorge', category: 'Droguerías', city: 'Palmira', status: 'verified', days: 5 },
  { id: 'b3', name: 'Casa del Tornillo', category: 'Ferreterías', city: 'Palmira', status: 'verified', days: 65 },
  { id: 'b4', name: 'Distrito 23 Barbería', category: 'Barberías', city: 'Palmira', status: 'expired', days: -3 },
  { id: 'b5', name: 'Moto Express Palmira', category: 'Talleres', city: 'Palmira', status: 'verified', days: 41 },
  { id: 'b6', name: 'TecnoPalmira', category: 'Tecnología', city: 'Palmira', status: 'pending', days: 30 },
  { id: 'b7', name: 'Casa Semilla', category: 'Hogar y jardín', city: 'Cali', status: 'hidden', days: 12 },
  { id: 'b8', name: 'Panadería Aurora', category: 'Panaderías', city: 'Palmira', status: 'recovery', days: 20 },
  { id: 'b9', name: 'Luz de Barrio', category: 'Hogar y jardín', city: 'Quito', status: 'draft', days: 0 },
  { id: 'b10', name: 'Mercado del Sol', category: 'Comercio local', city: 'Cali', status: 'rejected', days: 0 },
  { id: 'b11', name: 'Café Sendero', category: 'Cafeterías', city: 'Palmira', status: 'verified', days: 3 },
  { id: 'b12', name: 'Estudio Lino', category: 'Arte y formación', city: 'Quito', status: 'verified', days: 92 },
  { id: 'b13', name: 'Flor de Ciudad', category: 'Hogar y jardín', city: 'Cali', status: 'recovery', days: -2 },
  { id: 'b14', name: 'Archivo del Barrio', category: 'Papelerías', city: 'Palmira', status: 'deleted', days: -30 },
];
const publicInfo: Record<string, { description: string; address: string; tags: string[]; phone: string; whatsapp: string; email: string; website: string; instagram: string; isOpen: boolean; rating: number; reviewCount: number; image?: string }> = {
  'demo-cafe': { description: 'Arepas hechas al momento y sabores de casa para empezar bien el día.', address: 'Calle 30 # 28-16, Palmira', tags: ['Comida típica', 'Desayunos'], phone: '+57 000 000 0003', whatsapp: '+57 000 000 0003', email: '', website: '', instagram: '', isOpen: true, rating: 4.8, reviewCount: 126, image: 'https://images.unsplash.com/photo-1598214886806-c87b84b7078b?auto=format&fit=crop&w=900&q=85' },
  'demo-taller': { description: 'Un lugar cercano para encontrar productos de cuidado personal y bienestar.', address: 'Carrera 29 # 31-42, Palmira', tags: ['Salud', 'Cuidado personal'], phone: '+57 000 000 0000', whatsapp: '+57 000 000 0000', email: '', website: '', instagram: '', isOpen: true, rating: 4.7, reviewCount: 84, image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=900&q=85' },
  b3: { description: 'Herramientas y soluciones para esos arreglos que tienes pendientes.', address: 'Calle 32 # 25-08, Palmira', tags: ['Herramientas', 'Construcción'], phone: '+57 000 000 0000', whatsapp: '+57 000 000 0000', email: '', website: '', instagram: '', isOpen: true, rating: 4.6, reviewCount: 53, image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=85' },
  b4: { description: 'Cortes y cuidado personal en un espacio pensado para hacer una pausa.', address: 'Carrera 31 # 27-23, Palmira', tags: ['Barbería', 'Cuidado personal'], phone: '+57 000 000 0000', whatsapp: '+57 000 000 0000', email: '', website: '', instagram: '', isOpen: true, rating: 4.9, reviewCount: 91, image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85' },
  b5: { description: 'Mantenimiento general para que sigas tu camino con tranquilidad.', address: 'Calle 42 # 19-35, Palmira', tags: ['Motos', 'Mantenimiento'], phone: '+57 000 000 0001', whatsapp: '+57 000 000 0001', email: '', website: '', instagram: '', isOpen: false, rating: 4.5, reviewCount: 47, image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85' },
  b6: { description: 'Accesorios y ayuda para mantener conectados tus dispositivos.', address: 'Carrera 28 # 35-10, Palmira', tags: ['Celulares', 'Accesorios'], phone: '+57 000 000 0000', whatsapp: '+57 000 000 0000', email: '', website: '', instagram: '', isOpen: true, rating: 4.6, reviewCount: 62, image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=900&q=85' },
};
export function createBusinessMocks(): ManagedBusiness[] {
  return seeds.map((seed, index) => {
    const foreign = seed.city === 'Quito';
    const info = publicInfo[seed.id];
    const applicant = { id: `owner-${index}`, name: `Propietario demo ${String(index + 1).padStart(2, '0')}`, email: `propietario${index + 1}@example.test` };
    const published = ['verified', 'hidden', 'expired', 'recovery'].includes(seed.status);
    const visibility = seed.status === 'verified' ? 'visible' : seed.status === 'hidden' ? 'hidden' : seed.status === 'expired' ? 'expired' : seed.status === 'recovery' ? 'recovery' : seed.status === 'pending' ? 'review' : 'unpublished';
    const deletionOffset = seed.id === 'b13' ? -29 : seed.id === 'b14' ? -40 : -10;
    return {
      ...seed, ownerId: applicant.id, owner: applicant, createdBy: applicant,
      claimant: seed.status === 'pending' ? { ...applicant, discrepancy: seed.id === 'b6' } : undefined,
      claimStatus: seed.id === 'b6' ? 'review' : seed.status === 'pending' ? 'pending' : published ? 'verified' : 'unclaimed',
      verification: { status: seed.status === 'pending' ? 'pending' : seed.status === 'rejected' ? 'rejected' : published ? 'approved' : 'none', requestedAt: seed.status !== 'draft' ? day(-6 - index) : undefined },
      location: { country: foreign ? 'Ecuador' : 'Colombia', region: foreign ? 'Pichincha' : 'Valle del Cauca', city: seed.city, zone: index % 2 ? 'Zona norte' : 'Zona centro' },
      tags: info?.tags ?? ['Oferta local', 'Información por completar'],
      description: info?.description ?? `${seed.name} es un establecimiento ficticio de ${seed.category.toLowerCase()} para demostrar la supervisión de negocios en WIT. Conecta a la comunidad con su oferta local.`,
      address: info?.address ?? `Dirección de demostración ${index + 1} · Zona ${index % 2 ? 'norte' : 'centro'}`,
      coordinates: { latitude: foreign ? -.18 : 3.54, longitude: foreign ? -78.46 : -76.3 },
      phone: info?.phone ?? (foreign ? '+593 00 000 0000' : '+57 000 000 0000'), whatsapp: info?.whatsapp ?? (foreign ? '+593 00 000 0000' : '+57 000 000 0000'), email: info?.email ?? '', website: info?.website ?? '', instagram: info?.instagram ?? '', isOpen: info?.isOpen ?? false, rating: info?.rating, reviewCount: info?.reviewCount ?? 0,
      hours: [{ days: 'Lunes a viernes', time: '08:00 – 18:00' }, { days: 'Sábado', time: '09:00 – 14:00' }, { days: 'Domingo', time: 'Cerrado' }],
      // Admin reads this collection from the WIT Negocios media store. No placeholder
      // or admin-created image is included in the first-stage mock.
      photos: info?.image ? [{ id: `${seed.id}-cover`, title: 'Portada', source: 'negocios', url: info.image, uploadedAt: day(-35) }] : [],
      // Cada establecimiento usa un periodo de 40 días. Los días de la semilla
      // representan cuánto falta para vencer; se limita a 40 para conservar la regla.
      visibility: { status: visibility, startsAt: published ? day(Math.min(seed.days, BUSINESS_VISIBILITY_DAYS) - BUSINESS_VISIBILITY_DAYS) : undefined, expiresAt: published ? day(Math.min(seed.days, BUSINESS_VISIBILITY_DAYS)) : undefined, renewal: seed.status === 'expired' ? 'pending' : 'none', history: [] },
      deletion: ['recovery', 'deleted'].includes(seed.status) ? { deletedAt: day(deletionOffset), recoverUntil: day(deletionOffset + BUSINESS_RECOVERY_DAYS), responsible: applicant.name, reason: 'Solicitud del propietario (demostración)', previousStatus: 'verified', previousVisibility: 'visible' } : undefined,
      createdAt: day(-110 + index * 3), updatedAt: day(-index % 5), completeness: seed.status === 'draft' ? 42 : 72 + index % 5 * 6,
      content: [
        { id: `${seed.id}-p1`, name: seed.id === 'demo-cafe' ? 'Arepa con queso' : seed.category === 'Cafeterías' ? 'Café de origen' : 'Producto principal', kind: 'product', price: foreign ? 8 : 18000, currency: foreign ? 'USD' : 'COP', negotiable: false, active: true, image: info?.image },
        { id: `${seed.id}-p2`, name: seed.id === 'demo-cafe' ? 'Desayuno campesino' : 'Producto de temporada', kind: 'product', currency: foreign ? 'USD' : 'COP', negotiable: true, active: true, image: info?.image },
        { id: `${seed.id}-s1`, name: seed.id === 'demo-cafe' ? 'Pedidos para recoger' : 'Asesoría personalizada', kind: 'service', currency: foreign ? 'USD' : 'COP', negotiable: true, active: true, image: info?.image },
      ],
      opinions: [
        { id: `${seed.id}-o1`, user: 'Usuario demo 01', rating: 5, text: 'Información clara y fácil de encontrar.', createdAt: day(-4), reported: false },
        { id: `${seed.id}-o2`, user: 'Usuario demo 02', rating: 4, createdAt: day(-3), reported: false },
        { id: `${seed.id}-o3`, user: 'Usuario demo 03', text: 'El horario publicado necesita una actualización.', createdAt: day(-2), reported: seed.id === 'b6' },
      ],
      reports: index % 3 === 0 ? [{ id: seed.id === 'demo-cafe' ? 'demo-report' : `${seed.id}-report`, reason: 'Información comercial incorrecta', distinctUsers: index === 3 ? 5 : 2, createdAt: day(-2), status: 'Pendiente' }] : [],
      audit: [{ id: `${seed.id}-audit`, adminId: 'system-demo', adminName: 'Sistema', action: 'Registro del negocio', entityId: seed.id, previousState: 'Sin registro', newState: seed.status, createdAt: day(-110 + index * 3), reason: 'Registro inicial' }],
    };
  });
}
