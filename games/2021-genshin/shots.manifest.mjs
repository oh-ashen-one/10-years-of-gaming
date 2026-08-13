/**
 * shots.manifest.mjs — the 8 named film-test shots for GALE MEADOW.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the meadow, wind in the grass, spired city far
  { name: "01-title" },

  // 02 — the meadow run: luminous waves, quest ribbon up
  {
    name: "02-meadow-run",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(400);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1500); // mid-stride, grass waving
      // keep holding for flow into next shot's area
    },
  },

  // 03 — the camp fight: combo slash into the mosslunks
  {
    name: "03-camp-fight",
    async run(page, game) {
      await page.keyboard.up("KeyW");
      await game("toCamp");
      await page.waitForTimeout(600); // mobs converge
      await page.mouse.down(); // a real slash
      await page.waitForTimeout(350);
      await page.mouse.up();
    },
  },

  // 04 — the burst: camera snap + banner card + tornado of damage numbers
  {
    name: "04-burst-banner",
    async run(page, game) {
      await game("setEnergy", 100);
      await game("burst");
      await page.waitForTimeout(650); // banner up, snap mid-kick
    },
  },

  // 05 — the glide: updraft rings across the valley
  {
    name: "05-glide-valley",
    async run(page, game) {
      await game("killCamp");
      await game("glide"); // mid-air, glider open, rings ahead
      await page.waitForTimeout(1100);
    },
  },

  // 06 — the spin: dodge through the Warden's tornado
  {
    name: "06-boss-spin-dodge",
    async run(page, game) {
      await game("toArena");
      await game("bossState", "spin");
      await page.waitForTimeout(900); // spinning toward us
      await page.keyboard.press("ShiftLeft"); // the dodge
      await page.waitForTimeout(300);
    },
  },

  // 07 — core exposed: the pink glow, damage multiplied
  {
    name: "07-core-exposed",
    async run(page, game) {
      await game("bossState", "core");
      await page.waitForTimeout(500);
      await page.mouse.down(); // wail on it
      await page.waitForTimeout(400);
      await page.mouse.up();
    },
  },

  // 08 — the victory chest on the arena seal
  {
    name: "08-victory-chest",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__game.teleport(-40, 226));
      await page.waitForTimeout(1200);
    },
  },
];
