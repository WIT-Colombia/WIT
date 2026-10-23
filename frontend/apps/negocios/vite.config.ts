import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: Number(env.VITE_NEGOCIOS_PORT ?? 5175),
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: env.VITE_BUSINESS_BACKEND_URL ?? "http://127.0.0.1:3000",
          changeOrigin: false,
        },
      },
    },
  };
});
