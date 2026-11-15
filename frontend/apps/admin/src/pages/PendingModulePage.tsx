import { Link, useLocation } from 'react-router-dom';
import { navigation } from '../data/navigation';
import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { moduleWorkflows } from '../data/moduleWorkflows';

export function PendingModulePage() {
  const { pathname } = useLocation();
  const module = navigation.find(item => pathname === item.path || pathname.startsWith(`${item.path}/`));
  const title = module?.label || 'Módulo';
  const description = module?.description || 'Esta función aún no está disponible.';
  const workflow = moduleWorkflows[module?.path || ''] || { intro: description, work: ['Consulta de información', 'Revisión administrativa', 'Trazabilidad de acciones'], source: 'Una integración administrativa autorizada' };
  const [tab, setTab] = useState('overview');
  useEffect(() => setTab('overview'), [pathname]);
  const related = navigation.filter(item => item.group === module?.group && !item.pending && item.path !== module?.path);
  return <section className="ad-module-page" aria-labelledby="xa-module-title">
    <header className="admin-section-heading"><h1 id="xa-module-title">{title}</h1><span className="xa-module-status"><i aria-hidden="true" />Pendiente</span></header>
    <div className="ad-panel"><div className="ad-document-toolbar"><div className="ad-tabs" role="group" aria-label="Información del módulo">{[['overview', 'Resumen'], ['workflow', 'Flujo de trabajo'], ['connections', 'Conexiones']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div><span className="ad-security"><Icon name="lock" size={14}/>Acceso administrativo</span></div>
      {tab === 'overview' ? <div className="ad-module-overview"><span className="ad-large-icon"><Icon name={module?.icon || 'grid'} size={32}/></span><span className="ad-kicker">ESTA ÁREA ESTÁ EN PREPARACIÓN</span><h2>Un espacio preparado para {title.toLocaleLowerCase('es')}</h2><p>La vista está diseñada, pero la operación de este módulo todavía requiere conectar su servicio autorizado. No hay registros operativos disponibles para mostrar.</p><span className="ad-planned-badge"><Icon name="clock" size={15}/>Integración pendiente</span></div>
      : tab === 'workflow' ? <div className="ad-workflow-grid">{workflow.work.map((step, index) => <article key={step}><span className="ad-step">0{index + 1}</span><h2>{step}</h2><p>Alcance previsto del módulo. Disponible cuando se conecte el servicio correspondiente.</p><span className="ad-planned-badge">En preparación</span></article>)}</div>
      : <div className="ad-connections"><span className="ad-large-icon"><Icon name="server" size={28}/></span><div><span className="ad-kicker">FUENTE REQUERIDA</span><h2>{workflow.source}</h2><p>Su conexión permitirá consultar información real y ejecutar acciones con los permisos de tu cuenta. Este módulo aún no está conectado.</p></div></div>}
    </div>
    {related.length > 0 && <div className="ad-related"><h2>Continúa en esta área</h2><div>{related.map(item => <Link key={item.path} to={item.path}><span><Icon name={item.icon}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div><Icon name="arrow" size={18}/></Link>)}</div></div>}
    <div className="xa-module-footer">
      <p>Cuando exista una integración autorizada, esta vista podrá mostrar la información disponible para tu perfil.</p>
      <Link to="/dashboard"><Icon name="arrow" size={16} /> Volver al resumen</Link>
    </div>
  </section>;
}
