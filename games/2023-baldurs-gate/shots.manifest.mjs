/**
 * shots.manifest.mjs — the 9 named film-test shots for TOLLHOUSE.
 * Authored scenarios through window.__game hooks; real frames only.
 * Note: HUD flashes tick on (clamped) game time, so headless they linger
 * 3–5× longer in wall time — always wait the flash out before staging.
 */

/** wait until the center message flash has fully faded */
async function waitMsgClear(page) {
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector("#hud-msg");
        return !el || getComputedStyle(el).display === "none";
      },
      undefined,
      { timeout: 60000 },
    )
    .catch(() => {});
}

export default [
  // 01 — poster title: the candle-lit tavern corner, the die at rest
  { name: "01-title" },

  // 02 — the approach: party at the bridge's south foot, tollkeeper waiting
  {
    name: "02-tollhouse-approach",
    async run(page, game) {
      await game("autostart");
      await game("teleport", 0, -16); // just short of the dialogue trigger
      await page.waitForTimeout(900); // rigs settle, mage trails in
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
      await game("teleport", 2, 7); // near the guards' posts
      await game("startFight", true);
      await page.waitForTimeout(1500); // order rolled, first turns readable
    },
  },

  // 06 — the shove: a guard goes into the river
  {
    name: "06-shove-into-river",
    async run(page, game) {
      await page.waitForTimeout(3000); // let the shot-04 quip fire…
      await waitMsgClear(page);        // …then wait it out
      await game("forceShoveKill"); // staged: guard on the edge, roll 17
      await page.waitForTimeout(300);
      await game("shove");
      await page.waitForTimeout(600); // mid-flail, splash
    },
  },

  // 07 — grease fire: the pool ignites under the guards
  {
    name: "07-grease-fire",
    async run(page, game) {
      await waitMsgClear(page);
      await game("forceGreaseFire");
      await page.waitForTimeout(700); // the fire pool burning
    },
  },

  // 08 — the loot: 500 gold and a cloak off the toll chest
  {
    name: "08-loot",
    async run(page, game) {
      await game("winFight"); // the rest of the bridge guard drops
      await game("teleport", 10.5, 9.0); // south of the chest, clear of the walls
      await page.keyboard.press("KeyQ"); // swing the camera to the north side…
      await page.keyboard.press("KeyQ"); // …so the tollhouse stops blocking the chest
      await waitMsgClear(page); // win banner + mage quip fade
      // the camera glides on game time — wait until it stops moving
      let last = null;
      for (let i = 0; i < 40; i++) {
        const d = await page.evaluate(() => window.__game.debug());
        if (last && Math.hypot(d.cam[0] - last[0], d.cam[2] - last[2]) < 0.15) break;
        last = d.cam;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(300);
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
