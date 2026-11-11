import { businessMetadata, escapeHtml, hasUsefulPublicBusiness, injectMetadata, PUBLIC_API, USER_ORIGIN, type PublicSeoBusiness } from '../../../../packages/utils/src/publicSeo';
import { getAuthPageMetadata } from '../../../../packages/utils/src/authSeo';

type Environment = { ASSETS: { fetch(request: Request): Promise<Response> } };
type PublicList = { businesses: PublicSeoBusiness[]; pagination: { totalPages: number } };
const ID = /^[a-zA-Z0-9-]{1,100}$/;
const PAGE_SIZE = 20;
async function publicJson<T>(path: string): Promise<T> {
  // No visitor cookies, Authorization, session restoration or private endpoints.
  // Workers rejects redirect:'error'; manual exposes 3xx for rejection below.
  // A fresh URL request and explicit header allowlist never forward cookies.
  const response = await fetch(PUBLIC_API + path, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Object.assign(new Error('Public catalog unavailable'), { status: response.status });
  return response.json() as Promise<T>;
}
const xml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
async function sitemap(path: string): Promise<Response> {
  if (path === '/sitemap.xml') {
    const data = await publicJson<PublicList>(`/businesses?page=1&pageSize=${PAGE_SIZE}`);
    const pages = data.pagination.totalPages;
    if (!Number.isInteger(pages) || pages < 0 || pages > 50000) throw new Error('Invalid public pagination');
    return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: pages }, (_, i) => `<sitemap><loc>${USER_ORIGIN}/sitemaps/businesses-${i + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
  }
  const match = path.match(/^\/sitemaps\/businesses-([1-9]\d{0,4})\.xml$/);
  if (!match) return new Response('Not found', { status: 404 });
  const page = Number(match[1]);
  const data = await publicJson<PublicList>(`/businesses?page=${page}&pageSize=${PAGE_SIZE}`);
  if (page > data.pagination.totalPages) return new Response('Not found', { status: 404 });
  // Summaries already come from the anonymous published/visible catalog. Avoid
  // N+1 detail calls and fabricated lastmod: no public updatedAt is available.
  const urls = [...new Set(data.businesses.filter(hasUsefulPublicBusiness).map(item => `${USER_ORIGIN}/business/${encodeURIComponent(item.publicId)}`))];
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${escapeHtml(url)}</loc></url>`).join('')}</urlset>`);
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);
    if (url.pathname === '/sitemap.xml' || url.pathname.startsWith('/sitemaps/')) {
      if (url.origin !== USER_ORIGIN) return new Response('Canonical host only', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
      try { const response = await sitemap(url.pathname); return request.method === 'HEAD' ? new Response(null, response) : response; }
      catch { return new Response('Public sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '60', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } }); }
    }
    const match = url.pathname.match(/^\/business\/([^/]+)\/?$/);
    if (!match) return env.ASSETS.fetch(request);
    const id = match[1];
    let metadata = getAuthPageMetadata('usuario', 'login');
    let status = 404;
    if (ID.test(id)) {
      try {
        const { business } = await publicJson<{ business: PublicSeoBusiness }>(`/businesses/${encodeURIComponent(id)}`);
        if (!business || business.publicId !== id || !business.name) throw new Error('Invalid public business');
        metadata = businessMetadata(business, url.origin !== USER_ORIGIN || ['preview', 'demoCatalog', 'token', 'code', 'email'].some(key => url.searchParams.has(key)));
        status = 200;
      } catch (error) {
        status = (error as { status?: number }).status === 404 ? 404 : 503;
      }
    }
    if (status !== 200) metadata = { ...metadata, title: status === 404 ? 'Negocio no disponible | XAMUKO' : 'Consulta temporalmente no disponible | XAMUKO', canonical: USER_ORIGIN + '/home', structuredData: {} };
    const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
    if (!shell.ok) return shell;
    const headers = new Headers(shell.headers);
    headers.delete('Content-Length'); headers.delete('ETag'); headers.delete('Content-Encoding');
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Robots-Tag', metadata.robots);
    if (status === 503) headers.set('Retry-After', '60');
    return new Response(request.method === 'HEAD' ? null : injectMetadata(await shell.text(), metadata), { status, headers });
  },
};
