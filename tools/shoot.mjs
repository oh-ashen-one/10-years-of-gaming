/**
 * shoot.mjs — the parameterized film test (§2.6, fixed by the franchise).
 *
 * Drives a real game in headless Chromium (1280×800 @ deviceScaleFactor 2)
 * through a per-game shots manifest and captures named frames. Every shot
 * is an authored scenario, not luck — if a shot looks wrong, fix the game,
 * never mock the screenshot.
 *
 *   node tools/shoot.mjs --port 5301 --out games/2016-pokemon-go/shots \
 *       --manifest games/2016-pokemon-go/shots.manifest.mjs
 *
 * Flags:
 *   --port       dev-server port (required unless --url given)
 *   --url        full URL override (default http://localhost:<port>/)
 *   --out        output directory for PNGs (required)
 *   --manifest   shots manifest: .mjs default-exporting
 *                [{ name, run?(page, game) }] or a .json array of names
 *                ([{ "name": "01-title" }, ...] or ["01-title", ...]).
 *                With no manifest, a single "shot" capture is taken.
 *   --settle     ms to settle after frames gate (default 1500)
 *
 * A shot's run(page, game) may use page.keyboard / page.evaluate to drive
 * the game's __game scenario hooks; `game` is a convenience handle that
 * evaluates calls against window.__game: await game("teleportU", 0.4, 27).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const PORT = arg("port");
const URL = arg("url") ?? (PORT ? `http://localhost:${PORT}/` : undefined);
const OUT = arg("out");
const MANIFEST = arg("manifest");
const SETTLE = Number(arg("settle") ?? 1500);

if (!URL || !OUT) {
  console.error("usage: node tools/shoot.mjs --port <port> --out <dir> [--manifest <file>] [--settle ms]");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------ manifest -- */

let shots = [{ name: "shot" }];
if (MANIFEST) {
  const p = resolve(MANIFEST);
  if (p.endsWith(".json")) {
    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(p, "utf8"));
    shots = raw.map((s) => (typeof s === "string" ? { name: s } : s));
  } else {
    const mod = await import(pathToFileURL(p).href);
    shots = mod.default ?? mod.shots;
  }
}

/* --------------------------------------------------------------- drive -- */

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, // retina captures
});

page.on("console", (m) => {
  if (m.type() === "error") console.log("[page]", m.text());
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__game, { timeout: 20000 });
// wait for PRESENTED frames, not wall time — under software GL the first
// retina frames are slow; a fixed sleep can capture an unpresented canvas
await page.waitForFunction(() => window.__game.frames > 24, { timeout: 120000 });
await page.waitForTimeout(SETTLE);

// convenience handle: game("teleportU", 0.4, 27) -> window.__game call
const game = (fn, ...args) =>
  page.evaluate(
    ([f, a]) => window.__game[f](...a),
    [fn, args],
  );

for (const shot of shots) {
  if (shot.run) await shot.run(page, game);
  await page.screenshot({ path: join(OUT, `${shot.name}.png`) });
  console.log("captured", shot.name);
}

await browser.close();
console.log(`done -> ${OUT}`);
