/**
 * shots.manifest.mjs — the 9 named film-test shots for OVERPAINT.
 * Authored scenarios through window.__game hooks; real frames only.
 * HUD flashes tick on (clamped) game time — headless they linger 3–5×.
 * Sub-second pose captures are racy (screenshot latency ~300ms) — poll
 * DOM/debug state, never fixed sleeps, for anything that must be visible.
 */

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

/** parry the current incoming attack at its impact beat (poll, don't sleep) */
async function parryTheImpact(page) {
  await page.waitForFunction(
    () => {
      const b = window.__game.debug().battle;
      return b && b.incoming && b.incoming.t > b.incoming.beats[b.incoming.beat] - 0.14;
    },
    undefined,
    { timeout: 30000 },
  );
  await page.evaluate(() => window.__game.parry());
}

export default [
  // 01 — poster title: the valley, floating shards + frames, the "34" sky
  { name: "01-title" },

  // 02 — the painted path: petals, motes, a picto glowing off the edge
  {
    name: "02-painted-valley",
    async run(page, game) {
      await game("autostart");
      await game("teleport", 4, -24); // just shy of picto one
      await page.waitForTimeout(1200); // chase cam settles, petals drift
    },
  },

  // 03 — the first stroke: fight 1, your menu up, a brushling telegraphing
  {
    name: "03-first-stroke",
    async run(page, game) {
      await game("gotoBeat", "fight1");
      await page.waitForFunction(() => window.__game.phase === "battle", undefined, { timeout: 20000 });
      await page.waitForTimeout(1500); // the side-cam glides in
      await game("confirm"); // end the turn → the first stroke telegraphs
      await page.waitForFunction(
        () => {
          const b = window.__game.debug().battle;
          return b && b.incoming && b.incoming.t > 0.3;
        },
        undefined,
        { timeout: 20000 },
      ).catch(() => {});
    },
  },

  // 04 — the parry counter: the flash ring + the rose splash
  {
    name: "04-parry-counter",
    async run(page, game) {
      // an attack is already incoming from 03 (or force a fresh one)
      await page.evaluate(() => {
        const d = window.__game.debug();
        if (!d.battle || !d.battle.incoming) window.__game.forceAttack("stroke");
      });
      await parryTheImpact(page);
      await page.waitForTimeout(250); // the ring flashes (CSS, wall-clock)
    },
  },

  // 05 — free aim: the sway bar up, the dot crossing the gold
  {
    name: "05-free-aim",
    async run(page, game) {
      // back to our turn with AP for the aim (2 daubs)
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.battle && d.battle.turn === "player";
        },
        undefined,
        { timeout: 40000 },
      );
      await game("aimStart");
      await page.waitForFunction(
        () => window.__game.debug().aim,
        undefined,
        { timeout: 10000 },
      );
      await page.waitForTimeout(600); // the dot mid-sway
    },
  },

  // 06 — the Curator's Marionette: the gilt arena, the puppet on strings
  {
    name: "06-marionette",
    async run(page, game) {
      await waitMsgClear(page);
      await game("heal");
      await game("gotoBeat", "boss");
      await page.waitForFunction(() => window.__game.phase === "battle", undefined, { timeout: 20000 });
      await page.waitForTimeout(2200); // the wide side-cam glides in
      await game("forceAttack", "jab"); // the chain telegraph reads
      await page.waitForFunction(
        () => {
          const b = window.__game.debug().battle;
          return b && b.incoming && b.incoming.t > 0.25;
        },
        undefined,
        { timeout: 20000 },
      ).catch(() => {});
    },
  },

  // 07 — OVERPAINT: the burst, the face repainted gold
  {
    name: "07-overpaint",
    async run(page, game) {
      await waitMsgClear(page);
      // wait out the jab chain, back to our turn
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.phase === "battle" && d.battle && d.battle.turn === "player";
        },
        undefined,
        { timeout: 40000 },
      );
      await game("heal");
      await game("setMeter", 100);
      await game("overpaint");
      await page.waitForTimeout(500); // the splash + the face flash
    },
  },

  // 08 — the petal dissolve: the Marionette unpaints itself
  {
    name: "08-petal-dissolve",
    async run(page, game) {
      await game("heal");
      await game("bossHp", 10);
      // finish him with a real strike, then catch the dissolve mid-shed
      for (let i = 0; i < 10; i++) {
        const d = await dbg(page);
        if (!d.battle) break;
        const boss = d.battle.enemies.find((e) => e.kind === "marionette");
        if (boss && boss.state === "dying") break;
        if (d.battle.turn === "player") await game("strike");
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1100); // mid-dissolve: he sinks, the petals rise
    },
  },

  // 09 — FOR THOSE WHO COME AFTER
  {
    name: "09-those-who-come-after",
    async run(page, game) {
      await page.waitForFunction(
        () => window.__game.phase === "card" || window.__game.phase === "results",
        undefined,
        { timeout: 30000 },
      ).catch(() => {});
      await page.waitForTimeout(800); // the card fully faded in
    },
  },
];
