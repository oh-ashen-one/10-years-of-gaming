import { defineConfig } from "vite";

// Game 1 — 2016 · POKÉMON GO fan recreation. Port 5301 (5300 + N), strict,
// so all eleven games can coexist with other sessions on this machine.
export default defineConfig({
  server: {
    port: 5301,
    strictPort: true,
  },
});
