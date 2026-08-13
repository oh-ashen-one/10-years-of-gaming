/**
 * e2e.mjs — scripted playthrough check for INKPEAK. Real input path:
 * title → the bamboo court (a lesser killed by REAL light strings) →
 * immobilize (a real freeze) → stance swap → gate shrine rest → fog
 * curtain → the Tiger Abbot (real damage, then a harness-softened kill)
 * → YAOGUAI FELLED → results. Exits non-zero on any console error.
 *
 *   npm run dev        (port 5309, one terminal)
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
const game = (hook, ...args) =>
  page.evaluate(([h, a]) => window.__game[h](...a), [hook, args]);

await page.goto("http://localhost:5309/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → play (real Enter)
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());
if ((await phase()) !== "play") errors.push("never left the title");

// the bamboo court: kill a lesser with REAL light strings
await game("teleportBeat", "court");
await game("lockOn");
await page.waitForTimeout(400);
let killedOne = false;
for (let i = 0; i < 40; i++) {
  const d = await dbg();
  if (d.lessersAlive < 3) {
    killedOne = true;
    break;
  }
  await page.mouse.click(640, 400); // LMB
  await page.waitForTimeout(1000);  // a full swing, headless-slow
}
console.log("lesser killed by real combos:", killedOne);
if (!killedOne) errors.push("no lesser died to the staff string");
let d = await dbg();
if (d.focus <= 0) errors.push("lights never built focus");

// immobilize: freeze one for real (stage a leap so it lands next to us)
await game("lesserLeap");
await page.waitForTimeout(1200); // the leaper lands adjacent
await page.keyboard.press("KeyQ");
await page.waitForTimeout(400);
d = await dbg();
const frozeSomething = d.enemies.some((e) => e.frozen > 0) || d.immobilizeCD > 0;
console.log("immobilize landed:", frozeSomething);
if (!frozeSomething) errors.push("immobilize never froze anyone");

// stance swap
await page.keyboard.press("KeyC");
await page.waitForTimeout(300);
d = await dbg();
console.log("stance:", d.stance);
if (d.stance !== "poke") errors.push("stance never swapped");

// the gate shrine: rest refills the gourd (sip first if wounded)
d = await dbg();
if (d.hp < 100) {
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(300);
}
await game("teleport", 3, -94); // right at the gate shrine
await page.keyboard.press("KeyE");
await page.waitForTimeout(400);
d = await dbg();
console.log("after rest — gourd:", d.gourd, "hp:", d.hp);
if (d.gourd !== 4 || d.hp !== 100) errors.push("the shrine never refilled");

// through the fog curtain → the Abbot
await game("teleportBeat", "boss");
await page.waitForFunction(() => window.__game.phase === "boss", undefined, { timeout: 20000 });
await game("lockOn");
console.log("boss fight on");

// REAL damage first: strings until he bleeds (heal through the claw strings)
for (let i = 0; i < 14; i++) {
  d = await dbg();
  if (d.boss.hp < 700 || d.phase !== "boss") break;
  if (i % 2 === 0) await game("heal"); // claw strings stun-lock; stay standing
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1000);
}
d = await dbg();
console.log("boss hp after real strings:", d.boss.hp, "player hp:", d.hp);
if (d.boss.hp >= 700) errors.push("the boss never took real damage");

// harness assist down to the finishing range, then real hits to the knee
await game("heal");
await game("bossHp", 70);
await game("giveFocus", 3);
await game("immobilize"); // the seal buys the first free heavies
for (let i = 0; i < 40; i++) {
  d = await dbg();
  if (d.phase === "results") break;
  if (d.phase === "dead") break;
  if (i % 4 === 0) await game("heal"); // keep the script on its feet
  if (d.attack.t <= 0) {
    if (d.focus >= 1) await game("heavy");
    else await page.mouse.click(640, 400);
  }
  await page.waitForTimeout(450);
}
d = await dbg();
console.log("end phase:", d.phase, "deaths:", d.deaths, "longest combo:", d.longestCombo);
if (d.phase === "dead") errors.push("died during the finishing sequence");
if (d.phase !== "results") errors.push("never reached YAOGUAI FELLED");
if (d.longestCombo < 3) errors.push("no real combo string landed");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
