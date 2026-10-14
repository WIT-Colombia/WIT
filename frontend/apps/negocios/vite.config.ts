import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        "/api/v1": {
          target: env.VITE_BUSINESS_BACKEND_URL ?? "http://127.0.0.1:3000",
          changeOrigin: false,
        },
      },
    },
  };
});
