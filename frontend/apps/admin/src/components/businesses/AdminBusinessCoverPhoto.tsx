import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { fetchAdminBusinessCoverPhoto } from '../../services/adminApiClient';

/** Lazy authenticated image, with no stored URL leakage and a stable fallback. */
export function AdminBusinessCoverPhoto({ photoId, name }: { photoId: string | null; name: string }) {
  const holder = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    setVisible(false);
    const target = holder.current;
    if (!photoId || !target) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [photoId]);

  useEffect(() => {
    if (!photoId || !visible) { setSource(null); return; }
    let active = true;
    let url: string | null = null;
    void fetchAdminBusinessCoverPhoto(photoId).then(image => {
      if (!active) return;
      url = URL.createObjectURL(image);
      setSource(url);
    }).catch(() => { if (active) setSource(null); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [photoId, visible]);

  return <span ref={holder} className="business-directory-cover" title={"Portada de " + name} aria-hidden="true">
    {source ? <img src={source} alt="" loading="lazy" decoding="async" /> : <Icon name="store" size={21} />}
  </span>;
}
