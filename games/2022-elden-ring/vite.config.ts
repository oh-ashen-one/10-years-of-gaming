import { defineConfig } from "vite";

// Game 7 — 2022 · ELDEN RING fan recreation. Port 5307 (5300 + N),
// strict, so all eleven games can coexist on this machine.
export default defineConfig({
  server: {
    port: 5307,
    strictPort: true,
  },
});
