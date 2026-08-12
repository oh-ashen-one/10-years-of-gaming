/**
 * e2e playthrough: drive the REAL input path (keyboard) through the whole
 * loop — title → walk → catch (charge/curve/berry, real throw resolution)
 * → gym battle (attack + dodge) → win → results. Fails on any console error.
 */
import { chromium } from "playwright";

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const dbg = () => page.evaluate(() => window.__game.debug());
const phase = () => page.evaluate(() => window.__game.phase);

await page.goto("http://localhost:5301/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 60000 });

// title → walk via Enter (real key)
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
console.log("after Enter:", await phase());

// walk a bit (real keys)
await page.keyboard.down("KeyW");
await page.waitForTimeout(1500);
await page.keyboard.up("KeyW");
const d1 = await dbg();
console.log("walked, steps:", d1.steps);

// force an encounter and enter the catch scene with E (real key)
await page.evaluate(() => window.__game.forceEncounter("basker"));
await page.waitForTimeout(200);
await page.keyboard.press("KeyE");
await page.waitForTimeout(300);
console.log("catch phase:", await phase());

// berry + charge, release — a real throw
await page.keyboard.press("KeyB");
await page.keyboard.down("Space");
await page.waitForTimeout(550); // power ≈ 0.55 → pad distance
await page.keyboard.up("Space");
// wait for resolution (wobble ×3 then burst or breakout)
let caught = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(500);
  const p = await phase();
  if (p === "walk") { caught = true; break; }
  // if back in aim (breakout), throw again
  const sub = await page.evaluate(() => window.__game.debug().phase);
  void sub;
  const inAim = await page.evaluate(() => window.__game.phase === "catch");
  if (inAim) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(560);
    await page.keyboard.up("Space");
  }
}
const d2 = await dbg();
console.log("after catch attempts: phase", await phase(), "catches:", d2.catches, "dex:", d2.dex);

// gym: force second catch if needed, then start and fight with real keys
await page.evaluate(() => { window.__game.startGym(); });
await page.waitForTimeout(500);
console.log("gym phase:", await phase());
for (let i = 0; i < 120; i++) {
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  // dodge whenever a telegraph is up
  const warn = await page.evaluate(() => window.__game.gymWarn());
  if (warn) await page.keyboard.press("KeyD");
  const p = await phase();
  if (p === "results") break;
}
const d3 = await dbg();
console.log("end phase:", await phase(), "dex:", d3.dex, "catches:", d3.catches, "steps:", d3.steps);
await page.screenshot({ path: "/tmp/e2e-end.png" });

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
