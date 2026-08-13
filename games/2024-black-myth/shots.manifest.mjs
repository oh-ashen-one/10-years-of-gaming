/**
 * shots.manifest.mjs — the 8 named film-test shots for INKPEAK.
 * Authored scenarios through window.__game hooks; real frames only.
 * Note: HUD flashes tick on (clamped) game time, so headless they linger
 * 3–5× longer in wall time — wait the flash out before staging.
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

const dbg = (page) => page.evaluate(() => window.__game.debug());

export default [
  // 01 — poster title: the ink-wash peak, red gates receding, petals
  { name: "01-title" },

  // 02 — the bamboo court: three lesser yaoguai hop in to teach the staff
  {
    name: "02-bamboo-court",
    async run(page, game) {
      await game("autostart");
      await game("teleportBeat", "court");
      await page.waitForTimeout(2500); // the imps close in, hop by hop
    },
  },

  // 03 — the staff string: mid-swing, the gold trail arc quantizes
  {
    name: "03-staff-combo",
    async run(page, game) {
      await game("lockOn");
      await page.mouse.click(640, 400); // LMB — light 1
      await page.waitForTimeout(450);   // mid-swing, trail lit
    },
  },

  // 04 — IMMOBILIZE: a lesser frozen MID-LEAP, the golden seals bloom
  {
    name: "04-immobilize",
    async run(page, game) {
      await page.waitForTimeout(1200); // let the swing finish
      await game("lesserLeap");        // force the crouch → leap
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.enemies.some((e) => e.kind === "lesser" && e.state === "leap");
        },
        undefined,
        { timeout: 20000 },
      );
      await page.waitForTimeout(250); // mid-air
      await game("immobilize");
      await page.waitForTimeout(700); // seals bloom (real time)
    },
  },

  // 05 — PERFECT DODGE: the swipe comes in, the monk ghosts through it
  {
    name: "05-perfect-dodge",
    async run(page, game) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = (await dbg(page)).perfectDodges;
        await game("lesserSwipe"); // staged point-blank, windup 0.42s (game time)
        await page.waitForFunction(
          () => {
            const d = window.__game.debug();
            return d.enemies.some(
              (e) => e.kind === "lesser" && e.state === "windup" && e.stateT > 0.26,
            );
          },
          undefined,
          { timeout: 20000 },
        );
        await game("dodge");
        await page.waitForTimeout(120);
        if ((await dbg(page)).perfectDodges > before) break; // got it
        await page.waitForTimeout(1500); // whiffed — reset and try again
      }
      await page.waitForTimeout(200); // ghost + slow-mo streak on screen
    },
  },

  // 06 — THE TIGER ABBOT: through the fog curtain, the claw string begins
  {
    name: "06-tiger-abbot",
    async run(page, game) {
      await waitMsgClear(page);
      await game("teleportBeat", "boss"); // past the curtain — the fight is on
      await page.waitForFunction(
        () => window.__game.phase === "boss",
        undefined,
        { timeout: 20000 },
      );
      await game("lockOn");
      await page.waitForTimeout(800); // he closes the distance
      await game("bossMove", "claw");
      await page.waitForFunction(
        () => {
          const b = window.__game.debug().boss;
          return b.state === "attack" || (b.state === "windup" && b.move === "claw");
        },
        undefined,
        { timeout: 20000 },
      );
      await page.waitForTimeout(500); // mid-string, boss plate up
    },
  },

  // 07 — PHASE 2: the sword is out, the whirlwind dash mid-pass
  {
    name: "07-phase2-whirlwind",
    async run(page, game) {
      await waitMsgClear(page);
      await game("setBossPhase", 2);
      await game("bossMove", "whirlwind");
      await page.waitForFunction(
        () => window.__game.debug().boss.state === "dash",
        undefined,
        { timeout: 20000 },
      ).catch(() => {});
      await page.waitForTimeout(120); // mid-pass, the sword a gold blur
    },
  },

  // 08 — YAOGUAI FELLED: the seal burst over the kneeling Abbot
  {
    name: "08-yaoguai-felled",
    async run(page, game) {
      await page.waitForTimeout(2500); // let the dash chain resolve
      await game("bossHp", 30);
      await game("giveFocus", 3);
      // finish him with real swings
      for (let i = 0; i < 14; i++) {
        if ((await dbg(page)).phase === "results") break;
        await page.mouse.click(640, 400);
        await page.waitForTimeout(900);
      }
      await page.waitForFunction(
        () => window.__game.phase === "results",
        undefined,
        { timeout: 30000 },
      );
      await page.waitForTimeout(1000); // the banner + the gold shower
    },
  },
];
