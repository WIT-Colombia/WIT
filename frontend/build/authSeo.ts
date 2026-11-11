import type { Plugin } from "vite";
import { authSites, getAuthPageMetadata, getPrivateAuthPageMetadata, privateAuthRoutes, metadataTags, type AuthApplication, type PageMetadata } from "../packages/utils/src/authSeo";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Cloudflare Pages serves these clean HTML URLs before its SPA fallback. Search
// and social crawlers receive metadata without needing to execute JavaScript.
export function authSeo(application: AuthApplication): Plugin {
  const site = authSites[application];
  const routes: [string, PageMetadata][] = [[site.registerPath, getAuthPageMetadata(application, "register")]];
  if (!site.loginPath.includes("?")) routes.push([site.loginPath, getAuthPageMetadata(application, "login")]);
  for (const path of privateAuthRoutes[application]) routes.push([path, getPrivateAuthPageMetadata(application, path)!]);
  return {
    name: "xamuko-auth-seo", enforce: "post", apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const entry = bundle["index.html"];
        if (!entry || entry.type !== "asset") throw new Error("Missing index.html for authentication SEO pages");
        const base = String(entry.source).replace(/<title>.*?<\/title>/s, "").replace(/<meta name="description"[^>]*>/g, "").replace(/<meta name="robots"[^>]*>/g, "");
        for (const [path, meta] of routes) {
          const head = [
            `<title data-auth-seo>${escape(meta.title)}</title>`,
            ...metadataTags(meta).map(tag => `<meta data-auth-seo ${"property" in tag ? `property="${tag.property}"` : `name="${tag.name}"`} content="${escape(tag.content)}" />`),
            `<link data-auth-seo rel="canonical" href="${escape(meta.canonical)}" />`,
            `<script type="application/ld+json" data-auth-seo>${JSON.stringify(meta.structuredData).replace(/</g, "\\u003c")}</script>`,
          ].join("\n    ");
          this.emitFile({ type: "asset", fileName: `${path.slice(1)}.html`, source: base.replace("</head>", `    ${head}\n  </head>`) });
        }
        this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n${application === "usuario" ? `\nSitemap: ${site.origin}/sitemap.xml\n` : ""}` });
      },
    },
  };
}
