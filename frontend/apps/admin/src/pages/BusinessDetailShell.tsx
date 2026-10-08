import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Panel, StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { BusinessBadge } from '../components/businesses/BusinessBadge';
import { BusinessDetailPage } from './BusinessDetailPage';
import { businessStatusLabels, listBusinesses, visibilityLabels } from '../services/businessService';
import { plainDate } from '../utils/business';
import type { ManagedBusiness } from '../types/business';

function PublicSnapshot({ business }: { business: ManagedBusiness }) {
  return <Panel title="Resumen de publicación"><div className="public-snapshot"><div className="public-snapshot-heading">{business.photos[0]?.url ? <img src={business.photos[0].url} alt="" /> : <span className="business-avatar">{business.name.slice(0, 2).toUpperCase()}</span>}<div><strong>{business.name}</strong><p>{business.category} · {business.location.city}</p><div className="public-snapshot-badges"><BusinessBadge status={business.status} label={businessStatusLabels[business.status]} />{business.status !== business.visibility.status && !(business.status === 'pending' && business.visibility.status === 'review') && <BusinessBadge status={business.visibility.status} label={visibilityLabels[business.visibility.status]} />}</div></div></div><div className="public-snapshot-grid"><div><span>Calificación</span><strong>{business.rating ? `${business.rating.toFixed(1)} / 5` : 'Sin calificar'}</strong><small>{business.reviewCount} opiniones</small></div><div><span>Estado actual</span><strong>{business.isOpen === undefined ? 'Horario pendiente' : business.isOpen ? 'Abierto ahora' : 'Cerrado ahora'}</strong><small>Según el horario publicado</small></div><div><span>Fotografías</span><strong>{business.photos.length}</strong><small>Desde WIT Negocios</small></div><div><span>Catálogo</span><strong>{business.content.length}</strong><small>{business.content.filter(item => item.kind === 'product').length} productos · {business.content.filter(item => item.kind === 'service').length} servicios</small></div></div><div className="public-snapshot-contact"><span><Icon name="phone" size={15} /> {business.phone}</span>{business.email && <span><Icon name="message" size={15} /> {business.email}</span>}{business.website && <span><Icon name="globe" size={15} /> {business.website}</span>}<span><Icon name="clock" size={15} /> Creado {plainDate(business.createdAt)}</span></div></div></Panel>;
}

export function BusinessDetailShell() {
  const { id } = useParams(); const navigate = useNavigate(); const location = useLocation(); const fromCategory = new URLSearchParams(location.search).get('fromCategory'); const [business, setBusiness] = useState<ManagedBusiness | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; listBusinesses().then(items => { if (active) setBusiness(items.find(item => item.id === id) || null); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  if (loading) return <StatePanel kind="loading" title="Cargando establecimiento…" message="Consultamos el resumen de publicación." />;
  if (!business) return <BusinessDetailPage />;
  return <div className="business-shell"><Link className="back-link detail-back-link shell-back-link" to="/businesses" onClick={event => { event.preventDefault(); navigate(-1); }}><Icon name="arrow" size={16} /> {fromCategory ? 'Volver a categorías' : 'Volver a la página anterior'}</Link><PublicSnapshot business={business} /><BusinessDetailPage /></div>;
}
