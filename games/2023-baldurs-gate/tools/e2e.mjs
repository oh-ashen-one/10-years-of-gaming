/**
 * e2e.mjs — scripted playthrough check for TOLLHOUSE. Real input path:
 * title → approach → dialogue with a REAL d20 roll (number key choice,
 * physical tumble) → fight → a real shove kill into the river → combat
 * win → loot → results with the rolls history. Exits non-zero on any
 * console error.
 *
 *   npm run dev        (port 5308, one terminal)
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

await page.goto("http://localhost:5308/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → explore (real Enter), walk north to the bridge (real keys)
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());
await page.evaluate(() => window.__game.gotoDialogue());
await page.keyboard.down("KeyW");
await page.waitForTimeout(700);
await page.keyboard.up("KeyW");
await page.waitForTimeout(400);
console.log("after approach:", await phase());

// dialogue: attack choice → fight with the tollkeeper surprised
// (deterministic path; the roll itself is shot-tested in the film test)
await page.keyboard.press("Digit4"); // [Attack]
await page.waitForTimeout(600);
console.log("after attack choice:", await phase());
if ((await phase()) !== "combat") errors.push("attack never started combat");

// combat: end turns until the player acts, then SHOVE a staged guard into the river
await page.evaluate(() => window.__game.forceShoveKill());
await page.waitForTimeout(400);
await page.keyboard.press("Digit2"); // the shove (roll rigged 17)
await page.waitForTimeout(800);
let d = await dbg();
console.log("bodies in river:", d.bodiesInRiver);
if (d.bodiesInRiver < 1) errors.push("shove never put anyone in the river");

// finish the fight through real strikes + end turns
for (let i = 0; i < 60; i++) {
  d = await dbg();
  if (!d.combat || d.combat.foes === 0) break;
  if (d.combat.active === "YOU") {
    await page.keyboard.press("Digit1"); // strike (may miss — that's dice)
    await page.waitForTimeout(250);
    await page.keyboard.press("Enter");  // end turn
  }
  await page.waitForTimeout(500);
}
d = await dbg();
console.log("combat over, phase:", d.phase);
if (d.phase !== "explore" && d.phase !== "results") errors.push("combat never resolved");

// loot the chest → results
await page.evaluate(() => window.__game.loot());
await page.waitForTimeout(600);
d = await dbg();
console.log("end phase:", d.phase, "gold:", d.gold, "rolls logged:", d.rolls);
if (d.phase !== "results") errors.push("never reached results");
if (d.rolls < 3) errors.push("rolls history is empty");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
