import { useState, type FormEvent } from 'react';
import { AdminDialog } from '../../components/AdminDialog';
import { Icon } from '../../components/Icon';
import { changeAdminBusinessPlan, verifyAdminBusiness } from '../../services/adminApiClient';

export type BusinessDecision = 'verification' | 'plan';

export function BusinessDecisionDialog({ business, decision, onClose, onSuccess }: {
  business: { id: string; name: string; isPro: boolean };
  decision: BusinessDecision; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const [plan, setPlan] = useState<'BASIC' | 'PRO'>(business.isPro ? 'BASIC' : 'PRO');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verification = decision === 'verification';
  const expected = verification ? 'VERIFICAR' : plan;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || reason.trim().length < 12 || reason.trim().length > 500 || confirmation !== expected) return;
    setBusy(true); setError('');
    try {
      const result = verification
        ? await verifyAdminBusiness(business.id, reason.trim(), confirmation)
        : await changeAdminBusinessPlan(business.id, plan, reason.trim(), confirmation);
      onSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la decisión.');
      setBusy(false);
    }
  };
  return <AdminDialog title={verification ? 'Verificar negocio' : 'Administrar suscripción'}
    busy={busy} contextLabel="XAMUKO ADMIN · DECISIÓN REGISTRADA" onClose={onClose}>
    <form className="bd-decision-form" onSubmit={event => void submit(event)}>
      <p className="bd-decision-business">{business.name}</p>
      {verification ? <p>Esta aprobación manual requiere que hayas comprobado la identidad y el nombre comercial.
        Si existe una solicitud documental pendiente, debes resolverla desde <strong>Verificaciones</strong> para conservar el expediente.</p>
        : <>
          <label>Plan que deseas asignar
            <select value={plan} disabled={busy} onChange={event => { setPlan(event.target.value as 'BASIC' | 'PRO'); setConfirmation(''); }}>
              <option value="BASIC">Básico</option><option value="PRO">Business PRO</option>
            </select></label>
          <p>{plan === 'PRO' ? 'La asignación administrativa activa Business PRO sin generar un cobro ni renovación automática y estará vigente hasta una revocación administrativa.'
            : 'El cambio a Básico revocará el acceso PRO vigente, incluso si procedía de una suscripción de pago. Revisa previamente las obligaciones comerciales correspondientes.'}</p>
        </>}
      <label>Motivo de la decisión (12 a 500 caracteres)
        <textarea value={reason} disabled={busy} rows={4} maxLength={500} minLength={12} required
          onChange={event => setReason(event.target.value)}
          placeholder="Documenta el fundamento, las comprobaciones y la razón administrativa."/></label>
      <label>Escribe <strong>{expected}</strong> para confirmar
        <input value={confirmation} disabled={busy} required autoComplete="off"
          onChange={event => setConfirmation(event.target.value)} placeholder={expected}/></label>
      <p className="bd-decision-footnote"><Icon name="shield" size={16}/> El cambio quedará auditado y enviará una notificación en Business y al propietario.</p>
      {error && <p className="bd-decision-error" role="alert">{error}</p>}
      <div className="bd-decision-actions">
        <button className="bd-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="bd-button bd-button--primary" type="submit"
          disabled={busy || reason.trim().length < 12 || confirmation !== expected}>
          {busy ? 'Registrando…' : verification ? 'Confirmar verificación' : 'Confirmar cambio de plan'}
        </button>
      </div>
    </form>
  </AdminDialog>;
}
