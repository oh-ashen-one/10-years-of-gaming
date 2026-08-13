import { defineConfig } from "vite";

// Game 10 — 2025 · CLAIR OBSCUR: EXPEDITION 33 fan recreation.
// Port 5310 (5300 + N), strict, so all eleven games can coexist.
export default defineConfig({
  server: {
    port: 5310,
    strictPort: true,
  },
});
