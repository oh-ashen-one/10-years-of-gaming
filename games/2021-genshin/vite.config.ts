import { defineConfig } from "vite";

// Game 6 — 2021 · GENSHIN IMPACT fan recreation. Port 5306 (5300 + N),
// strict, so all eleven games can coexist on this machine.
export default defineConfig({
  server: {
    port: 5306,
    strictPort: true,
  },
});
