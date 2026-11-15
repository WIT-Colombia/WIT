import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Serve PDF.js resources from our own origin; private documents never need a CDN.
function pdfAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('pdfjs-dist/package.json'));
  const version = require('pdfjs-dist/package.json').version;
  const files = new Map<string, string>();
  async function discover() {
    files.set(`/pdfjs/${version}/LICENSE`, join(root, 'LICENSE'));
    for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
      for (const name of await readdir(join(root, folder))) files.set(`/pdfjs/${version}/${folder}/${name}`, join(root, folder, name));
    }
  }
  return { name: 'admin-private-pdf-resources',
    async buildStart() { await discover(); },
    async generateBundle() { for (const [url, file] of files) this.emitFile({ type: 'asset', fileName: url.slice(1), source: await readFile(file) }); },
    async configureServer(server) {
      await discover();
      server.middlewares.use(async (req, res, next) => {
        const file = files.get((req.url || '').split('?')[0]);
        if (!file) return next();
        try { res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'); res.end(await readFile(file)); }
        catch (error) { next(error); }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), pdfAssets()],
    server: {
      host: '127.0.0.1',
      port: Number(env.VITE_ADMIN_PORT ?? 5176),
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: env.VITE_ADMIN_BACKEND_URL ?? "http://127.0.0.1:3000",
          changeOrigin: false,
          secure: false,
        },
      },
    },
  };
});
