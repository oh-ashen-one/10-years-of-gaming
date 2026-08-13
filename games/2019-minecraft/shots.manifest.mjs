/**
 * shots.manifest.mjs — the 9 named film-test shots for VOXEL VALLEY.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title over the valley diorama, blocky clouds drifting
  { name: "01-title" },

  // 02 — the first punch: crosshair on an oak trunk, cracks showing
  {
    name: "02-first-punch",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        window.__game.teleport(60, 52);       // in the grove
        window.__game.aimNearestTree();       // step to a trunk, face it
      });
      await page.waitForTimeout(400);
      await page.mouse.down();
      await page.waitForTimeout(700); // mid-crack
    },
  },

  // 03 — crafting: the menu over a fresh table
  {
    name: "03-crafting",
    async run(page, game) {
      await page.mouse.up();
      await game("give", "log", 8);
      await game("give", "coal", 4);
      await page.keyboard.press("KeyE"); // open the craft menu
      await page.waitForTimeout(400);
    },
  },

  // 04 — the mine: torch pools and ore glints in the cave
  {
    name: "04-mine-torches",
    async run(page, game) {
      await page.keyboard.press("KeyE"); // close menu
      await game("give", "stonepick", 1);
      await game("cave"); // teleports into the chamber, lights it, faces ore
      await page.waitForTimeout(1400); // chunks rebuild
    },
  },

  // 05 — shelter build: 3 walls and a roof going up before dusk
  {
    name: "05-shelter-build",
    async run(page, game) {
      await game("teleport", 100, 158);
      await game("shelter"); // auto-builds the hut east of the player
      await page.evaluate(() => {
        window.__game.teleport(103, 148); // due south, framing the hut face-on
        window.__game.lookAt(103, 12, 158);
      });
      await page.waitForTimeout(900);
    },
  },

  // 06 — night siege: zombies shambling into the torch pools
  {
    name: "06-night-siege",
    async run(page, game) {
      await page.evaluate(() => window.__game.teleport(100, 175)); // open meadow, clear of the shelter
      await game("setTime", 345);
      await game("killAll");
      await page.evaluate(() => {
        const g = window.__game;
        const d = g.debug();
        g.lookAt(d.player[0] - Math.sin(d.yaw) * 8, d.player[1] + 1, d.player[2] - Math.cos(d.yaw) * 8);
        g.torchRing();
        g.spawnMob("zombie", 7);
        g.spawnMob("zombie", 10);
        g.spawnMob("skeleton", 13);
      });
      await page.waitForTimeout(1600); // they close in through the light
    },
  },

  // 07 — the creeper hiss: swollen, ticking, in the torch pool
  {
    name: "07-creeper-hiss",
    async run(page, game) {
      await game("killAll");
      await page.evaluate(() => {
        window.__game.spawnMob("creeper", 2.3);
      });
      await page.waitForTimeout(900); // mid-hiss swell
    },
  },

  // 08 — dawn burn: the undead catch fire as the square sun returns
  {
    name: "08-dawn-burn",
    async run(page, game) {
      await game("killAll");
      await page.evaluate(() => {
        window.__game.spawnMob("zombie", 6);
        window.__game.spawnMob("skeleton", 9);
      });
      await game("setTime", 599);
      await page.waitForTimeout(1800); // burn flames + rising light
    },
  },

  // 09 — YOU SURVIVED: stats over the shelter orbit
  {
    name: "09-results",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(1200);
    },
  },
];
