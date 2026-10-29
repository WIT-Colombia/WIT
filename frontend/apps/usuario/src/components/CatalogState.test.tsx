import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogStateView } from './CatalogState';

describe('Home catálogo', () => {
  it('muestra carga, vacío y error', () => {
    const { rerender } = render(<CatalogStateView state="loading" hasResults={false} onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    rerender(<CatalogStateView state="ready" hasResults={false} onRetry={vi.fn()} />);
    expect(screen.getByText('No hay negocios disponibles.')).toBeInTheDocument();
    rerender(<CatalogStateView state="error" hasResults={false} onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar');
  });
  it('permite reintentar sin recargar', () => { const retry = vi.fn(); render(<CatalogStateView state="error" hasResults={false} onRetry={retry} />); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); expect(retry).toHaveBeenCalledTimes(1); });
});
