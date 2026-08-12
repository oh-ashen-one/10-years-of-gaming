/**
 * shots.manifest.mjs — the 8 named film-test shots for DUSTFALL ISLAND.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the island from plane height
  { name: "01-title" },

  // 02 — out the door: freefall over the island, FOV kicked
  {
    name: "02-plane-drop",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(2500); // plane well over the island
      await game("jump");
      await page.waitForTimeout(1500); // clean freefall
    },
  },

  // 03 — chute open over Milltown's cottages
  {
    name: "03-chute-compound",
    async run(page, game) {
      await game("dropOver", 0, 70); // chute already open, Milltown below
      await page.waitForTimeout(1200);
    },
  },

  // 04 — boots down, first loot: rifle on the compound floor
  {
    name: "04-first-loot",
    async run(page, game) {
      await game("land", 0);
      await page.waitForTimeout(300);
      // walk toward the weapon glow
      await page.evaluate(() => window.__game.teleport(-256, -181));
      await page.waitForTimeout(800);
    },
  },

  // 05 — the blue wall: standing just inside circle 1 as it closes
  {
    name: "05-blue-wall",
    async run(page, game) {
      await game("setCircle", 1);
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const w = window.__game.debug().wall;
        // stand just inside the wall, facing out at it
        window.__game.teleport(w.cx + w.r - 18, w.cz);
      });
      await page.waitForTimeout(1200);
    },
  },

  // 06 — the buggy run: cross-country at speed
  {
    name: "06-buggy-run",
    async run(page, game) {
      await page.evaluate(() => window.__game.teleport(30, -10)); // in-zone center
      await game("buggy");
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1400);
    },
  },

  // 07 — final circle: prone in the wheat, 4 alive, walls closing
  {
    name: "07-final-circle",
    async run(page, game) {
      await page.keyboard.up("KeyW");
      await game("exitBuggy");
      await game("setCircle", 3);
      await game("setAlive", 4);
      await page.evaluate(() => window.__game.teleport(120, 62));
      await game("prone");
      await page.waitForTimeout(1600);
    },
  },

  // 08 — WINNER WINNER CHICKEN DINNER
  {
    name: "08-chicken-dinner",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(1400); // banner mid-pulse
    },
  },
];
