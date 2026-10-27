import { Link, useLocation } from 'react-router-dom';
import { navigation } from '../data/navigation';
import { Icon } from '../components/Icon';

export function PendingModulePage() {
  const { pathname } = useLocation();
  const module = navigation.find(item => item.path === pathname);
  return <section className="xa-pending-module"><span className="xa-pending-icon"><Icon name={module?.icon || 'grid'} size={30} /></span><p className="eyebrow">PRÓXIMAMENTE</p><h1>{module?.label || 'Módulo'}</h1><p>{module?.description || 'Esta función aún no está disponible.'} Aquí aparecerán datos reales cuando exista la integración correspondiente.</p><Link to="/dashboard">Volver al inicio <Icon name="arrow" size={16} /></Link></section>;
}
