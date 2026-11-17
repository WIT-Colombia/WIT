import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRecordPage } from './BusinessRecordPage';
import { ActivityChart } from './Activity';
import { offerPrice } from './Catalog';
import { HistoryTimeline } from './History';
import type { RecordBusiness, RecordOffer } from '../../services/adminBusinessRecord';

const api = vi.hoisted(() => ({ getRecordBusiness: vi.fn(), getRecordHistory: vi.fn(), getRecordCatalog: vi.fn(), getRecordReviews: vi.fn(), getRecordPhotos: vi.fn(), getRecordActivity: vi.fn(), changeAdminBusinessVisibility: vi.fn(), deleteAdminBusiness: vi.fn(), verifyAdminBusiness: vi.fn(), changeAdminBusinessPlan: vi.fn(), listRecordBusinessReports: vi.fn() }));
vi.mock('../../services/adminBusinessRecord', () => api);
vi.mock('../../services/adminApiClient', async original => ({ ...await original<typeof import('../../services/adminApiClient')>(), changeAdminBusinessVisibility: api.changeAdminBusinessVisibility, deleteAdminBusiness: api.deleteAdminBusiness, verifyAdminBusiness: api.verifyAdminBusiness, changeAdminBusinessPlan: api.changeAdminBusinessPlan, listRecordBusinessReports: api.listRecordBusinessReports }));
vi.mock('../../components/businesses/BusinessRecordPhoto', () => ({ BusinessRecordPhotos: ({ children }: { children: React.ReactNode }) => children, BusinessRecordPhoto: ({ alt }: { alt: string }) => <span data-testid="record-photo">{alt}</span> }));
let role = 'SUPER_ADMIN', permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write'];
vi.mock('../../services/adminService', () => ({ getSession: () => ({ name: 'Administración de prueba', role, permissions }) }));
const pagination = { page: 1, pageSize: 6, total: 1, totalPages: 1 };
const business: RecordBusiness = { id: 'business-1', publicId: 'B-REAL-1', name: 'Establecimiento registrado', description: 'Descripción registrada', coverPhotoId: null, profilePhotoId: null, email: 'contacto@example.invalid', phone: '000', lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', verificationStatus: 'PENDING', deletionStatus: 'NONE', administrativeRestriction: null, administrativePreviousVisibility: null, administrativeRestrictedAt: null, administrativeRestrictionReason: null, isPro: true, completeness: 85, createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z', createdBy: { displayName: 'Cuenta registradora', emailNormalized: null }, memberships: [{ user: { displayName: 'Propietaria registrada', nickname: null } }], _count: { offers: 1, reviews: 1, memberships: 1, reports: 2 }, location: { cityName: 'Palmira', regionName: 'Valle del Cauca', countryCode: 'CO', address: 'Dirección registrada', zoneName: null }, category: { id: 'cat', code: 'tools', translations: [{ locale: 'es', name: 'Ferretería' }] }, record: { version: 1, members: [{ id: 'member-1', role: 'OWNER', status: 'ACTIVE', createdAt: '2026-11-01T12:00:00Z', user: { displayName: 'Propietaria registrada', nickname: null } }], effectiveVisibility: 'VISIBLE', rating: { value: 4, count: 1 }, products: 1, services: 0, businessPhotos: 0, catalogPhotos: 0, accountStatus: 'ACTIVE', coverPosition: { x: 50, y: 50 }, profilePosition: { x: 50, y: 50 } } };
const offer: RecordOffer = { id: 'offer-1', internalCode: 'P000001', kind: 'PRODUCT', name: 'Producto registrado', description: 'Información comercial registrada', priceAmount: '0', currency: 'COP', priceText: null, negotiable: false, publicationStatus: 'PUBLISHED', administrativeStatus: 'NONE', active: true, deletedAt: null, createdAt: business.createdAt, updatedAt: business.updatedAt, category: business.category, photos: [] };
function setup() { render(<MemoryRouter initialEntries={['/businesses/business-1']}><Routes><Route path="/businesses/:id" element={<BusinessRecordPage/>}/></Routes></MemoryRouter>); }
async function ready() { await screen.findByRole('heading', { name: 'Ficha administrativa del negocio' }); }
describe('Ficha administrativa del negocio', () => {
  beforeEach(() => { vi.clearAllMocks(); role = 'SUPER_ADMIN'; permissions = ['business:write', 'catalog:read', 'content:moderate', 'content:moderate:write', 'settings:write']; api.getRecordBusiness.mockResolvedValue(business); api.getRecordHistory.mockResolvedValue({ history: [], pagination: { ...pagination, total: 0, totalPages: 0 } }); api.getRecordCatalog.mockResolvedValue({ offers: [offer], pagination }); api.getRecordReviews.mockResolvedValue({ reviews: [], pagination: { ...pagination, total: 0 } }); api.getRecordPhotos.mockResolvedValue({ photos: [], pagination: { ...pagination, total: 0 } }); api.listRecordBusinessReports.mockResolvedValue({ reports: [], pagination: { ...pagination, total: 0, totalPages: 0 } }); });
  afterEach(cleanup);
  it('no atribuye una actuación a un administrador ficticio cuando falta su identidad', () => { render(<HistoryTimeline entries={[{ id: 'audit-1', action: 'BUSINESS_UPDATED', reason: 'Motivo registrado', comment: null, actor: null, createdAt: business.updatedAt, previousState: null, newState: null }]}/>); expect(screen.getByText('Responsable no disponible')).toBeInTheDocument(); expect(screen.queryByText('Sistema', { exact: true })).not.toBeInTheDocument(); });
  it('impide consultar la ficha sin permiso de negocios', () => { permissions = []; setup(); expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument(); expect(api.getRecordBusiness).not.toHaveBeenCalled(); });
  it('presenta identidad e indicadores procedentes de la respuesta', async () => { setup(); await ready(); expect(screen.getByRole('heading', { name: business.name })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('85%'); expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Business PRO'); expect(screen.getAllByText('Propietaria registrada').length).toBeGreaterThan(0); expect(screen.getAllByRole('tab')).toHaveLength(8); });
  it('cambiar pestañas conserva la ficha y la consulta del catálogo', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); await screen.findByRole('heading', { name: offer.name }); fireEvent.click(screen.getByRole('tab', { name: 'Información general' })); expect(screen.getByRole('tabpanel', { name: 'Información general' })).toHaveTextContent('Cuenta registradora'); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); expect(api.getRecordBusiness).toHaveBeenCalledTimes(1); expect(api.getRecordCatalog).toHaveBeenCalledTimes(1); expect(screen.getByRole('heading', { name: offer.name })).toBeInTheDocument(); });
  it('el catálogo permite consultar sin modificar la información comercial', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' })); const dialog = await screen.findByRole('dialog', { name: offer.name }); expect(within(dialog).queryByRole('button', { name: /Guardar|Eliminar|Editar/ })).not.toBeInTheDocument(); expect(within(dialog).getByText('Información comercial registrada')).toBeInTheDocument(); expect(offerPrice(offer)).toMatch(/COP.*0/); expect(offerPrice({ ...offer, negotiable: true })).toBe('Precio a convenir'); });
  it('respeta los permisos separados de catálogo y opiniones', async () => { permissions = ['business:write']; role = 'ADMIN'; setup(); await ready(); fireEvent.click(screen.getByRole('tab', { name: 'Productos y servicios' })); expect(screen.getByRole('heading', { name: 'Catálogo de acceso restringido' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Opiniones' })); expect(screen.getByRole('heading', { name: 'Opiniones de acceso restringido' })).toBeInTheDocument(); expect(api.getRecordCatalog).not.toHaveBeenCalled(); expect(api.getRecordReviews).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Ocultar negocio' })).not.toBeInTheDocument(); });
  it('cancelar una medida no escribe y confirmar actualiza acciones e historial', async () => { setup(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ocultar negocio' })); expect(screen.getByRole('button', { name: 'Confirmar ocultamiento' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled(); api.changeAdminBusinessVisibility.mockResolvedValue({ message: 'Medida registrada' }); api.getRecordBusiness.mockResolvedValue({ ...business, administrativeRestriction: null, visibilityStatus: 'HIDDEN', record: { ...business.record, effectiveVisibility: 'HIDDEN' } }); fireEvent.click(screen.getByRole('button', { name: 'Ocultar negocio' })); fireEvent.change(screen.getByLabelText(/Motivo administrativo/), { target: { value: 'Motivo suficiente y registrado' } }); fireEvent.click(screen.getByRole('button', { name: 'Confirmar ocultamiento' })); await waitFor(() => expect(screen.getByRole('region', { name: 'Indicadores principales' })).toHaveTextContent('Oculta (reversible)')); expect(api.changeAdminBusinessVisibility).toHaveBeenCalledWith(business.id, 'SET_HIDDEN', 'Motivo suficiente y registrado'); expect(api.getRecordBusiness).toHaveBeenCalledTimes(2); await waitFor(() => expect(api.getRecordHistory).toHaveBeenCalledTimes(2)); });
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
  it('abre una confirmación auditable al verificar un negocio', async () => {
    api.verifyAdminBusiness.mockResolvedValue({ verificationStatus: 'APPROVED', message: 'Negocio verificado' });
    api.getRecordBusiness.mockResolvedValueOnce(business).mockResolvedValueOnce({ ...business, verificationStatus: 'APPROVED' });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar administrativamente el negocio' }));
    const dialog = screen.getByRole('dialog', { name: 'Verificar negocio' });
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Documentación revisada y nombre confirmado' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe VERIFICAR/), { target: { value: 'VERIFICAR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar verificación' }));
    await waitFor(() => expect(api.verifyAdminBusiness).toHaveBeenCalledWith(business.id, 'Documentación revisada y nombre confirmado', 'VERIFICAR'));
    await waitFor(() => expect(api.getRecordBusiness).toHaveBeenCalledTimes(2));
  });
  it('solicita confirmación al cambiar el plan del negocio', async () => {
    api.changeAdminBusinessPlan.mockResolvedValue({ plan: 'BASIC', message: 'Plan actualizado' });
    api.getRecordBusiness.mockResolvedValueOnce(business).mockResolvedValueOnce({ ...business, isPro: false });
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el plan del negocio' }));
    const dialog = screen.getByRole('dialog', { name: 'Administrar suscripción' });
    fireEvent.change(within(dialog).getByLabelText(/Motivo de la decisión/), { target: { value: 'Se acordó regresar al plan básico' } });
    fireEvent.change(within(dialog).getByLabelText(/Escribe BASIC/), { target: { value: 'BASIC' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cambio de plan' }));
    await waitFor(() => expect(api.changeAdminBusinessPlan).toHaveBeenCalledWith(business.id, 'BASIC', 'Se acordó regresar al plan básico', 'BASIC'));
    await waitFor(() => expect(api.getRecordBusiness).toHaveBeenCalledTimes(2));
  });
  it('muestra visible, oculta y suspendida como opciones diferenciadas', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    expect(screen.getByRole('button', { name: 'Visible' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oculta.*El propietario puede reactivarla/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suspendida.*Solo Admin puede levantarla/ })).toBeInTheDocument();
  });
  it('centra las cinco tarjetas y permite consultar la completitud desde toda su superficie', async () => {
    setup(); await ready();
    const cards = screen.getByRole('region', { name: 'Indicadores principales' });
    expect(within(cards).getAllByRole('button')).toHaveLength(5);
    expect(within(cards).getByRole('button', { name: 'Cambiar visibilidad del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Verificar administrativamente el negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Cambiar el plan del negocio' })).toHaveClass('bd-indicator-trigger');
    expect(within(cards).getByRole('button', { name: 'Consultar reportes de este negocio' })).toHaveClass('bd-indicator-trigger');
    fireEvent.click(within(cards).getByRole('button', { name: 'Consultar información general y completitud del negocio' }));
    expect(screen.getByRole('tab', { name: 'Información general' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Información general' })).toHaveTextContent('Cuenta registradora');
  });
  it('permite cerrar el selector de visibilidad con Escape sin cambiar el negocio', async () => {
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar visibilidad del negocio' }));
    expect(screen.getByRole('group', { name: 'Elegir estado de visibilidad' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Elegir estado de visibilidad' })).not.toBeInTheDocument();
    expect(api.changeAdminBusinessVisibility).not.toHaveBeenCalled();
  });
  it('un fallo del backend no presenta una ficha ficticia', async () => { api.getRecordBusiness.mockRejectedValue(new Error('No disponible temporalmente')); setup(); expect(await screen.findByRole('heading', { name: 'No pudimos abrir la ficha' })).toBeInTheDocument(); expect(screen.queryByText('85%')).not.toBeInTheDocument(); expect(screen.getByText('No disponible temporalmente')).toBeInTheDocument(); });
  it('la gráfica permite consultar un intervalo con cero mediante teclado', () => { const row = { views: 2, interactions: 0, offerViews: 0, reviews: 0, products: 0, services: 0 }; render(<ActivityChart metric="views" data={{ period: 'month', timezone: 'America/Bogota', start: business.createdAt, end: business.updatedAt, totals: row, definition: 'Eventos registrados', series: [{ label: '2026-11-01', ...row }, { label: '2026-11-02', ...row, views: 0 }] }}/>); const chart = screen.getByRole('group', { name: /Visualizaciones de la ficha/ }); fireEvent.focus(chart); fireEvent.keyDown(chart, { key: 'ArrowRight' }); expect(screen.getByTestId('activity-guide')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('0 · visualizaciones de la ficha'); });
});
