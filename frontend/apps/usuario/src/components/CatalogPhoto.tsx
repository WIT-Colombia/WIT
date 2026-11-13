import { useEffect, useState } from "react";
import { requestBlobWithSession } from "../services/authService";

/** Shared authenticated media renderer for products and services. */
export function CatalogPhoto({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(null);
    if (!src) return;
    void requestBlobWithSession(src).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setUrl(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return url ? <img src={url} alt={alt} loading="lazy" /> : <div className="catalog-photo-fallback" role="img" aria-label={alt} />;
}
