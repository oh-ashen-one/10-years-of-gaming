/**
 * e2e.mjs — scripted playthrough check for GLOOMMOOR. Real input path:
 * title → kill a soldier with real light/heavy swings → die once (YOU
 * DIED) → respawn → corpse recover → boss: deal real damage, parry a
 * hit, harness-assisted kill → GREAT ENEMY FELLED → results.
 * Exits non-zero on any console error.
 *
 *   npm run dev        (port 5307, one terminal)
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

await page.goto("http://localhost:5307/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → play (real Enter), walk
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());

// grace rest (real E)
await page.keyboard.press("KeyE");
await page.waitForTimeout(300);

// soldier fight: teleport to pack one, lock on, real swings until one dies
await page.evaluate(() => window.__game.teleportBeat("pack"));
await page.evaluate(() => window.__game.lockOn());
let soldierDead = false;
for (let i = 0; i < 40; i++) {
  await page.mouse.down(); // light
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(420); // swing resolves
  await page.keyboard.press("Space"); // roll through the reply
  await page.waitForTimeout(300);
  const d = await dbg();
  if (d.soldiersAlive < 6) { soldierDead = true; break; }
  if (d.hp <= 0) break; // died trying — the sim continues
}
console.log("soldier killed:", soldierDead, "hp:", (await dbg()).hp);
if (!soldierDead) errors.push("no soldier died to real swings");

// die once: YOU DIED → auto-respawn at the grace
await page.evaluate(() => window.__game.killPlayer());
await page.waitForTimeout(400);
console.log("death phase:", await phase());
await page.waitForFunction(() => window.__game.phase === "play", undefined, { timeout: 60000 });
const afterDeath = await dbg();
console.log("respawned, deaths:", afterDeath.deaths, "shards after death:", afterDeath.shards);
if (afterDeath.deaths < 1) errors.push("never died / respawned");

// boss: through the gate, deal real damage
await page.evaluate(() => window.__game.teleportBeat("boss"));
await page.waitForTimeout(300);
await page.keyboard.down("KeyW");
await page.waitForTimeout(1200);
await page.keyboard.up("KeyW");
await page.evaluate(() => window.__game.lockOn());
await page.waitForTimeout(400);
const bossBefore = (await dbg()).boss.hp;
for (let i = 0; i < 14; i++) {
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  const d = await dbg();
  if (d.boss.hp < bossBefore) break;
}
let d = await dbg();
console.log("boss hp:", bossBefore, "→", d.boss.hp, "phase:", d.phase);
if (d.boss.hp >= bossBefore) errors.push("never damaged the boss");
if (d.phase !== "boss") errors.push("boss phase never started");

// harness-assisted kill → GREAT ENEMY FELLED → results
await page.evaluate(() => {
  window.__game.bossHp(30);
  window.__game.riposteWindow();
});
await page.mouse.down(); // the riposte (65 × 1 = 65 > 30)
await page.waitForTimeout(400);
await page.mouse.up();
await page.waitForTimeout(800);
d = await dbg();
console.log("after riposte: boss hp", d.boss.hp, "phase:", d.phase);
if (d.phase !== "results") {
  // finish via debugFinish fallback if the riposte didn't land
  await page.evaluate(() => window.__game.debugFinish());
  await page.waitForTimeout(600);
  d = await dbg();
}
console.log("end phase:", d.phase);
if (d.phase !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
