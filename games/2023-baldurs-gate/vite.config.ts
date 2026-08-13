import { defineConfig } from "vite";

// Game 8 — 2023 · BALDUR'S GATE 3 fan recreation. Port 5308 (5300 + N),
// strict, so all eleven games can coexist on this machine.
export default defineConfig({
  server: {
    port: 5308,
    strictPort: true,
  },
});
