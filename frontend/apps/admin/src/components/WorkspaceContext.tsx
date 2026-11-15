import { Link, useLocation } from 'react-router-dom';
import { navigation, navigationGroups } from '../data/navigation';
import { Icon } from './Icon';
import workspaceArt from '../assets/admin-workspace-960.webp';
import workspaceArt4k from '../assets/admin-workspace-4k.webp';

const captions: Record<string, string> = {
  inicio: 'Una visión clara para tomar mejores decisiones.', plataforma: 'La información de tu comunidad, organizada y accesible.', crecimiento: 'Construye el siguiente capítulo de la plataforma.', finanzas: 'Control y claridad sobre los recursos de la organización.', tecnologia: 'Continuidad, trazabilidad y control operativo.', soporte: 'Cada solicitud merece una respuesta y un seguimiento.', juridica: 'El respaldo documental de una organización que crece.', configuracion: 'Un entorno de trabajo ordenado, seguro y bajo control.',
};
export function WorkspaceContext() {
  const { pathname } = useLocation();
  if (pathname === '/businesses' || pathname.startsWith('/businesses/') || pathname === '/users' || pathname.startsWith('/users/')) return null;
  const item = navigation.find(entry => pathname === entry.path || pathname.startsWith(`${entry.path}/`));
  const group = navigationGroups.find(entry => entry.id === item?.group);
  return <div className="ad-workspace-context" data-area={group?.id || 'inicio'}>
    <div><nav aria-label="Ubicación administrativa"><Link to="/dashboard">XAMUKO Admin</Link><span>/</span><span>{group?.label || 'Administración'}</span></nav><p>{captions[group?.id || 'inicio']}</p><span className={`ad-context-status${item?.pending ? ' ad-context-status--pending' : ''}`}><i/>{item?.pending ? 'Módulo en preparación' : 'Espacio de trabajo administrativo'}</span></div>
    <img src={workspaceArt} srcSet={`${workspaceArt} 960w, ${workspaceArt4k} 3840w`} sizes="(max-width: 650px) 100px, 200px" width="3840" height="2160" alt="" aria-hidden="true" />
    <span className="ad-context-symbol" aria-hidden="true"><Icon name={item?.icon || 'grid'} size={22}/></span>
  </div>;
}
