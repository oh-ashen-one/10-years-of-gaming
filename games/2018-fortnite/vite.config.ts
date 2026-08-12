import { defineConfig } from "vite";

// Game 3 — 2018 · FORTNITE fan recreation. Port 5303 (5300 + N), strict,
// so all eleven games can coexist with other sessions on this machine.
export default defineConfig({
  server: {
    port: 5303,
    strictPort: true,
  },
});
