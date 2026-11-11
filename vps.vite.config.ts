import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build Web HMI dưới dạng tài nguyên tĩnh tại "/" để FastAPI trên VPS/Docker phục vụ trực tiếp
export default defineConfig({
  root: "pages",
  base: "/",
  plugins: [react()],
  define: {
    __VPS_HOSTED__: JSON.stringify(true),
  },
  build: {
    outDir: "../vps-mqtt-backend/static",
    emptyOutDir: true,
  },
});
