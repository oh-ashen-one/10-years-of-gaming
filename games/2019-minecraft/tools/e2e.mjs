/**
 * e2e.mjs — scripted playthrough check for VOXEL VALLEY. Real input path:
 * title → punch a tree until logs drop (real mining) → craft planks and a
 * table through the real recipe path → place blocks (real RMB) → night
 * siege (mob spawns, real sword swings) → dawn → YOU SURVIVED.
 * Exits non-zero on any console error.
 *
 *   npm run dev        (port 5304, one terminal)
 *   node tools/e2e.mjs (another terminal)
 */
import { chromium } from "playwright";

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const phase = () => page.evaluate(() => window.__game.phase);
const dbg = () => page.evaluate(() => window.__game.debug());

await page.goto("http://localhost:5304/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → play (real Enter)
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());

// punch a tree: stand in the grove, the harness walks us to a trunk.
// NOTE: headless frames are slow and dt is clamped — game time runs
// ~3-5× slower than wall time here, so holds are long.
await page.evaluate(() => {
  window.__game.teleport(60, 52);
  window.__game.aimNearestTree();
});
let logs = 0;
for (let attempt = 0; attempt < 5 && logs < 2; attempt++) {
  await page.mouse.down();
  await page.waitForTimeout(5200); // ≈1.5s+ of game-time mining
  await page.mouse.up();
  const d = await dbg();
  logs = d.inv.log ?? 0;
  if (logs < 2) await page.evaluate(() => window.__game.aimNearestTree());
}
console.log("logs:", logs);
if (logs < 1) errors.push("never punched a log out of a tree");

// craft: planks then sticks through the real recipe path (2×2)
await page.evaluate(() => {
  window.__game.craft("planks");
  window.__game.craft("planks");
  window.__game.craft("stick");
});
let d = await dbg();
console.log("crafted: planks", d.inv.planks ?? 0, "sticks", d.inv.stick ?? 0);
if ((d.inv.planks ?? 0) < 1) errors.push("crafting planks failed");

// table: craft + place (RMB against the ground), then 3×3 craft torches
await page.evaluate(() => {
  window.__game.give("planks", 8);
  window.__game.give("coal", 2);
  window.__game.craft("table");
});
await page.evaluate(() => {
  // look down at the ground ahead and place the table
  const g = window.__game;
  const p = g.debug().player;
  g.lookAt(p[0] + 2, p[1] - 1, p[2]);
});
// select table slot (6) and place with RMB
await page.keyboard.press("Digit6");
await page.mouse.down({ button: "right" });
await page.waitForTimeout(400);
await page.mouse.up({ button: "right" });
d = await dbg();
console.log("table placed:", d.placed > 0 ? "yes" : "no");
if (d.placed < 1) errors.push("could not place the crafting table");

// 3×3 recipes need the table nearby — craft torches
await page.evaluate(() => window.__game.craft("torch"));
d = await dbg();
console.log("torches:", d.inv.torch ?? 0);
if ((d.inv.torch ?? 0) < 1) errors.push("3×3 craft failed near the table");

// night siege: force night, spawn a zombie up close, sword it down
await page.evaluate(() => {
  window.__game.give("sword", 1);
  window.__game.setTime(340);
  window.__game.killAll();
});
await page.evaluate(() => {
  const g = window.__game;
  g.spawnMob("zombie", 2.5); // right in front — it closes, we swing
});
// level the crosshair at it (the table placement left us looking down),
// and SELECT the sword (hotbar 9)
await page.keyboard.press("Digit9");
await page.evaluate(() => {
  const g = window.__game;
  const d = g.debug();
  g.lookAt(
    d.player[0] - Math.sin(d.yaw) * 5,
    d.player[1] + 1.2,
    d.player[2] - Math.cos(d.yaw) * 5,
  );
});
const slainBefore = (await dbg()).mobsSlain;
for (let i = 0; i < 16; i++) {
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(300);
  if ((await dbg()).mobsSlain > slainBefore) break;
}
d = await dbg();
console.log("sword: mobsSlain", slainBefore, "→", d.mobsSlain, "hp:", d.hp);
if (d.mobsSlain <= slainBefore) errors.push("sword never slew the zombie");

// dawn + survive: jump the clock past the burn
await page.evaluate(() => window.__game.debugFinish());
await page.waitForTimeout(1200);
console.log("end phase:", await phase());
if ((await phase()) !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
