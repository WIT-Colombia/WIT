import "./GoogleMapEmbed.css";

type GoogleMapEmbedProps = { query: string; title: string; className?: string };

export function GoogleMapEmbed({ query, title, className = "" }: GoogleMapEmbedProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  const searchUrl = new URL("https://www.google.com/maps/search/");
  searchUrl.searchParams.set("api", "1");
  searchUrl.searchParams.set("query", query);

  if (!apiKey) return <div className={`google-map-fallback ${className}`} role="group" aria-label={title}>
    <span aria-hidden="true">⌖</span>
    <b>El mapa interactivo no está disponible en este momento</b>
    <p>Puedes abrir esta ubicación directamente en Google Maps.</p>
    <a href={searchUrl.toString()} target="_blank" rel="noreferrer">Abrir en Google Maps <span aria-hidden="true">↗</span></a>
  </div>;

  const parameters = new URLSearchParams({ key: apiKey, q: query, language: "es", region: "co" });
  return <iframe
    className={`google-map-embed ${className}`}
    title={title}
    src={`https://www.google.com/maps/embed/v1/place?${parameters.toString()}`}
    loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
    allowFullScreen
  />;
}
