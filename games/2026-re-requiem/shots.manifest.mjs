/**
 * shots.manifest.mjs — the 9 named film-test shots for REQUIEM WARD.
 * Authored scenarios through window.__game hooks; real frames only.
 * HUD cards/veils are DOM — poll debug state, never fixed sleeps, for
 * anything time-critical (screenshot latency ~300ms headless).
 */

const dbg = (page) => page.evaluate(() => window.__game.debug());

export default [
  // 01 — poster title: the rain-streaked facade, one window lit
  { name: "01-title" },

  // 02 — ward a dark: the corridor, the beam, one tube pool ahead
  {
    name: "02-ward-a-dark",
    async run(page, game) {
      await game("autostart");
      await game("teleport", 0, -10);
      await game("face", 0, -40); // down the spine
      await page.waitForTimeout(1200); // the beam settles, a tube hums
    },
  },

  // 03 — the first shambler: in the beam, mid-shamble, aimed at
  {
    name: "03-first-shambler",
    async run(page, game) {
      await game("teleport", 0, -19);
      await game("face", 0.5, -24);
      await game("aim", true);
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.shamblers[0].state !== "dormant" && d.shamblers[0].d < 6;
        },
        undefined,
        { timeout: 30000 },
      ); // it shambles INTO the light
    },
  },

  // 04 — the inventory: two herbs, one marked for the combine
  {
    name: "04-inventory-combine",
    async run(page, game) {
      await game("aim", false);
      await game("giveItem", "herb");
      await game("giveItem", "herb");
      await game("openInv", true);
      await game("setCursor", 1); // the second herb
      await page.waitForTimeout(150);
      await game("pressSlot", 1); // marked
      await game("setCursor", 0); // hovering the first
      await page.waitForTimeout(400); // the grid + the hint read
    },
  },

  // 05 — the fuse: the item-get card in the exam room dark
  {
    name: "05-fuse-puzzle",
    async run(page, game) {
      await game("openInv", false);
      await game("teleport", 7.4, -14);
      await game("face", 8.6, -14);
      await page.waitForFunction(
        () => window.__game.debug().prompt.includes("FUSE"),
        undefined,
        { timeout: 10000 },
      );
      await game("interact");
      await page.waitForTimeout(500); // the card: FUSE — still good
    },
  },

  // 06 — power on: the director's office wakes in tube-light green
  {
    name: "06-power-on",
    async run(page, game) {
      await game("giveItem", "crank");
      await game("giveItem", "fuse");
      await game("teleport", 1.5, -51);
      await game("face", 2.8, -51);
      await game("interact"); // the crank turns
      await page.waitForTimeout(600);
      await game("teleport", 8.2, -50);
      await game("face", 9.7, -50);
      await game("interact"); // the fuse slots home
      await page.waitForTimeout(500); // POWER RESTORED — the office lit
    },
  },

  // 07 — the Pursuer: a tall silhouette in the far tube pool
  {
    name: "07-the-pursuer",
    async run(page, game) {
      await page.waitForTimeout(1400); // the power card fades
      await game("teleport", 0, -26);
      await game("movePursuer", 0, -37.5); // beneath the far tube
      await game("wakePursuer", "patrol");
      await game("face", 0, -38);
      await page.waitForTimeout(500); // it stands in the green pool
    },
  },

  // 08 — the elevator chase: the doors shut on its hand
  {
    name: "08-elevator-chase",
    async run(page, game) {
      await game("giveItem", "liftkey");
      await game("teleport", 0, -56.2);
      await game("face", 0, -58);
      await game("interact"); // GO
      await page.waitForFunction(
        () => window.__game.debug().finaleT > 2.55, // the doors meet its arm
        undefined,
        { timeout: 30000 },
      );
    },
  },

  // 09 — SURVIVED: the card with the run's numbers
  {
    name: "09-survived",
    async run(page, game) {
      await page.waitForFunction(
        () => window.__game.phase === "results",
        undefined,
        { timeout: 30000 },
      );
      await page.waitForTimeout(700); // the card settles over the dark
    },
  },
];
