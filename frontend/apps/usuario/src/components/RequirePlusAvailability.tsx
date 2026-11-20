import { refreshPaidPlans, usePaidPlans } from '@wit/utils';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Fail closed on direct Plus URLs. The shared availability store initially
 * starts disabled, so wait for a fresh public API response before deciding
 * whether to enter Plus or return to Profile.
 * The backend continues to enforce the global switch and each membership.
 */
export function RequirePlusAvailability({ children }: { children: ReactNode }) {
  const { xamukoPlus } = usePaidPlans();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let mounted = true;
    void refreshPaidPlans().catch(() => { /* A failed availability check must never grant access. */ }).finally(() => {
      if (mounted) setVerified(true);
    });
    return () => { mounted = false; };
  }, []);

  if (!verified) return <main className="xamuko-route-pending" role="status">Verificando disponibilidad…</main>;
  return xamukoPlus ? <>{children}</> : <Navigate to="/profile" replace />;
}
