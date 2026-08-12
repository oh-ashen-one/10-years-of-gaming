/**
 * shots.manifest.mjs — the 8 named film-test shots for BUILD ROYALE.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the toy island diorama, bus drifting past
  { name: "01-title" },

  // 02 — out of the bus: freefall toward Tilted
  {
    name: "02-bus-jump",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(5000); // bus over the island
      await game("jump");
      await page.waitForTimeout(1400); // clean freefall
    },
  },

  // 03 — glider over Tilted's towers
  {
    name: "03-glider-over-tilted",
    async run(page, game) {
      await game("glideOver", "tilted", 55);
      await page.waitForTimeout(1300);
    },
  },

  // 04 — the harvest whack: pickaxe into a tree, chips flying
  {
    name: "04-harvest-whack",
    async run(page, game) {
      await game("land", "tilted");
      await game("gotoTree"); // teleports facing the nearest tree
      await page.waitForTimeout(600); // camera settles behind
      await page.mouse.down();
      await page.waitForTimeout(320); // mid-swing, chips flying
      await page.mouse.up();
    },
  },

  // 05 — build mode: ghost green, a ramp + wall going up on open grass
  {
    name: "05-build-ramp",
    async run(page, game) {
      await page.evaluate(() => window.__game.teleport(60, -60)); // open field
      await page.waitForTimeout(500);
      await game("giveMats", 120);
      await game("buildDemo"); // ramp + wall placed ahead
      await page.keyboard.down("KeyS"); // step back so the ghost sits on clear grass
      await page.waitForTimeout(450);
      await page.keyboard.up("KeyS");
      await game("q"); // enter build mode, ghost = wall
      await page.waitForTimeout(600);
    },
  },

  // 06 — the storm wall: purple grid closing on the fields
  {
    name: "06-storm-wall",
    async run(page, game) {
      await game("q"); // cycle through to exit build mode
      await game("q");
      await game("q");
      await game("q");
      await game("setCircle", 1);
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const w = window.__game.debug().wall;
        window.__game.teleport(w.cx + w.r - 20, w.cz);
      });
      await page.waitForTimeout(1100);
    },
  },

  // 07 — the build-off: last bot panic-ramps toward you, shotgun out
  {
    name: "07-build-fight",
    async run(page, game) {
      await game("setCircle", 3);
      await game("setAlive", 2);
      await page.evaluate(() => window.__game.teleport(30, 206));
      await game("giveWeapon", "pump");
      await game("buildRush");
      await page.waitForTimeout(1500); // wall up, ramp building
    },
  },

  // 08 — #1 VICTORY ROYALE: banner + the dance
  {
    name: "08-victory-royale",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(1500); // banner + dance mid-beat
    },
  },
];
