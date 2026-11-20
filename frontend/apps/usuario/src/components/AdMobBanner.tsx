import { useEffect, useState } from 'react';
import { usePaidPlans, usePaidPlansVerification } from '@wit/utils';
import { useAuth } from '../context/AuthContext';
import { fetchPlusStatus } from '../services/userPlusService';
import './AdMobBanner.css';

/** Ad slot only. Real third-party ads are not yet integrated. */
export function AdMobBanner({ slot = 'home-inline' }: { slot?: string }) {
  const { user, status } = useAuth();
  const { xamukoPlus } = usePaidPlans();
  const availability = usePaidPlansVerification();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    if (status === 'loading') { setShow(false); return () => { active = false; }; }
    if (!user || status !== 'authenticated') { setShow(true); return () => { active = false; }; }
    // Do not briefly show ads to existing paying members while the global
    // availability request is pending or the public API is unavailable.
    if (availability !== 'verified') {
      setShow(false);
      return () => { active = false; };
    }
    // Admin's master switch overrides historical subscriptions. If Plus is
    // globally off, all signed-in users (including administrators) see ads,
    // even when the separate membership endpoint is not deployed or fails.
    if (!xamukoPlus) {
      setShow(true);
      return () => { active = false; };
    }
    setShow(false);
    const refresh = () => {
      void fetchPlusStatus().then(value => {
        if (active) setShow(value.enabled !== true || value.active !== true);
      })
        // When Plus is enabled, do not expose ads to unverified paying members.
        .catch(() => { if (active) setShow(false); });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user?.id, status, xamukoPlus, availability]);

  if (!show) return null;
  return <aside className="admob-banner" data-admob-slot={slot} aria-label="Publicidad">
    <span className="admob-banner__label">Publicidad</span>
    <div className="admob-banner__copy">
      <strong>Descubre algo nuevo cerca de ti</strong>
      <span>Recomendaciones de negocios locales</span>
    </div>
    <span className="admob-banner__mark" aria-hidden="true">↗</span>
  </aside>;
}
