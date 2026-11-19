import { useEffect, useState } from 'react';
import { refreshPaidPlans, type PaidPlanAvailability, type PaidPlanKey } from '@wit/utils';
import { getSession } from '../services/adminService';
import { getAdminPaidPlans, updateAdminPaidPlan } from '../services/adminApiClient';
import './PaidPlanControl.css';

export function PaidPlanControl({ plan, name }: { plan: PaidPlanKey; name: string }) {
  const [plans, setPlans] = useState<PaidPlanAvailability | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const canManage = getSession()?.role === 'SUPER_ADMIN';

  async function load() {
    setBusy(true); setError('');
    try { setPlans(await getAdminPaidPlans()); }
    catch { setPlans(null); setError('No se pudo consultar el estado real del plan.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    getAdminPaidPlans().then(result => { if (active) setPlans(result); })
      .catch(() => { if (active) setError('No se pudo consultar el estado real del plan.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function change() {
    if (busy || !canManage || !plans || !confirming || confirmation !== 'CONFIRMAR' || reason.trim().length < 12) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await updateAdminPaidPlan(plan, !plans[plan], reason.trim(), confirmation);
      setPlans(result);
      setConfirming(false); setReason(''); setConfirmation('');
      setNotice(`${name}: ${result[plan] ? 'habilitado' : 'deshabilitado'} en toda la plataforma.`);
      void refreshPaidPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.');
    } finally { setBusy(false); }
  }

  const enabled = plans?.[plan] === true;
  const action = enabled ? 'Deshabilitar' : 'Habilitar';
  const isPlus = plan === 'xamukoPlus';
  return <section className="paid-plan-control" aria-label={`Control global de ${name}`} aria-busy={busy}>
    <div className="paid-plan-control-heading">
      <div><span className="paid-plan-control-eyebrow">INTERRUPTOR MAESTRO</span>
        <h2>{name}</h2><p>Control global de funciones y visibilidad del plan en XAMUKO.</p></div>
      <span className={`paid-plan-control-status ${plans && enabled ? 'is-enabled' : ''}`}>
        {busy && !plans ? 'Consultando…' : !plans ? 'Sin verificar' : enabled ? 'Habilitado' : 'Deshabilitado'}
      </span>
    </div>
    <p className="paid-plan-control-description">
      {isPlus
        ? 'El estado queda preparado para las futuras funciones de XAMUKO Plus. Actualmente no existen contratación, cobros ni beneficios Plus operativos.'
        : 'Al deshabilitar, se ocultan las ofertas y las funciones exclusivas PRO, y el backend vuelve a aplicar límites básicos. También se suspende temporalmente el acceso avanzado de suscriptores vigentes.'}
    </p>
    <p className="paid-plan-control-preservation">Las suscripciones registradas, estadísticas y demás datos históricos no se eliminan. El registro administrativo permanece disponible.</p>
    {notice && <p className="paid-plan-control-notice" role="status">{notice}</p>}
    {error && <p className="paid-plan-error" role="alert">{error}</p>}
    {!canManage && <p className="paid-plan-control-restricted">Solo el superadministrador puede modificar este estado.</p>}
    {canManage && !confirming && <div className="paid-plan-control-actions">
      <button className={`paid-plan-button ${enabled ? 'is-danger' : ''}`} type="button" disabled={busy}
        onClick={() => plans ? setConfirming(true) : void load()}>
        {busy ? 'Consultando…' : !plans ? 'Reintentar consulta' : `${action} ${name}`}
      </button>
    </div>}
    {canManage && confirming && plans && <div className="paid-plan-control-confirmation">
      <h3>Confirmar: {action.toLowerCase()} {name}</h3>
      <p>{enabled
        ? 'Esta acción suspenderá las funciones exclusivas del plan incluso para suscripciones vigentes, hasta que vuelva a habilitarse.'
        : isPlus ? 'Se activará el indicador global, pero Plus seguirá sin funciones de pago ni beneficios implementados.' : 'Las funciones PRO volverán a estar disponibles únicamente para las suscripciones que sigan vigentes.'}</p>
      <label>Justificación administrativa obligatoria
        <textarea value={reason} onChange={event => setReason(event.target.value)} minLength={12} maxLength={500} rows={3}
          disabled={busy} placeholder="Registra el motivo y quién autoriza este cambio" />
      </label>
      <label>Escribe CONFIRMAR para aplicar el cambio
        <input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" placeholder="CONFIRMAR"/>
      </label>
      <div className="paid-plan-control-actions">
        <button className={`paid-plan-button ${enabled ? 'is-danger' : ''}`} type="button" disabled={busy || reason.trim().length < 12 || confirmation !== 'CONFIRMAR'}
          onClick={() => void change()}>{busy ? 'Guardando…' : `Confirmar ${action.toLowerCase()}`}</button>
        <button className="paid-plan-button is-secondary" type="button" disabled={busy} onClick={() => { setConfirming(false); setReason(''); setConfirmation(''); setError(''); }}>Cancelar</button>
      </div>
    </div>}
  </section>;
}
