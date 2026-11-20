import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RequirePlusAvailability } from './RequirePlusAvailability';

const plans = vi.hoisted(() => ({ enabled: false, refresh: vi.fn(async () => {}) }));
vi.mock('@wit/utils', () => ({
  usePaidPlans: () => ({ xamukoPlus: plans.enabled, businessPro: true }),
  refreshPaidPlans: plans.refresh,
}));

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="current-route">{location.pathname + location.search + location.hash}</output>;
}
function mount(path = '/plus?preview=1#prices') {
  return render(<MemoryRouter initialEntries={[path]}>
    <CurrentLocation />
    <Routes>
      <Route path="/plus" element={<RequirePlusAvailability><div>Herramientas privadas de Plus</div></RequirePlusAvailability>} />
      <Route path="/profile" element={<div>Perfil del usuario</div>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  plans.enabled = false;
  vi.clearAllMocks();
  plans.refresh.mockResolvedValue(undefined);
});

describe('Access to Xamuko Plus by global Admin switch', () => {
  it('redirects a disabled plan to Profile even with a legacy demo deep link', async () => {
    mount();
    expect(await screen.findByText('Perfil del usuario')).toBeInTheDocument();
    expect(screen.getByTestId('current-route')).toHaveTextContent('/profile');
    expect(screen.queryByText('Herramientas privadas de Plus')).not.toBeInTheDocument();
    expect(plans.refresh).toHaveBeenCalledTimes(1);
  });

  it('permits the real Plus page after the public availability has been refreshed', async () => {
    plans.enabled = true;
    mount('/plus#prices');
    expect(await screen.findByText('Herramientas privadas de Plus')).toBeInTheDocument();
    expect(screen.getByTestId('current-route')).toHaveTextContent('/plus#prices');
  });

  it('fails closed when public availability cannot be refreshed', async () => {
    plans.refresh.mockRejectedValueOnce(new Error('API unavailable'));
    mount('/plus');
    expect(await screen.findByText('Perfil del usuario')).toBeInTheDocument();
    expect(screen.queryByText('Herramientas privadas de Plus')).not.toBeInTheDocument();
  });
});
