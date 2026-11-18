import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Real Admin CSS, loaded in the same order as the app. The fixture uses no
// privileged account, backend or mocked font sizes.
const typography = await readFile(new URL('../apps/admin/src/styles/typography.css', import.meta.url), 'utf8');
const businessRecord = await readFile(new URL('../apps/admin/src/pages/businessRecord/businessRecord.css', import.meta.url), 'utf8');
const output = fileURLToPath(new URL('../test-results/admin-business-metric-type/', import.meta.url));
const variants = [
  { device: 'desktop', viewport: { width: 1440, height: 900 }, expected: '11px' },
  { device: 'ipad', viewport: { width: 820, height: 1180 }, expected: '11px' },
  { device: 'mobile', viewport: { width: 390, height: 844 }, expected: '12px' },
];
const items = [
  ['Visualizaciones', 'En el período', 'Total de reportes'],
  ['Me gusta', 'En productos y servicios', 'Pendientes'],
  ['Calificación promedio', 'Sin calificaciones', 'En revisión'],
  ['Favoritos', 'Personas que lo guardaron', 'Finalizados'],
];
const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body class="admin-refresh"><main class="admin-main"><div class="workspace"><div class="bd-record">
<div class="bd-summary"><section class="bd-summary-card bd-summary-performance"><h2>Rendimiento en Xamuko</h2>
<div class="bd-summary-metrics">
${items.map(([label, hint], index) => `<article class="bd-summary-metric bd-summary-metric--${['purple','blue','gold','green'][index]}">
<span class="bd-summary-metric-icon" aria-hidden="true">☆</span><strong>—</strong>
<span class="bd-summary-metric-name">${label}</span><small>${hint}</small></article>`).join('')}
</div></section></div>
<section class="bd-report-register" aria-label="Reportes del negocio"><h2>Reportes del negocio</h2>
<div class="bd-report-stats">
${items.map(([, , label], index) => `<div class="bd-report-stat"><span class="bd-report-stat-icon">${index+1}</span>
<span class="bd-report-stat-body"><span>${label}</span><strong>—</strong></span></div>`).join('')}
</div></section></div></div></main></body></html>`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
await mkdir(output, { recursive: true });
try {
  for (const { device, viewport, expected } of variants) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.setContent(fixture);
      await page.addStyleTag({ content: typography });
      await page.addStyleTag({ content: businessRecord });
      const sizes = await page.evaluate(() => ({
        summary: [...document.querySelectorAll('.bd-summary-metric-name')].map(el => getComputedStyle(el).fontSize),
        reports: [...document.querySelectorAll('.bd-report-stat-body > span')].map(el => getComputedStyle(el).fontSize),
      }));
      assert.equal(sizes.summary.length, 4, device + ': four Summary indicators');
      assert.equal(sizes.reports.length, 4, device + ': four Reports indicators');
      for (let index = 0; index < 4; index++) {
        assert.equal(sizes.summary[index], expected, device + ': Summary indicator ' + index);
        assert.equal(sizes.reports[index], expected, device + ': Reports indicator ' + index);
        assert.equal(sizes.summary[index], sizes.reports[index], device + ': matching font size for ' + items[index][0]);
      }
      await page.screenshot({ path: resolve(output, device + '.png'), fullPage: true });
      console.log('Admin business metric typography OK: ' + device + ' (' + expected + ')');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
