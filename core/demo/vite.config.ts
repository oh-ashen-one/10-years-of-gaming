import { defineConfig } from "vite";

// Smoke-demo dev server: the studio pipeline proof, not a game.
// Port 5300 is reserved for this demo; games use 5300+N (MASTER.md §4).
export default defineConfig({
  server: {
    port: 5300,
    strictPort: true,
  },
});
