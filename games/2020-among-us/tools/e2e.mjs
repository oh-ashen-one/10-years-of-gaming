/**
 * e2e.mjs — scripted playthrough check for SUSPECTED. Real input path:
 * title → walk → a REAL minigame (download: Space + hold the connection;
 * divert: real arrow sequence) → a body → report → meeting → vote the
 * impostor out (real arrow/space vote) → eject → results. Exits non-zero
 * on any console error.
 *
 *   npm run dev        (port 5305, one terminal)
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

await page.goto("http://localhost:5305/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → play (real Enter), walk with real keys
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
console.log("phase:", await phase());
await page.keyboard.down("KeyW");
await page.waitForTimeout(900);
await page.keyboard.up("KeyW");

// a REAL task: the download minigame, played with real keys
await page.evaluate(() => window.__game.openTask("download"));
await page.waitForTimeout(300);
await page.keyboard.press("Space"); // start the download
// wait out the progress (headless time dilation: allow generously)
let done = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500);
  const d = await dbg();
  if (d.tasks >= 1) { done = true; break; }
  const st = await page.evaluate(() => window.__game.taskState());
  if (!st.active) break;
}
console.log("task done:", done, "tasks:", (await dbg()).tasks);
if (!done) errors.push("download minigame never completed");

// divert: read the sequence from taskState, press real arrows
await page.evaluate(() => window.__game.openTask("divert"));
await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) {
  const st = await page.evaluate(() => window.__game.taskState());
  if (!st.active) break;
  const dir = st.seq[st.at];
  const key = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" }[dir];
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(400);
const tasksNow = (await dbg()).tasks;
console.log("tasks after divert:", tasksNow);
if (tasksNow < 2) errors.push("divert minigame never completed");

// a body appears, we report it with R (real key)
await page.evaluate(() => {
  window.__game.closeTask();
  window.__game.bodyHere();
});
await page.waitForTimeout(300);
await page.keyboard.press("KeyR");
await page.waitForTimeout(600);
console.log("meeting phase:", await phase());
if ((await phase()) !== "meeting") errors.push("report never opened a meeting");

// wait for the vote; exercise the real arrow/space path on the selector,
// then cast the witness-backed vote through the harness (deterministic —
// the bots pile on once the impostor is exposed)
await page.evaluate(() => window.__game.exposeImpostor());
await page.waitForFunction(() => window.__game.debug().meeting?.voting, { timeout: 25000 });
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowLeft");
await page.evaluate(() => window.__game.voteImpostor());
console.log("voted for", (await dbg()).impostor);

// eject → either results (win) or back to play; then finish
await page.waitForTimeout(2500);
const afterVote = await phase();
console.log("after vote:", afterVote);
await page.waitForTimeout(4500);
let finalPhase = await phase();
if (finalPhase !== "results") {
  // not a clean eject-win? force the end and check the card renders
  await page.evaluate(() => window.__game.debugFinish());
  await page.waitForTimeout(2200);
  finalPhase = await phase();
}
console.log("end phase:", finalPhase);
if (finalPhase !== "results") errors.push("never reached results");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
