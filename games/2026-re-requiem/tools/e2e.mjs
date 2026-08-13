/**
 * e2e.mjs — scripted playthrough check for REQUIEM WARD. Real input path:
 * title → exam room (fuse + ammo by real F) → ward A (herb) → the guarded
 * morgue (crank + herb, real aimed shots at the guard) → real inventory
 * combine (Tab, arrows, F — herb+herb=medkit) → crank the director's door
 * → slot the fuse → POWER ON → the key off the lit desk → the elevator →
 * the doors shut on its hand → SURVIVED. Non-zero on any console error.
 *
 *   npm run dev        (port 5311, one terminal)
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

/** walk to a spot and press F (real key) when the prompt names it */
async function grab(x, z, fx, fz, promptBit) {
  await game("teleport", x, z);
  await game("face", fx, fz);
  await page.waitForFunction(
    (bit) => window.__game.debug().prompt.includes(bit),
    promptBit,
    { timeout: 10000 },
  );
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(350);
}

await page.goto("http://localhost:5311/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.frames > 30, { timeout: 90000 });

// title → play (real Enter)
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
console.log("phase:", await phase());
if ((await phase()) !== "play") errors.push("never left the title");

// the exam room: fuse + ammo, real interactions
await grab(7.4, -14, 8.6, -14, "FUSE");
await grab(4.6, -11.5, 4, -11.5, "ROUNDS");
let d = await dbg();
if (!d.slots.includes("fuse")) errors.push("never picked up the fuse");
if (d.ammo !== 18) errors.push("ammo pickup never landed");
console.log("fuse + ammo:", JSON.stringify(d.slots), d.ammo);

// ward A: the herb
await grab(-7.6, -26, -8.4, -26, "HERB");
// the morgue: crank + herb, with the guard for company
await grab(-8.8, -44.4, -9.6, -44, "CRANK");
await grab(-4.6, -46.2, -4, -46.5, "HERB");
d = await dbg();
if (!d.slots.includes("crank")) errors.push("never picked up the crank");
console.log("crank + herbs:", JSON.stringify(d.slots));

// the guard gets real bullets: aim (RMB), face it, fire (LMB)
await game("heal");
const guard = d.shamblers[2];
if (guard.state !== "dead") {
  await game("face", -8, -43);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(300);
  await page.mouse.down({ button: "left" });
  await page.waitForTimeout(250);
  await page.mouse.up({ button: "left" });
  await page.mouse.up({ button: "right" });
}
d = await dbg();
console.log("shots fired:", d.shotsFired, "hits:", d.hits);
if (d.shotsFired < 1) errors.push("never fired a real shot");

// the inventory combine: Tab, arrows, F — herb + herb = medkit
await page.keyboard.press("Tab");
await page.waitForTimeout(300);
// slots: 0 fuse, 1 herb, 2 crank, 3 herb — mark 1, combine with 3
await page.keyboard.press("ArrowRight");
await page.keyboard.press("KeyF"); // mark the first herb
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.keyboard.press("KeyF"); // COMBINE
await page.waitForTimeout(300);
await page.keyboard.press("Tab");
d = await dbg();
console.log("after combine:", JSON.stringify(d.slots));
if (!d.slots.includes("medkit")) errors.push("herb+herb never made a medkit");

// the crank door, then the fuse panel
await grab(1.5, -51, 2.8, -51, "CRANK THE DOOR");
d = await dbg();
if (!d.directorOpen) errors.push("the director's door never opened");
await grab(8.2, -50, 9.7, -50, "SLOT THE FUSE");
d = await dbg();
console.log("power:", d.powerOn, "pursuer:", d.pursuer.state);
if (!d.powerOn) errors.push("power never came on");
if (d.pursuer.state === "asleep") errors.push("the pursuer never woke");

// the key off the lit desk
await grab(6.6, -51.6, 7.4, -52.4, "ELEVATOR KEY");
d = await dbg();
if (!d.slots.includes("liftkey")) errors.push("never got the elevator key");

// RUN — the elevator (it is behind us, somewhere)
await game("heal");
await grab(0, -56.2, 0, -58, "ELEVATOR");
await page.waitForFunction(() => window.__game.phase === "finale", undefined, { timeout: 10000 });
console.log("the chase is on");
await page.waitForFunction(() => window.__game.phase === "results", undefined, { timeout: 30000 });
d = await dbg();
console.log("end phase:", d.phase, "— shots:", d.shotsFired, "hits:", d.hits, "deaths:", d.deaths);
if (d.phase !== "results") errors.push("never reached SURVIVED");

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
