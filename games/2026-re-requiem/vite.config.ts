import { defineConfig } from "vite";

// Game 11 — 2026 · RESIDENT EVIL REQUIEM fan recreation. Port 5311
// (5300 + N), strict, so all eleven games can coexist on this machine.
export default defineConfig({
  server: {
    port: 5311,
    strictPort: true,
  },
});
