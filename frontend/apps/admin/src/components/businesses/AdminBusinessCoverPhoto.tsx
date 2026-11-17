import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { fetchAdminBusinessCoverPhoto } from '../../services/adminApiClient';

/** Resize the decoded preview to save memory on iPad and mobile without modifying the original. */
async function previewThumbnail(source: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return source;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(source);
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return source;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return source;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>(resolve => canvas.toBlob(
      result => resolve(result && result.size ? result : source), 'image/webp', .88,
    ));
  } catch {
    return source;
  } finally {
    bitmap?.close();
  }
}

/** Lazy authenticated image, with no stored URL leakage and a stable fallback. */
export function AdminBusinessCoverPhoto({ photoId, name, variant = 'cover' }: { photoId: string | null; name: string; variant?: 'cover' | 'profile' }) {
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
    void fetchAdminBusinessCoverPhoto(photoId).then(async image => {
      const thumbnail = await previewThumbnail(image);
      if (!active) return;
      url = URL.createObjectURL(thumbnail);
      setSource(url);
    }).catch(() => { if (active) setSource(null); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [photoId, visible]);

  return <span ref={holder} className={'business-directory-cover' + (variant === 'profile' ? ' business-directory-profile' : '')}
    title={(variant === 'profile' ? 'Foto de perfil de ' : 'Portada de ') + name} aria-hidden="true">
    {source ? <img src={source} alt="" loading="lazy" decoding="async" /> : <Icon name="store" size={21} />}
  </span>;
}
