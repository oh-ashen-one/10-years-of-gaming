/**
 * e2e.mjs — scripted playthrough check for BUILD ROYALE. Real keyboard
 * through the loop: title → bus → jump → glider → land → harvest a tree
 * (real swings) → build a wall + ramp + edit it (Q/LMB/G) → real gunfight
 * → storm → victory. Exits non-zero on any console error.
 *
 *   npm run dev        (port 5303, one terminal)
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

await page.goto("http://localhost:5303/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 60000 });

// title → bus (real Enter), jump, glide, land
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
console.log("phase:", await phase());
await page.keyboard.press("Space"); // jump
await page.waitForTimeout(600);
await page.keyboard.press("Space"); // glider (below 100m only — may dive first)
let landed = false;
await page.keyboard.down("KeyW");
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(1000);
  const d = await dbg();
  if (!d.glider && d.phase === "drop" && d.player[1] < 90) {
    await page.keyboard.press("Space"); // redeploy the glider
  }
  if (d.phase === "ground") { landed = true; break; }
}
await page.keyboard.up("KeyW");
console.log("landed:", landed);
if (!landed) errors.push("never landed");

// harvest: teleport next to a living tree, swing with LMB until it falls
await page.evaluate(() => window.__game.gotoTree());
await page.waitForTimeout(400);
let woodBefore = (await dbg()).mats.wood;
await page.mouse.down();
await page.waitForTimeout(2600); // several swings → 3 whacks fell a tree
await page.mouse.up();
let d = await dbg();
console.log("harvest: wood", woodBefore, "→", d.mats.wood);
if (d.mats.wood <= woodBefore) {
  // not in reach — walk at the tree and keep swinging
  await page.keyboard.down("KeyW");
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.keyboard.up("KeyW");
  d = await dbg();
  console.log("harvest retry: wood", d.mats.wood);
  if (d.mats.wood <= woodBefore) errors.push("harvest never yielded wood");
}

// build: enter build mode, place two pieces, edit the wall
await page.evaluate(() => window.__game.giveMats(100));
const buildsBefore = (await dbg()).builds;
await page.keyboard.press("KeyQ"); // wall
await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
await page.keyboard.press("KeyQ"); // ramp
await page.waitForTimeout(150);
await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
await page.keyboard.press("KeyG"); // edit own wall → door
d = await dbg();
console.log("builds:", buildsBefore, "→", d.builds, "mode:", d.buildMode);
if (d.builds < buildsBefore + 2) errors.push("expected two pieces placed");
await page.keyboard.press("KeyQ"); // floor
await page.keyboard.press("KeyQ"); // cone
await page.keyboard.press("KeyQ"); // exit

// gunfight: pull a bot into the open and fire the real hitscan.
// bots panic-wall, so early bursts chew the wall — assert damage dealt
// (bot or its build) through the real resolveShot path; kill if possible.
await page.evaluate(() => window.__game.giveWeapon("ar"));
const before = await dbg();
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__game.pullBot(10));
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const d = await dbg();
  if (d.kills > before.kills) break;
}
d = await dbg();
console.log("combat: kills", before.kills, "→", d.kills, "damage", before.damage, "→", d.damage, "hp:", d.hp);
if (d.kills <= before.kills && d.damage <= before.damage) {
  errors.push("hitscan never landed (no kill, no damage)");
}

// storm state jumps work
await page.evaluate(() => window.__game.setCircle(2));
await page.waitForTimeout(600);
d = await dbg();
if (d.stage < 1) errors.push("storm director did not advance");

// victory: finish → results
await page.evaluate(() => window.__game.debugFinish());
await page.waitForTimeout(4200); // banner + dance then card
console.log("end phase:", await phase());
if ((await phase()) !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
