import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchPlusStatus } from '../services/userPlusService';
import './AdMobBanner.css';

/** Ad slot only. Real third-party ads are not yet integrated. */
export function AdMobBanner({ slot = 'home-inline' }: { slot?: string }) {
  const { user, status } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    if (status === 'loading') { setShow(false); return () => { active = false; }; }
    if (!user || status !== 'authenticated') { setShow(true); return () => { active = false; }; }
    setShow(false);
    const refresh = () => {
      void fetchPlusStatus().then(value => { if (active) setShow(!value.active); })
        // Unverified entitlements never render advertising to potentially paying members.
        .catch(() => { if (active) setShow(false); });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user?.id, status]);

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
