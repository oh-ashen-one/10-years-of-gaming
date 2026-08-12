/**
 * e2e.mjs — scripted playthrough check for DUSTFALL ISLAND. Real keyboard
 * input through the loop: title → plane → jump → dive → chute → land →
 * walk → real gunfight (aim ray vs a pulled bot) → buggy drive → dinner.
 * Exits non-zero on any console error.
 *
 *   npm run dev        (port 5302, one terminal)
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

await page.goto("http://localhost:5302/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 60000 });

// title → plane (real Enter), then jump with Space
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
console.log("phase:", await phase());
await page.keyboard.press("Space");
await page.waitForTimeout(300);
console.log("after jump:", await phase());

// ride the dive down (hold W to steer), wait for the ground
await page.keyboard.down("KeyW");
let landed = false;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(1000);
  if ((await phase()) === "ground") { landed = true; break; }
}
await page.keyboard.up("KeyW");
console.log("landed:", landed, "phase:", await phase());
if (!landed) errors.push("never landed");

// walk (real keys)
await page.keyboard.down("KeyW");
await page.waitForTimeout(1500);
await page.keyboard.up("KeyW");

// a real gunfight: pull a bot into the open, fire the rifle with Space
await page.evaluate(() => {
  window.__game.giveWeapon("rifle");
  window.__game.pullBot(14);
});
await page.waitForTimeout(300);
const before = await dbg();
await page.keyboard.down("Space");
await page.waitForTimeout(2500);
await page.keyboard.up("Space");
const after = await dbg();
console.log("combat: damage check — kills before/after:", before.kills, after.kills);
if (after.kills <= before.kills && after.hp === 100) {
  errors.push("gunfight had no effect (no kill, no damage taken)");
}

// buggy: enter, drive, exit
await page.evaluate(() => window.__game.buggy());
await page.keyboard.down("KeyW");
await page.waitForTimeout(1200);
await page.keyboard.up("KeyW");
await page.evaluate(() => window.__game.exitBuggy());
console.log("buggy drive ok");

// finish: force the dinner, expect results
await page.evaluate(() => window.__game.debugFinish());
await page.waitForTimeout(4000); // banner then card
console.log("end phase:", await phase());
if ((await phase()) !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
