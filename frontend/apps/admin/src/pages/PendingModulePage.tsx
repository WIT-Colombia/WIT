import { Link, useLocation } from 'react-router-dom';
import { navigation, navigationGroups } from '../data/navigation';
import { Icon } from '../components/Icon';

export function PendingModulePage() {
  const { pathname } = useLocation();
  const module = navigation.find(item => pathname === item.path || pathname.startsWith(`${item.path}/`));
  const group = navigationGroups.find(item => item.id === module?.group);
  const title = module?.label || 'Módulo';
  const description = module?.description || 'Esta función aún no está disponible.';
  return <section className="xa-module-page" aria-labelledby="xa-module-title">
    <header className="xa-module-heading">
      <span className="xa-module-icon"><Icon name={module?.icon || 'grid'} size={25} /></span>
      <div className="xa-module-heading-copy">
        <p className="xa-module-eyebrow">{group?.label || 'XAMUKO ADMIN'}</p>
        <div className="xa-module-title-row"><h1 id="xa-module-title">{title}</h1><span className="xa-module-status"><i aria-hidden="true" />Pendiente</span></div>
        <p>{description}</p>
      </div>
    </header>
    <div className="xa-module-status-card">
      <span className="xa-module-status-icon"><Icon name="clock" size={22} /></span>
      <div className="xa-module-status-copy">
        <p className="xa-module-card-eyebrow">ESTADO DE LA SECCIÓN</p>
        <h2>Integración pendiente</h2>
        <p>Esta sección todavía no está conectada a una API. Por ahora no consulta, modifica ni presenta registros operativos.</p>
      </div>
      <div className="xa-module-source"><span>Fuente de datos</span><strong>No disponible</strong></div>
    </div>
    <div className="xa-module-footer">
      <p>Cuando exista una integración autorizada, esta vista podrá mostrar la información disponible para tu perfil.</p>
      <Link to="/dashboard"><Icon name="arrow" size={16} /> Volver al resumen</Link>
    </div>
  </section>;
}
