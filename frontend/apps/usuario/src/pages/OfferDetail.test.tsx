import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProductDetail } from './OfferDetail';

const mocks = vi.hoisted(() => ({
  getOfferPageDetail: vi.fn(),
  fetchPlusStatus: vi.fn(),
  addPlusWatch: vi.fn(),
  user: { id: 'user-1', emailNormalized: 'usuario@example.com', emailVerified: true, status: 'ACTIVE' },
}));

vi.mock('../components/PublicPageSeo', () => ({ PublicOfferSeo: () => null }));
vi.mock('../components/CatalogPhoto', () => ({ CatalogPhoto: ({ alt }: { alt: string }) => <div role="img" aria-label={alt}/> }));
vi.mock('../components/PageLayout', () => ({ PageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../hooks/useAccountGate', () => ({ useAccountGate: () => (action: () => void) => action() }));
vi.mock('../services/businessService', () => ({ getOfferPageDetail: mocks.getOfferPageDetail }));
vi.mock('../services/userPlusService', () => ({
  fetchPlusStatus: mocks.fetchPlusStatus,
  addPlusWatch: mocks.addPlusWatch,
}));
vi.mock('../services/offerLikesService', () => ({
  isRealOfferId: (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
  useOfferLikes: () => ({ get: () => ({ liked: false, count: 0 }), toggle: vi.fn() }),
}));
vi.mock('../services/analyticsService', () => ({
  activeBusinessContext: () => ({ source: 'direct' }),
  createAnalyticsInteractionId: () => 'interaction-test',
  recordBusinessEvent: vi.fn(),
}));
vi.mock('../services/userDataService', () => ({ getLikeCount: () => 0 }));
vi.mock('../services/publicBusinessApi', () => ({ recordPublicPromotionView: vi.fn() }));

const uuid = '12345678-1234-4234-8234-123456789abc';
const business = {
  id: 'business-1', name: 'Negocio de prueba', category: 'Comercio', address: 'Dirección de prueba',
  image: '', logo: '', plan: 'free',
};
function setupOffer(price: number | undefined = 32000) {
  mocks.getOfferPageDetail.mockResolvedValue({
    offer: { id: uuid, businessId: business.id, name: 'Producto de prueba', description: '', price,
      priceLabel: price !== undefined ? '$32.000 COP' : 'Consultar precio', image: '', isOffer: false },
    business,
  });
}
function LocationIndicator() {
  const { pathname, search } = useLocation();
  return <output data-testid="destination">{pathname + search}</output>;
}
const mount = () => render(<MemoryRouter initialEntries={['/product/' + uuid]}>
  <LocationIndicator/>
  <Routes>
    <Route path="/product/:id" element={<ProductDetail/>}/>
    <Route path="/plus" element={<div>Página Plus</div>}/>
  </Routes>
</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.emailNormalized = 'usuario@example.com';
  mocks.user.emailVerified = true;
  mocks.user.status = 'ACTIVE';
  setupOffer();
  mocks.fetchPlusStatus.mockResolvedValue({ enabled: true, active: true, subscription: null });
  mocks.addPlusWatch.mockResolvedValue({ id: 'watch-1' });
});

describe('Ficha de producto: seguir precio en un toque', () => {
  it('saves the current product ID directly for a verified Plus member, without copying links', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir precio' }));
    await waitFor(() => expect(mocks.fetchPlusStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.addPlusWatch).toHaveBeenCalledWith(uuid));
    expect(await screen.findByRole('button', { name: 'Siguiendo precio' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver mis precios seguidos' })).toHaveAttribute('href', '/plus#prices');
    expect(screen.getByTestId('destination')).toHaveTextContent('/product/' + uuid);
  });

  it('directs a non-member to Plus without performing paid writes', async () => {
    mocks.fetchPlusStatus.mockResolvedValue({ enabled: false, active: false, subscription: null });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir precio' }));
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/plus'));
    expect(mocks.addPlusWatch).not.toHaveBeenCalled();
  });

  it('provides the designated test account a visual, non-persistent price follow', async () => {
    mocks.user.emailNormalized = 'administradoreswit@gmail.com';
    mocks.fetchPlusStatus.mockResolvedValue({ enabled: false, active: false, subscription: null });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir precio' }));
    await waitFor(() => expect(screen.getByTestId('destination'))
      .toHaveTextContent('/plus?preview=1&watch=' + uuid));
    expect(mocks.addPlusWatch).not.toHaveBeenCalled();
  });

  it('does not offer price tracking on products without a numeric price', async () => {
    setupOffer(undefined);
    mount();
    await screen.findByText('Producto de prueba');
    expect(screen.queryByRole('button', { name: 'Seguir precio' })).not.toBeInTheDocument();
    expect(mocks.fetchPlusStatus).not.toHaveBeenCalled();
  });
});
