import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../../../negocios/src/components/layout/Sidebar';
const flags = vi.hoisted(() => ({ businessPro: false, xamukoPlus: false }));
vi.mock('../../../negocios/src/services/businessAuthService', () => ({ getAvatarBlob: vi.fn() }));
vi.mock('@wit/utils', async importOriginal => ({ ...await importOriginal<any>(), usePaidPlans: () => flags }));
vi.mock('../../../negocios/src/services/businessStore', () => ({ useBusinessStore: () => ({ business: { id: 'test', name: 'Test', role: 'Propietario', source: 'real' }, notifications: [], persistentNotificationCount: 0, account: { name: 'Test' } }) }));
vi.mock('../../../negocios/src/services/businessAuthContext', () => ({ useBusinessAuth: () => ({ user: null }) }));
vi.mock('../../../negocios/src/services/businessWelcomeStatus', () => ({ useBusinessAccountWelcomeUnread: () => false }));
vi.mock('../../../negocios/src/services/businessApiClient', () => ({ businessApi: { getCatalogLimits: vi.fn().mockResolvedValue({ plan: 'BASIC' }) } }));
afterEach(() => { cleanup(); flags.businessPro = false; });
it('oculta la oferta y el diálogo al desactivar Business Pro, incluido el menú móvil compartido', async () => {
  const view = render(<MemoryRouter><Sidebar /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('link', { name: /XAMUKO Business, inicio/i })).toBeInTheDocument());
  expect(screen.queryByText('Business Pro')).not.toBeInTheDocument();
  flags.businessPro = true;
  view.rerender(<MemoryRouter><Sidebar /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Conocer beneficios' }));
  expect(screen.getByRole('dialog', { name: 'XAMUKO Business Pro' })).toBeInTheDocument();
  flags.businessPro = false;
  view.rerender(<MemoryRouter><Sidebar /></MemoryRouter>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Business Pro')).not.toBeInTheDocument();
});
it('el parámetro demoPro no elude el interruptor global', () => {
  render(<MemoryRouter initialEntries={['/preview?demoPro=1']}><Sidebar /></MemoryRouter>);
  expect(screen.queryByText('PRO')).not.toBeInTheDocument();
});
