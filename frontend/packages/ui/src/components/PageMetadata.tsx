import { useEffect } from "react";

type MetaTag = { name?: string; property?: string; content: string };

/** Updates route metadata and restores the previous head when the route exits. */
export function PageMetadata({ title, canonical, tags, structuredData, fallbackTitle, fallbackDescription }: {
  title: string;
  canonical: string;
  tags: MetaTag[];
  structuredData: Record<string, unknown>;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const serializedTags = JSON.stringify(tags);
  const serializedData = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  useEffect(() => {
    const staticTitle = document.head.querySelector('title[data-auth-seo]');
    const previousTitle = staticTitle ? fallbackTitle : document.title;
    staticTitle?.removeAttribute("data-auth-seo");
    const restore: (() => void)[] = [];
    document.title = title;
    function update(selector: string, tagName: string, attributes: Record<string, string>, content?: string) {
      const existing = document.head.querySelector(selector);
      // Static registration metadata belongs to this route, not the next page.
      const snapshot = existing?.hasAttribute("data-auth-seo") ? null : existing?.cloneNode(true);
      const element = existing ?? document.createElement(tagName);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      if (content !== undefined) element.textContent = content;
      if (!existing) document.head.append(element);
      restore.push(() => snapshot ? element.replaceWith(snapshot) : element.remove());
    }
    for (const tag of JSON.parse(serializedTags) as MetaTag[]) {
      const key = tag.name ? "name" : "property";
      const value = tag.name ?? tag.property!;
      update(`meta[${key}="${value}"]`, "meta", { [key]: value, content: tag.content });
    }
    update('link[rel="canonical"]', "link", { rel: "canonical", href: canonical });
    update('script[data-auth-seo]', "script", { type: "application/ld+json", "data-auth-seo": "" }, serializedData);
    return () => {
      document.title = previousTitle;
      restore.reverse().forEach(reset => reset());
      if (!document.head.querySelector('meta[name="robots"]')) {
        const robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex,follow"; document.head.append(robots);
      }
      if (!document.head.querySelector('meta[name="description"]')) {
        const description = document.createElement("meta");
        description.name = "description";
        description.content = fallbackDescription;
        document.head.append(description);
      }
    };
  }, [title, canonical, serializedTags, serializedData, fallbackTitle, fallbackDescription]);
  return null;
}
