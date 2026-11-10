import { useEffect, useState } from 'react';
import { listAdminCategories, type AdminCategoryRecord } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { StatePanel } from '../components/common';

export function AdminCategoriesPage() {
  const allowed = getSession()?.permissions?.includes('dashboard:read') ?? false;
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminCategories().then(rows => { if (active) setCategories(rows); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las categorías.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar las categorías." />;
  return <section className="admin-categories-page"><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN Y SEGURIDAD</p><h1>Categorías</h1><p>Catálogo y relaciones registradas en XAMUKO.</p></div></div>
    {loading ? <StatePanel kind="loading" title="Cargando categorías" message="Consultando datos reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar las categorías" message={error} retry={() => setRevision(value => value + 1)} /> : categories.length === 0 ? <StatePanel kind="empty" title="Sin categorías" message="La base de datos no contiene categorías." /> : <div className="admin-directory-table"><table><thead><tr><th>Categoría</th><th>Código</th><th>Estado</th><th>Negocios</th><th>Productos y servicios</th></tr></thead><tbody>{categories.map(item => <tr key={item.id}><td><strong>{item.translations.find(translation => translation.locale === 'es')?.name ?? item.translations[0]?.name ?? item.code}</strong></td><td>{item.code}</td><td><span className="status-pill">{item.active ? 'Activa' : 'Inactiva'}</span></td><td>{item._count.businesses}</td><td>{item._count.offers}</td></tr>)}</tbody></table></div>}
  </section>;
}
