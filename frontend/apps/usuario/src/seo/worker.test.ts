import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import { businessMetadata, injectMetadata, type PublicSeoBusiness } from '../../../../packages/utils/src/publicSeo';

// Synthetic fixtures only; never emitted by a production build or sitemap.
const fixture: PublicSeoBusiness = { publicId: 'public-test', name: 'Negocio de prueba', description: 'Descripción pública de prueba', category: { name: 'Categoría de prueba' }, location: { cityName: 'Ciudad de prueba', visibility: 'PUBLIC', address: 'Dirección de prueba', latitude: 0, longitude: 0 }, contacts: { phone: 'telefono-publico', website: 'https://example.test/' }, modalities: [{ hours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '17:00' }] }] };
const shell = '<html><head><title>Aplicación</title><meta name="robots" content="noindex,follow" /><meta name="description" content="Aplicación" /></head><body><div id="root"></div></body></html>';
const assets = { fetch: vi.fn(async () => new Response(shell, { headers: { 'Content-Type': 'text/html', ETag: 'old' } })) };
const request = (path: string, init?: RequestInit) => new Request(`https://user.xamuko.com${path}`, init);
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('public business SEO and privacy', () => {
  it('uses only public fields and emits valid LocalBusiness, hours and breadcrumbs', () => {
    const metadata = businessMetadata(fixture);
    expect(metadata.robots).toContain('index,follow');
    expect(metadata.title).toContain(fixture.location!.cityName);
    const graph = metadata.structuredData['@graph'] as Record<string, any>[];
    expect(graph.map(item => item['@type'])).toEqual(['WebPage', 'LocalBusiness', 'BreadcrumbList']);
    expect(graph[1].geo).toMatchObject({ latitude: 0, longitude: 0 });
    expect(graph[1].openingHoursSpecification[0].dayOfWeek).toBe('https://schema.org/Monday');
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|email|price|availability/);
  });
  it('does not expose a private address/coordinates or invented hours', () => {
    const metadata = businessMetadata({ ...fixture, location: { ...fixture.location!, visibility: 'PRIVATE' }, modalities: [{ hours: [{ dayOfWeek: '8', isClosed: false, opensAt: 'invalid', closesAt: 'invalid' }] }] });
    const graph = metadata.structuredData['@graph'] as Record<string, any>[];
    expect(graph[1].geo).toBeUndefined();
    expect(graph[1].address.streetAddress).toBeUndefined();
    expect(graph[1].openingHoursSpecification).toBeUndefined();
  });
  it('escapes hostile public text without breaking JSON-LD or adding scripts', () => {
    const metadata = businessMetadata({ ...fixture, name: '</script><script>alert(1)</script>' });
    const html = injectMetadata(shell, metadata);
    expect(html.match(/<script\b/g)).toHaveLength(1);
    const data = JSON.parse(html.match(/<script type="application\/ld\+json" data-auth-seo>(.*?)<\/script>/s)![1]);
    expect(data['@graph'][1].name).toContain('</script>');
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/name="robots"/g)).toHaveLength(1);
  });
  it('excludes insufficient content and previews', () => {
    expect(businessMetadata({ publicId: 'empty', name: 'Sin información' }).robots).toBe('noindex,follow');
    expect(businessMetadata(fixture, true).robots).toBe('noindex,follow');
  });
  it('returns source metadata to all visitors without forwarding credentials', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => Response.json({ business: fixture })); vi.stubGlobal('fetch', fetchMock);
    const result = await worker.fetch(request('/business/public-test?tab=products&ref=private', { headers: { Cookie: 'private=session', Authorization: 'Bearer private' } }), { ASSETS: assets });
    expect(result.status).toBe(200);
    expect(result.headers.get('X-Robots-Tag')).toContain('index,follow');
    const html = await result.text();
    expect(html).toContain('https://user.xamuko.com/business/public-test');
    expect(html).not.toContain('ref=private');
    expect(result.headers.has('ETag')).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.xamuko.com/api/v1/public/businesses/public-test');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', headers: { Accept: 'application/json' } });
  });
  it('marks previews noindex in the HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ business: fixture })));
    const response = await worker.fetch(request('/business/public-test?preview=business'), { ASSETS: assets });
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex,follow');
  });
  it('returns real 404 and noindex for missing/unpublished profiles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const result = await worker.fetch(request('/business/removed'), { ASSETS: assets });
    expect(result.status).toBe(404); expect(result.headers.get('X-Robots-Tag')).toBe('noindex,follow');
  });
  it('returns retryable 503 on a temporary API failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const result = await worker.fetch(request('/business/public-test'), { ASSETS: assets });
    expect(result.status).toBe(503); expect(result.headers.get('Retry-After')).toBe('60');
  });
  it('delegates all other routes and methods without inspecting sessions', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await worker.fetch(request('/profile'), { ASSETS: assets });
    await worker.fetch(request('/business/public-test', { method: 'POST' }), { ASSETS: assets });
    expect(fetchMock).not.toHaveBeenCalled(); expect(assets.fetch).toHaveBeenCalledTimes(2);
  });
  it('generates a scalable sitemap index from anonymous public pagination', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ businesses: [fixture], pagination: { totalPages: 2 } })));
    const response = await worker.fetch(request('/sitemap.xml'), { ASSETS: assets });
    const text = await response.text();
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(text).toContain('/sitemaps/businesses-1.xml'); expect(text).toContain('/sitemaps/businesses-2.xml');
    expect(text).not.toMatch(/register|login|profile|lastmod/);
  });
  it('deduplicates public canonical profile URLs and excludes thin records', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ businesses: [fixture, fixture, { publicId: 'thin', name: 'Thin' }], pagination: { totalPages: 1 } })));
    const response = await worker.fetch(request('/sitemaps/businesses-1.xml'), { ASSETS: assets });
    const text = await response.text(); expect(text.match(/<url>/g)).toHaveLength(1);
    expect(text).not.toMatch(/thin|lastmod|token|register/);
  });
  it('never replaces an API failure with a misleading empty successful sitemap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    const result = await worker.fetch(request('/sitemap.xml'), { ASSETS: assets });
    expect(result.status).toBe(503);
  });
});
