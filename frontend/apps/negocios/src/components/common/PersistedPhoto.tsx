import { useEffect, useState, type CSSProperties } from "react";
import { businessApi } from "../../services/businessApiClient";

export function PersistedPhoto({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  const [objectUrl, setObjectUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    if (!src.startsWith("/api/")) { setObjectUrl(src); return () => { active = false; }; }
    businessApi.photoBlob(src).then(blob => { if (active) setObjectUrl(URL.createObjectURL(blob)); }).catch(() => { if (active) setObjectUrl(undefined); });
    return () => { active = false; setObjectUrl(current => { if (current?.startsWith("blob:")) URL.revokeObjectURL(current); return undefined; }); };
  }, [src]);
  return objectUrl ? <img className={className} style={style} src={objectUrl} alt={alt} /> : <span className={className} style={style} aria-label={alt} />;
}
