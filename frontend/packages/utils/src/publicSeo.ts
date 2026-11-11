import { getAuthPageMetadata, metadataTags, type PageMetadata } from "./authSeo";

export const USER_ORIGIN = "https://user.xamuko.com";
export const PUBLIC_API = "https://api.xamuko.com/api/v1/public";
export type PublicSeoBusiness = {
  publicId: string; name: string; description?: string | null;
  category?: { name?: string; code?: string } | null;
  location?: { visibility?: string; cityName?: string; regionName?: string | null; address?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null } | null;
  coverPhoto?: { url: string } | null; profilePhoto?: { url: string } | null;
  contacts?: { phone?: string | null; website?: string | null };
  modalities?: { hours?: { dayOfWeek: string | number; isClosed: boolean; opensAt?: string | null; closesAt?: string | null }[] }[];
};
export const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const safeHttpUrl = (value?: string | null): string | undefined => {
  try {
    const url = new URL(value ?? "");
    const sensitive = [...url.searchParams.keys()].some(key => /token|signature|authorization|session|email|^code$|^key$|^x-amz-/i.test(key));
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !sensitive ? url.href : undefined;
  } catch { return undefined; }
};
const clean = (value?: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
export function hasUsefulPublicBusiness(business: PublicSeoBusiness): boolean {
  return Boolean(/^[a-zA-Z0-9-]{1,100}$/.test(business.publicId) && clean(business.name) && (clean(business.description).length >= 40 || (business.category?.name && business.location?.cityName)));
}

export function businessMetadata(business: PublicSeoBusiness, excluded = false): PageMetadata {
  const base = getAuthPageMetadata("usuario", "login");
  const name = clean(business.name);
  const category = clean(business.category?.name);
  const city = clean(business.location?.cityName);
  const title = [name, [category, city ? `en ${city}` : ""].filter(Boolean).join(" "), "XAMUKO"].filter(Boolean).join(" | ");
  const description = (clean(business.description) || `Conoce ${name}${city ? ` en ${city}` : ""}. Consulta la información comercial publicada y los medios de contacto disponibles en XAMUKO.`).slice(0, 160);
  const canonical = `${USER_ORIGIN}/business/${encodeURIComponent(business.publicId)}`;
  const image = safeHttpUrl(business.coverPhoto?.url) ?? safeHttpUrl(business.profilePhoto?.url) ?? base.image;
  const localBusiness: Record<string, unknown> = { "@type": "LocalBusiness", "@id": `${canonical}#business`, name, description, url: canonical };
  if (image !== base.image) localBusiness.image = image;
  const location = business.location;
  if (city) localBusiness.address = { "@type": "PostalAddress", addressLocality: city, ...(location?.regionName ? { addressRegion: location.regionName } : {}), ...(location?.visibility === "PUBLIC" && location.address ? { streetAddress: location.address } : {}), ...(location?.visibility === "PUBLIC" && location.postalCode ? { postalCode: location.postalCode } : {}) };
  if (location?.visibility === "PUBLIC" && typeof location.latitude === "number" && typeof location.longitude === "number" && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180) localBusiness.geo = { "@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude };
  if (business.contacts?.phone) localBusiness.telephone = business.contacts.phone;
  const website = safeHttpUrl(business.contacts?.website);
  if (website) localBusiness.sameAs = [website];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hours = (business.modalities?.[0]?.hours ?? []).filter(hour => !hour.isClosed && /^\d{2}:\d{2}$/.test(hour.opensAt ?? "") && /^\d{2}:\d{2}$/.test(hour.closesAt ?? "") && days[Number(hour.dayOfWeek)]).map(hour => ({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${days[Number(hour.dayOfWeek)]}`, opens: hour.opensAt, closes: hour.closesAt }));
  if (hours.length) localBusiness.openingHoursSpecification = hours;
  return { ...base, title, description, canonical, image, imageAlt: name, robots: !excluded && hasUsefulPublicBusiness(business) ? "index,follow,max-image-preview:large" : "noindex,follow", structuredData: { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: "es-CO", mainEntity: { "@id": `${canonical}#business` } },
    localBusiness,
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "XAMUKO", item: "https://xamuko.com/" }, { "@type": "ListItem", position: 2, name, item: canonical }] },
  ] } };
}

export function metadataHtml(metadata: PageMetadata): string {
  return [`<title data-auth-seo>${escapeHtml(metadata.title)}</title>`, ...metadataTags(metadata).map(tag => `<meta data-auth-seo ${"property" in tag ? `property="${tag.property}"` : `name="${tag.name}"`} content="${escapeHtml(tag.content)}" />`), `<link data-auth-seo rel="canonical" href="${escapeHtml(metadata.canonical)}" />`, `<script type="application/ld+json" data-auth-seo>${JSON.stringify(metadata.structuredData).replace(/</g, "\\u003c")}</script>`].join("\n");
}

export function injectMetadata(html: string, metadata: PageMetadata): string {
  return html.replace(/<title\b[^>]*>.*?<\/title>/gs, "").replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, "").replace(/<link\b[^>]*rel="canonical"[^>]*>/g, "").replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>.*?<\/script>/gs, "").replace("</head>", `${metadataHtml(metadata)}\n</head>`);
}
