import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { fetchAdminContentPhoto } from '../services/adminApiClient';

/**
 * Downsample directory thumbnails to avoid retaining many decoded 4K originals
 * on memory-constrained mobile devices. The detail view still loads full quality.
 */
async function asThumbnail(source:Blob):Promise<Blob>{
  if(typeof createImageBitmap!=='function')return source;
  let bitmap:ImageBitmap|null=null;
  try{
    bitmap=await createImageBitmap(source);
    const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    if(scale>=1)return source;
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)return source;
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const smaller=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.84));
    return smaller&&smaller.size>0?smaller:source;
  }catch{return source;}
  finally{bitmap?.close();}
}

/** Uses authenticated Admin session cookies; no internal photo storage key is exposed. */
export function AdminContentPhoto({ photoId, alt = '', type = 'PRODUCT', className = '', thumbnail = false }: {
  photoId: string | null; alt?: string; type?: 'PRODUCT' | 'SERVICE'; className?: string; thumbnail?:boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = holder.current;
    if (!node || !photoId) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: thumbnail ? '80px' : '250px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [photoId,thumbnail]);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSource(null);
    setFailed(false);
    if (!photoId || !visible) return;
    let active = true;
    let url: string | null = null;
    void (async()=>{
      try{
        const original=await fetchAdminContentPhoto(photoId);
        const blob=thumbnail?await asThumbnail(original):original;
        if(!active)return;
        url=URL.createObjectURL(blob);
        setSource(url);
      }catch{if(active)setFailed(true);}
    })();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [photoId, visible,thumbnail]);
  return <div ref={holder} className={'ac-photo ' + className}>
    {source
      ? <img alt={alt} src={source} loading="lazy" decoding="async" onError={() => { setSource(null); setFailed(true); }} />
      : <span className="ac-photo-fallback" aria-label={failed ? 'Imagen no disponible' : photoId ? 'Cargando imagen' : 'Sin imagen registrada'}>
        <Icon name={type === 'SERVICE' ? 'settings' : 'box'} size={25} />
        <small>{failed ? 'Imagen no disponible' : photoId ? 'Cargando imagen' : 'Sin fotografía'}</small>
      </span>}
  </div>;
}
