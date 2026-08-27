import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The API base is `/api` in every environment. In dev it is proxied to the
// local backend below; in a deployed setting it is expected to be routed to
// the Cloud Run service by whatever fronts this bundle. Keeping one origin
// means the browser never needs CORS and the backend's auth posture is
// untouched (DECISIONS.md #11 / #32).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "OPENCUBE_");
  const apiTarget = env.OPENCUBE_API_URL ?? "http://127.0.0.1:8000";

  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  };
});
