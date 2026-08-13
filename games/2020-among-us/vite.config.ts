import { defineConfig } from "vite";

// Game 5 — 2020 · AMONG US fan recreation. Port 5305 (5300 + N), strict,
// so all eleven games can coexist with other sessions on this machine.
export default defineConfig({
  server: {
    port: 5305,
    strictPort: true,
  },
});
