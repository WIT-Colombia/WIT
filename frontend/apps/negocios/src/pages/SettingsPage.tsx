import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { addBusinessVisibilityPeriod, BUSINESS_VISIBILITY_DAYS } from "../services/visibilityPolicy";
import { businessApi, type BusinessVisibility } from "../services/businessApiClient";
import { homeVisibilityState } from "../services/homeVisibilityState";
import "./CollaboratorsPage.css";
import "./SettingsPage.css";


type SettingIconName = "settings" | "eye" | "eyeOff" | "shield" | "transfer" | "refresh" | "file" | "upload" | "x" | "check" | "alert" | "user" | "lock" | "arrow" | "clock";
function SettingsIcon({ name }: { name: SettingIconName }) {
  const paths: Record<SettingIconName, ReactNode> = {
    settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4.9 5.1 7 3.6l1.8 1.1a8 8 0 0 1 2.1-.7L11.5 2h1l.6 2a8 8 0 0 1 2.1.7L17 3.6l2.1 1.5-.5 2.1a8 8 0 0 1 1.3 1.8L22 9.5v3l-2.1.6a8 8 0 0 1-1.3 1.8l.5 2.1-2.1 1.5-1.8-1.1a8 8 0 0 1-2.1.7L12.5 20h-1l-.6-1.9a8 8 0 0 1-2.1-.7L7 18.5l-2.1-1.5.5-2.1a8 8 0 0 1-1.3-1.8L2 12.5v-3l2.1-.5a8 8 0 0 1 1.3-1.8z"/></>,
    eye: <><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18M10.6 6.1c.5-.1 1-.1 1.4-.1 6.3 0 10 6 10 6a15 15 0 0 1-3 3.5M6 7.5A15 15 0 0 0 2 12s3.7 6 10 6c1.5 0 2.8-.3 4-.8"/><path d="M10.1 10.1a3 3 0 0 0 3.8 3.8"/></>,
    shield: <><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/><path d="m9 12 2.3 2.3L16 9.5"/></>,
    transfer: <><path d="M4 7h15m0 0-4-4m4 4-4 4M20 17H5m0 0 4-4m-4 4 4 4"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.4 9a7.8 7.8 0 0 1 13.3-2L20 12M4 12l1.3 5a7.8 7.8 0 0 0 13.3-2"/></>,
    file: <><path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h7M8 16h8"/></>,
    upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4"/></>,
    x: <><path d="M6 6 18 18M18 6 6 18"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16 9.5"/></>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    arrow: <><path d="M5 12h14m0 0-6-6m6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function SettingsPage() {
  const { preferences, setPreferences, business, account } = useBusinessStore();
  const [confirmHide, setConfirmHide] = useState(false);
  const hideOverlayRef = useRef<HTMLDivElement>(null);
  const transferOverlayRef = useRef<HTMLDivElement>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [resolvedRecipient, setResolvedRecipient] = useState<{ id: string; nickname: string; displayName: string } | null>(null);
  const [recipientResolving, setRecipientResolving] = useState(false);
  const [sentTransfers, setSentTransfers] = useState<Array<{ id: string; status: string; expiresAt: string | null; requestedAt: string; toUser: { displayName: string; nickname: string | null } }>>([]);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [remoteVisibility, setRemoteVisibility] = useState<BusinessVisibility | null>(null);
  const [visibilityActionError, setVisibilityActionError] = useState("");
  const [verification, setVerification] = useState<{ status: string; documentSizeBytes?: number } | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationLoadError, setVerificationLoadError] = useState(false);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSending, setVerificationSending] = useState(false);
  const verificationPending = verification?.status === "PENDING";
  const verificationApproved = verification?.status === "APPROVED";
  const verificationStatusLabel = verificationLoading ? "Consultando estado" : verificationLoadError ? "Estado no disponible" : verificationPending ? "En revisión" : verification?.status === "INFORMATION" ? "Información requerida" : verificationApproved ? "Verificado" : verification?.status === "REJECTED" ? "Requiere una nueva solicitud" : "Sin verificar";
  useEffect(() => { if (business.source !== "real" || !business.id) return; setVerificationLoading(true); setVerificationLoadError(false); void businessApi.getVerification(business.id).then(({ verification: value }) => setVerification(value)).catch(() => { setVerification(null); setVerificationLoadError(true); }).finally(() => setVerificationLoading(false)); }, [business.id, business.source]);
  useEffect(() => { if (business.source !== "real" || !business.id || business.role !== "Propietario") return; void businessApi.listSentOwnershipTransfers(business.id).then(({ transfers }) => setSentTransfers(transfers)).catch(() => setSentTransfers([])); }, [business.id, business.source, business.role]);
  useEffect(() => { setResolvedRecipient(null); setTransferError(""); if (business.source !== "real" || !business.id || business.role !== "Propietario" || !/^@?[a-zA-Z0-9._-]{3,30}$/.test(transferTarget.trim())) { setRecipientResolving(false); return; } let active = true; const timer = window.setTimeout(() => { setRecipientResolving(true); void businessApi.resolveTransferRecipient(business.id!, transferTarget.trim()).then(({ recipient }) => { if (active) setResolvedRecipient(recipient); }).catch((error: Error) => { if (active) setTransferError(error.message); }).finally(() => { if (active) setRecipientResolving(false); }); }, 350); return () => { active = false; window.clearTimeout(timer); }; }, [business.id, business.source, business.role, transferTarget]);
  useEffect(() => { if (business.source !== "real" || !business.id) return; void businessApi.getVisibility(business.id).then(({ visibility }) => setRemoteVisibility(visibility)).catch(() => setRemoteVisibility(null)); }, [business.id, business.source]);
  const businessVisibility = preferences.visibilityByBusiness?.[business.name];
  const visibilityUntil = remoteVisibility?.period?.expiresAt ? new Date(remoteVisibility.period.expiresAt) : ((businessVisibility?.visibilityUntil ?? preferences.visibilityUntil) ? new Date(businessVisibility?.visibilityUntil ?? preferences.visibilityUntil!) : null);
  const visibilityPeriodActive = Boolean(remoteVisibility?.isWithinPeriod && visibilityUntil && visibilityUntil.getTime() > Date.now());
  const visibilityView = homeVisibilityState(remoteVisibility, visibilityPeriodActive);
  const visibilityRestricted = business.source === "real" && visibilityView.blockedByAdmin;
  const visibilityActive = remoteVisibility
    ? visibilityView.label === "Visible"
    : Boolean((businessVisibility?.profileVisible ?? preferences.profileVisible) && visibilityUntil && visibilityUntil.getTime() > Date.now());
  const visibilityLabel = remoteVisibility ? visibilityView.label : business.source === "real" ? "Consultando" : visibilityActive ? "Visible" : "No visible";
  const saveVisibility = (profileVisible: boolean, until: string | null) => {
    if (visibilityRestricted) return;
    setVisibilityActionError("");
    if (business.source === "real" && business.id) {
      void businessApi.setVisibility(business.id, profileVisible)
        .then(({ visibility }) => setRemoteVisibility(visibility))
        .catch((error: Error) => setVisibilityActionError(error.message));
      return;
    }
    setPreferences({ ...preferences, visibilityByBusiness: { ...(preferences.visibilityByBusiness ?? {}), [business.name]: { profileVisible, visibilityUntil: until } } });
  };
  useEffect(() => {
    if (business.source !== "real" && !businessVisibility && preferences.profileVisible && !preferences.visibilityUntil) {
      saveVisibility(true, addBusinessVisibilityPeriod().toISOString());
    }
  }, []);
  const renewVisibility = () => {
    if (visibilityRestricted) return;
    setVisibilityActionError("");
    if (business.source === "real" && business.id) {
      const operation = visibilityView.hiddenByOwner && visibilityPeriodActive
        ? businessApi.setVisibility(business.id, true)
        : businessApi.renewVisibility(business.id);
      void operation.then(({ visibility }) => setRemoteVisibility(visibility))
        .catch((error: Error) => setVisibilityActionError(error.message));
      return;
    }
    saveVisibility(true, addBusinessVisibilityPeriod().toISOString());
  };
  const requestVerification = () => {
    if (business.source !== "real" || !business.id || !verificationFile) { setVerificationError("Adjunta el PDF oficial del negocio para solicitar la revisión."); return; }
    setVerificationSending(true); setVerificationError("");
    const operation = verification?.status === "INFORMATION" ? businessApi.replaceVerification(business.id, verificationFile) : businessApi.submitVerification(business.id, verificationFile);
    void operation.then(({ verification: value }) => setVerification(value as { status: string })).catch((error: Error) => setVerificationError(error.message)).finally(() => setVerificationSending(false));
  };
  const requestTransfer = (event: React.FormEvent) => {
    event.preventDefault();
    const target = transferTarget.trim();
    if (business.role !== "Propietario") return;
    if (!/^@?[a-zA-Z0-9._-]{3,30}$/.test(target) || target.toLowerCase() === account.nickname.toLowerCase()) {
      setTransferError("Escribe el nickname de otra cuenta registrada en XAMUKO.");
      return;
    }
    setTransferError("");
    if (!resolvedRecipient || resolvedRecipient.nickname !== (target.startsWith("@") ? target.toLowerCase() : `@${target.toLowerCase()}`)) { setTransferError("Confirma primero la cuenta destinataria."); return; }
    setConfirmTransfer(true);
  };
  const transferOwnership = () => {
    if (transferSubmitting) return;
    if (business.source === "real" && business.id && resolvedRecipient) {
      setTransferError("");
      setTransferSubmitting(true);
      void businessApi.requestOwnershipTransfer(business.id, resolvedRecipient.id)
        .then(() => businessApi.listSentOwnershipTransfers(business.id!))
        .then(({ transfers }) => { setSentTransfers(transfers); setTransferTarget(""); setResolvedRecipient(null); setConfirmTransfer(false); })
        .catch((error: Error) => setTransferError(error.message))
        .finally(() => setTransferSubmitting(false));
      return;
    }
    setTransferTarget(""); setResolvedRecipient(null); setConfirmTransfer(false);
  };
  const cancelOwnershipTransfer = () => { const transfer = sentTransfers.find(item => item.status === "PENDING"); if (!transfer || !business.id || !window.confirm("¿Cancelar esta solicitud de transferencia?")) return; setTransferBusy(true); void businessApi.cancelOwnershipTransfer(transfer.id).then(() => businessApi.listSentOwnershipTransfers(business.id!)).then(({ transfers }) => setSentTransfers(transfers)).catch((error: Error) => setTransferError(error.message)).finally(() => setTransferBusy(false)); };

  // Confirmations are rendered outside Business's sticky headers. Constrain
  // their size and position to the visual viewport (iPhone/iPad safe areas).
  useLayoutEffect(() => {
    const overlay = confirmTransfer && resolvedRecipient ? transferOverlayRef.current : confirmHide ? hideOverlayRef.current : null;
    if (!overlay) return;
    const viewport = window.visualViewport;
    const previousOverflow = document.body.style.overflow;
    const syncViewport = () => {
      overlay.style.setProperty("--settings-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--settings-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      overlay.style.setProperty("--settings-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--settings-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    document.body.classList.add("settings-dialog-active");
    document.body.style.overflow = "hidden";
    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    overlay.querySelector<HTMLButtonElement>(".settings-dialog-cancel")?.focus({ preventScroll:true });
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("settings-dialog-active");
    };
  }, [confirmHide, confirmTransfer, Boolean(resolvedRecipient)]);
  useEffect(() => {
    if (!confirmHide && !confirmTransfer) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || transferSubmitting) return;
      setConfirmHide(false);
      setConfirmTransfer(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [confirmHide, confirmTransfer, transferSubmitting]);

  return <><main className="business-settings-page">
    <header className="page-heading settings-page-heading"><span className="settings-page-eyebrow">TU ESPACIO</span><div className="settings-page-heading-main"><span className="settings-page-heading-icon"><SettingsIcon name="settings" /></span><div><h1>Configuración</h1><p>Administra tus preferencias, privacidad y acceso a la cuenta.</p></div></div></header><div className="settings-layout"><div className="content-stack"><section className="surface-card settings-section settings-privacy"><div className="card-heading"><span className="settings-card-icon privacy"><SettingsIcon name="eye" /></span><div><h2>Privacidad</h2><p>Controla la visibilidad de tu información comercial.</p></div></div><div className="visibility-panel">
  <div>
    <strong className="settings-visibility-title"><SettingsIcon name="eye" />Mostrar mi negocio en XAMUKO</strong>
    <p>{visibilityRestricted && visibilityView.note
      ? visibilityView.note
      : visibilityActive && visibilityUntil
        ? `Visible hasta el ${visibilityUntil.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.`
        : visibilityView.hiddenByOwner
          ? "Tu negocio está oculto. Puedes volver a mostrarlo con su vigencia actual."
          : "Tu tienda no está visible para las personas."}</p>
    {visibilityRestricted && visibilityUntil && <small className="visibility-renew-note">
      La vigencia actual termina el {visibilityUntil.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.
    </small>}
  </div>
  <span className={`visibility-status ${visibilityActive ? "active" : "expired"}`} role="status">{visibilityLabel}</span>
  <div className="visibility-actions">
    {!visibilityRestricted && <>
      <button className="action-button" type="button" onClick={renewVisibility}
        disabled={business.source === "real" && !remoteVisibility}>
        <SettingsIcon name="refresh" />
        {visibilityView.hiddenByOwner && visibilityPeriodActive
          ? "Volver a mostrar negocio"
          : visibilityActive
            ? `Renovar por ${BUSINESS_VISIBILITY_DAYS} días desde este momento`
            : `Hacer visible durante ${BUSINESS_VISIBILITY_DAYS} días`}
      </button>
      <small className="visibility-renew-note">
        {visibilityView.hiddenByOwner && visibilityPeriodActive
          ? "Al mostrarlo nuevamente, se conserva la vigencia existente."
          : `Al renovar, los ${BUSINESS_VISIBILITY_DAYS} días empiezan a contar desde ese momento.`}
      </small>
      {visibilityActive && <button className="outline-button visibility-hide" type="button"
        onClick={() => setConfirmHide(true)}><SettingsIcon name="eyeOff" />Ocultar mi negocio</button>}
    </>}
    {visibilityRestricted && <small className="visibility-renew-note">No puedes modificar la visibilidad ni renovarla mientras exista una restricción administrativa.</small>}
    {visibilityActionError && <small role="alert" className="settings-visibility-error">{visibilityActionError}</small>}
  </div>
</div><div className="settings-legal-links"><Link className="text-link" to="/legal/terms?from=ajustes">Términos y condiciones →</Link><Link className="text-link" to="/legal/privacy?from=ajustes">Política de privacidad →</Link></div></section><section className="surface-card settings-section verification-settings"><div className="card-heading"><span className="settings-card-icon verification"><SettingsIcon name="shield" /></span><div><h2>Verificación del negocio</h2><p>Ayuda a las personas a confiar en la información de tu tienda.</p></div><span className={`verification-badge ${verification?.status === "APPROVED" ? "verified" : verification?.status === "PENDING" ? "pending" : verification?.status === "INFORMATION" ? "information" : verification?.status === "REJECTED" ? "rejected" : verificationLoadError ? "unavailable" : "neutral"}`}>{verificationStatusLabel}</span></div><div className="verification-copy"><p>Adjunta un PDF oficial para que un administrador pueda comprobar el nombre comercial de tu negocio.</p>{verificationPending && <div className="settings-notice is-info" role="status"><strong>Solicitud en revisión</strong><p>Recibimos tu documento. No necesitas enviarlo de nuevo mientras revisamos la solicitud.</p></div>}{verification?.status === "INFORMATION" && <div className="settings-notice is-warning" role="status"><strong>Necesitamos información adicional</strong><p>Adjunta un PDF corregido para continuar con la revisión.</p></div>}{verificationApproved && <div className="settings-notice is-success" role="status"><strong>Negocio verificado</strong><p>La información de tu negocio ya fue revisada y aprobada.</p></div>}{verificationLoading && <div className="settings-notice is-loading" role="status">Consultando el estado de verificación…</div>}{verificationLoadError && <div className="settings-notice is-error" role="alert"><strong>No pudimos consultar la verificación</strong><p>Comprueba tu conexión e inténtalo de nuevo más tarde. No enviaremos otra solicitud hasta confirmar el estado actual.</p></div>}{verification?.status === "REJECTED" && <div className="settings-notice is-warning" role="status"><strong>La solicitud fue rechazada</strong><p>Revisa las observaciones recibidas y adjunta un nuevo documento para solicitar otra revisión.</p></div>}{!verificationLoading && !verificationLoadError && !verificationPending && !verificationApproved && <><label className="form-field verification-file-field"><span>{verification?.status === "INFORMATION" ? "Documento corregido (PDF, máximo 10 MB)" : "Documento PDF (máximo 10 MB)"}</span><input type="file" accept="application/pdf,.pdf" onChange={event => setVerificationFile(event.target.files?.[0] ?? null)} /></label>{verificationError && <p className="settings-notice is-error" role="alert">{verificationError}</p>}<ul><li>Un administrador comprobará que el nombre comercial coincida con el documento.</li><li>Tu negocio seguirá visible durante la revisión.</li></ul><button className="action-button verification-submit" type="button" onClick={requestVerification} disabled={verificationSending || !verificationFile}><SettingsIcon name="upload" />{verificationSending ? "Enviando solicitud…" : verification?.status === "INFORMATION" ? "Enviar documento corregido" : "Solicitar verificación"}</button></>}</div></section>{business.role === "Propietario" && business.status !== "Eliminado" && <section className="surface-card settings-section ownership-settings"><div className="ownership-heading"><span className="ownership-icon" aria-hidden="true"><SettingsIcon name="transfer" /></span><div><h2>Transferir propiedad</h2><p>Solicita el cambio de titularidad y administración de este establecimiento a otra cuenta de XAMUKO.</p></div></div>{sentTransfers.filter(item => item.status === "PENDING").map(transfer => <div className="ownership-confirm" key={transfer.id}><strong>Transferencia pendiente de aceptación</strong><p>Destinatario: {transfer.toUser.displayName} ({transfer.toUser.nickname ?? "sin nickname"})</p><small>Solicitada {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transfer.requestedAt))}{transfer.expiresAt ? ` · Vence ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(transfer.expiresAt))}` : ""}</small><button className="danger-button" type="button" disabled={transferBusy} onClick={cancelOwnershipTransfer}><SettingsIcon name="x" />{transferBusy ? "Cancelando…" : "Cancelar transferencia"}</button></div>)}{!sentTransfers.some(item => item.status === "PENDING") && <form className="ownership-form" onSubmit={requestTransfer}><label className="form-field"><span>Nickname del nuevo propietario</span><input value={transferTarget} onChange={event => { setTransferTarget(event.target.value); setTransferError(""); }} placeholder="Ej. @laura.gomez" autoComplete="off" pattern="@?[a-zA-Z0-9._-]{3,30}" required /><small>La persona debe tener una cuenta registrada en XAMUKO.</small>{transferError && <em className="form-error">{transferError}</em>}</label>{recipientResolving && <div className="collab-recipient" aria-live="polite">Buscando cuenta XAMUKO…</div>}{resolvedRecipient && <div className="collab-recipient resolved" aria-live="polite"><span className="collab-recipient-avatar">{resolvedRecipient.displayName.slice(0, 1).toUpperCase()}</span><span><b>{resolvedRecipient.displayName}</b><small>{resolvedRecipient.nickname}</small></span><strong>Cuenta confirmada</strong></div>}<button className="outline-button ownership-submit" type="submit" disabled={recipientResolving || !resolvedRecipient}><SettingsIcon name="transfer" />Transferir propiedad</button></form>}{!sentTransfers.some(item => item.status === "PENDING") && null}</section>}</div></div>
    </main>
    {confirmHide && createPortal(<div ref={hideOverlayRef} className="settings-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmHide(false); }}>
      <section className="settings-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-hide-title" aria-describedby="settings-hide-copy">
        <header className="settings-dialog-heading"><span className="settings-dialog-icon warning"><SettingsIcon name="eyeOff" /></span><div><span className="settings-dialog-eyebrow">PRIVACIDAD · XAMUKO BUSINESS</span><h2 id="settings-hide-title">¿Ocultar tu negocio?</h2></div></header>
        <p id="settings-hide-copy">Dejará de aparecer para las personas, pero conservarás toda su información.</p>
        <footer className="settings-dialog-actions"><button className="outline-button settings-dialog-cancel" type="button" onClick={() => setConfirmHide(false)}>Cancelar</button><button className="danger-button settings-dialog-danger" type="button" onClick={() => { saveVisibility(false, visibilityUntil?.toISOString() ?? null); setConfirmHide(false); }}><SettingsIcon name="eyeOff" />Sí, ocultar negocio</button></footer>
      </section>
    </div>, document.body)}
    {confirmTransfer && resolvedRecipient && createPortal(<div ref={transferOverlayRef} className="settings-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !transferSubmitting) setConfirmTransfer(false); }}>
      <section className="settings-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-transfer-title" aria-describedby="settings-transfer-copy" aria-busy={transferSubmitting}>
        <header className="settings-dialog-heading"><span className="settings-dialog-icon warning"><SettingsIcon name="transfer" /></span><div><span className="settings-dialog-eyebrow">PROPIEDAD · XAMUKO BUSINESS</span><h2 id="settings-transfer-title">¿Confirmas solicitar la transferencia?</h2></div></header>
        <div className="settings-dialog-copy"><p>Destinatario: <strong>{resolvedRecipient.displayName}</strong> ({resolvedRecipient.nickname})</p><p id="settings-transfer-copy">Dejarás de ser propietario de {business.name} y perderás todo acceso y permiso administrativo sobre el negocio.</p></div>
        {transferError && <p className="settings-dialog-error" role="alert">{transferError}</p>}
        <footer className="settings-dialog-actions"><button className="outline-button settings-dialog-cancel" type="button" disabled={transferSubmitting} onClick={() => setConfirmTransfer(false)}>Cancelar</button><button className="danger-button settings-dialog-danger" type="button" disabled={transferSubmitting} onClick={transferOwnership}><SettingsIcon name="transfer" />{transferSubmitting ? "Solicitando…" : "Sí, transferir propiedad"}</button></footer>
      </section>
    </div>, document.body)}
  </>;
}
