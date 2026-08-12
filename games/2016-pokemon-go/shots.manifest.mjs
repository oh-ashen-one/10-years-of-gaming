/**
 * shots.manifest.mjs — the 7 named film-test shots for POCKET GO.
 * Every shot is an authored scenario driven through window.__game hooks —
 * real frames of the real game, never mocked (MASTER.md §2.6).
 */
export default [
  // 01 — poster title over the living diorama (orbit cam, leaves drifting)
  { name: "01-title" },

  // 02 — third-person neighborhood walk, phone HUD up
  {
    name: "02-neighborhood-walk",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(400);
      await game("teleport", "parkEast");
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1600);
      await page.keyboard.up("KeyW");
      await page.waitForTimeout(300);
    },
  },

  // 03 — the catch scene: Nibbit on the pad, ring mid-shrink
  {
    name: "03-encounter-ring",
    async run(page, game) {
      await game("forceEncounter", "nibbit");
      await page.waitForTimeout(300);
      await game("enterCatch");
      await page.waitForTimeout(900); // ring visibly mid-shrink
    },
  },

  // 04 — the GOTCHA burst, stars flying
  {
    name: "04-gotcha-burst",
    async run(page, game) {
      await game("catchBurst");
      await page.waitForFunction(() => window.__game.phase === "catch", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(380); // third wobble → stars mid-flight
    },
  },

  // 05 — the rare gold duck at Mirror Pond
  {
    name: "05-pond-rare",
    async run(page, game) {
      // back out to the walk if the previous shot left us mid-catch
      await page.evaluate(() => {
        const g = window.__game;
        if (g.phase === "catch") g.catchBurst();
      });
      await page.waitForTimeout(2200); // burst finishes → walk
      await game("teleport", "pond");
      await page.evaluate(() => {
        // face the pond, duck on the shore ahead
        window.__game.forceEncounter("gildquack");
      });
      await page.waitForTimeout(1200);
    },
  },

  // 06 — the Crown Plaza gym battle, mid-fight
  {
    name: "06-gym-battle",
    async run(page, game) {
      await game("startGym");
      await page.waitForTimeout(1400);
      await page.keyboard.press("Space"); // one attack for the pose
      await page.waitForTimeout(250);
    },
  },

  // 07 — results: dex page, catches, steps, GYM LEADER
  {
    name: "07-dex-results",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(1000);
    },
  },
];
