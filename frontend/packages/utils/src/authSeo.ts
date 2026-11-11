export type AuthApplication = "usuario" | "business";
export type AuthMode = "register" | "login";

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  siteName: string;
  image: string;
  imageAlt?: string;
  fallbackTitle: string;
  fallbackDescription: string;
  structuredData: Record<string, unknown>;
}

export const authSites = {
  usuario: {
    origin: "https://user.xamuko.com",
    registerPath: "/register",
    loginPath: "/register?mode=login",
    siteName: "XAMUKO Usuarios",
    registerTitle: "Crea tu cuenta y descubre negocios cerca de ti | XAMUKO",
    registerDescription: "Regístrate en XAMUKO para descubrir negocios, productos y servicios cerca de ti. Guarda tus favoritos y conecta con los establecimientos de tu ciudad.",
    loginDescription: "Inicia sesión en XAMUKO para explorar negocios, productos y servicios de tu ciudad y consultar tus favoritos.",
  },
  business: {
    origin: "https://business.xamuko.com",
    registerPath: "/registro",
    loginPath: "/login",
    siteName: "XAMUKO Business",
    registerTitle: "Registra tu cuenta de negocio | XAMUKO Business",
    registerDescription: "Crea tu cuenta en XAMUKO Business y gestiona el perfil comercial de tu negocio, sus productos y servicios. Conecta con clientes cercanos en tu ciudad.",
    loginDescription: "Inicia sesión en XAMUKO Business para administrar tus negocios, productos, servicios y presencia comercial en tu ciudad.",
  },
} as const;

// Only allowlisted routes enter metadata: never copy tokens, email, referrals or
// arbitrary query parameters into canonical links, social tags or JSON-LD.
export function getAuthPageMetadata(application: AuthApplication, mode: AuthMode): PageMetadata {
  const site = authSites[application];
  const registration = mode === "register";
  const canonical = site.origin + (registration ? site.registerPath : site.loginPath);
  const title = registration ? site.registerTitle : `Iniciar sesión | ${site.siteName}`;
  const description = registration ? site.registerDescription : site.loginDescription;
  return {
    title, description, canonical,
    robots: "noindex,follow",
    siteName: site.siteName,
    image: `${site.origin}/seo/registration.png`,
    fallbackTitle: application === "usuario" ? "XAMUKO · Encuentra cerca de ti" : "XAMUKO Business",
    fallbackDescription: application === "usuario" ? "Descubre negocios, productos y servicios cerca de ti con XAMUKO." : "Gestiona la presencia comercial de tu negocio con XAMUKO Business.",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical, name: title, description, inLanguage: "es-CO",
      isPartOf: { "@type": "WebSite", name: "XAMUKO", url: "https://xamuko.com/" },
    },
  };
}

export function metadataTags(metadata: PageMetadata) {
  return [
    { name: "description", content: metadata.description },
    { name: "robots", content: metadata.robots },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "es_CO" },
    { property: "og:site_name", content: metadata.siteName },
    { property: "og:title", content: metadata.title },
    { property: "og:description", content: metadata.description },
    { property: "og:url", content: metadata.canonical },
    { property: "og:image", content: metadata.image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: metadata.imageAlt ?? "XAMUKO — Lo que necesitas, está más cerca." },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: metadata.title },
    { name: "twitter:description", content: metadata.description },
    { name: "twitter:image", content: metadata.image },
    { name: "twitter:image:alt", content: metadata.imageAlt ?? "XAMUKO — Lo que necesitas, está más cerca." },
  ].filter(tag => metadata.image.endsWith("/seo/registration.png") || !["og:image:width", "og:image:height"].includes(tag.property ?? ""));
}

export const privateAuthRoutes = {
  usuario: ["/recover-password", "/reset-password", "/change-password", "/recuperar", "/verify-email", "/auth/google/callback"],
  business: ["/recuperar", "/verify-email", "/auth/google/callback"],
} as const;

export function getPrivateAuthPageMetadata(application: AuthApplication, pathname: string): PageMetadata | null {
  if (!(privateAuthRoutes[application] as readonly string[]).includes(pathname)) return null;
  const site = authSites[application];
  const metadata = getAuthPageMetadata(application, "login");
  const title = `Verificación y recuperación de cuenta | ${site.siteName}`;
  const canonical = site.origin + pathname;
  return {
    ...metadata, title, canonical,
    structuredData: { ...metadata.structuredData, "@id": `${canonical}#webpage`, url: canonical, name: title },
  };
}
