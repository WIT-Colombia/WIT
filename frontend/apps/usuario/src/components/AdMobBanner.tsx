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
    // Avoid an initial advertising flash while plan availability is loading.
    if (availability === 'pending') {
      setShow(false);
      return () => { active = false; };
    }
    // Admin's confirmed master OFF switch overrides historical subscriptions.
    // No private Plus endpoint should be required to display regular banners.
    if (!xamukoPlus && availability === 'verified') {
      setShow(true);
      return () => { active = false; };
    }
    setShow(false);
    const refresh = () => {
      void fetchPlusStatus().then(value => {
        if (active) setShow(value.enabled !== true || value.active !== true);
      }).catch(() => {
        if (!active) return;
        // During an older/backend-unavailable deployment, public availability
        // falls back to OFF. Restore the ordinary banner rather than leave all
        // authenticated accounts permanently ad-free; when Plus is confirmed
        // enabled, keep the safe no-ad fallback for unverified memberships.
        setShow(availability === 'unavailable' && !xamukoPlus);
      });
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
