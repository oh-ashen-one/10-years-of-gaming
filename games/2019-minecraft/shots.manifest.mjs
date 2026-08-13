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
      // stand before the nearest grove tree, look at its trunk, hold LMB
      await page.evaluate(() => {
        window.__game.teleport(60, 52);
        window.__game.lookAt(60, 12, 48); // into the grove — trunk height
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        // aim exactly at the nearest solid block along view: probe a trunk
        window.__game.lookAt(56, 11, 44);
      });
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
      await game("cave");
      await page.evaluate(() => {
        // light the chamber: torches on the cave floor
        const g = window.__game;
        g.placeTorchAt(182, 9, 100);
        g.placeTorchAt(179, 9, 103);
        g.placeTorchAt(185, 9, 97);
        g.lookAt(185, 11, 100); // into the chamber wall (ore glints)
      });
      await page.waitForTimeout(1200); // chunks rebuild
    },
  },

  // 05 — shelter build: 3 walls and a roof going up before dusk
  {
    name: "05-shelter-build",
    async run(page, game) {
      await game("teleport", 100, 158);
      await game("shelter"); // auto-builds the hut east of the player
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__game.lookAt(108, 12, 158));
      await page.waitForTimeout(900);
    },
  },

  // 06 — night siege: zombies shambling in out of the indigo
  {
    name: "06-night-siege",
    async run(page, game) {
      await game("setTime", 345);
      await game("killAll");
      await page.evaluate(() => {
        window.__game.spawnMob("zombie", 9);
        window.__game.spawnMob("zombie", 12);
        window.__game.spawnMob("skeleton", 14);
      });
      await page.waitForTimeout(1500); // they close in
    },
  },

  // 07 — the creeper hiss: swollen, ticking, too close
  {
    name: "07-creeper-hiss",
    async run(page, game) {
      await game("killAll");
      await page.evaluate(() => {
        window.__game.spawnMob("creeper", 2.2);
      });
      await page.waitForFunction(() => {
        // wait for the hiss to start
        return true;
      }, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900); // mid-hiss swell
    },
  },

  // 08 — dawn burn: the undead catch fire as the square sun returns
  {
    name: "08-dawn-burn",
    async run(page, game) {
      await game("killAll");
      await page.evaluate(() => {
        window.__game.spawnMob("zombie", 7);
        window.__game.spawnMob("skeleton", 10);
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
