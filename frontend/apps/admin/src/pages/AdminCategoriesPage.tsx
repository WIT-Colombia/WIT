import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Panel, StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { listAdminCategories, type AdminCategoryRecord } from '../services/adminApiClient';
import './AdminCategoriesPage.css';
import { resolveCategoryVisual } from './categoryVisuals';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITHOUT_BUSINESSES';
type SortOrder = 'ORDER' | 'NAME' | 'BUSINESSES' | 'OFFERS';
const PAGE_SIZE = 12;
const numberFormat = new Intl.NumberFormat('es-CO');
const number = (value: number) => numberFormat.format(value);
const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO');
const categoryName = (category: AdminCategoryRecord) =>
  category.translations.find(item => item.locale.toLowerCase().startsWith('es'))?.name
    ?? category.translations[0]?.name ?? category.code;
const products = (category: AdminCategoryRecord): number | null =>
  Number.isFinite(category.productCount) ? category.productCount! : null;
const services = (category: AdminCategoryRecord): number | null =>
  Number.isFinite(category.serviceCount) ? category.serviceCount! : null;
const offers = (category: AdminCategoryRecord) => products(category) !== null &&
  services(category) !== null ? products(category)! + services(category)! : category._count.offers;
const displayCount = (value: number | null) => value === null ? '—' : number(value);
const safeCsv = (value: string | number) => {
  const raw = String(value);
  const safe = /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
};
function Metric({ title, value, hint, icon, tone }: {
  title: string; value: number; hint: string; icon: string; tone: string;
}) {
  return <article className={'cat-metric cat-metric--' + tone}>
    <span className="cat-metric-icon"><Icon name={icon} size={20} /></span>
    <div className="cat-metric-info"><span>{title}</span>
      <strong>{number(value)}</strong><small>{hint}</small></div>
  </article>;
}
function CategoryIcon({category,detail=false,compact=false}: {
  category: AdminCategoryRecord; detail?: boolean; compact?: boolean;
}) {
  const visual = resolveCategoryVisual(category.code,categoryName(category));
  const className = (detail ? 'cat-detail-icon' : compact ? 'cat-ranking-glyph' : 'cat-category-icon')
    + ' cat-category-icon--' + visual.tone;
  return <span className={className} data-category-glyph={visual.glyph} aria-hidden="true">
    <Icon name={visual.glyph} size={detail ? 23 : compact ? 15 : 19} />
  </span>;
}
function CategoryStatus({ active }: { active: boolean }) {
  return <span className={'cat-state ' + (active ? 'cat-state--active' : 'cat-state--inactive')}>
    <span className="cat-state-dot" aria-hidden="true" />{active ? 'Activa' : 'Inactiva'}
  </span>;
}
function CategoryDetails({ category, onClose, canOpenBusinesses }: {
  category: AdminCategoryRecord; onClose: () => void; canOpenBusinesses: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    const priorFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled])',
      ) ?? [])];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault(); controls[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = oldOverflow;
      priorFocus?.focus();
    };
  }, []);

  const names = [...category.translations].sort((a, b) =>
    (a.locale.startsWith('es') ? 0 : 1) - (b.locale.startsWith('es') ? 0 : 1) ||
    a.locale.localeCompare(b.locale));
  return <div className="cat-detail-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <aside ref={dialogRef} className="cat-detail" role="dialog" aria-modal="true"
      aria-labelledby="cat-detail-title" aria-describedby="cat-detail-description">
      <header className="cat-detail-top">
        <CategoryIcon category={category} detail />
        <button ref={closeButton} type="button" className="cat-detail-close"
          aria-label="Cerrar ficha de categoría" onClick={onClose}>
          <Icon name="close" size={19} />
        </button>
      </header>
      <span className="cat-eyebrow">FICHA DE CATEGORÍA</span>
      <h2 id="cat-detail-title">{categoryName(category)}</h2>
      <p id="cat-detail-description">Consulta la clasificación y los registros asociados.
        Los cambios de estado y estructura no están habilitados en esta vista.</p>
      <div className="cat-detail-meta">
        <CategoryStatus active={category.active} />
        <span className="cat-code">{category.code}</span>
      </div>
      <div className="cat-detail-metrics">
        <div><small>Negocios</small><strong>{number(category._count.businesses)}</strong></div>
        <div><small>Productos</small><strong>{displayCount(products(category))}</strong></div>
        <div><small>Servicios</small><strong>{displayCount(services(category))}</strong></div>
      </div>
      <section className="cat-detail-section">
        <h3><Icon name="globe" size={17} /> Nombres e idiomas</h3>
        {names.length ? <dl className="cat-detail-translations">
          {names.map(item => <div key={item.locale}><dt>{item.locale.toUpperCase()}</dt>
            <dd>{item.name}</dd></div>)}
        </dl> : <p className="cat-detail-muted">Esta categoría no tiene nombres traducidos.
          Se utiliza su código como referencia.</p>}
      </section>
      <section className="cat-detail-section">
        <h3><Icon name="database" size={17} /> Cómo se calculan las cifras</h3>
        <p>Los negocios se agrupan por su categoría principal. Productos y servicios
          son las publicaciones no eliminadas con esta categoría asignada. Si la publicación
          no tiene categoría propia, se utiliza la categoría principal de su negocio. Un cero representa un conteo
          confirmado; «—» significa que el servidor todavía no suministra ese dato.
          No representan ventas ni publicaciones necesariamente visibles.</p>
      </section>
      <footer className="cat-detail-actions">
        {canOpenBusinesses && <Link to={'/businesses?categoryId=' + encodeURIComponent(category.id)}
          onClick={onClose} className="cat-detail-link">Ver negocios <Icon name="arrow" size={15} /></Link>}
        <Link to={'/content?categoryId=' + encodeURIComponent(category.id)}
          onClick={onClose} className="cat-detail-link cat-detail-link--secondary">
          Ver contenido <Icon name="arrow" size={15} /></Link>
      </footer>
    </aside>
  </div>;
}

export function AdminCategoriesPage() {
  const session = getSession();
  const allowed = session?.permissions?.includes('catalog:read') === true ||
    session?.realRole === 'SUPER_ADMIN';
  const canOpenBusinesses = session?.permissions?.includes('business:write') ?? false;
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(allowed));
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<SortOrder>('ORDER');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    listAdminCategories().then(rows => {
      if (active) { setCategories(rows); setError(''); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'No fue posible consultar las categorías.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [allowed, revision]);

  const stats = useMemo(() => ({
    total: categories.length,
    active: categories.filter(category => category.active).length,
    inactive: categories.filter(category => !category.active).length,
    businesses: categories.reduce((sum, category) => sum + category._count.businesses, 0),
    products: categories.reduce((sum, category) => sum + (products(category) ?? 0), 0),
    services: categories.reduce((sum, category) => sum + (services(category) ?? 0), 0),
    complete: categories.every(category => products(category) !== null && services(category) !== null),
    empty: categories.filter(category => category._count.businesses === 0).length,
  }), [categories]);
  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    return categories.filter(category => {
      if (filter === 'ACTIVE' && !category.active) return false;
      if (filter === 'INACTIVE' && category.active) return false;
      if (filter === 'WITHOUT_BUSINESSES' && category._count.businesses > 0) return false;
      return !query || normalize(category.code + ' ' +
        category.translations.map(translation => translation.name + ' ' + translation.locale).join(' '))
        .includes(query);
    }).sort((a, b) => {
      if (sort === 'NAME') return categoryName(a).localeCompare(categoryName(b), 'es');
      if (sort === 'BUSINESSES') return b._count.businesses - a._count.businesses ||
        categoryName(a).localeCompare(categoryName(b), 'es');
      if (sort === 'OFFERS') return offers(b) - offers(a) ||
        categoryName(a).localeCompare(categoryName(b), 'es');
      return a.sortOrder - b.sortOrder || categoryName(a).localeCompare(categoryName(b), 'es');
    });
  }, [categories, search, filter, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const actualPage = Math.min(page, pages);
  const visible = filtered.slice((actualPage - 1) * PAGE_SIZE, actualPage * PAGE_SIZE);
  const details = categories.find(category => category.id === selectedId) ?? null;
  const ranking = useMemo(() => [...categories].filter(category => category._count.businesses > 0)
    .sort((a, b) => b._count.businesses - a._count.businesses ||
      categoryName(a).localeCompare(categoryName(b), 'es')).slice(0, 6), [categories]);

  const resetFilters = () => {
    setSearch(''); setFilter('ALL'); setSort('ORDER'); setPage(1);
  };
  const exportCsv = () => {
    const header = ['Categoría', 'Código', 'Estado', 'Negocios', 'Productos', 'Servicios',
      stats.complete ? 'Publicaciones por categoría del negocio' : 'Publicaciones con categoría individual (datos antiguos)', 'Orden'];
    const rows = filtered.map(category => [categoryName(category), category.code,
      category.active ? 'Activa' : 'Inactiva', category._count.businesses,
      products(category) ?? '', services(category) ?? '', offers(category), category.sortOrder]);
    const csv = '\ufeff' + [header, ...rows].map(row => row.map(safeCsv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'xamuko-categorias.csv';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!allowed) return <StatePanel kind="permission" title="Acceso restringido"
    message="Necesitas permiso de catálogo para consultar las categorías." />;
  if (loading && categories.length === 0 && !error) return <div className="cat-skeleton" role="status">
    <div className="cat-skeleton-heading" />
    <div className="cat-skeleton-kpis">{Array.from({ length: 5 }, (_, index) =>
      <div className="cat-skeleton-card" key={index} />)}</div>
    <div className="cat-skeleton-main" />
    <span className="cat-visually-hidden">Cargando categorías del catálogo.</span>
  </div>;
  if (error && categories.length === 0) return <StatePanel kind="error"
    title="No pudimos cargar las categorías" message={error} retry={refresh} />;

  return <section className="categories-workspace" aria-labelledby="cat-title">
    <header className="cat-page-head">
      <div className="cat-page-title">
        <span className="cat-eyebrow"><Icon name="tag" size={15} /> ESTRUCTURA DEL CATÁLOGO</span>
        <h1 id="cat-title">Categorías</h1>
        <p>Consulta la organización de los negocios y su contenido en XAMUKO.
          Información real para identificar categorías con mayor actividad registrada.</p>
        <div className="cat-head-tags">
          <span><Icon name="database" size={14} /> Datos del catálogo</span>
          <span><Icon name="shield" size={14} /> Vista de consulta</span>
          <span><Icon name="check" size={14} /> Los ceros se muestran</span>
        </div>
      </div>
      <button className="cat-refresh" type="button" onClick={refresh} disabled={loading}>
        <Icon name="refresh" size={17} /> {loading ? 'Actualizando…' : 'Actualizar datos'}
      </button>
    </header>

    {categories.length > 0 && !stats.complete && <div className="cat-warning cat-warning--info" role="status">
      <Icon name="database" size={18} /><span>El servidor actual todavía no ofrece
        el desglose por categoría del negocio. Mostramos «—» en lugar de inventar cifras;
        los contadores de negocios siguen disponibles.</span></div>}
    {error && <div className="cat-warning" role="alert">
      <Icon name="flag" size={18} /> <span>No se pudieron actualizar las categorías.
        Se muestran los últimos datos consultados: {error}</span>
      <button type="button" onClick={refresh}>Reintentar</button></div>}

    <div className="cat-metrics" aria-label="Resumen del catálogo">
      <Metric icon="grid" tone="blue" title="Categorías totales"
        value={stats.total} hint="En el catálogo" />
      <Metric icon="check" tone="green" title="Categorías activas"
        value={stats.active} hint="Habilitadas" />
      <Metric icon="lock" tone="neutral" title="Inactivas"
        value={stats.inactive} hint="No habilitadas" />
      <Metric icon="store" tone="purple" title="Negocios asignados"
        value={stats.businesses} hint="Por categoría principal" />
      {stats.complete ? <Metric icon="box" tone="teal" title="Productos y servicios"
        value={stats.products + stats.services}
        hint={number(stats.products) + ' productos · ' + number(stats.services) + ' servicios'} /> :
        <article className="cat-metric cat-metric--neutral"><span className="cat-metric-icon"><Icon name="box" size={20} /></span>
          <div className="cat-metric-info"><span>Productos y servicios</span>
            <strong>—</strong><small>Desglose pendiente del servidor</small></div>
        </article>}
    </div>

    <div className="cat-layout">
      <Panel className="cat-directory" title="Directorio de categorías"
        subtitle="Explora las categorías, consulta sus cifras y abre sus fichas."
        action={<span className="cat-count-tag">{number(stats.total)} categorías</span>}>
        <div className="cat-toolbar">
          <label className="cat-search" htmlFor="cat-search">
            <span>Buscar categoría</span>
            <div><Icon name="search" size={17} />
              <input id="cat-search" type="search" placeholder="Nombre, código o idioma"
                value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
            </div>
          </label>
          <label htmlFor="cat-status-filter">Estado
            <select id="cat-status-filter" value={filter} onChange={event => {
              setFilter(event.target.value as StatusFilter); setPage(1);
            }}>
              <option value="ALL">Todas las categorías</option>
              <option value="ACTIVE">Activas</option>
              <option value="INACTIVE">Inactivas</option>
              <option value="WITHOUT_BUSINESSES">Sin negocios</option>
            </select>
          </label>
          <label htmlFor="cat-sort">Ordenar
            <select id="cat-sort" value={sort} onChange={event => {
              setSort(event.target.value as SortOrder); setPage(1);
            }}>
              <option value="ORDER">Orden del catálogo</option>
              <option value="BUSINESSES">Más negocios</option>
              <option value="OFFERS">Más publicaciones</option>
              <option value="NAME">Nombre A–Z</option>
            </select>
          </label>
        </div>
        <div className="cat-toolbar-foot">
          <div><strong>{number(filtered.length)} categorías</strong>
            <small>{filtered.length === categories.length ? 'Catálogo completo' : 'Coinciden con los filtros'}</small></div>
          <div className="cat-actions">
            <button type="button" className="cat-clear" onClick={resetFilters}>
              <Icon name="refresh" size={15} /> Limpiar filtros
            </button>
            <button type="button" className="cat-export" disabled={!filtered.length}
              onClick={exportCsv}><Icon name="download" size={16} /> Exportar CSV</button>
          </div>
        </div>
        {visible.length ? <div className="cat-table-wrap">
          <table className="cat-table">
            <thead><tr>
              <th scope="col">Categoría</th><th scope="col">Estado</th>
              <th scope="col" className="cat-numeric">Negocios</th>
              <th scope="col" className="cat-numeric">Productos</th>
              <th scope="col" className="cat-numeric">Servicios</th>
              <th scope="col">Detalle</th>
            </tr></thead>
            <tbody>{visible.map(category => <tr key={category.id}>
              <td className="cat-name-cell" data-label="Categoría">
                <CategoryIcon category={category} />
                <span className="cat-name-info"><strong>{categoryName(category)}</strong>
                  <small>{category.code}</small></span>
              </td>
              <td data-label="Estado"><CategoryStatus active={category.active} /></td>
              <td className="cat-numeric" data-label="Negocios"><strong>{number(category._count.businesses)}</strong></td>
              <td className="cat-numeric" data-label="Productos"><strong>{displayCount(products(category))}</strong></td>
              <td className="cat-numeric" data-label="Servicios"><strong>{displayCount(services(category))}</strong></td>
              <td data-label="Detalle"><button className="cat-details-button" type="button"
                aria-label={'Ver detalle de ' + categoryName(category)}
                onClick={() => setSelectedId(category.id)}>
                <Icon name="eye" size={16} /> Ver detalle</button></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="cat-empty-state">
          <span><Icon name={categories.length ? 'search' : 'grid'} size={28} /></span>
          <strong>{categories.length ? 'No hay categorías con esos filtros' : 'El catálogo está vacío'}</strong>
          <p>{categories.length ? 'Modifica el texto o los filtros para consultar otras categorías.'
            : 'Todavía no hay categorías registradas en la base de datos.'}</p>
          {categories.length > 0 && <button type="button" onClick={resetFilters}>Restablecer filtros</button>}
        </div>}
        {pages > 1 && <nav className="cat-pagination" aria-label="Paginación de categorías">
          <span>Mostrando {number((actualPage - 1) * PAGE_SIZE + 1)}–
            {number(Math.min(actualPage * PAGE_SIZE, filtered.length))} de {number(filtered.length)}</span>
          <div><button type="button" disabled={actualPage === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
            <strong>Página {actualPage} de {pages}</strong>
            <button type="button" disabled={actualPage === pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}>Siguiente</button>
          </div>
        </nav>}
        <p className="cat-directory-note">
          <Icon name="database" size={15} />
          {stats.complete
            ? 'Los negocios se agrupan por categoría principal. Las publicaciones usan su categoría propia, o la del negocio cuando no tienen una. Los ceros son reales.'
            : 'El servidor aún no ofrece un desglose completo de productos y servicios. Un guion significa dato no disponible, no cero.'}
        </p>
      </Panel>

      <aside className="cat-side" aria-label="Análisis complementario de categorías">
        <section className="cat-side-panel">
          <div className="cat-side-heading"><span className="cat-side-icon"><Icon name="chart" size={20} /></span>
            <div><h2>Categorías con más negocios</h2>
              <p>Distribución según registros de negocios.</p></div>
          </div>
          {ranking.length ? <ol className="cat-ranking">
            {ranking.map((category, index) => {
              const max = ranking[0]._count.businesses;
              return <li key={category.id}>
                <div className="cat-ranking-top">
                  <span><small>{String(index + 1).padStart(2, '0')}</small>
                    <CategoryIcon category={category} compact />
                    <strong>{categoryName(category)}</strong></span>
                  <b>{number(category._count.businesses)}</b></div>
                <div className="cat-ranking-bar" role="img" aria-label={
                  categoryName(category) + ': ' + number(category._count.businesses) + ' negocios'}>
                  <span style={{ width: (max ? 100 * category._count.businesses / max : 0) + '%' }} />
                </div>
                <small>{number(offers(category))} {stats.complete ? 'productos y servicios' : 'publicaciones con categoría individual'}</small>
              </li>;
            })}
          </ol> : <p className="cat-side-empty">Todavía no hay negocios asignados a categorías.</p>}
        </section>
        <section className="cat-side-panel">
          <div className="cat-side-heading"><span className="cat-side-icon"><Icon name="grid" size={20} /></span>
            <div><h2>Estado del catálogo</h2><p>Resumen de clasificación actual.</p></div>
          </div>
          <div className="cat-distribution" role="img" aria-label={
            number(stats.active) + ' activas y ' + number(stats.inactive) + ' inactivas'}>
            <span style={{ width: (stats.total ? stats.active / stats.total * 100 : 0) + '%' }} />
          </div>
          <dl className="cat-legend">
            <div><dt><i className="cat-legend-dot cat-legend-dot--active" />Activas</dt>
              <dd>{number(stats.active)}</dd></div>
            <div><dt><i className="cat-legend-dot cat-legend-dot--inactive" />Inactivas</dt>
              <dd>{number(stats.inactive)}</dd></div>
            <div><dt><i className="cat-legend-dot cat-legend-dot--empty" />Sin negocios</dt>
              <dd>{number(stats.empty)}</dd></div>
          </dl>
        </section>
        <section className="cat-help">
          <span className="cat-side-icon"><Icon name="shield" size={20} /></span>
          <h2>Cómo interpretar estos datos</h2>
          <p><strong>Negocios:</strong> cantidad de negocios vinculados a su categoría principal,
            independientemente de que estén publicados.</p>
          <p><strong>Productos y servicios:</strong> {stats.complete
            ? 'publicaciones no eliminadas con categoría propia o, si no existe, la categoría principal de su negocio.'
            : 'el desglose por categoría del negocio todavía no está disponible en este servidor.'}
            No representan ventas, visualizaciones ni contenido necesariamente visible.</p>
          <p><strong>Estado:</strong> indica si la categoría está habilitada en el catálogo,
            no la disponibilidad territorial de sus negocios.</p>
        </section>
      </aside>
    </div>
    {details && <CategoryDetails category={details} onClose={() => setSelectedId(null)}
      canOpenBusinesses={canOpenBusinesses} />}
  </section>;
}
