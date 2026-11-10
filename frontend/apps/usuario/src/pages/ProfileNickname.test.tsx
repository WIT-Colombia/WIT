import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';
import { ProfilePage } from '../../../negocios/src/pages/ProfilePage';

const state = vi.hoisted(() => ({
  user: null as null | { id: string; displayName: string; emailNormalized: string; nickname: string | null; avatarUrl: null; emailVerified: boolean; authProviders: string[] },
  account: { name: 'Nombre visible', nickname: '@cache.obsoleta', email: 'perfil@example.test' },
  saveProfile: vi.fn(),
  updateProfile: vi.fn(),
  setAccount: vi.fn(),
  uploadAvatar: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: state.user, logout: vi.fn(), reloadUser: vi.fn() }) }));
vi.mock('../services/userDataService', () => ({
  getProfile: () => ({ name: 'Nombre visible', email: 'perfil@example.test' }),
  getNotifications: () => [],
  saveProfile: state.saveProfile,
}));
vi.mock('../services/authService', () => ({ uploadAvatar: state.uploadAvatar }));
vi.mock('../context/LocationContext', () => ({ useLocationContext: () => ({ selection: null }) }));
vi.mock('../hooks/useAccountAvatar', () => ({ useAccountAvatar: () => null }));
vi.mock('../components/PageLayout', () => ({ PageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../components/EmailVerificationNotice', () => ({ EmailVerificationNotice: () => null }));
vi.mock('../../../negocios/src/services/businessAuthContext', () => ({ useBusinessAuth: () => ({ user: state.user, signOut: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../../../negocios/src/services/businessStore', () => ({ useBusinessStore: () => ({ account: state.account, setAccount: state.setAccount }) }));
vi.mock('../../../negocios/src/services/businessAuthService', () => ({ updateProfile: state.updateProfile, uploadAvatar: state.uploadAvatar, getAvatarBlob: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'cuenta-existente', displayName: 'Nombre visible', emailNormalized: 'perfil@example.test', nickname: '@nickname.unico.42', avatarUrl: null, emailVerified: true, authProviders: ['EMAIL'] };
});
afterEach(() => {
  cleanup();
  expect(state.saveProfile).not.toHaveBeenCalled();
  expect(state.updateProfile).not.toHaveBeenCalled();
  expect(state.setAccount).not.toHaveBeenCalled();
  expect(state.uploadAvatar).not.toHaveBeenCalled();
});
describe('nickname real de la cuenta existente', () => {
  it('Usuario lo muestra inmediatamente debajo del nombre', () => {
    render(<MemoryRouter><Profile /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toHaveTextContent('@nickname.unico.42');
  });
  it('Usuario refleja un dato recibido después, sin guardarlo ni generar otro', () => {
    state.user = { ...state.user!, nickname: null };
    const view = render(<MemoryRouter><Profile /></MemoryRouter>);
    expect(screen.queryByText('@nickname.unico.42')).not.toBeInTheDocument();
    state.user = { ...state.user!, nickname: '@nickname.unico.42' };
    view.rerender(<MemoryRouter><Profile /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toHaveTextContent('@nickname.unico.42');
  });
  it('Business usa el nickname real debajo del nombre y en el campo existente', () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Nombre visible' }).nextElementSibling).toHaveTextContent('@nickname.unico.42');
    expect(screen.getByRole('textbox', { name: /Nickname único/ })).toHaveValue('@nickname.unico.42');
    expect(screen.queryByText('@cache.obsoleta')).not.toBeInTheDocument();
  });
  it('Business no presenta un nickname local como si perteneciera a la cuenta', () => {
    state.user = { ...state.user!, nickname: null };
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /Nickname único/ })).toHaveValue('Sin registrar');
  });
  it('Business actualiza la visualización al recibir el nickname real', () => {
    state.user = null;
    const view = render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /Nickname único/ })).toHaveValue('Sin registrar');
    state.user = { id: 'cuenta-existente', displayName: 'Nombre visible', emailNormalized: 'perfil@example.test', nickname: '@nickname.unico.42', avatarUrl: null, emailVerified: true, authProviders: ['EMAIL'] };
    view.rerender(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /Nickname único/ })).toHaveValue('@nickname.unico.42');
  });
});
