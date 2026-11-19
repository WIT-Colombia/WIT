import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { FinanceSectionNav } from '../components/FinanceSectionNav';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { can, getSession } from '../services/adminService';
import {
  listAdminFinancialTransactions, updateFinancePayment,
  type AdminFinancialTransaction, type AdminFinancialTransactionsPage,
  type AdminFinancialPaymentStatus,
} from '../services/adminApiClient';
import './AdminTransactionsPage.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
});
const number = (value: number) => value.toLocaleString('es-CO');
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value))
  : 'No registrada';
const statusName: Record<AdminFinancialPaymentStatus, string> = {
  PENDING: 'Pendiente', PAID: 'Pagado', CANCELLED: 'Cancelado',
};
const statusOptions: Array<{ value: AdminFinancialPaymentStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'PAID', label: 'Pagado' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'CANCELLED', label: 'Cancelado' },
];
const csvCell = (value: string) => '"' +
  (/^\s*[=+\-@]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';

function TransactionDetail({ transaction, mayEdit, onClose, onUpdated }: {
  transaction: AdminFinancialTransaction;
  mayEdit: boolean;
  onClose: () => void;
  onUpdated: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AdminFinancialPaymentStatus>(transaction.status);
  const [amount, setAmount] = useState(transaction.amountCop);
  const [reference, setReference] = useState(transaction.reference ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault(); closeRef.current(); return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
      ) ?? []).filter(item => item.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  const validAmount = amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0;
  const validReason = reason.trim().length >= 12 && reason.trim().length <= 500;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mayEdit || busy || !validAmount || !validReason) return;
    setBusy(true); setError('');
    try {
      await updateFinancePayment(transaction.id, {
        amountCop: Number(amount), status, reference: reference.trim(), reason: reason.trim(),
      });
      onUpdated('Corrección administrativa registrada en el historial financiero.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el pago.');
      setBusy(false);
    }
  };
  const documentUrl = transaction.invoice.documentUrl;
  const verifiedDocumentUrl = (() => {
    if (!documentUrl) return null;
    try {
      const parsed = new URL(documentUrl);
      return parsed.protocol === 'https:' ? parsed.href : null;
    } catch { return null; }
  })();
  return createPortal(<div className="atx-dialog-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="atx-dialog" role="dialog" aria-modal="true" ref={modalRef}
      aria-labelledby="atx-dialog-title" aria-describedby="atx-dialog-description">
      <div className="atx-dialog-heading">
        <span className="atx-dialog-badge"><Icon name="card" size={22}/></span>
        <button ref={cancelRef} type="button" className="atx-dialog-close" aria-label="Cerrar detalle"
          onClick={onClose} disabled={busy}><Icon name="close" size={18}/></button>
      </div>
      <h2 id="atx-dialog-title">{editing ? 'Corregir registro financiero' : 'Detalle del pago a proveedor'}</h2>
      <p id="atx-dialog-description" className="atx-dialog-subtitle">
        {transaction.invoice.provider.name} · Documento {transaction.invoice.invoiceNumber ?? transaction.invoice.externalId}
      </p>
      <div className="atx-dialog-amount">
        <small>Importe registrado</small>
        <strong>{money.format(Number(transaction.amountCop))}</strong>
        <span className={'atx-status atx-status-'+transaction.status.toLowerCase()}>{statusName[transaction.status]}</span>
      </div>
      <dl className="atx-detail-grid">
        <div><dt>Proveedor</dt><dd>{transaction.invoice.provider.name}</dd></div>
        <div><dt>Documento de proveedor</dt><dd>{transaction.invoice.invoiceNumber ?? 'Sin número'} </dd></div>
        <div><dt>Referencia de pago</dt><dd>{transaction.reference ?? 'Sin referencia'}</dd></div>
        <div><dt>Registrado el</dt><dd>{date(transaction.createdAt)}</dd></div>
        <div><dt>Fecha de pago</dt><dd>{date(transaction.paidAt)}</dd></div>
        <div><dt>Importe de la factura</dt><dd>{money.format(Number(transaction.invoice.amountCop))}</dd></div>
      </dl>
      {verifiedDocumentUrl && <a className="atx-document-link" href={verifiedDocumentUrl}
        target="_blank" rel="noopener noreferrer"><Icon name="file" size={16}/> Abrir documento del proveedor</a>}
      <p className="atx-dialog-disclaimer">
        El estado Pagado es el estado administrativo registrado; por sí solo no confirma conciliación bancaria.
        Este registro corresponde a un egreso, no a un cobro de cliente.
      </p>
      {editing ? <form className="atx-edit-form" onSubmit={event => void submit(event)}>
        <div className="atx-edit-two">
          <label><span>Estado registrado</span><select aria-label="Estado del pago" value={status}
            disabled={busy} onChange={event => setStatus(event.target.value as AdminFinancialPaymentStatus)}>
            <option value="PENDING">Pendiente</option><option value="PAID">Pagado</option>
            <option value="CANCELLED">Cancelado</option>
          </select></label>
          <label><span>Importe en COP</span><input aria-label="Importe del pago en COP" type="number"
            min="0" step="0.01" required value={amount} disabled={busy}
            onChange={event => setAmount(event.target.value)}/></label>
        </div>
        <label><span>Referencia del pago</span><input type="text" maxLength={160}
          aria-label="Referencia del pago" value={reference} disabled={busy}
          onChange={event => setReference(event.target.value)}/></label>
        <label><span>Motivo de la corrección (12 a 500 caracteres)</span>
          <textarea aria-label="Motivo de la corrección" minLength={12} maxLength={500}
            rows={3} required value={reason} disabled={busy}
            placeholder="Justifica el cambio con información verificable."
            onChange={event => setReason(event.target.value)}/></label>
        {error && <p className="atx-dialog-error" role="alert">{error}</p>}
        <div className="atx-dialog-actions">
          <button type="button" className="atx-btn atx-btn-outline" disabled={busy}
            onClick={() => { setEditing(false); setError(''); }}>Cancelar edición</button>
          <button type="submit" className="atx-btn atx-btn-primary"
            disabled={busy || !validAmount || !validReason}>
            {busy ? 'Registrando…' : 'Guardar corrección'}
          </button>
        </div>
      </form> : <div className="atx-dialog-actions">
        <button type="button" className="atx-btn atx-btn-outline" onClick={onClose}>Cerrar</button>
        {mayEdit && <button type="button" className="atx-btn atx-btn-primary" onClick={() => setEditing(true)}>
          <Icon name="settings" size={16}/> Corregir registro
        </button>}
      </div>}
    </section>
  </div>, document.body);
}

export function AdminTransactionsPage() {
  const admin = getSession();
  const canRead = admin ? can(admin, 'finance:read') : false;
  const canManage = admin ? can(admin, 'finance:manage') : false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const requestedStatus = params.get('status') ?? '';
  const status = statusOptions.some(option => option.value === requestedStatus) ? requestedStatus : '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) ? Math.min(100000, Math.max(1, Math.floor(requestedPage))) : 1;
  const [draftQ, setDraftQ] = useState(q);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [records, setRecords] = useState<AdminFinancialTransactionsPage | null>(null);
  const [loading, setLoading] = useState(canRead);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AdminFinancialTransaction | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => { setDraftQ(q); setDraftFrom(from); setDraftTo(to); }, [q, from, to]);
  useEffect(() => {
    if (!canRead) return;
    let active = true;
    setLoading(true); setError('');
    void listAdminFinancialTransactions({ page, q, status, from, to }).then(data => {
      if (active) setRecords(data);
    }).catch(cause => {
      if (active) {
        setRecords(null);
        setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las transacciones.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canRead, page, q, status, from, to, revision]);

  const updateQuery = (updates: { q?: string; status?: string; from?: string; to?: string; page?: number }) => {
    const next = new URLSearchParams(params);
    for (const key of ['q', 'status', 'from', 'to'] as const) {
      if (updates[key] === undefined) continue;
      if (updates[key]) next.set(key, updates[key]); else next.delete(key);
      next.delete('page');
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set('page', String(updates.page)); else next.delete('page');
    }
    setParams(next, { replace: true });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setNotice('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setNotice('');
    updateQuery({ q: draftQ.trim(), from: draftFrom, to: draftTo });
  };
  const reset = () => {
    setDraftQ(''); setDraftFrom(''); setDraftTo(''); setNotice('');
    setParams({}, { replace: true });
  };
  const onUpdated = (message: string) => {
    setSelected(null); setNotice(message); setRevision(value => value + 1);
  };
  const csv = () => {
    if (!records?.transactions.length) return;
    const rows = [
      ['Proveedor', 'Factura', 'ID externo factura', 'Referencia pago', 'Estado registrado',
        'Importe COP', 'Fecha de registro (Colombia)', 'Fecha de pago (Colombia)'],
      ...records.transactions.map(item => [
        item.invoice.provider.name, item.invoice.invoiceNumber ?? '',
        item.invoice.externalId, item.reference ?? '', statusName[item.status], item.amountCop,
        date(item.createdAt), item.paidAt ? date(item.paidAt) : '',
      ]),
    ];
    const content = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = 'xamuko-transacciones-proveedores-pagina.csv'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!canRead) return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas el permiso FINANCE_READ para consultar Transacciones."/>;
  const totals = records?.totals;
  const indicators: Array<{
    key: AdminFinancialPaymentStatus | ''; title: string; count: number | undefined;
    amount?: number; icon: string; color: string; caption: string;
  }> = [
    { key: '', title: 'Movimientos registrados', count: totals?.records, icon: 'layers',
      color: 'purple', caption: 'Pagos a proveedores · historial completo' },
    { key: 'PAID', title: 'Registrados como pagados', count: totals?.PAID.count, amount: totals?.PAID.amountCop,
      icon: 'check', color: 'green', caption: 'Estado administrativo PAID' },
    { key: 'PENDING', title: 'Pendientes', count: totals?.PENDING.count, amount: totals?.PENDING.amountCop,
      icon: 'clock', color: 'amber', caption: 'Estado administrativo PENDING' },
    { key: 'CANCELLED', title: 'Cancelados', count: totals?.CANCELLED.count, amount: totals?.CANCELLED.amountCop,
      icon: 'close', color: 'rose', caption: 'Estado administrativo CANCELLED' },
  ];
  return <main className="atx-page">
    <AdminPageHeading icon="clock" title="Transacciones"
      description="Historial de movimientos financieros registrados, con estados, montos y trazabilidad administrativa."
      actions={<div className="atx-header-actions">
        <button type="button" className="atx-btn atx-btn-primary" onClick={() => setRevision(v => v+1)}>
          <Icon name="refresh" size={16}/> Actualizar
        </button>
      </div>}/>
    <FinanceSectionNav />
    <section className="atx-scope" aria-label="Alcance real de las transacciones">
      <span className="atx-scope-icon"><Icon name="shield" size={24}/></span>
      <div><strong>Transacciones comerciales de clientes: sin integración</strong>
        <p>Actualmente XAMUKO conserva pagos registrados a proveedores tecnológicos, pero no un historial de
          cobros a clientes, cargos Business PRO, transferencias entrantes ni confirmaciones bancarias.
          Por eso, los movimientos que aparecen aquí son <b>egresos administrativos</b>, no ingresos.</p></div>
      <span className="atx-scope-tag">Registro de proveedores</span>
    </section>
    {notice && <div className="atx-notice" role="status"><Icon name="info" size={17}/>{notice}</div>}
    <section className="atx-overview" aria-labelledby="atx-overview-heading">
      <header className="atx-section-header"><div>
        <span className="atx-eyebrow">MOVIMIENTOS REALES · COP</span>
        <h2 id="atx-overview-heading">Resumen del registro financiero</h2>
        <p>Totales históricos del registro de pagos a proveedores, no afectados por los filtros de la tabla.</p>
      </div><span className="atx-scope-label"><Icon name="info" size={16}/> Datos administrativos, no extracto bancario</span></header>
      <div className="atx-indicators">
        {indicators.map(item => <button type="button" key={item.key || 'all'}
          className={'atx-indicator atx-indicator-'+item.color+(status === item.key && !q && !from && !to ? ' selected':'')}
          aria-pressed={status === item.key && !q && !from && !to}
          onClick={() => { setNotice(''); setDraftQ(''); setDraftFrom(''); setDraftTo('');
            setParams(item.key ? { status: item.key } : {}, { replace: true }); }}>
          <span className="atx-indicator-icon"><Icon name={item.icon} size={22}/></span>
          <span className="atx-indicator-main"><span>{item.title}</span>
            <strong aria-busy={loading}>{typeof item.count === 'number' ? number(item.count) : '—'}</strong>
            {item.key && <em>{typeof item.amount === 'number' ? money.format(item.amount) : '—'}</em>}
            <small>{item.caption}</small>
          </span>
        </button>)}
      </div>
      <p className="atx-explainer"><Icon name="info" size={16}/>
        «Pagado» representa el estado guardado en el sistema, no una conciliación bancaria.
        Los montos de Pendientes y Cancelados no son desembolsos confirmados.</p>
    </section>

    <section className="atx-register" aria-labelledby="atx-register-heading">
      <header className="atx-section-header"><div><span className="atx-eyebrow">CONSULTA Y TRAZABILIDAD</span>
        <h2 id="atx-register-heading">Historial de transacciones</h2>
        <p>Explora los pagos de proveedores por estado, referencia, factura o fechas de registro.</p></div>
        <button type="button" className="atx-btn atx-btn-outline" disabled={loading || !records?.transactions.length}
          onClick={csv}><Icon name="download" size={16}/> Exportar página (CSV)</button>
      </header>
      <form className="atx-filters" onSubmit={submit}>
        <label className="atx-field atx-field-search"><span>Buscar transacción</span>
          <span className="atx-search-wrap"><Icon name="search" size={18}/>
            <input type="search" aria-label="Buscar pagos por proveedor, factura o referencia"
              maxLength={100} placeholder="Proveedor, factura o referencia…"
              value={draftQ} onChange={event => setDraftQ(event.target.value)}/></span></label>
        <label className="atx-field"><span>Estado registrado</span>
          <select aria-label="Filtrar por estado de transacción" value={status}
            onChange={event => { setNotice(''); updateQuery({ status: event.target.value }); }}>
            {statusOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
        <label className="atx-field"><span>Desde (registro UTC)</span><input type="date"
          aria-label="Fecha inicial del registro" value={draftFrom} max={draftTo || undefined}
          onChange={event => setDraftFrom(event.target.value)}/></label>
        <label className="atx-field"><span>Hasta (registro UTC)</span><input type="date"
          aria-label="Fecha final del registro" min={draftFrom || undefined}
          value={draftTo} onChange={event => setDraftTo(event.target.value)}/></label>
        <div className="atx-filter-actions">
          <button type="button" className="atx-btn atx-btn-outline" onClick={reset}>Limpiar</button>
          <button type="submit" className="atx-btn atx-btn-primary"><Icon name="search" size={16}/> Buscar</button>
        </div>
      </form>
      <div className="atx-result-header">
        <strong>{loading ? 'Consultando movimientos…' : records
          ? number(records.pagination.total)+(records.pagination.total===1?' registro':' registros')
          : 'Registro financiero'}</strong>
        <span>Origen: FinancialPayment · solo pagos de proveedores</span>
      </div>
      {loading ? <div className="atx-loading" role="status">Consultando registros reales de transacciones…</div>
        : error ? <div className="atx-error" role="alert"><Icon name="shield" size={22}/>
          <p>{error}. Es necesario disponer de la API financiera actualizada.</p>
          <button type="button" className="atx-btn atx-btn-outline" onClick={() => setRevision(v=>v+1)}>Reintentar</button>
        </div>
        : !records?.transactions.length ? <div className="atx-empty"><Icon name="search" size={29}/>
          <strong>Sin transacciones coincidentes</strong>
          <p>No hay pagos de proveedores registrados que cumplan estos filtros.</p>
          <button className="atx-btn atx-btn-outline" type="button" onClick={reset}>Limpiar filtros</button></div>
        : <>
          <div className="atx-table-scroll"><table className="atx-table">
            <thead><tr><th>Proveedor / documento</th><th>Registro</th><th>Referencia</th>
              <th>Estado</th><th>Importe (COP)</th><th>Detalle</th></tr></thead>
            <tbody>{records.transactions.map(item => <tr key={item.id}>
              <td><div className="atx-business-cell"><span className="atx-business-avatar"><Icon name="server" size={20}/></span>
                <span><strong>{item.invoice.provider.name}</strong>
                  <small>Factura: {item.invoice.invoiceNumber ?? item.invoice.externalId}</small></span></div></td>
              <td>{date(item.createdAt)}</td>
              <td className="atx-reference">{item.reference ?? 'Sin referencia'}</td>
              <td><span className={'atx-status atx-status-'+item.status.toLowerCase()}>{statusName[item.status]}</span></td>
              <td className="atx-money">{money.format(Number(item.amountCop))}</td>
              <td><button type="button" className="atx-open-detail" onClick={() => setSelected(item)}>
                <Icon name="eye" size={15}/> Ver detalle</button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="atx-mobile-records">{records.transactions.map(item => <article key={item.id}>
            <header><div><strong>{item.invoice.provider.name}</strong>
              <small>Factura: {item.invoice.invoiceNumber ?? item.invoice.externalId}</small></div>
              <span className={'atx-status atx-status-'+item.status.toLowerCase()}>{statusName[item.status]}</span></header>
            <div className="atx-mobile-amount">{money.format(Number(item.amountCop))}</div>
            <dl><div><dt>Registrado</dt><dd>{date(item.createdAt)}</dd></div>
              <div><dt>Referencia</dt><dd>{item.reference ?? 'Sin referencia'}</dd></div></dl>
            <button type="button" className="atx-open-detail" onClick={() => setSelected(item)}>
              Ver detalle <Icon name="arrow" size={15}/></button>
          </article>)}</div>
        </>}
      {records && records.pagination.totalPages > 1 && <nav className="atx-pagination" aria-label="Páginas de transacciones">
        <span>Página {page} de {records.pagination.totalPages}</span><div>
          <button type="button" className="atx-btn atx-btn-outline" disabled={loading || page<=1}
            onClick={() => updateQuery({ page:page-1 })}>Anterior</button>
          <button type="button" className="atx-btn atx-btn-primary"
            disabled={loading || page>=records.pagination.totalPages}
            onClick={() => updateQuery({ page:page+1 })}>Siguiente <Icon name="arrow" size={16}/></button>
        </div></nav>}
      <p className="atx-ledger-footnote"><Icon name="shield" size={16}/>
        La búsqueda y las fechas filtran el registro real, antes de paginar. Las fechas del filtro son días UTC;
        los detalles se presentan en hora de Colombia. Exportar incluye exclusivamente la página y los filtros visibles.</p>
    </section>

    <p className="atx-last-note"><Icon name="info" size={17}/>
      Esta sección no genera cobros, transferencias ni facturas. La edición de movimientos existentes está
      restringida a FINANCE_MANAGE, exige un motivo y utiliza la auditoría financiera del backend.</p>
    {selected && <TransactionDetail transaction={selected} mayEdit={canManage}
      onClose={() => setSelected(null)} onUpdated={onUpdated}/>}
  </main>;
}
