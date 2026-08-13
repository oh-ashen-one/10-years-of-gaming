/**
 * shots.manifest.mjs — the 9 named film-test shots for GLOOMMOOR.
 * Authored scenarios through window.__game hooks; real frames only.
 */
export default [
  // 01 — poster title: the misted valley beneath the golden tree
  { name: "01-title" },

  // 02 — the first grace: gold threads, the guidance path north
  {
    name: "02-grace-guidance",
    async run(page, game) {
      await game("autostart");
      await page.waitForTimeout(1500); // rest beat at the grace
    },
  },

  // 03 — the soldier pack: lock-on, one winds up
  {
    name: "03-soldier-pack",
    async run(page, game) {
      await game("teleportBeat", "pack");
      await game("lockOn");
      await page.waitForTimeout(1400); // they close and swing
    },
  },

  // 04 — the fog gate: pale shimmer before the bridge
  {
    name: "04-fog-gate",
    async run(page, game) {
      await game("lockOn"); // off
      await game("teleportBeat", "gate");
      await page.waitForTimeout(1200);
    },
  },

  // 05 — the Warden, phase 1: staff sweep telegraph
  {
    name: "05-warden-phase1",
    async run(page, game) {
      await game("teleportBeat", "boss");
      await page.waitForTimeout(400); // walk through the gate
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(900);
      await page.keyboard.up("KeyW");
      await game("lockOn");
      await page.waitForTimeout(1800); // it engages, a move telegraphs
    },
  },

  // 06 — the riposte: staggered Warden, point blank, the killing light
  {
    name: "06-parry-riposte",
    async run(page, game) {
      await page.evaluate(() => window.__game.teleport(0, -188)); // toe to toe
      await game("riposteWindow");
      await page.waitForTimeout(250);
      await page.mouse.down(); // the riposte
      await page.waitForTimeout(300);
      await page.mouse.up();
    },
  },

  // 07 — phase 2: the golden hammer falls on your mark
  {
    name: "07-phase2-hammer",
    async run(page, game) {
      await game("setBossPhase", 2);
      await game("bossMove", "hammer"); // the gold ring + the descent
      await page.waitForTimeout(650);   // mid-telegraph
    },
  },

  // 08 — YOU DIED: ink serif, slow fade
  {
    name: "08-you-died",
    async run(page, game) {
      await game("killPlayer");
      await page.waitForTimeout(1500); // mid-fade
    },
  },

  // 09 — GREAT ENEMY FELLED: gold shower, then the card
  {
    name: "09-great-enemy-felled",
    async run(page, game) {
      await page.waitForTimeout(3200); // respawn first (dead phase ends)
      await game("debugFinish");
      await page.waitForTimeout(900); // banner + gold shower mid-fall
    },
  },
];
