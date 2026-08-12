import { defineConfig } from "vite";

// Game 2 — 2017 · PUBG fan recreation. Port 5302 (5300 + N), strict,
// so all eleven games can coexist with other sessions on this machine.
export default defineConfig({
  server: {
    port: 5302,
    strictPort: true,
  },
});
