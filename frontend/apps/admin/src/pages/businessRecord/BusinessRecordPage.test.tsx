import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRecordPage } from './BusinessRecordPage';
import { ActivityChart } from './Activity';
import { offerPrice } from './Catalog';
import { HistoryTimeline } from './History';
import type { RecordBusiness, RecordOffer } from '../../services/adminBusinessRecord';

const api = vi.hoisted(() => ({ getRecordBusiness: vi.fn(), getRecordHistory: vi.fn(), getRecordCatalog: vi.fn(), setRecordOfferState: vi.fn(), getRecordReviews: vi.fn(), getRecordPhotos: vi.fn(), getRecordActivity: vi.fn(), changeAdminBusinessVisibility: vi.fn(), deleteAdminBusiness: vi.fn(), changeAdminBusinessVerification: vi.fn(), changeAdminBusinessPlan: vi.fn(), listRecordBusinessReports: vi.fn(), getBusinessReportCase: vi.fn() }));
vi.mock('../../services/adminBusinessRecord', () => api);
vi.mock('../../services/adminApiClient', async original => ({ ...await original<typeof import('../../services/adminApiClient')>(), changeAdminBusinessVisibility: api.changeAdminBusinessVisibility, deleteAdminBusiness: api.deleteAdminBusiness, changeAdminBusinessVerification: api.changeAdminBusinessVerification, changeAdminBusinessPlan: api.changeAdminBusinessPlan, listRecordBusinessReports: api.listRecordBusinessReports, getBusinessReportCase: api.getBusinessReportCase }));
vi.mock('../../components/businesses/BusinessRecordPhoto', () => ({ BusinessRecordPhotos: ({ children }: { children: React.ReactNode }) => children, BusinessRecordPhoto: ({ alt }: { alt: string }) => <span data-testid="record-photo">{alt}</span> }));
let role = 'SUPER_ADMIN', permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write'];
vi.mock('../../services/adminService', () => ({ getSession: () => ({ name: 'Administración de prueba', role, permissions }) }));
const pagination = { page: 1, pageSize: 6, total: 1, totalPages: 1 };
const business: RecordBusiness = { id: 'business-1', publicId: 'B-REAL-1', name: 'Establecimiento registrado', description: 'Descripción registrada', coverPhotoId: null, profilePhotoId: null, email: 'contacto@example.invalid', phone: '000', lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', verificationStatus: 'PENDING', deletionStatus: 'NONE', administrativeRestriction: null, administrativePreviousVisibility: null, administrativeRestrictedAt: null, administrativeRestrictionReason: null, isPro: true, completeness: 85, createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z', createdBy: { displayName: 'Cuenta registradora', emailNormalized: null }, memberships: [{ user: { displayName: 'Propietaria registrada', nickname: null } }], _count: { offers: 1, reviews: 1, memberships: 1, reports: 2 }, location: { cityName: 'Palmira', regionName: 'Valle del Cauca', countryCode: 'CO', address: 'Dirección registrada', zoneName: null }, category: { id: 'cat', code: 'tools', translations: [{ locale: 'es', name: 'Ferretería' }] }, record: { version: 1, members: [{ id: 'member-1', role: 'OWNER', status: 'ACTIVE', createdAt: '2026-11-01T12:00:00Z', user: { displayName: 'Propietaria registrada', nickname: null } }], effectiveVisibility: 'VISIBLE', rating: { value: 4, count: 1 }, products: 1, services: 0, referrals: 7, businessPhotos: 0, catalogPhotos: 0, accountStatus: 'ACTIVE', coverPosition: { x: 50, y: 50 }, profilePosition: { x: 50, y: 50 } } };
const offer: RecordOffer = { id: 'offer-1', internalCode: 'P000001', kind: 'PRODUCT', name: 'Producto registrado', description: 'Información comercial registrada', priceAmount: '0', currency: 'COP', priceText: null, negotiable: false, publicationStatus: 'PUBLISHED', administrativeStatus: 'NONE', active: true, deletedAt: null, createdAt: business.createdAt, updatedAt: business.updatedAt, category: business.category, photos: [] };
function setup() { render(<MemoryRouter initialEntries={['/businesses/business-1']}><Routes><Route path="/businesses/:id" element={<BusinessRecordPage/>}/></Routes></MemoryRouter>); }
async function ready() { await screen.findByRole('heading', { name: 'Ficha administrativa del negocio' }); }
describe('Ficha administrativa del negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); role = 'SUPER_ADMIN'; permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write']; api.getRecordBusiness.mockResolvedValue(business); api.getRecordHistory.mockResolvedValue({ history: [], pagination: { ...pagination, total: 0, totalPages: 0 } }); api.getRecordCatalog.mockResolvedValue({ offers: [offer], pagination }); api.setRecordOfferState.mockResolvedValue({ id: offer.id, state: 'INACTIVE', message: 'Cambio registrado en auditoría.' }); api.getRecordReviews.mockResolvedValue({ reviews: [], pagination: { ...pagination, total: 0 } }); api.getRecordPhotos.mockResolvedValue({ photos: [], pagination: { ...pagination, total: 0 } }); api.getRecordActivity.mockResolvedValue({ period: 'last30', timezone: 'America/Bogota',
    start: '2026-10-19T05:00:00Z', end: '2026-11-17T12:00:00Z',
    totals: { views: 8, interactions: 3, offerViews: 0, reviews: 0, products: 0, services: 0 },
    current: { favorites: 7, offerLikes: 13 },
    series: [
      { label: '2026-11-16', views: 0, interactions: 0, offerViews: 0, reviews: 0, products: 0, services: 0 },
      { label: '2026-11-17', views: 8, interactions: 3, offerViews: 0, reviews: 0, products: 0, services: 0 }
    ],
    definition: 'Eventos reales por fecha de Bogotá, con cero para días sin eventos.' }); api.listRecordBusinessReports.mockResolvedValue({ reports: [], summary: { total: 0, pending: 0, reviewing: 0, finalized: 0, resolved: 0, rejected: 0 }, pagination: { ...pagination, total: 0, totalPages: 0 } }); });
  afterEach(cleanup);
  it('no atribuye una actuación a un administrador ficticio cuando falta su identidad', () => { render(<HistoryTimeline entries={[{ id: 'audit-1', action: 'BUSINESS_UPDATED', reason: 'Motivo registrado', comment: null, actor: null, createdAt: business.updatedAt, previousState: null, newState: null }]}/>); expect(screen.getByText('Responsable no disponible')).toBeInTheDocument(); expect(screen.queryByText('Sistema', { exact: true })).not.toBeInTheDocument(); });
  it('no muestra bloques de estado ni detalles vacíos cuando la auditoría antigua no conserva los cambios', () => {
    render(<HistoryTimeline entries={[{
      id: 'legacy-1', action: 'BUSINESS_UPDATED', createdAt: business.updatedAt,
      reason: null, comment: null, actor: { displayName: 'Colaboradora registrada' },
      previousState: null, newState: null,
    }]}/>);
    expect(screen.getByText('El registro original no incluye el detalle del cambio.')).toBeInTheDocument();
    expect(screen.getByText('Colaboradora registrada')).toBeInTheDocument();
    expect(screen.queryByText('No conservado')).not.toBeInTheDocument();
    expect(screen.queryByText('Estado anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin motivo registrado.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ver detalles del registro')).not.toBeInTheDocument();
  });
  it('rescata la descripción histórica que cambió, sin mostrar nombres que no cambiaron', () => {
    render(<HistoryTimeline entries={[{
      id: 'historical-2', action: 'BUSINESS_UPDATED', createdAt: business.updatedAt,
      reason: null, comment: null, actor: null,
      previousState: { name: 'Empresa', description: 'Texto anterior' },
      newState: { name: 'Empresa', description: 'Texto actualizado', changedFields: 'Descripción' },
    }]}/>);
    const transition = screen.getByLabelText('Cambio de Descripción');
    expect(within(transition).getByText('Texto anterior')).toBeInTheDocument();
    expect(within(transition).getByText('Texto actualizado')).toBeInTheDocument();
    expect(screen.getByText('Campos modificados: Descripción')).toBeInTheDocument();
  });
  it('en los detalles antiguos sólo muestra el estado realmente conservado', () => {
    render(<HistoryTimeline entries={[{
      id: 'partial-1', action: 'BUSINESS_MODALITY_CREATED', createdAt: business.updatedAt,
      reason: null, comment: null, actor: null,
      previousState: null, newState: { status: 'ACTIVE' },
    }]}/>);
    fireEvent.click(screen.getByText('Ver detalles del registro'));
    expect(screen.getByText('Datos registrados')).toBeInTheDocument();
    expect(screen.getByText('Estado de modalidad')).toBeInTheDocument();
    expect(screen.queryByText('Estado anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Estado no conservado en este registro.')).not.toBeInTheDocument();
  });
  it('presenta los campos auditados sin inventar valores privados de contacto', () => {
    render(<HistoryTimeline entries={[{
      id: 'new-3', action: 'BUSINESS_UPDATED', createdAt: business.updatedAt,
      reason: null, comment: null, actor: null, previousState: {},
      newState: { changedFields: 'Teléfono, WhatsApp' },
    }]}/>);
    expect(screen.getByText('Campos modificados: Teléfono, WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText('Estado anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Ver detalles del registro')).not.toBeInTheDocument();
  });
  it('impide consultar la ficha sin permiso de negocios', () => { permissions = []; setup(); expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument(); expect(api.getRecordBusiness).not.toHaveBeenCalled(); });
  it('presenta identidad e indicadores procedentes de la respuesta', async () => { setup(); await ready(); expect(screen.getByRole('heading', { name: business.name })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Referidos'); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Business PRO'); expect(screen.getAllByText('Propietaria registrada').length).toBeGreaterThan(0); expect(screen.getAllByRole('tab')).toHaveLength(5); });
  it('muestra el Resumen premium con datos reales y sin el aviso Sobre este resumen', async () => {
    setup(); await ready();
    expect(screen.getByRole('heading', { name: 'Rendimiento en Xamuko' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contenido registrado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Últimas actuaciones administrativas' })).toBeInTheDocument();
    expect(screen.queryByText('Sobre este resumen')).not.toBeInTheDocument();
    expect(screen.queryByText(/Los días sin registros aparecen/)).not.toBeInTheDocument();
    expect(screen.queryByText('Origen e interpretación de los indicadores')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explorar actividad/ })).not.toBeInTheDocument();
    expect(screen.getByText('Todo el historial', { selector: '.bd-summary-period-caption' })).toBeInTheDocument();
    await waitFor(() => expect(api.getRecordActivity).toHaveBeenCalledWith(business.id, 'all'));
    expect(screen.getByRole('combobox', { name: 'Período del resumen' })).toHaveValue('all');
    expect(screen.getByText('Calificación promedio')).toBeInTheDocument();
    expect(screen.getByText('4,0')).toBeInTheDocument();
    expect(screen.getByText('Me gusta')).toBeInTheDocument();
    expect(screen.getByText('Favoritos')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel', { name: 'Resumen' })).getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Fotos')).toBeInTheDocument();
    expect(screen.queryByText('Interacciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Miembros', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Período del resumen' })).toHaveValue('all');
    expect(screen.queryByText('0 · visualizaciones de la ficha')).not.toBeInTheDocument();
    const chart = await screen.findByRole('group', { name: /Visualizaciones de la ficha/ });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: 'Home' });
    await waitFor(() => expect(screen.getByTestId('activity-guide')).toBeInTheDocument());
    expect(chart.querySelector('.bd-overview-tooltip-box')).not.toBeNull();
    expect(chart.querySelector('.bd-overview-tooltip-date')).toHaveTextContent(/nov/i);
    expect(chart.querySelector('path.bd-trend-line')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('0 · visualizaciones de la ficha');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('8 · visualizaciones de la ficha'));
  });
  it('el resumen cambia la temporalidad sin fabricar aumentos ni datos no disponibles', async () => {
    setup(); await ready();
    fireEvent.change(screen.getByRole('combobox', { name: 'Período del resumen' }), { target: { value: 'week' } });
    await waitFor(() => expect(api.getRecordActivity).toHaveBeenCalledWith(business.id, 'week'));
    expect(screen.queryByText(/12 %|18 %/)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  });
  it('oculta los paneles administrativos redundantes y deja el contenido de la pestaña a ancho completo', async () => {
    setup(); await ready();
    expect(screen.queryByText('Estado administrativo')).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones administrativas')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar ficha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar administrativamente' })).not.toBeInTheDocument();
    expect(document.querySelector('.bd-administration')).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Resumen' })).toBeInTheDocument();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toBeEnabled();
    expect(within(cards).getByRole('button', { name: 'Cambiar verificación del negocio' })).toBeEnabled();
    expect(within(cards).getByRole('button', { name: 'Cambiar suscripción del negocio' })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Historial administrativo' }));
    expect(screen.getByRole('tabpanel', { name: 'Historial administrativo' })).toBeInTheDocument();
  });
  it('historial administrativo: filtra por categoría y busca en todo el historial del backend', async () => {
    const event = {
      id: 'entry-1', action: 'ADMIN_OFFER_DEACTIVATED', createdAt: business.updatedAt,
      reason: 'Publicación incumple lineamientos', comment: null,
      actor: { displayName: 'Administradora de prueba' },
      previousState: { offerState: 'ACTIVE' }, newState: { offerState: 'INACTIVE' },
    };
    api.getRecordHistory.mockImplementation(async (_id: string, page: number, filters?: { kind: string; search: string }) => ({
      history: filters?.kind === 'VERIFICATION' ? [] : [event],
      pagination: { page, pageSize: 12, total: filters?.kind === 'VERIFICATION' ? 0 : 1, totalPages: filters?.kind === 'VERIFICATION' ? 0 : 1 },
    }));
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Historial administrativo' }));
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledWith(business.id, 1, { kind: 'ALL', search: '' }));
    const panel = screen.getByRole('tabpanel', { name: 'Historial administrativo' });
    expect(within(panel).getByText('Producto o servicio desactivado por Admin')).toBeInTheDocument();
    expect(within(panel).getByText('Administradora de prueba')).toBeInTheDocument();
    expect(within(panel).getByText('Activo', { selector: '.bd-history-state-pill' })).toBeInTheDocument();
    expect(within(panel).getByText('Desactivado', { selector: '.bd-history-state-pill' })).toBeInTheDocument();
    const filter = within(panel).getByRole('button', { name: 'Productos y servicios' });
    fireEvent.click(filter);
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledWith(business.id, 1, { kind: 'OFFER', search: '' }));
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    const search = within(panel).getByRole('textbox', { name: 'Buscar por actuación o responsable' });
    fireEvent.change(search, { target: { value: 'Administradora' } });
    fireEvent.submit(search.closest('form')!);
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledWith(business.id, 1, { kind: 'OFFER', search: 'Administradora' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Verificación' }));
    await waitFor(() => expect(within(panel).getByText('Sin resultados para esta búsqueda')).toBeInTheDocument());
    expect(api.getRecordHistory).toHaveBeenCalledWith(business.id, 1, { kind: 'VERIFICATION', search: 'Administradora' });
    expect(within(panel).queryByRole('button', { name: /Confirmar|Eliminar|Guardar actuación/ })).not.toBeInTheDocument();
  });

  it('historial administrativo: pagina sin alterar las actuaciones y permite consultar los estados', async () => {
    const event = {
      id: 'entry-2', action: 'ADMIN_BUSINESS_SET_HIDDEN', createdAt: business.updatedAt,
      reason: 'Revisión justificada', comment: 'Actuación registrada',
      actor: { displayName: 'Responsable autorizado' },
      previousState: { visibilityStatus: 'VISIBLE' }, newState: { visibilityStatus: 'HIDDEN' },
    };
    api.getRecordHistory.mockImplementation(async (_id: string, page: number) => ({
      history: [event], pagination: { page, pageSize: 12, total: 15, totalPages: 2 },
    }));
    setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Historial administrativo' }));
    const panel = screen.getByRole('tabpanel', { name: 'Historial administrativo' });
    expect(await within(panel).findByText('Negocio ocultado por Admin')).toBeInTheDocument();
    const details = within(panel).getByText('Ver detalles del registro');
    fireEvent.click(details);
    expect(within(panel).getAllByText('Estado anterior').length).toBeGreaterThan(0);
    expect(within(panel).getByText('Observaciones:')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledWith(business.id, 2, { kind: 'ALL', search: '' }));
    expect(within(panel).getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra únicamente la imagen de perfil en la cabecera sin cartel de fotografía faltante', async () => {
    setup(); await ready();
    const identity = screen.getByRole('region', { name: 'Identificación del establecimiento' });
    const pictures = within(identity).getAllByTestId('record-photo');
    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toHaveTextContent('Perfil de ' + business.name);
    expect(within(identity).queryByText('Sin fotografía registrada')).not.toBeInTheDocument();
    expect(within(identity).queryByText('Portada de ' + business.name)).not.toBeInTheDocument();
    expect(within(identity).queryByText('ID público:', { exact: false })).not.toBeInTheDocument();
    expect(within(identity).queryByRole('button', { name: 'Copiar ID público' })).not.toBeInTheDocument();
    expect(within(identity).getByRole('heading', { name: business.name })).toBeInTheDocument();
    expect(within(identity).getByText('Palmira, Valle del Cauca')).toBeInTheDocument();
  });

  it('presenta Información general en cuatro bloques y mantiene los datos administrativos y miembros', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Información general' }));
    const panel = screen.getByRole('tabpanel', { name: 'Información general' });
    expect(within(panel).getByRole('heading', { name: 'Información comercial' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Ubicación' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Contacto' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Datos administrativos' })).toBeInTheDocument();
    expect(within(panel).getByText('Descripción registrada')).toBeInTheDocument();
    expect(within(panel).getByText('Dirección registrada')).toBeInTheDocument();
    expect(within(panel).getByText('contacto@example.invalid')).toBeInTheDocument();
    expect(within(panel).getByText('B-REAL-1')).toBeInTheDocument();
    expect(within(panel).getByText('Cuenta registradora')).toBeInTheDocument();
    expect(within(panel).getAllByText('Propietaria registrada')).toHaveLength(2);
    expect(within(panel).getByRole('heading', { name: 'Miembros vinculados' })).toBeInTheDocument();
    expect(within(panel).getByText('Vinculado:', { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText('Activo')).toBeInTheDocument();
  });
  it('conserva el acceso al historial sin enlaces a pestañas eliminadas', async () => {
    setup(); await ready();
    const history = screen.getByRole('button', { name: /Ver historial completo/ });
    expect(history).toHaveClass('bd-summary-outline-action');
    expect(history.closest('.bd-summary-history-footer')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Explorar actividad/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver galería/ })).not.toBeInTheDocument();
    fireEvent.click(history);
    expect(screen.getByRole('tab', { name: 'Historial administrativo' })).toHaveAttribute('aria-selected', 'true');
  });
  it('muestra Visible en publicación solamente cuando la ficha está realmente visible', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Información general' }));
    const panel = screen.getByRole('tabpanel', { name: 'Información general' });
    const publication = within(panel).getByText('Estado de publicación').closest('.bd-info-field') as HTMLElement;
    expect(within(publication).getByText('Visible')).toBeInTheDocument();
    expect(within(publication).queryByText('Publicado')).not.toBeInTheDocument();
  });
  it('no confunde una ficha publicada pero oculta con una ficha visible', async () => {
    api.getRecordBusiness.mockResolvedValue({
      ...business, visibilityStatus: 'HIDDEN',
      record: { ...business.record!, effectiveVisibility: 'HIDDEN' }
    });
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Información general' }));
    const panel = screen.getByRole('tabpanel', { name: 'Información general' });
    const publication = within(panel).getByText('Estado de publicación').closest('.bd-info-field') as HTMLElement;
    expect(within(publication).getByText('Publicado (no visible)')).toBeInTheDocument();
    expect(within(publication).queryByText('Visible')).not.toBeInTheDocument();
  });
  it('muestra el número real de referidos y conserva el verde del estado Visible', async () => {
    setup(); await ready();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getByText('Referidos')).toBeInTheDocument();
    expect(within(cards).getByText('7')).toBeInTheDocument();
    expect(within(cards).queryByText('Progreso de la ficha')).not.toBeInTheDocument();
    expect(within(cards).queryByText('85%')).not.toBeInTheDocument();
    const visibility = within(cards).getByRole('button', { name: 'Cambiar visibilidad del negocio' });
    expect(visibility.querySelector('.bd-badge--visible')).toHaveTextContent('Visible');
    const referrals = within(cards).getByRole('article', { name: 'Referidos del negocio' });
    expect(referrals).toHaveTextContent('Referidos');
    expect(referrals).toHaveTextContent('7');
    expect(within(cards).queryByRole('button', { name: 'Consultar referidos del negocio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Referidos del negocio' })).not.toBeInTheDocument();
  });
  it('abre la ficha pública del negocio usando publicId y no su identificador interno', async () => {
    setup(); await ready();
    const link = screen.getByRole('link', { name: 'Ver ficha pública de Establecimiento registrado en Xamuko' });
    expect(link).toHaveAttribute('href', 'https://user.xamuko.com/business/B-REAL-1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.getAttribute('href')).not.toContain('/business/business-1');
  });
  it('evita mostrar cero como si fuera un dato real cuando el API ampliado aún no responde', async () => {
    api.getRecordBusiness.mockResolvedValue({ ...business, record: undefined });
    setup(); await ready();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getByRole('article', { name: 'Referidos del negocio' })).toHaveTextContent('—');
    expect(within(cards).queryByRole('button', { name: 'Consultar referidos del negocio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Referidos del negocio' })).not.toBeInTheDocument();
    expect(screen.queryByText(/La información administrativa ampliada todavía no está disponible/)).not.toBeInTheDocument();
  });
  it('cambiar pestañas conserva la ficha y la consulta del catálogo', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); await screen.findByRole('heading', { name: offer.name }); fireEvent.click(screen.getByRole('tab', { name: 'Información general' })); expect(screen.getByRole('tabpanel', { name: 'Información general' })).toHaveTextContent('Cuenta registradora'); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); expect(api.getRecordBusiness).toHaveBeenCalledTimes(1); expect(api.getRecordCatalog).toHaveBeenCalledTimes(1); expect(screen.getByRole('heading', { name: offer.name })).toBeInTheDocument(); });
  it('el catálogo permite consultar sin modificar la información comercial', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' })); const dialog = await screen.findByRole('dialog', { name: offer.name }); expect(within(dialog).queryByRole('button', { name: /Guardar|Eliminar|Editar/ })).not.toBeInTheDocument(); expect(within(dialog).getByText('Información comercial registrada')).toBeInTheDocument(); expect(offerPrice(offer)).toMatch(/COP.*0/); expect(offerPrice({ ...offer, negotiable: true })).toBe('Precio a convenir'); });
  it('el catálogo utiliza un único filtro Todos, Activos, Desactivados, Eliminados', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' }));
    expect(await screen.findByRole('heading', { name: offer.name })).toBeInTheDocument();
    const filter = screen.getByRole('combobox', { name: 'Estado del catálogo' });
    expect(filter).toHaveValue('ALL');
    expect(within(filter).getAllByRole('option')).toHaveLength(4);
    expect(screen.queryByRole('combobox', { name: 'Activación del catálogo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Publicación del catálogo' })).not.toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'DELETED' } });
    await waitFor(() => expect(api.getRecordCatalog).toHaveBeenCalledWith(business.id,
      expect.objectContaining({ kind: 'PRODUCT', state: 'DELETED', page: 1 })));
  });
  it('tres acciones por producto piden motivo, confirman y refrescan el historial', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' }));
    await screen.findByRole('heading', { name: offer.name });
    expect(screen.getByRole('button', { name: 'Activar ' + offer.name })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desactivar ' + offer.name })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Eliminar ' + offer.name })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar ' + offer.name }));
    const dialog = screen.getByRole('dialog', { name: 'Desactivar publicación' });
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar desactivación' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Decisión administrativa debidamente sustentada.' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(api.setRecordOfferState).toHaveBeenCalledWith(business.id,
      offer.id, 'DEACTIVATE', 'Decisión administrativa debidamente sustentada.'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Desactivar publicación' })).not.toBeInTheDocument());
    expect(api.getRecordCatalog.mock.calls.length).toBeGreaterThan(1);
    expect(api.getRecordHistory.mock.calls.length).toBeGreaterThan(1);
  });
  it('eliminar requiere confirmación y nunca se ofrece al administrador no principal', async () => {
    role = 'ADMIN'; setup(); await ready();
    fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' }));
    await screen.findByRole('heading', { name: offer.name });
    expect(screen.getByRole('button', { name: 'Eliminar ' + offer.name })).toBeDisabled();
    expect(api.setRecordOfferState).not.toHaveBeenCalled();
  });
  it('mantiene solo las cinco pestañas y conserva los permisos del catálogo', async () => {
    permissions = ['business:write']; role = 'ADMIN'; setup(); await ready();
    const names = screen.getAllByRole('tab').map(tab => tab.textContent?.trim());
    expect(names).toEqual(['Resumen', 'Información general', 'Productos y servicios', 'Historial administrativo', 'Reportes']);
    expect(screen.queryByRole('tab', { name: 'Opiniones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Fotografías' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Actividad del negocio' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' }));
    expect(screen.getByRole('heading', { name: 'Catálogo de acceso restringido' })).toBeInTheDocument();
    expect(api.getRecordCatalog).not.toHaveBeenCalled();
    expect(api.getRecordReviews).not.toHaveBeenCalled();
    expect(api.getRecordPhotos).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Ocultar negocio' })).not.toBeInTheDocument();
  });
  it('cancelar una medida desde Visibilidad no escribe y confirmar actualiza el historial', async () => {
    setup(); await ready();
    const openHide = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
      const picker = screen.getByRole('dialog', { name: 'Cambiar visibilidad' });
      fireEvent.click(within(picker).getByRole('button', { name: 'Oculta' }));
    };
    openHide();
    const first = screen.getByRole('dialog', { name: 'Ocultar negocio' });
    expect(within(first).getByRole('button', { name: 'Confirmar ocultamiento' })).toBeDisabled();
    fireEvent.click(within(first).getByRole('button', { name: 'Cancelar' }));
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
    api.changeAdminBusinessVisibility.mockResolvedValue({ message: 'Medida registrada' });
    api.getRecordBusiness.mockResolvedValue({ ...business, administrativeRestriction: null, visibilityStatus: 'HIDDEN', record: { ...business.record, effectiveVisibility: 'HIDDEN' } });
    openHide();
    const confirmation = screen.getByRole('dialog', { name: 'Ocultar negocio' });
    fireEvent.change(within(confirmation).getByLabelText(/Motivo administrativo/), { target: { value: 'Motivo suficiente y registrado' } });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirmar ocultamiento' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Oculta (reversible)'));
    expect(api.changeAdminBusinessVisibility).toHaveBeenCalledWith(business.id, 'SET_HIDDEN', 'Motivo suficiente y registrado');
    expect(api.getRecordBusiness).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledTimes(2));
  });
  it('un negocio eliminado conserva consulta y no ofrece acciones incompatibles', async () => { api.getRecordBusiness.mockResolvedValue({ ...business, deletionStatus: 'DELETED', publicationStatus: 'UNPUBLISHED', isPro: false }); setup(); await ready(); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Eliminado'); expect(screen.queryByRole('button', { name: 'Eliminar administrativamente' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Ocultar negocio' })).not.toBeInTheDocument(); expect(screen.getByRole('tab', { name: 'Historial administrativo' })).toBeInTheDocument(); });
  it('consulta el seguimiento del negocio con cifras reales, filtros y vínculo al expediente específico', async () => {
    const report = {
      id: 'report-1', reason: 'FALSE_INFORMATION', description: 'Información reportada por una persona usuaria',
      status: 'PENDING', decisionNote: null, createdAt: business.updatedAt, updatedAt: business.updatedAt,
      reporter: { displayName: 'Denunciante registrada' },
    };
    api.listRecordBusinessReports.mockResolvedValue({ reports: [report],
      summary: { total: 4, pending: 1, reviewing: 1, finalized: 2, resolved: 1, rejected: 1 },
      pagination });
    api.getBusinessReportCase.mockResolvedValue({ report: {
      ...report, business: { id: business.id, name: business.name, publicId: business.publicId },
    }, history: [{
      id: 'audit-1', action: 'BUSINESS_REPORT_MODERATED', createdAt: business.updatedAt,
      actor: { displayName: 'Administradora de prueba' }, reason: 'Revisión documental',
      previousStatus: 'PENDING', newStatus: 'UNDER_REVIEW',
    }] });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reportes de este negocio' }));
    const panel = screen.getByRole('tabpanel', { name: 'Reportes' });
    expect(await within(panel).findByRole('heading', { name: 'Reportes del negocio' })).toBeInTheDocument();
    expect(within(panel).getByRole('article', { name: 'Reporte: Información falsa' })).toBeInTheDocument();
    expect(within(panel).getByText('Finalizados: 1 resueltos y 1 rechazados. Son decisiones distintas.')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Gestionar reporte/ }))
      .toHaveAttribute('href', '/business-reports?report=report-1');
    expect(api.listRecordBusinessReports).toHaveBeenCalledWith(business.id, 1,
      { status: '', reason: '', q: '', from: '', to: '' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Ver detalle' }));
    expect(await within(panel).findByText('Denunciante registrada')).toBeInTheDocument();
    expect(within(panel).getByText('Revisión documental')).toBeInTheDocument();
    expect(within(panel).getByText('Administradora de prueba')).toBeInTheDocument();
    expect(within(panel).queryByText('Identificador')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Pendientes', pressed: false }));
    await waitFor(() => expect(api.listRecordBusinessReports).toHaveBeenCalledWith(business.id, 1,
      { status: 'PENDING', reason: '', q: '', from: '', to: '' }));
    fireEvent.change(within(panel).getByLabelText('Filtrar por motivo'), { target: { value: 'FALSE_INFORMATION' } });
    await waitFor(() => expect(api.listRecordBusinessReports).toHaveBeenCalledWith(business.id, 1,
      { status: 'PENDING', reason: 'FALSE_INFORMATION', q: '', from: '', to: '' }));
  });
  it('abre las dos opciones y exige un motivo antes de marcar Verificado', async () => {
    api.changeAdminBusinessVerification.mockResolvedValue({ verificationStatus: 'APPROVED', message: 'Negocio verificado' });
    api.getRecordBusiness.mockResolvedValueOnce({ ...business, verificationStatus: 'NONE' }).mockResolvedValueOnce({ ...business, verificationStatus: 'APPROVED' });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar verificación del negocio' }));
    const picker = screen.getByRole('dialog', { name: 'Cambiar verificación' });
    expect(within(picker).getByRole('button', { name: 'Sin verificar' })).toBeDisabled();
    fireEvent.click(within(picker).getByRole('button', { name: 'Verificado' }));
    const dialog = screen.getByRole('dialog', { name: 'Verificar negocio' });
    expect(within(dialog).getByRole('button', { name: 'Confirmar verificación' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Documentación revisada y nombre confirmado' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe VERIFICAR/), { target: { value: 'VERIFICAR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar verificación' }));
    await waitFor(() => expect(api.changeAdminBusinessVerification).toHaveBeenCalledWith(business.id, 'VERIFY', 'Documentación revisada y nombre confirmado', 'VERIFICAR'));
    await waitFor(() => expect(api.getRecordBusiness).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledTimes(2));
  });
  it('permite retirar la verificación con motivo sin modificar la visibilidad', async () => {
    api.changeAdminBusinessVerification.mockResolvedValue({ verificationStatus: 'NONE', message: 'Verificación retirada' });
    api.getRecordBusiness.mockResolvedValueOnce({ ...business, verificationStatus: 'APPROVED' }).mockResolvedValueOnce({ ...business, verificationStatus: 'NONE' });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar verificación del negocio' }));
    const picker = screen.getByRole('dialog', { name: 'Cambiar verificación' });
    expect(within(picker).getByRole('button', { name: 'Verificado' })).toBeDisabled();
    fireEvent.click(within(picker).getByRole('button', { name: 'Sin verificar' }));
    const dialog = screen.getByRole('dialog', { name: 'Retirar verificación' });
    expect(within(dialog).getByRole('button', { name: 'Confirmar sin verificar' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Inconsistencia comprobada en la información registrada' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe SIN VERIFICAR/), { target: { value: 'SIN VERIFICAR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar sin verificar' }));
    await waitFor(() => expect(api.changeAdminBusinessVerification).toHaveBeenCalledWith(business.id, 'UNVERIFY', 'Inconsistencia comprobada en la información registrada', 'SIN VERIFICAR'));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Sin verificar'));
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('cancelar la verificación no escribe un cambio administrativo', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar verificación del negocio' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cambiar verificación' })).getByRole('button', { name: 'Verificado' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Verificar negocio' })).getByRole('button', { name: 'Cancelar' }));
    expect(api.changeAdminBusinessVerification).not.toHaveBeenCalled();
  });
  it('solicita confirmación al cambiar el plan del negocio', async () => {
    api.changeAdminBusinessPlan.mockResolvedValue({ plan: 'BASIC', message: 'Plan actualizado' });
    api.getRecordBusiness.mockResolvedValueOnce(business).mockResolvedValueOnce({ ...business, isPro: false });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar suscripción del negocio' }));
    const picker = screen.getByRole('dialog', { name: 'Cambiar suscripción' });
    expect(within(picker).getByRole('button', { name: 'Business PRO' })).toBeDisabled();
    fireEvent.click(within(picker).getByRole('button', { name: 'Básico' }));
    const dialog = screen.getByRole('dialog', { name: 'Administrar suscripción' });
    expect(within(dialog).getByText(/revocará el acceso PRO/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Se acordó regresar al plan básico' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe BASIC/), { target: { value: 'BASIC' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cambio de plan' }));
    await waitFor(() => expect(api.changeAdminBusinessPlan).toHaveBeenCalledWith(business.id, 'BASIC', 'Se acordó regresar al plan básico', 'BASIC'));
    await waitFor(() => expect(api.getRecordBusiness).toHaveBeenCalledTimes(2));
  });
  it('asigna Business PRO desde Básico y actualiza el indicador', async () => {
    api.changeAdminBusinessPlan.mockResolvedValue({ plan: 'PRO', message: 'Plan actualizado' });
    api.getRecordBusiness.mockResolvedValueOnce({ ...business, isPro: false }).mockResolvedValueOnce({ ...business, isPro: true });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar suscripción del negocio' }));
    const picker = screen.getByRole('dialog', { name: 'Cambiar suscripción' });
    expect(within(picker).getByRole('button', { name: 'Básico' })).toBeDisabled();
    fireEvent.click(within(picker).getByRole('button', { name: 'Business PRO' }));
    const dialog = screen.getByRole('dialog', { name: 'Administrar suscripción' });
    expect(within(dialog).getByText(/activa Business PRO sin generar un cobro/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Asignación administrativa por evaluación registrada' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe PRO/), { target: { value: 'PRO' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cambio de plan' }));
    await waitFor(() => expect(api.changeAdminBusinessPlan).toHaveBeenCalledWith(business.id, 'PRO', 'Asignación administrativa por evaluación registrada', 'PRO'));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Business PRO'));
  });
  it('cancelar un cambio de suscripción no modifica el plan', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar suscripción del negocio' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cambiar suscripción' })).getByRole('button', { name: 'Básico' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Administrar suscripción' })).getByRole('button', { name: 'Cancelar' }));
    expect(api.changeAdminBusinessPlan).not.toHaveBeenCalled();
  });
  it('abre las opciones de la tarjeta aunque el backend no incluya la ficha ampliada', async () => {
    api.getRecordBusiness.mockResolvedValue({ ...business, record: undefined });
    setup(); await ready();
    expect(screen.queryByText(/información administrativa ampliada todavía no está disponible/)).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' });
    expect(card).toBeEnabled();
    fireEvent.click(card);
    const modal = screen.getByRole('dialog', { name: 'Cambiar visibilidad' });
    expect(within(modal).getByRole('button', { name: 'Visible' })).toBeDisabled();
    expect(within(modal).getByRole('button', { name: 'Oculta' })).toBeEnabled();
    expect(within(modal).getByRole('button', { name: 'Suspendida' })).toBeEnabled();
  });
  it('requiere confirmar un cambio de visibilidad incluso cuando falta la información ampliada', async () => {
    api.getRecordBusiness.mockResolvedValue({ ...business, record: undefined });
    api.changeAdminBusinessVisibility.mockResolvedValue({ message: 'Negocio ocultado', visibilityStatus: 'HIDDEN', administrativeRestriction: null });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cambiar visibilidad' })).getByRole('button', { name: 'Oculta' }));
    const confirmation = screen.getByRole('dialog', { name: 'Ocultar negocio' });
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
    fireEvent.change(within(confirmation).getByLabelText(/Motivo administrativo/), {
      target: { value: 'Ocultamiento administrativo solicitado con revisión previa' },
    });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirmar ocultamiento' }));
    await waitFor(() => expect(api.changeAdminBusinessVisibility).toHaveBeenCalledWith(
      business.id, 'SET_HIDDEN', 'Ocultamiento administrativo solicitado con revisión previa',
    ));
    expect(await screen.findByText('Negocio ocultado')).toBeInTheDocument();
  });
  it('no habilita la tarjeta si la cuenta no es SUPER_ADMIN, aunque falte la información ampliada', async () => {
    role = 'ADMIN';
    api.getRecordBusiness.mockResolvedValue({ ...business, record: undefined });
    setup(); await ready();
    expect(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toBeDisabled();
  });
  it('abre sobre la ficha las tres opciones diferenciadas, sin aplicar cambios automáticamente', async () => {
    setup(); await ready();
    const card = screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' });
    expect(card).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
    const picker = screen.getByRole('dialog', { name: 'Cambiar visibilidad' });
    expect(within(picker).getByRole('button', { name: 'Visible' })).toBeDisabled();
    expect(within(picker).getByRole('button', { name: 'Oculta' })).toBeEnabled();
    expect(within(picker).getByRole('button', { name: 'Suspendida' })).toBeEnabled();
    expect(within(picker).getByText(/propietario puede volver a mostrarlo/)).toBeInTheDocument();
    expect(within(picker).getByText(/Solo XAMUKO Admin/i)).toBeInTheDocument();
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('seleccionar Oculta abre un segundo paso de confirmación y no cambia el estado hasta justificarlo', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cambiar visibilidad' }))
      .getByRole('button', { name: 'Oculta' }));
    expect(screen.queryByRole('dialog', { name: 'Cambiar visibilidad' })).not.toBeInTheDocument();
    const confirmation = screen.getByRole('dialog', { name: 'Ocultar negocio' });
    expect(within(confirmation).getByRole('button', { name: 'Confirmar ocultamiento' })).toBeDisabled();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancelar' }));
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('seleccionar Suspendida abre la confirmación exclusiva de Admin', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cambiar visibilidad' }))
      .getByRole('button', { name: 'Suspendida' }));
    expect(screen.getByRole('dialog', { name: 'Suspender negocio' })).toBeInTheDocument();
    expect(screen.getByText(/no podrá renovar, activar ni volver a publicar/)).toBeInTheDocument();
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('las cuentas sin autorización administrativa no pueden abrir ni modificar la visibilidad', async () => {
    role = 'ADMIN';
    setup(); await ready();
    expect(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: 'Cambiar visibilidad' })).not.toBeInTheDocument();
  });
  it('centra los indicadores y presenta Referidos como cifra sin botón', async () => {
    setup(); await ready();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getAllByRole('button')).toHaveLength(4);
    expect(within(cards).getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Cambiar verificación del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Cambiar suscripción del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Consultar reportes de este negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('article', { name: 'Referidos del negocio' })).toHaveTextContent('7');
    expect(within(cards).queryByRole('button', { name: 'Consultar referidos del negocio' })).not.toBeInTheDocument();
  });
  it('permite cerrar el selector de visibilidad con Escape sin cambiar el negocio', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    expect(screen.getByRole('dialog', { name: 'Cambiar visibilidad' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Cambiar visibilidad' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toHaveAttribute('aria-expanded', 'false');
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('un fallo del backend no presenta una ficha ficticia', async () => { api.getRecordBusiness.mockRejectedValue(new Error('No disponible temporalmente')); setup(); expect(await screen.findByRole('heading', { name: 'No pudimos abrir la ficha' })).toBeInTheDocument(); expect(screen.queryByText('85%')).not.toBeInTheDocument(); expect(screen.getByText('No disponible temporalmente')).toBeInTheDocument(); });
  it('la gráfica permite consultar un intervalo con cero mediante teclado', () => { const row = { views: 2, interactions: 0, offerViews: 0, reviews: 0, products: 0, services: 0 }; render(<ActivityChart metric="views" data={{ period: 'month', timezone: 'America/Bogota', start: business.createdAt, end: business.updatedAt, totals: row, definition: 'Eventos registrados', series: [{ label: '2026-11-01', ...row }, { label: '2026-11-02', ...row, views: 0 }] }}/>); const chart = screen.getByRole('group', { name: /Visualizaciones de la ficha/ }); fireEvent.focus(chart); fireEvent.keyDown(chart, { key: 'ArrowRight' }); expect(screen.getByTestId('activity-guide')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('0 · visualizaciones de la ficha'); });
});
