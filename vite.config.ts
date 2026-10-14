import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Overridable for isolated runs; see server/service-config.ts.
const service = `http://127.0.0.1:${Number(process.env.KAMIKAMI_PORT) || 4318}`;
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.KAMIKAMI_EDITOR_PORT) || 5173,
    strictPort: true,
    proxy: {
      "/api": service,
      "/media": service,
      "/fonts/imported": service,
    },
  },
});
