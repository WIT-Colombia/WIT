import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { fetchAdminContentPhoto } from '../services/adminApiClient';

/** Uses authenticated Admin session cookies; no internal photo storage key is exposed. */
export function AdminContentPhoto({ photoId, alt = '', type = 'PRODUCT', className = '' }: {
  photoId: string | null; alt?: string; type?: 'PRODUCT' | 'SERVICE'; className?: string;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSource(null);
    setFailed(false);
    if (!photoId) return;
    let active = true;
    let url: string | null = null;
    fetchAdminContentPhoto(photoId).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setSource(url);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [photoId]);
  return <div className={'ac-photo ' + className}>
    {source
      ? <img alt={alt} src={source} loading="lazy" decoding="async" onError={() => { setSource(null); setFailed(true); }} />
      : <span className="ac-photo-fallback" aria-label={failed ? 'Imagen no disponible' : photoId ? 'Cargando imagen' : 'Sin imagen registrada'}>
        <Icon name={type === 'SERVICE' ? 'settings' : 'box'} size={25} />
        <small>{failed ? 'Imagen no disponible' : photoId ? 'Cargando imagen' : 'Sin fotografía'}</small>
      </span>}
  </div>;
}
