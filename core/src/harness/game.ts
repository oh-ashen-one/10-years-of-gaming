/**
 * game.ts — the film-test harness contract (§2.6, fixed by the franchise).
 *
 * Every game exposes `window.__game` implementing this interface so
 * `tools/shoot.mjs` can wait on real presented frames, drive authored
 * scenarios, and assert on camera/player state. Scenario hooks beyond this
 * base (teleport, spawnBoss, ...) are per-game additions — extend the type
 * in the game, never weaken the base.
 */

export interface GameHarness {
  /** skip the title straight into gameplay (used by the shoot tool) */
  autostart(): void;
  /** switch camera mode: chase | orbit | ceremony | game-specific modes */
  cam(mode: string): void;
  /** current game phase string, for waitForFunction */
  readonly phase: string;
  /** game clock seconds */
  readonly time: number;
  /** PRESENTED frame counter — the shoot tool waits on frames > 24 */
  readonly frames: number;
  /** jump to the results beat with plausible state */
  debugFinish(): void;
  /** diagnostics for shot assertions (cam/player positions, pixelScale…) */
  debug(): Record<string, unknown>;
  /** per-game scenario hooks */
  [hook: string]: unknown;
}

declare global {
  interface Window {
    __game?: GameHarness;
  }
}

/** Publish the harness. Called once from the game's main.ts. */
export function installHarness(game: GameHarness): void {
  window.__game = game;
}
