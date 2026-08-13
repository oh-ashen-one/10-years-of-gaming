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

  // 03 — the staff string: three real clicks INTO a lesser, the 連 counter up
  {
    name: "03-staff-combo",
    async run(page, game) {
      await game("heal");
      await game("lockOn");
      // a real string on a real imp — the combo counter is DOM (no capture race)
      for (let i = 0; i < 6; i++) {
        if ((await dbg(page)).combo >= 3) break;
        await page.mouse.click(640, 400);
        await page.waitForTimeout(420);
      }
      await page.waitForFunction(
        () => window.__game.debug().combo >= 3,
        undefined,
        { timeout: 15000 },
      ).catch(() => {});
      await page.waitForTimeout(150); // the counter + the hit flash read
    },
  },

  // 04 — IMMOBILIZE: a lesser frozen MID-LEAP, the golden seals bloom
  {
    name: "04-immobilize",
    async run(page, game) {
      await page.waitForTimeout(1200); // let the string finish
      await game("teleport", 0, -2);
      await game("rest"); // the shrine returns the court's lessers
      await page.waitForTimeout(400);
      await game("teleportBeat", "court");
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.enemies.some((e) => e.kind === "lesser" && e.d < 13);
        },
        undefined,
        { timeout: 30000 },
      );
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
      await game("heal");
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = (await dbg(page)).perfectDodges;
        await game("lesserSwipe"); // staged point-blank, windup 0.42s (game time)
        await page.waitForFunction(
          () => {
            const d = window.__game.debug();
            return d.enemies.some(
              (e) => e.kind === "lesser" && e.state === "windup" && e.stateT > 0.3,
            );
          },
          undefined,
          { timeout: 20000 },
        );
        await game("dodgeInto"); // THROUGH the swipe — that's what earns the ghost
        await page.waitForTimeout(120);
        if ((await dbg(page)).perfectDodges > before) {
          await page.waitForTimeout(450); // the monk dashes clear of his ghost
          break;
        }
        await page.waitForTimeout(1500); // whiffed — reset and try again
      }
      // capture NOW — the gold ghost fades in 0.8s of wall time
    },
  },

  // 06 — THE TIGER ABBOT: through the fog curtain, the claw string begins
  {
    name: "06-tiger-abbot",
    async run(page, game) {
      await waitMsgClear(page);
      await game("heal");
      await game("teleportBeat", "boss"); // past the curtain — the fight is on
      await page.waitForFunction(
        () => window.__game.phase === "boss",
        undefined,
        { timeout: 20000 },
      );
      if ((await dbg(page)).lockOn) await game("lockOn"); // drop the stale court lock
      await game("lockOn"); // lock the Abbot
      // let him close in, THEN force the string so he fills the frame
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          const b = d.enemies.find((e) => e.kind === "abbot");
          return b && b.d < 5.5;
        },
        undefined,
        { timeout: 40000 },
      );
      await game("bossMove", "claw");
      await page.waitForFunction(
        () => window.__game.debug().boss.state === "attack",
        undefined,
        { timeout: 20000 },
      );
      await page.waitForTimeout(350); // mid-string, boss plate up
    },
  },

  // 07 — PHASE 2: dodge THROUGH the whirlwind; the pass blurs past
  {
    name: "07-phase2-whirlwind",
    async run(page, game) {
      await waitMsgClear(page);
      await game("heal");
      if ((await dbg(page)).lockOn) await game("lockOn"); // steady chase cam for the pass
      await game("setBossPhase", 2);
      await game("bossMove", "whirlwind");
      await page.waitForFunction(
        () => window.__game.debug().boss.state === "dash",
        undefined,
        { timeout: 20000 },
      );
      await game("dodgeInto"); // i-frames through the pass — maybe a perfect
      await page.waitForFunction(
        () => window.__game.debug().boss.state !== "dash",
        undefined,
        { timeout: 20000 },
      );
      // the SECOND pass: he charges straight at the camera, sword spinning
      await page.waitForFunction(
        () => window.__game.debug().boss.state === "dash",
        undefined,
        { timeout: 20000 },
      );
      // capture NOW — the whirlwind incoming
    },
  },

  // 08 — YAOGUAI FELLED: the seal burst over the kneeling Abbot
  {
    name: "08-yaoguai-felled",
    async run(page, game) {
      await page.waitForTimeout(2500); // let the dash chain resolve
      // if the whirlwind killed us, ride out the respawn and walk back in
      await page
        .waitForFunction(() => window.__game.phase !== "dead", undefined, { timeout: 20000 })
        .catch(() => {});
      if ((await dbg(page)).phase !== "boss") {
        await game("teleportBeat", "boss");
        await page.waitForFunction(
          () => window.__game.phase === "boss",
          undefined,
          { timeout: 20000 },
        );
      }
      await game("heal");
      await game("teleport", 1, -129); // open floor, clear of the pillar ring
      await game("bossHp", 30);
      await game("giveFocus", 3);
      await game("lockOn"); // 07 dropped the lock — facing matters
      // let him reach us, then the SEAL holds him for the finishing slam
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          const b = d.enemies.find((e) => e.kind === "abbot");
          return d.phase === "results" || (b && b.d < 4.5);
        },
        undefined,
        { timeout: 30000 },
      );
      await game("immobilize");
      for (let i = 0; i < 12; i++) {
        const d = await dbg(page);
        if (d.phase === "results") break;
        if (d.phase === "dead") break;
        if (d.attack.t <= 0) {
          if (d.focus >= 1) await game("heavy");
          else await page.mouse.click(640, 400);
        }
        if (i % 3 === 2) await game("heal");
        await page.waitForTimeout(400);
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
