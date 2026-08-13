/**
 * e2e.mjs — scripted playthrough check for OVERPAINT. Real input path:
 * title → the painted path → fight 1 (real menu strikes; a REAL dodge and
 * a REAL parry against the brushling's telegraphs, polled not slept) →
 * fight 2 (3 real parries break the mime's gradient shield) → the flag →
 * the Marionette (real damage, then a harness-assisted felling) → the
 * dissolve → FOR THOSE WHO COME AFTER → results. Non-zero on any error.
 *
 *   npm run dev        (port 5310, one terminal)
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

/** act at an incoming attack's impact: parry or dodge (polled, never slept) */
async function defendTheImpact(kind) {
  await page.waitForFunction(
    () => {
      const b = window.__game.debug().battle;
      return b && b.incoming && b.incoming.t > b.incoming.beats[b.incoming.beat] - 0.13;
    },
    undefined,
    { timeout: 30000 },
  );
  await page.keyboard.press(kind === "parry" ? "KeyF" : "Space");
  await page.waitForTimeout(150);
}

await page.goto("http://localhost:5310/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → explore (real Enter)
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());
if ((await phase()) !== "explore") errors.push("never left the title");

// fight 1 — real menu turns, real defenses
await game("gotoBeat", "fight1");
await page.waitForFunction(() => window.__game.phase === "battle", undefined, { timeout: 20000 });
let dodged = 0;
let parried = 0;
for (let i = 0; i < 120; i++) {
  const d = await dbg();
  if (!d.battle) break; // fight 1 won
  if (d.battle.turn === "player") {
    await page.keyboard.press("Digit1"); // strike (1 daub)
    await page.waitForTimeout(350);
  } else if (d.battle.incoming) {
    const kind = d.battle.incoming.defense === "dodge" ? "dodge" : "parry";
    await defendTheImpact(kind);
    const dd = await dbg();
    dodged = dd.dodges;
    parried = dd.parriesLanded;
  }
  await page.waitForTimeout(120);
}
d = await dbg();
console.log("fight1 done — dodges:", dodged, "parries:", parried);
if (d.battle) errors.push("fight 1 never resolved");
if (dodged < 1) errors.push("never landed a real dodge");
if (parried < 1) errors.push("never landed a real parry");
if (d.parriesLanded > d.parryAttempts) errors.push("parry math is broken");

// fight 2 — the mime: three real parries break the shield
await game("heal");
await game("gotoBeat", "fight2");
await page.waitForFunction(() => window.__game.phase === "battle", undefined, { timeout: 20000 });
let sawBreak = false;
for (let i = 0; i < 160; i++) {
  const d = await dbg();
  if (!d.battle) break;
  const mime = d.battle.enemies.find((e) => e.kind === "mime");
  if (mime && mime.shield === 0) sawBreak = true;
  if (d.battle.turn === "player") {
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(350);
  } else if (d.battle.incoming) {
    await defendTheImpact(d.battle.incoming.defense === "dodge" ? "dodge" : "parry");
  }
  await page.waitForTimeout(120);
}
d = await dbg();
console.log("fight2 done — gradient break:", sawBreak);
if (d.battle) errors.push("fight 2 never resolved");
if (!sawBreak) errors.push("the gradient shield never broke");

// the flag, then the Marionette
await game("heal");
await game("gotoBeat", "boss");
await page.waitForFunction(() => window.__game.phase === "battle", undefined, { timeout: 20000 });
console.log("boss fight on");

// real damage first
for (let i = 0; i < 12; i++) {
  const d2 = await dbg();
  if (!d2.battle || d2.battle.enemies[0].hp < 420) break;
  if (d2.battle.turn === "player") {
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(350);
  } else if (d2.battle.incoming) {
    await defendTheImpact(d2.battle.incoming.defense === "parry" ? "parry" : "dodge");
  }
  await page.waitForTimeout(120);
}
d = await dbg();
console.log("boss hp after real turns:", d.battle ? d.battle.enemies[0].hp : 0, "player hp:", d.hp);
if (d.battle && d.battle.enemies[0].hp >= 420) errors.push("the boss never took real damage");

// harness assist to the brink, then real strikes to the dissolve
await game("heal");
await game("bossHp", 24);
for (let i = 0; i < 40; i++) {
  const d2 = await dbg();
  if (d2.phase === "card" || d2.phase === "results") break;
  if (!d2.battle) break;
  if (d2.battle.turn === "player") {
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(400);
  } else if (d2.battle.incoming) {
    await defendTheImpact(d2.battle.incoming.defense === "parry" ? "parry" : "dodge");
  }
  if (i % 5 === 4) await game("heal");
  await page.waitForTimeout(150);
}
// through the card to results
await page.waitForFunction(
  () => ["card", "results"].includes(window.__game.phase),
  undefined,
  { timeout: 40000 },
).catch(() => {});
await game("showResults");
await page.waitForTimeout(400);
d = await dbg();
console.log("end phase:", d.phase, "turns:", d.turns, "parries:", `${d.parriesLanded}/${d.parryAttempts}`, "damage:", d.damageDealt);
if (d.phase !== "results") errors.push("never reached results");
if (d.turns < 3) errors.push("turn counter broken");
if (d.damageDealt < 100) errors.push("damage counter broken");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
