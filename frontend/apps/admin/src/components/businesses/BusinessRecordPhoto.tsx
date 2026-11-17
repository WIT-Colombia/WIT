import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchAdminBusinessRecordPhoto } from '../../services/adminApiClient';
import { Icon } from '../Icon';

type PhotoLoader = (id: string, size: number) => Promise<string>;
const PhotoContext = createContext<PhotoLoader | null>(null);
async function resize(blob: Blob, size: number) {
  if (!size || typeof createImageBitmap !== 'function') return blob;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return blob;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) return blob;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>(resolve => canvas.toBlob(result => resolve(result || blob), 'image/webp', .9));
  } catch { return blob; } finally { bitmap?.close(); }
}
/** Cache private previews for this record only. Revoke every URL when leaving. */
export function BusinessRecordPhotos({ businessId, children }: { businessId: string; children: ReactNode }) {
  const sources = useRef(new Map<string, Promise<string>>()), urls = useRef(new Set<string>()), alive = useRef(true);
  const loader = useRef<PhotoLoader>(async (id, size) => {
    const key = `${id}:${size}`, existing = sources.current.get(key);
    if (existing) return existing;
    const request = fetchAdminBusinessRecordPhoto(businessId, id).then(blob => resize(blob, size)).then(blob => {
      if (!alive.current) throw new Error('La ficha ya está cerrada.');
      const url = URL.createObjectURL(blob); urls.current.add(url); return url;
    }).catch(error => { sources.current.delete(key); throw error; });
    sources.current.set(key, request); return request;
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); sources.current.clear(); }; }, []);
  return <PhotoContext.Provider value={loader.current}>{children}</PhotoContext.Provider>;
}
export function BusinessRecordPhoto({ id, alt, size = 640, className = '', position, eager = false }: {
  id: string | null; alt: string; size?: number; className?: string; position?: { x: number; y: number }; eager?: boolean;
}) {
  const load = useContext(PhotoContext), ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager), [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '120px' });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    let active = true; setUrl(''); setFailed(false);
    if (id && visible && load) void load(id, size).then(source => { if (active) setUrl(source); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id, visible, load, size]);
  return <div ref={ref} className={`bd-photo ${className}`}>
    {url ? <img src={url} alt={alt} decoding="async" loading={eager ? 'eager' : 'lazy'} style={position ? { objectPosition: `${position.x}% ${position.y}%` } : undefined} onError={() => { setUrl(''); setFailed(true); }}/>
      : <span className="bd-photo-placeholder"><Icon name="image" size={28}/><span>{id ? failed ? 'Imagen no disponible' : 'Cargando fotografía…' : 'Sin fotografía registrada'}</span></span>}
  </div>;
}
