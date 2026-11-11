import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/seo/worker.ts', formats: ['es'], fileName: () => '_worker.js' },
    target: 'es2022',
    minify: true,
  },
});
