import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Keep an unexpected catalogue rendering error from unmounting the whole Admin shell. */
export class AdminContentErrorBoundary extends Component<
  { children: ReactNode }, { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Error details stay in the browser console; never expose internal traces to visitors.
    console.error('[Admin Contenido] Error al representar la sección:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="state-panel error" role="alert" aria-live="assertive">
        <h2>No pudimos mostrar Contenido</h2>
        <p>La sección encontró un error al cargar los datos. Puedes reintentar o volver al inicio de Admin.</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <button className="primary" type="button" onClick={() => this.setState({ failed: false })}>
            Volver a intentar
          </button>
          <Link to="/dashboard" className="secondary-button">Ir al inicio de Admin</Link>
        </div>
      </section>
    );
  }
}
