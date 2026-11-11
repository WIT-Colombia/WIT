import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (app, file) => readFileSync(new URL(`../apps/${app}/dist/${file}`, import.meta.url), 'utf8');
const content = (html, key) => html.match(new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]+content="([^"]+)"`))?.[1];

for (const [app, origin, route, privateRoutes] of [
  ['usuario', 'https://user.xamuko.com', '/register', ['/verify-email', '/recover-password', '/change-password', '/reset-password', '/recuperar', '/auth/google/callback']],
  ['negocios', 'https://business.xamuko.com', '/registro', ['/login', '/verify-email', '/recuperar', '/auth/google/callback']],
]) {
  test(`${app}: search and social crawlers receive complete registration metadata without JavaScript`, () => {
    const html = read(app, `${route.slice(1)}.html`);
    assert.match(html, /<html lang="es-CO">/);
    assert.equal((html.match(/<title\b/g) ?? []).length, 1);
    assert.equal((html.match(/name="description"/g) ?? []).length, 1);
    assert.match(content(html, 'description'), /XAMUKO/);
    assert.equal(content(html, 'robots'), 'noindex,follow');
    assert.match(html, new RegExp(`<link[^>]+rel="canonical" href="${origin}${route}"`));
    assert.equal(content(html, 'og:url'), origin + route);
    assert.equal(content(html, 'og:locale'), 'es_CO');
    assert.equal(content(html, 'og:image'), `${origin}/seo/registration.png`);
    assert.equal(content(html, 'twitter:card'), 'summary_large_image');
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json" data-auth-seo>(.*?)<\/script>/s)[1]);
    assert.equal(structured['@type'], 'WebPage');
    assert.equal(structured.url, origin + route);
    assert.equal(structured.inLanguage, 'es-CO');
    assert(!('aggregateRating' in structured));
    const image = readFileSync(new URL(`../apps/${app}/dist/seo/registration.png`, import.meta.url));
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
  });
  test(`${app}: access and account recovery are noindex and excluded from the sitemap`, () => {
    for (const path of privateRoutes) {
      const html = read(app, `${path.slice(1)}.html`);
      assert.equal(content(html, 'robots'), 'noindex,follow');
      assert.equal(content(html, 'og:url'), origin + path);
    }
    assert.match(read(app, 'robots.txt'), /User-agent: \*\nAllow: \//);
    if (app === 'usuario') assert(read(app, 'robots.txt').includes(`Sitemap: ${origin}/sitemap.xml`));
    else assert(!read(app, 'robots.txt').includes('Sitemap:'));
    assert(!read(app, 'index.html').includes('rel="canonical"'));
  });
}

test('landing: real public content is prerendered and canonical sitemap contains only the root', () => {
  const html = read('landing', 'index.html');
  assert(!html.includes('<div id="root"></div>'));
  assert.match(html, /Todo lo que necesitas/);
  assert.match(html, /Para <span>usuarios/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal(content(html, 'robots'), 'index,follow,max-image-preview:large');
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(schema['@graph'].map(item => item['@type']), ['Organization', 'WebSite']);
  assert.deepEqual([...read('landing', 'sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), ['https://xamuko.com/']);
  assert(html.includes('reference-art-4k.webp'));
  assert(!html.includes('reference-art.jpg'));
});
