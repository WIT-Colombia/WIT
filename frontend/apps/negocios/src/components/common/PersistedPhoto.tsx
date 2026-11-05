import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { businessApi } from "../../services/businessApiClient";

export function PersistedPhoto({ src, alt, className, style, fallback }: { src: string; alt: string; className?: string; style?: CSSProperties; fallback?: ReactNode }) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setObjectUrl(undefined);
    setFailed(false);
    if (!src.startsWith("/api/")) { setObjectUrl(src); return () => { active = false; }; }
    businessApi.photoBlob(src).then(blob => { if (active) setObjectUrl(URL.createObjectURL(blob)); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; setObjectUrl(current => { if (current?.startsWith("blob:")) URL.revokeObjectURL(current); return undefined; }); };
  }, [src]);
  if (objectUrl && !failed) {
    return <img className={className} style={style} src={objectUrl} alt={alt} onError={() => setFailed(true)} />;
  }
  return failed && fallback ? fallback : <span className={className} style={style} aria-label={alt} />;
}
