import { Link } from 'react-router-dom';

export function DemoDashboardPage() {
  return <section className="demo-dashboard">
    <div className="page-heading"><div><p className="eyebrow">MODO DE PRUEBAS</p><h1>Panel administrativo</h1><p>Explora la navegación de XAMUKO Admin con datos simulados.</p></div></div>
    <div className="metrics-grid">
      <article className="metric-card"><div className="metric-top">Negocios visibles</div><div className="metric-value">3</div><p>Datos de demostración</p></article>
      <article className="metric-card"><div className="metric-top">Opiniones</div><div className="metric-value">8</div><p>Datos de demostración</p></article>
      <article className="metric-card"><div className="metric-top">Usuarios</div><div className="metric-value">4</div><p>Datos de demostración</p></article>
      <article className="metric-card"><div className="metric-top">Estado</div><div className="metric-value">Demo</div><p>Sin acceso a producción</p></article>
    </div>
    <div className="panel state-panel"><h2>Navegación segura de demostración</h2><p>Los módulos muestran información ficticia y todas las operaciones reales están deshabilitadas.</p><Link className="primary button-link" to="/businesses">Explorar módulos</Link></div>
  </section>;
}
