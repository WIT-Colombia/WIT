import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRecordPage } from './BusinessRecordPage';
import { ActivityChart } from './Activity';
import { offerPrice } from './Catalog';
import { HistoryTimeline } from './History';
import type { RecordBusiness, RecordOffer } from '../../services/adminBusinessRecord';

const api = vi.hoisted(() => ({ getRecordBusiness: vi.fn(), getRecordHistory: vi.fn(), getRecordCatalog: vi.fn(), getRecordReviews: vi.fn(), getRecordPhotos: vi.fn(), getRecordActivity: vi.fn(), changeAdminBusinessVisibility: vi.fn(), deleteAdminBusiness: vi.fn(), changeAdminBusinessVerification: vi.fn(), changeAdminBusinessPlan: vi.fn(), listRecordBusinessReports: vi.fn() }));
vi.mock('../../services/adminBusinessRecord', () => api);
vi.mock('../../services/adminApiClient', async original => ({ ...await original<typeof import('../../services/adminApiClient')>(), changeAdminBusinessVisibility: api.changeAdminBusinessVisibility, deleteAdminBusiness: api.deleteAdminBusiness, changeAdminBusinessVerification: api.changeAdminBusinessVerification, changeAdminBusinessPlan: api.changeAdminBusinessPlan, listRecordBusinessReports: api.listRecordBusinessReports }));
vi.mock('../../components/businesses/BusinessRecordPhoto', () => ({ BusinessRecordPhotos: ({ children }: { children: React.ReactNode }) => children, BusinessRecordPhoto: ({ alt }: { alt: string }) => <span data-testid="record-photo">{alt}</span> }));
let role = 'SUPER_ADMIN', permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write'];
vi.mock('../../services/adminService', () => ({ getSession: () => ({ name: 'Administración de prueba', role, permissions }) }));
const pagination = { page: 1, pageSize: 6, total: 1, totalPages: 1 };
const business: RecordBusiness = { id: 'business-1', publicId: 'B-REAL-1', name: 'Establecimiento registrado', description: 'Descripción registrada', coverPhotoId: null, profilePhotoId: null, email: 'contacto@example.invalid', phone: '000', lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', verificationStatus: 'PENDING', deletionStatus: 'NONE', administrativeRestriction: null, administrativePreviousVisibility: null, administrativeRestrictedAt: null, administrativeRestrictionReason: null, isPro: true, completeness: 85, createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z', createdBy: { displayName: 'Cuenta registradora', emailNormalized: null }, memberships: [{ user: { displayName: 'Propietaria registrada', nickname: null } }], _count: { offers: 1, reviews: 1, memberships: 1, reports: 2 }, location: { cityName: 'Palmira', regionName: 'Valle del Cauca', countryCode: 'CO', address: 'Dirección registrada', zoneName: null }, category: { id: 'cat', code: 'tools', translations: [{ locale: 'es', name: 'Ferretería' }] }, record: { version: 1, members: [{ id: 'member-1', role: 'OWNER', status: 'ACTIVE', createdAt: '2026-11-01T12:00:00Z', user: { displayName: 'Propietaria registrada', nickname: null } }], effectiveVisibility: 'VISIBLE', rating: { value: 4, count: 1 }, products: 1, services: 0, businessPhotos: 0, catalogPhotos: 0, accountStatus: 'ACTIVE', coverPosition: { x: 50, y: 50 }, profilePosition: { x: 50, y: 50 } } };
const offer: RecordOffer = { id: 'offer-1', internalCode: 'P000001', kind: 'PRODUCT', name: 'Producto registrado', description: 'Información comercial registrada', priceAmount: '0', currency: 'COP', priceText: null, negotiable: false, publicationStatus: 'PUBLISHED', administrativeStatus: 'NONE', active: true, deletedAt: null, createdAt: business.createdAt, updatedAt: business.updatedAt, category: business.category, photos: [] };
function setup() { render(<MemoryRouter initialEntries={['/businesses/business-1']}><Routes><Route path="/businesses/:id" element={<BusinessRecordPage/>}/></Routes></MemoryRouter>); }
async function ready() { await screen.findByRole('heading', { name: 'Ficha administrativa del negocio' }); }
describe('Ficha administrativa del negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); role = 'SUPER_ADMIN'; permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write']; api.getRecordBusiness.mockResolvedValue(business); api.getRecordHistory.mockResolvedValue({ history: [], pagination: { ...pagination, total: 0, totalPages: 0 } }); api.getRecordCatalog.mockResolvedValue({ offers: [offer], pagination }); api.getRecordReviews.mockResolvedValue({ reviews: [], pagination: { ...pagination, total: 0 } }); api.getRecordPhotos.mockResolvedValue({ photos: [], pagination: { ...pagination, total: 0 } }); api.getRecordActivity.mockResolvedValue({ period: 'last30', timezone: 'America/Bogota',
    start: '2026-10-19T05:00:00Z', end: '2026-11-17T12:00:00Z',
    totals: { views: 8, interactions: 3, offerViews: 0, reviews: 0, products: 0, services: 0 },
    current: { favorites: 7, offerLikes: 13 },
    series: [
      { label: '2026-11-16', views: 0, interactions: 0, offerViews: 0, reviews: 0, products: 0, services: 0 },
      { label: '2026-11-17', views: 8, interactions: 3, offerViews: 0, reviews: 0, products: 0, services: 0 }
    ],
    definition: 'Eventos reales por fecha de Bogotá, con cero para días sin eventos.' }); api.listRecordBusinessReports.mockResolvedValue({ reports: [], pagination: { ...pagination, total: 0, totalPages: 0 } }); });
  afterEach(cleanup);
  it('no atribuye una actuación a un administrador ficticio cuando falta su identidad', () => { render(<HistoryTimeline entries={[{ id: 'audit-1', action: 'BUSINESS_UPDATED', reason: 'Motivo registrado', comment: null, actor: null, createdAt: business.updatedAt, previousState: null, newState: null }]}/>); expect(screen.getByText('Responsable no disponible')).toBeInTheDocument(); expect(screen.queryByText('Sistema', { exact: true })).not.toBeInTheDocument(); });
  it('impide consultar la ficha sin permiso de negocios', () => { permissions = []; setup(); expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument(); expect(api.getRecordBusiness).not.toHaveBeenCalled(); });
  it('presenta identidad e indicadores procedentes de la respuesta', async () => { setup(); await ready(); expect(screen.getByRole('heading', { name: business.name })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('85%'); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Business PRO'); expect(screen.getAllByText('Propietaria registrada').length).toBeGreaterThan(0); expect(screen.getAllByRole('tab')).toHaveLength(8); });
  it('muestra el Resumen premium con datos reales y sin el aviso Sobre este resumen', async () => {
    setup(); await ready();
    expect(screen.getByRole('heading', { name: 'Rendimiento en Xamuko' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contenido registrado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Últimas actuaciones administrativas' })).toBeInTheDocument();
    expect(screen.queryByText('Sobre este resumen')).not.toBeInTheDocument();
    expect(screen.queryByText(/Los días sin registros aparecen/)).not.toBeInTheDocument();
    expect(screen.queryByText('Origen e interpretación de los indicadores')).not.toBeInTheDocument();
    const exploreActivity = screen.getByRole('button', { name: /Explorar actividad/ });
    expect(exploreActivity).toHaveClass('bd-summary-text-link');
    expect(exploreActivity.closest('.bd-summary-plot')).not.toBeNull();
    expect(exploreActivity).toBeInTheDocument();
    expect(screen.getByText('Todo el historial', { selector: '.bd-summary-period-caption' })).toBeInTheDocument();
    await waitFor(() => expect(api.getRecordActivity).toHaveBeenCalledWith(business.id, 'all'));
    expect(screen.getByRole('combobox', { name: 'Período del resumen' })).toHaveValue('all');
    expect(screen.getByText('Calificación promedio')).toBeInTheDocument();
    expect(screen.getByText('4,0')).toBeInTheDocument();
    expect(screen.getByText('Me gusta')).toBeInTheDocument();
    expect(screen.getByText('Favoritos')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Explorar actividad/ }));
    expect(screen.getByRole('tab', { name: 'Actividad del negocio' })).toHaveAttribute('aria-selected', 'true');
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
  it('usa el mismo estilo para Explorar actividad y Ver historial completo', async () => {
    setup(); await ready();
    const explore = screen.getByRole('button', { name: /Explorar actividad/ });
    const history = screen.getByRole('button', { name: /Ver historial completo/ });
    expect(explore).toHaveClass('bd-summary-outline-action');
    expect(history).toHaveClass('bd-summary-outline-action');
    expect(explore.closest('.bd-summary')).toBe(history.closest('.bd-summary'));
    expect(screen.getByRole('heading', { name: 'Últimas actuaciones administrativas' }).closest('header')?.querySelector('button')).toBeNull();
    expect(history.closest('.bd-summary-history-footer')).not.toBeNull();
    expect(explore.closest('.bd-summary-chart-footer')).not.toBeNull();
    fireEvent.click(history);
    expect(screen.getByRole('tab', { name: 'Historial administrativo' })).toHaveAttribute('aria-selected', 'true');
  });
  it('cambiar pestañas conserva la ficha y la consulta del catálogo', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); await screen.findByRole('heading', { name: offer.name }); fireEvent.click(screen.getByRole('tab', { name: 'Información general' })); expect(screen.getByRole('tabpanel', { name: 'Información general' })).toHaveTextContent('Cuenta registradora'); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); expect(api.getRecordBusiness).toHaveBeenCalledTimes(1); expect(api.getRecordCatalog).toHaveBeenCalledTimes(1); expect(screen.getByRole('heading', { name: offer.name })).toBeInTheDocument(); });
  it('el catálogo permite consultar sin modificar la información comercial', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' })); const dialog = await screen.findByRole('dialog', { name: offer.name }); expect(within(dialog).queryByRole('button', { name: /Guardar|Eliminar|Editar/ })).not.toBeInTheDocument(); expect(within(dialog).getByText('Información comercial registrada')).toBeInTheDocument(); expect(offerPrice(offer)).toMatch(/COP.*0/); expect(offerPrice({ ...offer, negotiable: true })).toBe('Precio a convenir'); });
  it('respeta los permisos separados de catálogo y opiniones', async () => { permissions = ['business:write']; role = 'ADMIN'; setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); expect(screen.getByRole('heading', { name: 'Catálogo de acceso restringido' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Opiniones' })); expect(screen.getByRole('heading', { name: 'Opiniones de acceso restringido' })).toBeInTheDocument(); expect(api.getRecordCatalog).not.toHaveBeenCalled(); expect(api.getRecordReviews).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Ocultar negocio' })).not.toBeInTheDocument(); });
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
  it('permite consultar reportes desde el indicador sin salir de la ficha', async () => {
    api.listRecordBusinessReports.mockResolvedValue({ reports: [{
      id: 'report-1', reason: 'FALSE_INFORMATION', description: 'Información reportada por una persona usuaria',
      status: 'PENDING', decisionNote: null, createdAt: business.updatedAt, updatedAt: business.updatedAt,
      reporter: { displayName: 'Denunciante registrada' },
    }], pagination });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reportes de este negocio' }));
    expect(await screen.findByRole('heading', { name: 'Reportes del negocio' })).toBeInTheDocument();
    expect(screen.getByText('Información falsa')).toBeInTheDocument();
    expect(screen.getByText('Denunciante registrada')).toBeInTheDocument();
    expect(api.listRecordBusinessReports).toHaveBeenCalledWith(business.id, 1, '');
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
    expect(screen.getByText(/información administrativa ampliada todavía no está disponible/)).toBeInTheDocument();
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
  it('centra las cinco tarjetas y permite consultar la completitud desde toda su superficie', async () => {
    setup(); await ready();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getAllByRole('button')).toHaveLength(5);
    expect(within(cards).getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Cambiar verificación del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Cambiar suscripción del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Consultar reportes de este negocio' })).toHaveClass('bd-indicator-trigger');
    fireEvent.click(within(cards).getByRole('button', { name: 'Consultar información general y completitud del negocio' }));
    expect(screen.getByRole('tab', { name: 'Información general' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Información general' })).toHaveTextContent('Cuenta registradora');
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
