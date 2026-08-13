/**
 * shots.manifest.mjs — the 9 named film-test shots for SUSPECTED.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the ship drifting through the void
  { name: "01-title" },

  // 02 — cafeteria spawn: beans under the skylight, fog at the edges
  {
    name: "02-cafeteria-spawn",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(1600); // crew mill around the table
    },
  },

  // 03 — the wires task in Electrical
  {
    name: "03-wires-task",
    async run(page, game) {
      await game("gotoStation", "wires");
      await page.waitForTimeout(600);
      await game("openTask", "wires");
      await page.waitForTimeout(500);
    },
  },

  // 04 — asteroids: crosshair mid-drift
  {
    name: "04-asteroids-task",
    async run(page, game) {
      await game("closeTask");
      await game("openTask", "asteroids");
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(600);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.press("Space"); // one shot for the tracer
      await page.waitForTimeout(300);
    },
  },

  // 05 — lights out: the shrunk vision bubble in a corridor
  {
    name: "05-lights-out",
    async run(page, game) {
      await game("closeTask");
      await page.evaluate(() => window.__game.teleport(0, -6)); // the spine corridor
      await game("lightsOut");
      await page.waitForTimeout(900);
    },
  },

  // 06 — a body in Storage, report prompt up
  {
    name: "06-body-reported",
    async run(page, game) {
      await game("lightsFix");
      await page.waitForTimeout(1600); // let the fix message clear
      await page.evaluate(() => window.__game.teleport(1, 18)); // storage
      await game("bodyHere");
      await page.waitForTimeout(800);
    },
  },

  // 07 — the meeting: testimony lines + the vote list
  {
    name: "07-meeting-vote",
    async run(page, game) {
      await page.keyboard.press("KeyR"); // report it
      await page.waitForFunction(() => window.__game.debug().meeting?.voting, undefined, { timeout: 90000 });
      await page.waitForTimeout(700); // vote list settled
    },
  },

  // 08 — the airlock eject: a bean tumbling into the black
  {
    name: "08-airlock-eject",
    async run(page, game) {
      await game("voteImpostor");
      await page.waitForTimeout(2100); // tally → eject phase, drift mid-air
    },
  },

  // 09 — results: the impostor reveal card
  {
    name: "09-results",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(2000);
    },
  },
];
