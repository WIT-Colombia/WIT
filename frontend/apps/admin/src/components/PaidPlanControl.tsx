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
  const canManage = getSession()?.role === 'SUPER_ADMIN';
  useEffect(() => {
    let active = true;
    getAdminPaidPlans().then(result => { if (active) setPlans(result); })
      .catch(() => { if (active) setError('No se pudo consultar el estado del plan.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function change() {
    if (busy || !canManage) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = plans ? await updateAdminPaidPlan(plan, !plans[plan]) : await getAdminPaidPlans();
      setPlans(result);
      setNotice(`${name}: ${result[plan] ? 'activado' : 'desactivado'}.`);
      void refreshPaidPlans();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.'); }
    finally { setBusy(false); }
  }
  const enabled = plans?.[plan];
  return <section className="paid-plan-control" aria-label={`Disponibilidad de ${name}`} aria-busy={busy}>
    <div><h2>Disponibilidad del plan</h2>
      <p>Estado: <strong>{plans ? enabled ? 'Activado' : 'Desactivado' : busy ? 'Consultando…' : 'No disponible'}</strong></p>
      <p>{plan === 'businessPro' ? 'Al desactivarlo, se ocultan las referencias y promociones de Business Pro en Business.' : 'Controla la disponibilidad comercial de Xamuko Plus.'} Las suscripciones existentes se conservan.</p>
      {plan === 'xamukoPlus' && <p>La contratación y los cobros de Xamuko Plus aún no están disponibles.</p>}
      {notice && <p role="status">{notice}</p>}{error && <p className="paid-plan-error" role="alert">{error}</p>}
      {!canManage && <p>Solo el administrador principal puede cambiar este estado.</p>}
    </div>
    {canManage && <button className="paid-plan-button" type="button" disabled={busy} onClick={() => void change()}>
      {busy ? 'Consultando…' : !plans ? 'Reintentar' : enabled ? 'Desactivar plan' : 'Activar plan'}
    </button>}
  </section>;
}
