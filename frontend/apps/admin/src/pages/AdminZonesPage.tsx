import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Panel, StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import {
  getAdminZones, updateAdminZone, type ZoneEntry, type ZoneLaunchState,
  type ZoneRegistry, type ZoneScope,
} from '../services/adminApiClient';
import './AdminZonesPage.css';

type View = 'MUNICIPALITY' | 'DEPARTMENT' | 'AUDIT';
type SortOrder = 'priority' | 'registered' | 'ready' | 'name' | 'opening';
type Decision = { scope: ZoneScope; zone: ZoneEntry };
const PAGE_SIZE = 12;
const stateLabels: Record<ZoneLaunchState, string> = {
  OPEN: 'Activa', SCHEDULED: 'Programada', PAUSED: 'Pausada', CLOSED: 'No disponible',
};
const stateOrder: Record<ZoneLaunchState, number> = {
  OPEN: 0, SCHEDULED: 1, PAUSED: 2, CLOSED: 3,
};
const actionLabels: Record<string, string> = {
  ZONE_OPEN: 'Apertura inmediata',
  ZONE_SCHEDULED: 'Apertura programada',
  ZONE_PAUSED: 'Exploración pausada',
  ZONE_CLOSED: 'Zona cerrada',
};
const numberFormat = new Intl.NumberFormat('es-CO');
const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
});
const formatNumber = (value: number) => numberFormat.format(value);
const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Sin fecha programada';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : 'Fecha no disponible';
};
const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO');
const pad = (value: number) => String(value).padStart(2, '0');
const localBogota = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return value('year') + '-' + value('month') + '-' + value('day')
    + 'T' + value('hour') + ':' + value('minute');
};
const remaining = (iso: string, now: number) => {
  const milliseconds = Math.max(0, new Date(iso).getTime() - now);
  const seconds = Math.floor(milliseconds / 1000);
  return [
    { label: 'Días', value: Math.floor(seconds / 86400) },
    { label: 'Horas', value: Math.floor(seconds % 86400 / 3600) },
    { label: 'Minutos', value: Math.floor(seconds % 3600 / 60) },
    { label: 'Segundos', value: seconds % 60 },
  ];
};
const remainingCompact = (iso: string, now: number) => {
  const units = remaining(iso, now);
  return units[0].value + 'd ' + pad(units[1].value) + 'h ' +
    pad(units[2].value) + 'm';
};
const readAuditState = (value: unknown): ZoneLaunchState | null => {
  if (!value || typeof value !== 'object' || !('state' in value)) return null;
  const state = (value as { state?: unknown }).state;
  return typeof state === 'string' && state in stateLabels ? state as ZoneLaunchState : null;
};
const readAuditCode = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || !('code' in value)) return null;
  return typeof (value as { code?: unknown }).code === 'string'
    ? (value as { code: string }).code : null;
};
const csvCell = (value: string | number) => {
  const string = String(value);
  // Inhibit formula execution when a spreadsheet opens exported city names or labels.
  const safe = /^[\s]*[=+@-]/.test(string) ? "'" + string : string;
  return '"' + safe.replaceAll('"', '""') + '"';
};
function StatusBadge({ state, source }: { state: ZoneLaunchState; source?: ZoneEntry['source'] }) {
  return <span className="zones-status-wrap">
    <span className={'zones-status zones-status--' + state.toLowerCase()}>
      <span aria-hidden="true" className="zones-status-dot" />{stateLabels[state]}
    </span>
    {source === 'DEPARTMENT' && <small>Heredada</small>}
    {source === 'INITIAL' && <small>Apertura inicial</small>}
  </span>;
}
function CountdownPanel({ opensAt, now }: { opensAt: string; now: number }) {
  return <div className="zones-countdown" role="timer"
    aria-label={'Tiempo restante hasta el lanzamiento: ' + remainingCompact(opensAt, now)}>
    {remaining(opensAt, now).map(unit => <div className="zones-countdown-unit" key={unit.label}>
      <strong>{pad(unit.value)}</strong><small>{unit.label}</small>
    </div>)}
  </div>;
}
function MetricCard({ label, value, icon, hint, tone }: {
  label: string; value: number; icon: string; hint: string; tone: string;
}) {
  return <article className={'zones-metric zones-metric--' + tone}>
    <span className="zones-metric-icon"><Icon name={icon} size={20} /></span>
    <div className="zones-metric-copy">
      <span>{label}</span><strong>{formatNumber(value)}</strong><small>{hint}</small>
    </div>
  </article>;
}
function ZoneDecisionDialog({ value, records, close, save }: {
  value: Decision; records: ZoneRegistry['records']; close: () => void;
  save: (state: ZoneLaunchState, date: string | null, reason: string) => Promise<void>;
}) {
  const previous = records.find(record =>
    record.scope === value.scope && record.code === value.zone.code);
  const [state, setState] = useState<ZoneLaunchState>(previous?.state ?? value.zone.state);
  const [date, setDate] = useState(localBogota(previous?.opensAt ?? value.zone.opensAt));
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(close);
  const workingRef = useRef(working);
  closeRef.current = close;
  workingRef.current = working;
  const originalStatus = previous?.state ?? value.zone.state;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !workingRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      ) ?? [])];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    if (confirmation !== 'APLICAR' || reason.trim().length < 12) {
      setError('Confirma la operación y explica el motivo con al menos 12 caracteres.');
      return;
    }
    const scheduled = state === 'SCHEDULED' ? new Date(date + '-05:00') : null;
    if (state === 'SCHEDULED' && (!date || !scheduled ||
      !Number.isFinite(scheduled.getTime()) || scheduled <= new Date())) {
      setError('La apertura debe programarse para una fecha y hora futuras de Colombia.');
      return;
    }
    setError(''); setWorking(true);
    try {
      await save(state, scheduled?.toISOString() ?? null, reason.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar la decisión.');
    } finally {
      setWorking(false);
    }
  };

  return <div className="zones-modal-backdrop"
    onMouseDown={event => { if (!working && event.target === event.currentTarget) close(); }}>
    <section ref={dialogRef} className="zones-modal" role="dialog" aria-modal="true"
      aria-labelledby="zones-dialog-title" aria-describedby="zones-dialog-description">
      <header className="zones-modal-header">
        <div className="zones-modal-heading">
          <span className="zones-modal-icon"><Icon name="globe" size={21} /></span>
          <div><span className="zones-eyebrow">DECISIÓN ADMINISTRATIVA</span>
            <h2 id="zones-dialog-title">{value.zone.name}</h2>
            <p>{value.scope === 'DEPARTMENT' ? 'Departamento' : 'Municipio'} · Código {value.zone.code}</p>
          </div>
        </div>
        <button className="zones-icon-button" type="button" aria-label="Cerrar ventana"
          disabled={working} onClick={close}><Icon name="close" size={19} /></button>
      </header>
      <div className="zones-modal-body">
        <p id="zones-dialog-description" className="zones-modal-description">
          Controla la exploración de negocios físicos de este territorio. Los registros y los negocios
          virtuales activos seguirán disponibles en toda Colombia.
        </p>
        <div className="zones-modal-status">
          <div><small>Estado actual</small><StatusBadge state={originalStatus}
            source={!previous ? value.zone.source : undefined} /></div>
          <Icon name="arrow" size={18} />
          <div><small>Nuevo estado</small><StatusBadge state={state} /></div>
        </div>
        <form onSubmit={submit} className="zones-decision-form">
          <label htmlFor="zones-decision-state">Acción territorial
            <select id="zones-decision-state" value={state} disabled={working}
              onChange={event => { setState(event.target.value as ZoneLaunchState); setError(''); }}>
              <option value="CLOSED">Mantener no disponible</option>
              <option value="SCHEDULED">Programar apertura</option>
              <option value="OPEN">Abrir inmediatamente</option>
              <option value="PAUSED">Pausar temporalmente</option>
            </select>
          </label>
          {state === 'SCHEDULED' && <label htmlFor="zones-decision-date">
            Fecha y hora de apertura (Colombia, UTC−5)
            <input id="zones-decision-date" type="datetime-local" required
              value={date} disabled={working}
              onChange={event => setDate(event.target.value)} />
            <small>La visibilidad se habilita automáticamente en la hora programada.</small>
          </label>}
          {value.scope === 'DEPARTMENT' && <div className="zones-modal-warning">
            <Icon name="flag" size={17} />
            <p>Esta decisión se aplica a los municipios del departamento, excepto aquellos
              que tengan una configuración individual.</p>
          </div>}
          {!previous && value.zone.source === 'DEPARTMENT' && <div className="zones-modal-neutral">
            <Icon name="shield" size={16} />
            <p>Esta zona hereda su estado del departamento. Al guardar crearás una
              configuración municipal específica.</p>
          </div>}
          <label htmlFor="zones-decision-reason">Motivo administrativo
            <textarea id="zones-decision-reason" rows={3} required minLength={12} maxLength={500}
              value={reason} disabled={working} onChange={event => setReason(event.target.value)}
              placeholder="Explica el motivo de apertura, cambio de fecha, pausa o cierre." />
            <small>{reason.length}/500 caracteres · Se guardará en auditoría.</small>
          </label>
          <label htmlFor="zones-decision-confirm">Confirmación de seguridad
            <span className="zones-confirmation-caption">Escribe <b>APLICAR</b> para guardar la decisión.</span>
            <input id="zones-decision-confirm" autoComplete="off" required
              value={confirmation} disabled={working}
              onChange={event => setConfirmation(event.target.value)} />
          </label>
          {error && <p className="zones-modal-error" role="alert"><Icon name="flag" size={16} />{error}</p>}
          <footer className="zones-modal-footer">
            <button ref={cancelRef} className="secondary-button" type="button"
              disabled={working} onClick={close}>Cancelar</button>
            <button className="primary" type="submit"
              disabled={working || reason.trim().length < 12 || confirmation !== 'APLICAR'}>
              <Icon name={working ? 'clock' : 'shield'} size={17} />
              {working ? 'Guardando decisión…' : 'Guardar decisión'}
            </button>
          </footer>
        </form>
      </div>
    </section>
  </div>;
}

export function AdminZonesPage() {
  const allowed = getSession()?.role === 'SUPER_ADMIN';
  const [data, setData] = useState<ZoneRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<View>('MUNICIPALITY');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState<SortOrder>('priority');
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);

  const refreshData = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const ticker = window.setInterval(() => setClock(Date.now()), 1000);
    const polling = window.setInterval(() => setRevision(value => value + 1), 60000);
    return () => { window.clearInterval(ticker); window.clearInterval(polling); };
  }, []);
  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getAdminZones().then(result => {
      if (!active) return;
      setData(result);
      const serverTime = new Date(result.serverTime).getTime();
      if (Number.isFinite(serverTime)) setOffset(serverTime - Date.now());
      setError('');
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las zonas.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  const registry = useMemo(() => {
    if (!data || view === 'AUDIT') return [] as ZoneEntry[];
    return view === 'DEPARTMENT' ? data.departments : data.municipalities;
  }, [data, view]);
  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    const matching = registry.filter(zone =>
      (status === 'ALL' || zone.state === status) &&
      (view !== 'MUNICIPALITY' || !department || zone.departmentCode === department) &&
      (!search || normalize(zone.name + ' ' + (zone.context ?? '') + ' ' + zone.code).includes(search)),
    );
    return matching.sort((a, b) => {
      if (sort === 'registered') return b.registered - a.registered || a.name.localeCompare(b.name, 'es');
      if (sort === 'ready') return b.ready - a.ready || a.name.localeCompare(b.name, 'es');
      if (sort === 'name') return a.name.localeCompare(b.name, 'es');
      if (sort === 'opening') {
        const aTime = a.state === 'SCHEDULED' && a.opensAt ? new Date(a.opensAt).getTime() : Infinity;
        const bTime = b.state === 'SCHEDULED' && b.opensAt ? new Date(b.opensAt).getTime() : Infinity;
        return aTime - bTime || a.name.localeCompare(b.name, 'es');
      }
      return stateOrder[a.state] - stateOrder[b.state] ||
        b.registered - a.registered || a.name.localeCompare(b.name, 'es');
    });
  }, [registry, status, view, department, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const municipalityCounts = useMemo(() => {
    const counts: Record<ZoneLaunchState, number> = { OPEN: 0, SCHEDULED: 0, PAUSED: 0, CLOSED: 0 };
    for (const zone of data?.municipalities ?? []) counts[zone.state]++;
    return counts;
  }, [data]);
  const leaderboard = useMemo(() =>
    [...(data?.municipalities ?? [])].filter(zone => zone.registered > 0)
      .sort((a, b) => b.registered - a.registered || a.name.localeCompare(b.name, 'es')).slice(0, 7),
  [data]);
  const nextLaunch = data?.nextLaunch &&
    new Date(data.nextLaunch.opensAt).getTime() > clock + offset ? data.nextLaunch : null;

  const selectView = (next: View) => {
    setView(next); setPage(1); setQuery(''); setDepartment(''); setStatus('ALL'); setSort('priority');
  };
  const resetFilters = () => {
    setQuery(''); setDepartment(''); setStatus('ALL'); setSort('priority'); setPage(1);
  };
  const exportFiltered = () => {
    const header = ['Código DIVIPOLA', 'Zona', 'Departamento', 'Estado', 'Origen',
      'Registrados', 'Listos', 'Apertura (ISO, hora Colombia)'];
    const rows = filtered.map(zone => [
      zone.code, zone.name, zone.context ?? '', stateLabels[zone.state], zone.source,
      zone.registered, zone.ready, zone.opensAt ?? '',
    ]);
    const csv = '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'xamuko-zonas-' + view.toLowerCase() + '.csv';
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const save = async (next: ZoneLaunchState, date: string | null, reason: string) => {
    if (!decision) return;
    await updateAdminZone({
      scope: decision.scope, code: decision.zone.code, state: next, opensAt: date, reason,
    });
    setNotice('La configuración de ' + decision.zone.name + ' se guardó y quedó registrada en auditoría.');
    setDecision(null); refreshData();
  };
  const auditTitle = (action: string) => actionLabels[action] ?? action.replaceAll('_', ' ');
  const auditZoneName = (item: ZoneRegistry['audit'][number]) => {
    const code = readAuditCode(item.newState) ?? readAuditCode(item.previousState);
    return [...data!.municipalities, ...data!.departments].find(zone =>
      zone.code === code)?.name ?? 'Territorio registrado';
  };

  if (!allowed) return <StatePanel kind="permission" title="Acceso restringido"
    message="Solo el administrador principal puede consultar y administrar la expansión territorial." />;
  if (loading && !data) return <div className="zones-skeleton" aria-label="Cargando expansión territorial" role="status">
    <div className="zones-skeleton-header" />
    <div className="zones-skeleton-metrics">{Array.from({ length: 5 }, (_, index) =>
      <div key={index} className="zones-skeleton-card" />)}</div>
    <div className="zones-skeleton-banner" /><div className="zones-skeleton-content" />
    <span className="zones-visually-hidden">Consultando cobertura y crecimiento territorial.</span>
  </div>;
  if (!data) return <StatePanel kind="error" title="No se pudo cargar Zonas"
    message={error || 'No se recibió información del servicio.'} retry={refreshData} />;
  const total = data.municipalities.length;
  return <section className="zones-workspace" aria-labelledby="zones-title">
    <header className="zones-page-header">
      <div className="zones-page-heading">
        <span className="zones-eyebrow"><Icon name="globe" size={15} /> CONTROL DE EXPANSIÓN · COLOMBIA</span>
        <h1 id="zones-title">Zonas y expansión territorial</h1>
        <p>Administra dónde crece XAMUKO y programa nuevas aperturas sin afectar los registros nacionales
          ni la visibilidad de los negocios virtuales.</p>
        <div className="zones-header-facts">
          <span><Icon name="check" size={14} /> Registro nacional</span>
          <span><Icon name="globe" size={14} /> Virtuales disponibles en Colombia</span>
          <span><Icon name="clock" size={14} /> Hora oficial de Colombia</span>
        </div>
      </div>
      <div className="zones-page-actions">
        <span className="zones-last-sync"><Icon name="clock" size={14} />
          Actualizado: {formatDate(data.serverTime)}</span>
        <button className="secondary-button zones-refresh-button" type="button"
          disabled={loading} onClick={refreshData}>
          <Icon name="refresh" size={17} />{loading ? 'Actualizando…' : 'Actualizar datos'}
        </button>
      </div>
    </header>
    {error && <div className="zones-error" role="alert"><Icon name="flag" size={17} />
      <span>No se pudo actualizar la información. Se muestran los últimos datos obtenidos: {error}</span>
      <button type="button" className="secondary-button" onClick={refreshData}>Reintentar</button>
    </div>}
    {notice && <div className="zones-notice" role="status"><Icon name="check" size={18} />
      <span>{notice}</span><button aria-label="Cerrar notificación" type="button"
        onClick={() => setNotice('')}><Icon name="close" size={16} /></button>
    </div>}
    <div className="zones-metrics" aria-label="Indicadores reales de expansión">
      <MetricCard label="Municipios activos" value={municipalityCounts.OPEN} icon="globe"
        hint="Visibles para explorar" tone="success" />
      <MetricCard label="Programados" value={municipalityCounts.SCHEDULED} icon="calendar"
        hint="Con apertura pendiente" tone="purple" />
      <MetricCard label="No disponibles" value={municipalityCounts.CLOSED + municipalityCounts.PAUSED}
        icon="lock" hint={formatNumber(municipalityCounts.PAUSED) + ' pausados'} tone="neutral" />
      <MetricCard label="Negocios registrados" value={data.summary.registered} icon="store"
        hint="Con municipio identificado" tone="blue" />
      <MetricCard label="Listos para publicar" value={data.summary.ready} icon="check"
        hint="Según estado del negocio" tone="teal" />
    </div>

    <section className={'zones-launch ' + (nextLaunch ? 'zones-launch--scheduled' : 'zones-launch--empty')}
      aria-labelledby="zones-launch-title">
      <div className="zones-launch-description">
        <span className="zones-launch-kicker"><Icon name={nextLaunch ? 'calendar' : 'clock'} size={16} />
          PRÓXIMA APERTURA</span>
        <h2 id="zones-launch-title">{nextLaunch ? nextLaunch.name : 'Tu próximo lanzamiento comienza aquí'}</h2>
        <p>{nextLaunch
          ? 'Apertura programada para el ' + formatDate(nextLaunch.opensAt) + ' (hora de Colombia).'
          : 'Aún no hay una apertura con fecha futura. Programa una ciudad o un departamento desde el listado.'}</p>
        <span className="zones-launch-note">
          <Icon name="shield" size={15} />
          {nextLaunch ? 'La cuenta regresiva también se muestra en el Landing.'
            : 'Las zonas sin fecha nunca muestran un contador ficticio.'}
        </span>
      </div>
      <div className="zones-launch-right">
        {nextLaunch ? <>
          <span className="zones-countdown-label">ESTAREMOS DISPONIBLES EN</span>
          <CountdownPanel opensAt={nextLaunch.opensAt} now={clock + offset} />
        </> : <div className="zones-launch-placeholder"><Icon name="calendar" size={28} />
          <strong>Sin apertura programada</strong>
          <small>Al programar una zona se actualizará este espacio y el Landing.</small>
        </div>}
      </div>
    </section>

    <div className="zones-content-layout">
      <Panel className="zones-directory" title="Cobertura territorial"
        subtitle="Consulta las zonas, revisa su preparación y administra su disponibilidad."
        action={<span className="zones-directory-total">{formatNumber(total)} municipios en el catálogo</span>}>
        <div className="zones-tabs" role="group" aria-label="Secciones de cobertura">
          <button type="button" className={view === 'MUNICIPALITY' ? 'active' : ''}
            aria-pressed={view === 'MUNICIPALITY'} onClick={() => selectView('MUNICIPALITY')}>
            <Icon name="store" size={17} /> Municipios
            <span>{formatNumber(data.municipalities.length)}</span>
          </button>
          <button type="button" className={view === 'DEPARTMENT' ? 'active' : ''}
            aria-pressed={view === 'DEPARTMENT'} onClick={() => selectView('DEPARTMENT')}>
            <Icon name="globe" size={17} /> Departamentos
            <span>{formatNumber(data.departments.length)}</span>
          </button>
          <button type="button" className={view === 'AUDIT' ? 'active' : ''}
            aria-pressed={view === 'AUDIT'} onClick={() => selectView('AUDIT')}>
            <Icon name="shield" size={17} /> Auditoría
            <span>{formatNumber(data.audit.length)}</span>
          </button>
        </div>
        {view === 'AUDIT' ? <div className="zones-audit">
          <div className="zones-audit-head">
            <h3>Historial de decisiones</h3>
            <p>Últimas {data.audit.length} decisiones registradas, con responsable, fecha, estado y motivo.</p>
          </div>
          {data.audit.length === 0 ? <div className="zones-empty-state">
            <Icon name="shield" size={26} /><strong>Sin actuaciones registradas</strong>
            <p>Las decisiones de apertura, programación, pausa o cierre aparecerán aquí.</p>
          </div> : <ol className="zones-audit-list">
            {data.audit.map(item => <li key={item.id} className="zones-audit-entry">
              <span className="zones-audit-entry-icon"><Icon name="shield" size={18} /></span>
              <div className="zones-audit-entry-content">
                <div className="zones-audit-entry-title">
                  <strong>{auditTitle(item.action)} · {auditZoneName(item)}</strong>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </div>
                <div className="zones-audit-entry-tags">
                  <span>{item.actor?.displayName ?? 'Administrador'}</span>
                  {readAuditState(item.previousState) && <span>Anterior: {stateLabels[readAuditState(item.previousState)!]}</span>}
                  {readAuditState(item.newState) && <span>Nuevo: {stateLabels[readAuditState(item.newState)!]}</span>}
                </div>
                <p>{item.reason || 'El registro no contiene un motivo descriptivo.'}</p>
              </div>
            </li>)}
          </ol>}
        </div> : <>
          <div className="zones-controls">
            <label className="zones-search-field" htmlFor="zones-search">
              <span>Buscar localidad</span>
              <div><Icon name="search" size={17} /><input id="zones-search" type="search"
                placeholder="Ciudad, departamento o código DIVIPOLA"
                value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
            </label>
            {view === 'MUNICIPALITY' && <label htmlFor="zones-department-filter">
              <span>Departamento</span>
              <select id="zones-department-filter" value={department}
                onChange={event => { setDepartment(event.target.value); setPage(1); }}>
                <option value="">Todos los departamentos</option>
                {data.departments.map(zone => <option key={zone.code} value={zone.code}>{zone.name}</option>)}
              </select>
            </label>}
            <label htmlFor="zones-status-filter"><span>Disponibilidad</span>
              <select id="zones-status-filter" value={status}
                onChange={event => { setStatus(event.target.value); setPage(1); }}>
                <option value="ALL">Todos los estados</option>
                <option value="OPEN">Activas</option><option value="SCHEDULED">Programadas</option>
                <option value="CLOSED">No disponibles</option><option value="PAUSED">Pausadas</option>
              </select>
            </label>
            <label htmlFor="zones-sort-filter"><span>Ordenar</span>
              <select id="zones-sort-filter" value={sort}
                onChange={event => { setSort(event.target.value as SortOrder); setPage(1); }}>
                <option value="priority">Prioridad operativa</option>
                <option value="registered">Más registrados</option>
                <option value="ready">Más listos</option>
                <option value="name">Nombre A–Z</option>
                <option value="opening">Próximas aperturas</option>
              </select>
            </label>
          </div>
          <div className="zones-list-toolbar">
            <div><strong>{formatNumber(filtered.length)} territorios</strong>
              <span>{filtered.length === registry.length ? 'Cobertura completa' : 'Coinciden con los filtros'}</span>
            </div>
            <div className="zones-list-actions">
              <button type="button" className="zones-text-button" onClick={resetFilters}>
                <Icon name="refresh" size={15} /> Limpiar filtros
              </button>
              <button type="button" className="secondary-button" disabled={filtered.length === 0}
                onClick={exportFiltered}><Icon name="download" size={16} /> Exportar CSV</button>
            </div>
          </div>
          {visible.length ? <div className="zones-table-wrap">
            <table className="zones-table">
              <thead><tr><th scope="col">Territorio</th><th scope="col">Disponibilidad</th>
                <th scope="col" className="zones-num-cell">Registrados</th>
                <th scope="col" className="zones-num-cell">Listos</th>
                <th scope="col">Apertura</th><th scope="col">Gestión</th></tr></thead>
              <tbody>{visible.map(zone => <tr key={view + zone.code}>
                <td className="zones-territory-cell" data-label="Territorio">
                  <div className="zones-territory">
                    <span className="zones-territory-icon"><Icon name="globe" size={17} /></span>
                    <span><strong>{zone.name}</strong>
                      <small>{zone.context ?? 'Colombia'} · DIVIPOLA {zone.code}</small>
                    </span>
                  </div>
                </td>
                <td data-label="Disponibilidad"><StatusBadge state={zone.state} source={zone.source} /></td>
                <td data-label="Registrados" className="zones-num-cell">
                  <strong>{formatNumber(zone.registered)}</strong></td>
                <td data-label="Listos" className="zones-num-cell">
                  <strong>{formatNumber(zone.ready)}</strong></td>
                <td data-label="Apertura">
                  {zone.state === 'SCHEDULED' && zone.opensAt ?
                    <div className="zones-schedule-cell"><strong>{formatDate(zone.opensAt)}</strong>
                      <small>{remainingCompact(zone.opensAt, clock + offset)}</small></div>
                    : <span className="zones-muted">Sin programación</span>}
                </td>
                <td className="zones-manage-cell" data-label="Acción">
                  <button type="button" className="secondary-button"
                    aria-label={'Gestionar ' + zone.name} onClick={() =>
                      setDecision({ scope: view as ZoneScope, zone })}>
                    <Icon name="settings" size={15} /> Gestionar
                  </button>
                </td>
              </tr>)}</tbody>
            </table>
          </div> : <div className="zones-empty-state">
            <Icon name="search" size={27} /><strong>No encontramos territorios</strong>
            <p>Prueba con otro municipio, departamento o estado.</p>
            <button type="button" className="secondary-button" onClick={resetFilters}>Restablecer filtros</button>
          </div>}
          {pages > 1 && <nav className="zones-pagination" aria-label="Paginación de territorios">
            <span>Mostrando {formatNumber((currentPage - 1) * PAGE_SIZE + 1)}–
              {formatNumber(Math.min(currentPage * PAGE_SIZE, filtered.length))} de {formatNumber(filtered.length)}</span>
            <div><button type="button" className="secondary-button" disabled={currentPage === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
              <span className="zones-pagination-indicator">Página {currentPage} de {pages}</span>
              <button type="button" className="secondary-button" disabled={currentPage === pages}
                onClick={() => setPage(value => Math.min(pages, value + 1))}>Siguiente</button>
            </div>
          </nav>}
        </>}
      </Panel>
      <aside className="zones-side" aria-label="Análisis y reglas del despliegue">
        <section className="zones-insights">
          <div className="zones-side-heading"><span className="zones-side-icon"><Icon name="chart" size={19} /></span>
            <div><h2>Potencial de expansión</h2><p>Municipios con más negocios registrados.</p></div>
          </div>
          {leaderboard.length ? <ol className="zones-ranking">
            {leaderboard.map((zone, index) => <li key={zone.code}>
              <div className="zones-ranking-top"><span><small>{pad(index + 1)}</small>
                <strong>{zone.name}</strong></span><b>{formatNumber(zone.registered)}</b></div>
              <div className="zones-ranking-track" role="img"
                aria-label={zone.name + ': ' + formatNumber(zone.registered) + ' registrados'}>
                <span style={{ width: (leaderboard[0].registered ?
                  zone.registered / leaderboard[0].registered * 100 : 0) + '%' }} />
              </div>
              <small>{formatNumber(zone.ready)} listos para publicar · {stateLabels[zone.state]}</small>
            </li>)}
          </ol> : <div className="zones-side-empty"><Icon name="store" size={22} />
            <p>Todavía no hay negocios registrados con localidad identificada.</p>
          </div>}
          <p className="zones-data-footnote"><Icon name="shield" size={14} />
            Se cuentan registros asociados a municipios, incluidos los valores cero. No son búsquedas ni visitas.</p>
        </section>
        <section className="zones-coverage-summary">
          <div className="zones-side-heading"><span className="zones-side-icon"><Icon name="globe" size={19} /></span>
            <div><h2>Estado de la cobertura</h2>
              <p>{formatNumber(total)} municipios del catálogo de Colombia.</p></div>
          </div>
          <div className="zones-coverage-track" role="img"
            aria-label={formatNumber(municipalityCounts.OPEN) + ' activos, ' +
              formatNumber(municipalityCounts.SCHEDULED) + ' programados, ' +
              formatNumber(municipalityCounts.PAUSED) + ' pausados, ' +
              formatNumber(municipalityCounts.CLOSED) + ' no disponibles'}>
            {(['OPEN', 'SCHEDULED', 'PAUSED', 'CLOSED'] as const).map(key =>
              <span key={key} className={'zones-coverage-part zones-coverage-part--' + key.toLowerCase()}
                style={{ width: (total ? municipalityCounts[key] / total * 100 : 0) + '%' }} />)}
          </div>
          <dl className="zones-coverage-legend">
            {(['OPEN', 'SCHEDULED', 'PAUSED', 'CLOSED'] as const).map(key =>
              <div key={key}><dt><span className={'zones-legend-dot ' + key.toLowerCase()} />
                {stateLabels[key]}</dt><dd>{formatNumber(municipalityCounts[key])}</dd></div>)}
          </dl>
        </section>
        <section className="zones-policy-card">
          <span className="zones-side-icon"><Icon name="shield" size={20} /></span>
          <h2>Reglas de publicación</h2>
          <p>Los municipios abiertos muestran negocios físicos. Una excepción municipal prevalece sobre
            su departamento; los negocios virtuales activos siguen visibles en toda Colombia.</p>
          <div><Icon name="clock" size={15} /> Las fechas se calculan con la hora del servidor.</div>
          <div><Icon name="shield" size={15} /> Cada cambio requiere motivo y queda en auditoría.</div>
        </section>
      </aside>
    </div>
    {decision && <ZoneDecisionDialog value={decision} records={data.records}
      close={() => setDecision(null)} save={save} />}
  </section>;
}
