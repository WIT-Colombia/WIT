import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { businessApi } from "../../services/businessApiClient";

export function PersistedPhoto({ src, alt, className, style, fallback }: { src: string; alt: string; className?: string; style?: CSSProperties; fallback?: ReactNode }) {
  const [objectUrl, setObjectUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    setObjectUrl(undefined);
    if (!src.startsWith("/api/")) { setObjectUrl(src); return () => { active = false; }; }
    businessApi.photoBlob(src).then(blob => { if (active) setObjectUrl(URL.createObjectURL(blob)); }).catch(() => { if (active) setObjectUrl(undefined); });
    return () => { active = false; setObjectUrl(current => { if (current?.startsWith("blob:")) URL.revokeObjectURL(current); return undefined; }); };
  }, [src]);
  // Show an initial during authenticated loading or if the image is missing.
  // Never leave a blank avatar where an account picture is expected.
  return objectUrl
    ? <img className={className} style={style} src={objectUrl} alt={alt} onError={() => setObjectUrl(current => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return undefined;
      })} />
    : <span className={className} style={style} role="img" aria-label={alt}>{fallback}</span>;
}
