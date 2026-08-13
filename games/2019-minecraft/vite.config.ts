import { defineConfig } from "vite";

// Game 4 — 2019 · MINECRAFT fan recreation. Port 5304 (5300 + N), strict,
// so all eleven games can coexist with other sessions on this machine.
export default defineConfig({
  server: {
    port: 5304,
    strictPort: true,
  },
});
