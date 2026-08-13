/**
 * shots.manifest.mjs — the 9 named film-test shots for TOLLHOUSE.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the candle-lit tavern corner, the die at rest
  { name: "01-title" },

  // 02 — the approach: party at the bridge's north foot, tollkeeper waiting
  {
    name: "02-tollhouse-approach",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(300);
      await page.keyboard.down("KeyW"); // walk toward the bridge
      await page.waitForTimeout(1400);
      await page.keyboard.up("KeyW");
      await page.waitForTimeout(400);
    },
  },

  // 03 — the dialogue: five hundred gold, the choices with their tags
  {
    name: "03-dialogue-roll",
    async run(page, game) {
      await game("gotoDialogue");
      await page.waitForTimeout(600); // trigger + lines
      await page.keyboard.press("Digit2"); // [Intimidation 14]
      await page.waitForTimeout(950);  // the d20 is mid-tumble
    },
  },

  // 04 — CRITICAL SUCCESS: the die settles on 20, gold verdict
  {
    name: "04-crit-success",
    async run(page, game) {
      await page.waitForFunction(
        () => window.__game.phase !== "roll",
        undefined,
        { timeout: 30000 },
      ).catch(() => {});
      await game("forceRoll", 20);
      await game("reroll"); // staged: INTIMIDATION 14, the die reads 20
      await page.waitForTimeout(2300); // tumble → settle → CRITICAL!
    },
  },

  // 05 — initiative: the fight begins, ribbon up, move ring out
  {
    name: "05-initiative",
    async run(page, game) {
      await game("startFight", true);
      await page.waitForTimeout(1500); // order rolled, first turns readable
    },
  },

  // 06 — the shove: a guard goes into the river
  {
    name: "06-shove-into-river",
    async run(page, game) {
      await game("forceShoveKill"); // staged: guard on the edge, roll 17
      await page.waitForTimeout(300);
      await game("shove");
      await page.waitForTimeout(500); // mid-flail, splash
    },
  },

  // 07 — grease fire: the pool ignites under the guards
  {
    name: "07-grease-fire",
    async run(page, game) {
      await game("forceGreaseFire");
      await page.waitForTimeout(700); // the fire pool burning
    },
  },

  // 08 — the loot: 500 gold and a cloak off the toll chest
  {
    name: "08-loot",
    async run(page, game) {
      await page.evaluate(() => {
        const g = window.__game;
        g.teleport(10.5, 9.5); // before the chest
      });
      await page.waitForTimeout(900);
    },
  },

  // 09 — results: the rolls history card
  {
    name: "09-results",
    async run(page, game) {
      await game("loot");
      await page.waitForTimeout(1200);
    },
  },
];
