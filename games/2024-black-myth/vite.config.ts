import { defineConfig } from "vite";

// Game 9 — 2024 · BLACK MYTH: WUKONG fan recreation. Port 5309 (5300 + N),
// strict, so all eleven games can coexist on this machine.
export default defineConfig({
  server: {
    port: 5309,
    strictPort: true,
  },
});
