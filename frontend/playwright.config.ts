import { defineConfig, devices } from 'playwright/test';

const usuario = process.env.E2E_USUARIO_URL ?? 'http://127.0.0.1:5175';
const negocios = process.env.E2E_NEGOCIOS_URL ?? 'http://127.0.0.1:5176';
const admin = process.env.E2E_ADMIN_URL ?? 'http://127.0.0.1:5177';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e-results/report', open: 'never' }]],
  outputDir: 'e2e-results/test-artifacts',
  use: { headless: true, baseURL: usuario, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [
    { name: 'usuario-desktop', grep: /Usuario|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: usuario, viewport: { width: 1440, height: 900 } } },
    { name: 'usuario-mobile', grep: /Usuario|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: usuario, viewport: { width: 390, height: 844 } } },
    { name: 'negocios-desktop', grep: /Business|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: negocios, viewport: { width: 1440, height: 900 } } },
    { name: 'negocios-mobile', grep: /Business|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: negocios, viewport: { width: 390, height: 844 } } },
    { name: 'admin-desktop', grep: /Admin|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: admin, viewport: { width: 1440, height: 900 } } },
    { name: 'admin-mobile', grep: /Admin|desbordan/, use: { ...devices['Desktop Chrome'], baseURL: admin, viewport: { width: 390, height: 844 } } },
  ],
});
