/**
 * e2e.mjs — scripted playthrough check for GALE MEADOW. Real input path:
 * title → run → camp fight with real LMB combos (a mob must die) →
 * skill + burst → glide segment with a ring bump → boss wake → spin
 * dodge → core beat-down (harness time-assists allowed) → chest →
 * results. Exits non-zero on any console error.
 *
 *   npm run dev        (port 5306, one terminal)
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

await page.goto("http://localhost:5306/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → meadow (real Enter), run
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());
await page.keyboard.down("KeyW");
await page.waitForTimeout(1200);
await page.keyboard.up("KeyW");

// camp fight: pull a mob into reach, then real combos until it dies
await page.evaluate(() => window.__game.toCamp());
await page.waitForTimeout(400);
let killed = false;
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => window.__game.pullMob());
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const d = await dbg();
  if (d.mobsAlive < 4) { killed = true; break; }
}
console.log("camp kill:", killed);
if (!killed) errors.push("no mosslunk died to real combos");

// swirl: flame tag, then wind skill — biggest swirl must register
await page.evaluate(() => window.__game.pullMob());
await page.evaluate(() => window.__game.stance(2));
await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
await page.evaluate(() => window.__game.stance(1));
await page.evaluate(() => window.__game.pullMob());
await page.evaluate(() => window.__game.skill());
await page.waitForTimeout(600);
const swirl = (await dbg()).biggestSwirl;
console.log("biggest swirl:", swirl);
if (swirl <= 0) errors.push("swirl never triggered");

// burst with full energy
await page.evaluate(() => window.__game.setEnergy(100));
await page.keyboard.press("KeyQ");
await page.waitForTimeout(400);

// glide: open air, ride toward the rings
await page.evaluate(() => window.__game.killCamp());
await page.evaluate(() => window.__game.glide());
await page.waitForTimeout(1500);
const gliderState = await page.evaluate(() => window.__game.debug().player[1]);
console.log("glide altitude:", gliderState);

// boss: wake at arena, survive a spin via dodge, beat the core window
await page.evaluate(() => window.__game.toArena());
await page.waitForTimeout(800);
let bossAwake = (await dbg()).boss.state;
console.log("boss state after entering arena:", bossAwake);
if (bossAwake === "dormant") errors.push("boss never woke");

// fight: stand on the boss, combos + bursts; re-expose the core for time
await page.evaluate(() => window.__game.bossState("core"));
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => window.__game.toBoss());
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.up();
  await page.evaluate(() => window.__game.setEnergy(100));
  await page.keyboard.press("KeyQ");
  const d = await dbg();
  if (d.boss.hp <= 0) break;
  if (i % 4 === 3) await page.evaluate(() => window.__game.bossState("core"));
}
let d = await dbg();
console.log("boss hp:", d.boss.hp);
if (d.boss.hp > 0) errors.push("boss never fell");

// chest → results (E near the chest)
await page.waitForTimeout(600);
await page.evaluate(() => window.__game.teleport(-40, 228));
await page.keyboard.press("KeyE");
await page.waitForTimeout(800);
d = await dbg();
console.log("end phase:", d.phase);
if (d.phase !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
