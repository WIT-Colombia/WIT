import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AdMobBanner } from './AdMobBanner';

const state = vi.hoisted(() => ({
  fetchPlusStatus: vi.fn(),
  auth: { user: { id: 'user-1' } as { id: string } | null, status: 'authenticated' },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('../services/userPlusService', () => ({ fetchPlusStatus: state.fetchPlusStatus }));

beforeEach(() => {
  vi.clearAllMocks();
  state.auth.user = { id: 'user-1' };
  state.auth.status = 'authenticated';
});
afterEach(() => cleanup());

describe('Xamuko Plus: experiencia sin publicidad de terceros', () => {
  it('hides the advertising slot when the backend verifies an active membership', async () => {
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: true, subscription: null });
    render(<AdMobBanner slot="home-inline" />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });
  it('shows the advertising slot for a verified account without Plus', async () => {
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: false, subscription: null });
    render(<AdMobBanner slot="home-inline" />);
    expect(await screen.findByRole('complementary', { name: 'Publicidad' }))
      .toHaveAttribute('data-admob-slot', 'home-inline');
  });
  it('does not display an unverified advertising slot while membership verification fails', async () => {
    state.fetchPlusStatus.mockRejectedValue(new Error('unavailable'));
    render(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });
  it('shows the public slot to guests without sending a Plus account request', () => {
    state.auth.user = null;
    render(<AdMobBanner />);
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });
});
