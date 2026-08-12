/**
 * e2e.mjs — scripted playthrough check. Drives the REAL input path
 * (keyboard events, not debug shortcuts where avoidable) through the whole
 * loop: title → walk → catch (berry + charged throw, real resolution) →
 * gym battle (attack + dodge telegraphs) → win → results card.
 * Exits non-zero if any console error was seen.
 *
 *   npm run dev        (port 5301, one terminal)
 *   node tools/e2e.mjs (another terminal)
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

// title → walk via the real Enter key
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
console.log("after Enter:", await phase());

// walk (real keys) — steps must accrue
await page.keyboard.down("KeyW");
await page.waitForTimeout(1500);
await page.keyboard.up("KeyW");
const d1 = await dbg();
console.log("walked, steps:", d1.steps);
if (d1.steps < 3) errors.push("steps did not accrue while walking");

// force an encounter nearby, then E (real key) enters the catch scene
await page.evaluate(() => window.__game.forceEncounter("basker"));
await page.waitForTimeout(200);
await page.keyboard.press("KeyE");
await page.waitForTimeout(300);
console.log("catch phase:", await phase());

// berry + charged throw (real keys), retry on break-out
for (let i = 0; i < 30 && (await phase()) === "catch"; i++) {
  if (i === 0) await page.keyboard.press("KeyB");
  await page.keyboard.down("Space");
  await page.waitForTimeout(560); // power ≈ 0.55 ≈ pad distance
  await page.keyboard.up("Space");
  await page.waitForTimeout(500);
}
const d2 = await dbg();
console.log("after catch attempts: phase", await phase(), "catches:", d2.catches, "dex:", d2.dex);
if (d2.catches < 1) errors.push("no catch landed in 30 throw attempts");

// gym battle (real keys): tap attack, dodge on telegraph
await page.evaluate(() => window.__game.startGym());
await page.waitForTimeout(500);
console.log("gym phase:", await phase());
for (let i = 0; i < 120; i++) {
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  if (await page.evaluate(() => window.__game.gymWarn())) await page.keyboard.press("KeyD");
  if ((await phase()) === "results") break;
}
console.log("end phase:", await phase());
if ((await phase()) !== "results") errors.push("gym battle never resolved to results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
