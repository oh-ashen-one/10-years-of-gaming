/**
 * shots.manifest.mjs — the 8 named film-test shots for GALE MEADOW.
 * Authored scenarios through window.__game hooks; real frames only.
 * HUD flashes tick on (clamped) game time — poll state, never sleeps.
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

export default [
  // 01 — poster title: the meadow, wind in the grass, spired city far
  { name: "01-title" },

  // 02 — the meadow run: luminous waves, quest ribbon up
  {
    name: "02-meadow-run",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(400);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1500); // mid-stride, grass waving
      // keep holding for flow into next shot's area
    },
  },

  // 03 — the camp fight: combo slash into the mosslunks
  {
    name: "03-camp-fight",
    async run(page, game) {
      await page.keyboard.up("KeyW");
      await game("toCamp");
      await page.waitForTimeout(600); // mobs converge
      await page.mouse.down(); // a real slash
      await page.waitForTimeout(350);
      await page.mouse.up();
    },
  },

  // 04 — the burst: camera snap + banner card + tornado of damage numbers
  {
    name: "04-burst-banner",
    async run(page, game) {
      await game("setEnergy", 100);
      await game("burst");
      await page.waitForTimeout(650); // banner up, snap mid-kick
    },
  },

  // 05 — the glide: airborne over the valley, threading the updraft rings
  {
    name: "05-glide-valley",
    async run(page, game) {
      await game("killCamp");
      await waitMsgClear(page); // CAMP CLEARED fades first
      await game("glide"); // off the plateau, ring one dead ahead
      await page.waitForFunction(
        () => {
          const d = window.__game.debug();
          return d.gliding && d.player[1] > 20; // the ring's updraft just lifted us
        },
        undefined,
        { timeout: 15000 },
      ).catch(() => {});
      await page.waitForTimeout(200); // rings two and three read ahead
    },
  },

  // 06 — the spin: dodge through the Warden's tornado
  {
    name: "06-boss-spin-dodge",
    async run(page, game) {
      await game("toArena");
      await game("face", -40, 224); // the boss, dead ahead (the glide ends facing away)
      await game("bossState", "spin");
      await page.waitForTimeout(900); // spinning toward us
      await page.keyboard.press("ShiftLeft"); // the dodge
      await page.waitForTimeout(300);
    },
  },

  // 07 — core exposed: the pink glow, damage multiplied
  {
    name: "07-core-exposed",
    async run(page, game) {
      await game("face", -40, 224); // stay on him after the dodge
      await game("bossState", "core");
      await page.waitForTimeout(500);
      await page.mouse.down(); // wail on it
      await page.waitForTimeout(400);
      await page.mouse.up();
    },
  },

  // 08 — the victory chest on the arena seal
  {
    name: "08-victory-chest",
    async run(page, game) {
      await game("debugFinish");
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__game.teleport(-40, 226));
      await page.waitForTimeout(1200);
    },
  },
];
