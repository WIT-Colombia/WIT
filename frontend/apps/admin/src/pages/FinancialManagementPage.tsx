import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeFinanceAlert,
  getFinanceAudit,
  getAwsFreeTierUsage,
  getFinanceRecords,
  getFinanceSummary,
  updateFinanceBudget,
  updateFinanceConsumption,
  updateFinanceInvoice,
  updateFinancePayment,
  updateFinanceProvider,
  type FinanceSummary,
  type FreeTierUsage,
} from "../services/adminApiClient";
import { can, getSession } from "../services/adminService";
import { financeCsv, financeXlsx } from "../utils/financeExport";
import { AwsFreeTierPanel } from "../components/AwsFreeTierPanel";
import { AdminDialog } from '../components/AdminDialog';
import { Icon } from '../components/Icon';
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
type Entity =
  "providers" | "budgets" | "consumptions" | "invoices" | "payments";
const entityNames: Record<Entity | 'audit' | 'alerts', string> = { providers: 'Proveedores', budgets: 'Presupuestos', consumptions: 'Consumos', invoices: 'Facturas', payments: 'Pagos', alerts: 'Alertas', audit: 'Historial de cambios' };
const fieldNames: Record<string, string> = { name: 'Nombre', currency: 'Moneda', amountCop: 'Importe en COP', amountUsd: 'Importe en USD', documentUrl: 'Enlace del documento', status: 'Estado', reference: 'Referencia' };
export function FinancialManagementPage() {
  const admin = getSession();
  const [tab, setTab] = useState<Entity | "audit" | "alerts">("providers");
  const [records, setRecords] = useState<any>({
    providers: [],
    budgets: [],
    consumptions: [],
    invoices: [],
    payments: [],
    alerts: [],
  });
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [freeTier, setFreeTier] = useState<{ state: "loading" | "available" | "empty" | "unconfigured" | "error"; usages: FreeTierUsage[]; updatedAt: string | null; error?: string }>({ state: "loading", usages: [], updatedAt: null });
  const load = async () => {
    setLoadingRecords(true);
    try {
    const [r, s, a] = await Promise.all([
      getFinanceRecords(),
      getFinanceSummary(),
      getFinanceAudit(),
    ]);
    setRecords(r);
    setSummary(s);
    setAudit(a.entries);
    } finally { setLoadingRecords(false); }
  };
  useEffect(() => {
    void load().catch(() => setError("No se pudieron cargar los registros."));
  }, []);
  const loadFreeTier = useCallback(async () => {
    setFreeTier((previous) => ({ ...previous, state: "loading", error: undefined }));
    try {
      const result = await getAwsFreeTierUsage();
      setFreeTier({ state: result.available ? (result.usages.length ? "available" : "empty") : "unconfigured", usages: result.usages, updatedAt: result.lastUpdatedAt });
    } catch (cause) {
      setFreeTier((previous) => ({ ...previous, state: "error", error: cause instanceof Error ? cause.message : "No se pudo consultar Free Tier." }));
    }
  }, []);
  useEffect(() => {
    if (admin && can(admin, "finance:read")) void loadFreeTier();
    // getSession() returns a fresh object on each render; do not include it in
    // dependencies or the refresh request would loop indefinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFreeTier]);
  if (!admin || !can(admin, "finance:read"))
    return (
      <section className="finance-page">
        <div className="state-panel">
          <h1>Acceso restringido</h1>
        </div>
      </section>
    );
  const manage = can(admin, "finance:manage");
  const fields = (entity: Entity) => {
    if (entity === "providers") return ["name", "currency"];
    if (entity === "budgets") return ["name", "amountCop", "amountUsd"];
    if (entity === "consumptions") return ["amountCop", "amountUsd"];
    if (entity === "invoices") return ["amountCop", "amountUsd", "documentUrl"];
    return ["amountCop", "status", "reference"];
  };
  const openEdit = (entity: Entity, row: any) => {
    if (entity === "consumptions" && row.dataKind !== "MANUAL") return;
    setEditing({ entity, row });
    const next: Record<string, string> = {};
    for (const k of fields(entity))
      next[k] = row[k] === undefined ? "" : String(row[k]);
    setForm(next);
    setMessage("");
    setError("");
  };
  const save = async () => {
    if (!editing || !form.reason?.trim()) {
      setError("El motivo de la modificación es obligatorio.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { entity, row } = editing;
      const input = {
        ...form,
        amountCop:
          form.amountCop === undefined ? undefined : Number(form.amountCop),
        amountUsd:
          form.amountUsd === undefined ? undefined : Number(form.amountUsd),
        reason: form.reason,
      };
      if (entity === "providers") await updateFinanceProvider(row.id, input);
      if (entity === "budgets") await updateFinanceBudget(row.id, input);
      if (entity === "consumptions")
        await updateFinanceConsumption(row.id, input);
      if (entity === "invoices") await updateFinanceInvoice(row.id, input);
      if (entity === "payments") await updateFinancePayment(row.id, input);
      setEditing(null);
      setMessage("Cambios guardados y auditados.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron guardar los cambios.",
      );
    } finally {
      setBusy(false);
    }
  };
  const rows =
    tab === "providers"
      ? records.providers
      : tab === "budgets"
        ? records.budgets
        : tab === "invoices"
          ? records.invoices
          : tab === "payments"
            ? records.payments
            : (records.consumptions ?? []);
  const exportRows = (summary?.consumptions ?? []).map((i) => ({
    provider: i.provider.name,
    service: i.service?.name ?? "General",
    period: i.periodStart,
    kind: i.dataKind,
    usd: Number(i.amountUsd) - Number(i.creditsUsd),
    cop: Number(i.amountCop),
  }));
  const download = (kind: "csv" | "xlsx") => {
    const blob = new Blob(
      [kind === "csv" ? financeCsv(exportRows) : financeXlsx(exportRows)],
      { type: "application/octet-stream" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="finance-page">
      <header className="admin-section-heading">
        <h1>Control financiero</h1>
        <div className="ad-finance-exports">
          <button className="ad-button" onClick={() => download("csv")}>
            <Icon name="download" size={16}/>CSV
          </button>
          <button className="ad-button" onClick={() => download("xlsx")}>
            <Icon name="download" size={16}/>XLSX
          </button>
        </div>
      </header>
      <div className="ad-summary-grid" aria-label="Resumen de gastos tecnológicos">
        <article><span className="ad-summary-icon"><Icon name="card"/></span><div><small>Consumo registrado en COP</small><strong>{summary ? cop.format(summary.totals.cop) : '—'}</strong><span>Periodo consultado · moneda local</span></div></article>
        <article><span className="ad-summary-icon ad-summary-icon--blue"><Icon name="chart"/></span><div><small>Consumo neto en USD</small><strong>{summary ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }).format(summary.totals.usd) : '—'}</strong><span>Periodo consultado · después de créditos</span></div></article>
        <article><span className="ad-summary-icon ad-summary-icon--neutral"><Icon name="server"/></span><div><small>Proveedores activos</small><strong>{summary?.providers.length ?? '—'}</strong><span>Registrados en el sistema</span></div></article>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {error && !editing && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="ad-finance-free-tier"><AwsFreeTierPanel state={freeTier.state} usages={freeTier.usages} updatedAt={freeTier.updatedAt} error={freeTier.error} />
      <button className="ad-button" disabled={freeTier.state === 'loading'} onClick={() => void loadFreeTier()}><Icon name="refresh" size={16}/>Actualizar Free Tier</button></div>
      <nav className="finance-tabs" aria-label="Secciones de gastos">
        {(
          [
            "providers",
            "budgets",
            "consumptions",
            "invoices",
            "payments",
            "alerts",
            "audit",
          ] as const
        ).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            aria-pressed={tab === item}
            key={item}
            onClick={() => setTab(item)}
          >
            {item === "providers"
              ? "Proveedores"
              : item === "budgets"
                ? "Presupuestos"
                : item === "consumptions"
                  ? "Consumos"
                  : item === "invoices"
                    ? "Facturas"
                    : item === "payments"
                      ? "Pagos"
                      : item === "alerts"
                        ? "Alertas"
                        : "Historial de cambios"}
          </button>
        ))}
      </nav>
      {loadingRecords && <p className="ad-preview-note" role="status">Consultando registros financieros…</p>}
      {tab === "alerts" && (
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Umbral</th>
                <th>Mensaje</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.alerts.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.threshold}%</td>
                  <td>{a.message}</td>
                  <td>{a.acknowledgedAt ? "Revisada" : "Pendiente"}</td>
                  <td>
                    {!a.acknowledgedAt && (
                      <button
                        disabled={!manage}
                        onClick={() =>
                          void acknowledgeFinanceAlert(a.id).then(load)
                        }
                      >
                        Revisar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loadingRecords && !error && records.alerts.length === 0 && <tr><td colSpan={4}><div className="ad-empty"><span className="ad-large-icon"><Icon name="bell" size={28}/></span><h2>Sin alertas registradas</h2><p>Los avisos financieros disponibles aparecerán en esta sección.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "audit" && (
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entidad</th>
                <th>Acción</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString("es-CO")}</td>
                  <td>{a.entityType}</td>
                  <td>{a.action}</td>
                  <td>{a.reason}</td>
                </tr>
              ))}
              {!loadingRecords && !error && audit.length === 0 && <tr><td colSpan={4}><div className="ad-empty"><span className="ad-large-icon"><Icon name="shield" size={28}/></span><h2>Sin cambios registrados</h2><p>Las modificaciones auditadas aparecerán aquí con su fecha y motivo.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab !== "alerts" && tab !== "audit" && (
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Importe</th>
                <th>Estado/tipo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.name ?? row.externalId ?? row.id}</td>
                  <td>
                    {row.amountCop === undefined
                      ? "—"
                      : cop.format(Number(row.amountCop))}
                  </td>
                  <td>{row.dataKind ?? row.status ?? row.currency ?? "—"}</td>
                  <td>
                    {manage &&
                    !(tab === "consumptions" && row.dataKind !== "MANUAL") ? (
                      <button
                        className="secondary-button"
                        onClick={() => openEdit(tab as Entity, row)}
                      >
                        Editar
                      </button>
                    ) : (
                      <span>Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loadingRecords && !error && rows.length === 0 && <tr><td colSpan={4}><div className="ad-empty"><span className="ad-large-icon"><Icon name="database" size={28}/></span><h2>Sin registros de {entityNames[tab].toLocaleLowerCase('es')}</h2><p>Esta sección mostrará la información financiera registrada en el sistema.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <AdminDialog title={`Editar ${entityNames[editing.entity as Entity].toLocaleLowerCase('es')}`} contextLabel="XAMUKO ADMIN · CONTROL FINANCIERO" busy={busy} onClose={() => setEditing(null)}>
          <form
            className="ad-document-form finance-edit-modal"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {fields(editing.entity).map((name) => (
              <label key={name}>
                {fieldNames[name]}
                <input
                  value={form[name] ?? ""}
                  type={name.includes("amount") ? "number" : "text"}
                  onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  required={name !== "documentUrl"}
                />
              </label>
            ))}
            <label>
              Motivo de la modificación
              <textarea
                value={form.reason ?? ""}
                required
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
            {error && <p className="ad-form-error" role="alert">{error}</p>}
            <div className="ad-dialog-actions">
              <button type="button" className="ad-button" disabled={busy} onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="ad-button ad-button--primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
    </section>
  );
}
