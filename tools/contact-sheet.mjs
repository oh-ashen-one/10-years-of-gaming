/**
 * contact-sheet.mjs — the §8 series assembly: one 4×3 contact sheet from
 * the eleven per-game hero shots (shots/2016.png … shots/2026.png) plus a
 * title cell. Rendered as an HTML page and screenshotted with Playwright —
 * no native deps. Run from the repo root:
 *
 *   node tools/contact-sheet.mjs   # writes shots/contact-sheet.png
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotsDir = path.join(root, "shots");

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TITLES = {
  2016: "POKÉMON GO",
  2017: "PUBG",
  2018: "FORTNITE",
  2019: "MINECRAFT",
  2020: "AMONG US",
  2021: "GENSHIN IMPACT",
  2022: "ELDEN RING",
  2023: "BALDUR'S GATE 3",
  2024: "BLACK MYTH: WUKONG",
  2025: "CLAIR OBSCUR",
  2026: "RE REQUIEM",
};

for (const y of YEARS) {
  if (!fs.existsSync(path.join(shotsDir, `${y}.png`))) {
    console.error(`missing hero shot: shots/${y}.png`);
    process.exit(1);
  }
}

const cell = (y) => {
  const b64 = fs.readFileSync(path.join(shotsDir, `${y}.png`)).toString("base64");
  return `
  <div class="cell">
    <img src="data:image/png;base64,${b64}"/>
    <div class="cap"><b>${y}</b> · ${TITLES[y]}</div>
  </div>`;
};

const html = `<!doctype html><html><head><style>
  html, body { margin: 0; background: #0c0a12; }
  .sheet { width: 2000px; padding: 28px; display: grid; box-sizing: border-box;
    grid-template-columns: repeat(4, 1fr); gap: 14px;
    font-family: Georgia, serif; }
  .cell { position: relative; aspect-ratio: 16/10; overflow: hidden;
    border: 2px solid #3a2c4a; background: #14101c; }
  .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cell .cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 10px;
    background: rgba(12,10,18,0.78); color: #e8d8b0; font-size: 15px;
    letter-spacing: 0.12em; font-style: italic; }
  .cell .cap b { color: #ffd98a; font-style: normal; }
  .cell.title { display: flex; flex-direction: column; align-items: center;
    justify-content: center; color: #e8d8b0; text-align: center; }
  .cell.title h1 { font: italic 700 44px Georgia, serif; margin: 0;
    color: #ffd98a; letter-spacing: 0.06em; }
  .cell.title .sub { margin-top: 10px; font: italic 16px Georgia, serif;
    color: #b8a0c0; letter-spacing: 0.35em; }
</style></head><body>
  <div class="sheet">
    <div class="cell title"><h1>10 YEARS<br/>OF GAMING</h1><div class="sub">2016 — 2026</div></div>
    ${YEARS.map(cell).join("")}
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2100, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(400); // images settle
const sheet = await page.$(".sheet");
await sheet.screenshot({ path: path.join(shotsDir, "contact-sheet.png") });
await browser.close();
console.log("wrote shots/contact-sheet.png");
