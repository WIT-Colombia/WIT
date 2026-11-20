import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AdMobBanner } from './AdMobBanner';

const state = vi.hoisted(() => ({
  fetchPlusStatus: vi.fn(),
  xamukoPlus: false,
  verification: 'verified' as 'pending' | 'verified' | 'unavailable',
  auth: {
    user: { id: 'user-1', emailNormalized: 'user@example.com' } as
      { id: string; emailNormalized: string } | null,
    status: 'authenticated' as 'authenticated' | 'loading' | 'unauthenticated',
  },
}));
vi.mock('@wit/utils', () => ({
  usePaidPlans: () => ({ businessPro: true, xamukoPlus: state.xamukoPlus }),
  usePaidPlansVerification: () => state.verification,
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('../services/userPlusService', () => ({ fetchPlusStatus: state.fetchPlusStatus }));

beforeEach(() => {
  vi.clearAllMocks();
  state.xamukoPlus = false;
  state.verification = 'verified';
  state.auth.user = { id: 'user-1', emailNormalized: 'user@example.com' };
  state.auth.status = 'authenticated';
});
afterEach(() => cleanup());

describe('Xamuko Plus: third-party advertising visibility', () => {
  it('shows both banner slots to authenticated users when Admin globally disables Plus, without checking subscription', () => {
    state.fetchPlusStatus.mockRejectedValue(new Error('old membership endpoint unavailable'));
    render(<><AdMobBanner slot="home-inline" /><AdMobBanner slot="home-footer" /></>);
    expect(screen.getAllByRole('complementary', { name: 'Publicidad' })).toHaveLength(2);
    expect(document.querySelector('[data-admob-slot="home-inline"]')).not.toBeNull();
    expect(document.querySelector('[data-admob-slot="home-footer"]')).not.toBeNull();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });

  it('does not treat the former administrative test account as ad-free when Plus is disabled', () => {
    state.auth.user = { id: 'admin-user', emailNormalized: 'administradoreswit@gmail.com' };
    render(<AdMobBanner />);
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });

  it('hides banners when Plus is enabled and the backend verifies an active membership', async () => {
    state.xamukoPlus = true;
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: true, subscription: null });
    render(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });

  it('shows advertising for a verified account without a membership when Plus is enabled', async () => {
    state.xamukoPlus = true;
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: false, subscription: null });
    render(<AdMobBanner slot="home-inline" />);
    expect(await screen.findByRole('complementary', { name: 'Publicidad' }))
      .toHaveAttribute('data-admob-slot', 'home-inline');
  });

  it('shows advertising if the backend also reports Plus globally disabled', async () => {
    state.xamukoPlus = true;
    state.fetchPlusStatus.mockResolvedValue({ enabled: false, active: false, subscription: null });
    render(<AdMobBanner />);
    expect(await screen.findByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
  });

  it('does not show unverified advertising to potentially active Plus members when subscription lookup fails', async () => {
    state.xamukoPlus = true;
    state.fetchPlusStatus.mockRejectedValue(new Error('membership service unavailable'));
    render(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });

  it('does not flash advertising until global availability has loaded', () => {
    state.verification = 'pending';
    const view = render(<AdMobBanner />);
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
    state.verification = 'verified';
    view.rerender(<AdMobBanner />);
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });

  it('restores banners even if the production backend has not deployed either Plus endpoint yet', async () => {
    state.verification = 'unavailable';
    state.fetchPlusStatus.mockRejectedValue(new Error('404: old backend'));
    render(<AdMobBanner />);
    expect(await screen.findByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1);
  });

  it('honors a known active subscription if the public plan endpoint is temporarily unavailable', async () => {
    state.verification = 'unavailable';
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: true, subscription: null });
    render(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });

  it('restores banners as soon as Admin disables Plus after an active membership check', async () => {
    state.xamukoPlus = true;
    state.fetchPlusStatus.mockResolvedValue({ enabled: true, active: true, subscription: null });
    const view = render(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
    state.xamukoPlus = false;
    view.rerender(<AdMobBanner />);
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).toHaveBeenCalledTimes(1);
    state.xamukoPlus = true;
    view.rerender(<AdMobBanner />);
    await waitFor(() => expect(state.fetchPlusStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
  });

  it('shows the public banner to guests without requesting private membership details', () => {
    state.auth.user = null;
    state.auth.status = 'unauthenticated';
    state.verification = 'pending';
    render(<AdMobBanner />);
    expect(screen.getByRole('complementary', { name: 'Publicidad' })).toBeInTheDocument();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });

  it('does not show banners before authentication finishes loading', () => {
    state.auth.status = 'loading';
    render(<AdMobBanner />);
    expect(screen.queryByRole('complementary', { name: 'Publicidad' })).not.toBeInTheDocument();
    expect(state.fetchPlusStatus).not.toHaveBeenCalled();
  });
});
