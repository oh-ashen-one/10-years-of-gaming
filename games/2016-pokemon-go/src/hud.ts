/**
 * hud.ts — the phone-trainer HUD. The whole screen is framed like a 2016
 * phone running the app: rounded ink bezel, status panel (steps / clock /
 * place), dex cells with creature icons, a context prompt bar, the throw
 * arc gauge + berry pip during catches, HP bars at the gym, and the big
 * italic message flash. Built on the core HUD language (ty-panel/ty-msg),
 * palette hexes only, canvas instruments over strings.
 */
import {
  injectHudStyles, MessageFlash, drawArcGauge, drawCells, fmtTime, hudColors, css,
} from "@tenyears/core";
import { PAL } from "./palette";
import { SPECIES, DEX_ORDER, type SpeciesId } from "./creatures";
import type { Game } from "./game";

const C = hudColors(PAL);

export class HUD {
  private flash: MessageFlash;
  private stepsEl: HTMLElement;
  private clockEl: HTMLElement;
  private placeEl: HTMLElement;
  private dexCells: HTMLCanvasElement[] = [];
  private catchesEl: HTMLElement;
  private promptEl: HTMLElement;
  private catchPanel: HTMLElement;
  private gaugeCv: HTMLCanvasElement;
  private berryEl: HTMLElement;
  private gradeEl: HTMLElement;
  private gymPanel: HTMLElement;
  private bossBarCv: HTMLCanvasElement;
  private buddyBarCv: HTMLCanvasElement;
  private resultsEl: HTMLElement;
  private gradeT = 0;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="phone-bezel"></div>
      <div id="phone-notch" class="ty-txt">POCKET&nbsp;GO</div>
      <div id="hud-status" class="ty-panel ty-txt">
        <div class="steps">0</div>
        <div class="lbl">STEPS</div>
        <div class="clock">0:00</div>
        <div class="place">HOME CORNER</div>
      </div>
      <div id="hud-dex" class="ty-panel ty-txt">
        <div class="dex-row"></div>
        <div class="dex-count">DEX 0/6 · CAUGHT 0</div>
      </div>
      <div id="hud-prompt" class="ty-panel ty-txt"></div>
      <div id="hud-catch" class="ty-panel ty-txt">
        <canvas width="240" height="190"></canvas>
        <div class="berry">BERRY READY — <b>B</b></div>
        <div class="grade"></div>
      </div>
      <div id="hud-gym">
        <div class="gym-bar boss ty-panel"><canvas width="420" height="56"></canvas></div>
        <div class="gym-bar buddy ty-panel"><canvas width="300" height="44"></canvas></div>
      </div>
      <div id="hud-msg"></div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1>GYM LEADER</h1>
        <div class="sub">CROWN PLAZA IS YOURS</div>
        <div class="res-dex"></div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — STROLL AGAIN</div>
      </div></div>
    `;

    const style = document.createElement("style");
    style.textContent = /* css */ `
      #phone-bezel {
        position: absolute; inset: 8px; pointer-events: none;
        border: 5px solid ${C.ink}; border-radius: 30px;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.06);
      }
      #phone-notch {
        position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
        background: ${C.ink}; color: ${C.accent}; font-size: 13px; letter-spacing: 0.3em;
        padding: 4px 26px 6px; border-radius: 0 0 14px 14px;
      }
      #hud-status { left: 26px; top: 30px; padding: 10px 20px 12px 16px; }
      #hud-status .steps { font-size: 40px; line-height: 0.9; color: ${C.accent};
        text-shadow: 3px 3px 0 ${C.ink}; }
      #hud-status .lbl { font-size: 11px; letter-spacing: 0.3em; color: ${C.paper}; margin-top: 2px; }
      #hud-status .clock { font-size: 16px; color: ${C.hot}; margin-top: 8px; }
      #hud-status .place { font-size: 11px; letter-spacing: 0.18em; color: ${C.paper}; margin-top: 3px; }
      #hud-dex { right: 26px; top: 30px; padding: 10px 14px; text-align: center; }
      #hud-dex .dex-row { display: flex; gap: 6px; transform: skewX(6deg); }
      #hud-dex .dex-row canvas { width: 44px; height: 44px; }
      #hud-dex .dex-count { font-size: 12px; letter-spacing: 0.12em; color: ${C.paper}; margin-top: 7px; }
      #hud-prompt {
        left: 50%; bottom: 26px; transform: translateX(-50%) skewX(-6deg);
        padding: 9px 26px; font-size: 16px; letter-spacing: 0.1em; color: ${C.paper};
        display: none;
      }
      #hud-prompt b { color: ${C.hot}; }
      #hud-catch {
        left: 26px; bottom: 60px; width: 150px; padding: 8px 10px; display: none;
        text-align: center;
      }
      #hud-catch canvas { width: 120px; height: 95px; }
      #hud-catch .berry { font-size: 11px; letter-spacing: 0.1em; color: ${C.accent}; }
      #hud-catch .berry.used { color: ${C.inkDeep}; text-decoration: line-through; }
      #hud-catch .grade { font-size: 22px; color: ${C.hot}; min-height: 26px;
        text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-gym { display: none; }
      .gym-bar { position: absolute; padding: 4px; }
      .gym-bar canvas { display: block; }
      .gym-bar.boss { top: 60px; left: 50%; transform: translateX(-50%) skewX(-6deg); }
      .gym-bar.boss canvas { width: 210px; height: 28px; }
      .gym-bar.buddy { bottom: 90px; left: 50%; transform: translateX(-50%) skewX(-6deg); }
      .gym-bar.buddy canvas { width: 150px; height: 22px; }
      #hud-results {
        position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(23, 28, 54, 0.45);
      }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.4em; font-size: 12px; margin-bottom: 18px; }
      #hud-results .res-dex { display: flex; gap: 10px; justify-content: center; margin-bottom: 18px; }
      #hud-results .res-dex canvas { width: 54px; height: 54px; }
      #hud-results .res-stats { font-size: 17px; line-height: 1.9; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${C.hot}; }
      #hud-results .again { margin-top: 22px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.stepsEl = root.querySelector("#hud-status .steps")!;
    this.clockEl = root.querySelector("#hud-status .clock")!;
    this.placeEl = root.querySelector("#hud-status .place")!;
    this.catchesEl = root.querySelector("#hud-dex .dex-count")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.catchPanel = root.querySelector("#hud-catch")!;
    this.gaugeCv = root.querySelector("#hud-catch canvas")!;
    this.berryEl = root.querySelector("#hud-catch .berry")!;
    this.gradeEl = root.querySelector("#hud-catch .grade")!;
    this.gymPanel = root.querySelector("#hud-gym")!;
    this.bossBarCv = root.querySelector(".gym-bar.boss canvas")!;
    this.buddyBarCv = root.querySelector(".gym-bar.buddy canvas")!;
    this.resultsEl = root.querySelector("#hud-results")!;

    const row = root.querySelector("#hud-dex .dex-row")!;
    for (let i = 0; i < 6; i++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 88;
      row.appendChild(cv);
      this.dexCells.push(cv);
    }
  }

  /* ------------------------------------------------------------ pieces -- */

  private drawDexIcon(cv: HTMLCanvasElement, id: SpeciesId, caught: boolean): void {
    const ctx = cv.getContext("2d")!;
    const w = cv.width;
    ctx.clearRect(0, 0, w, w);
    // cell plate
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(2, 2, w - 4, w - 4);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, w - 4);
    const cx = w / 2, cy = w / 2;
    if (!caught) {
      ctx.fillStyle = C.ink;
      ctx.font = "italic 900 44px 'Segoe UI', Arial";
      ctx.textAlign = "center";
      ctx.fillText("?", cx, cy + 15);
      return;
    }
    const body = css(SPECIES[id].colors.body);
    // simple poster glyph: round body, two ears/wings, big eyes
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy + 4, w * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - w * 0.16, cy - w * 0.2, w * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.16, cy - w * 0.2, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx - w * 0.1, cy, w * 0.06, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.1, cy, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(cx - w * 0.1, cy + 2, w * 0.028, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.1, cy + 2, w * 0.028, 0, Math.PI * 2);
    ctx.fill();
    if (SPECIES[id].rare) {
      ctx.strokeStyle = C.hot;
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, w - 12, w - 12);
    }
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  grade(text: string): void {
    this.gradeEl.textContent = text;
    this.gradeT = 1.4;
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
    if (this.gradeT > 0) {
      this.gradeT -= dtMs / 1000;
      if (this.gradeT <= 0) this.gradeEl.textContent = "";
    }
  }

  prompt(html: string): void {
    if (html) {
      this.promptEl.innerHTML = html;
      this.promptEl.style.display = "block";
    } else {
      this.promptEl.style.display = "none";
    }
  }

  /* ------------------------------------------------------------ update -- */

  update(game: Game, placeName: string): void {
    this.stepsEl.textContent = String(game.steps);
    this.clockEl.textContent = fmtTime(game.time);
    this.placeEl.textContent = placeName;
    this.catchesEl.textContent = `DEX ${game.dexCount()}/6 · CAUGHT ${game.catches}`;
    DEX_ORDER.forEach((id, i) => {
      this.drawDexIcon(this.dexCells[i], id, game.dex.has(id));
    });

    // catch panel
    const c = game.catch;
    const inCatch = game.phase === "catch" && !!c;
    this.catchPanel.style.display = inCatch ? "block" : "none";
    if (inCatch && c) {
      const ctx = this.gaugeCv.getContext("2d")!;
      ctx.clearRect(0, 0, this.gaugeCv.width, this.gaugeCv.height);
      drawArcGauge(ctx, {
        value: c.charging ? c.power : 0,
        color: C.accent,
        hotColor: C.hot,
        hot: c.power > 0.45 && c.power < 0.7,
        trackColor: "rgba(255,255,255,0.12)",
        tickColor: C.ink,
        label: c.charging ? "" : "SPACE",
        labelColor: C.paper,
        subLabel: "THROW",
        subColor: C.accent,
      });
      // sweet-spot marker on the gauge (ideal power ≈ 0.54)
      this.berryEl.className = c.berry ? "berry used" : "berry";
      this.berryEl.innerHTML = c.berry ? "BERRY SPENT" : "BERRY READY — <b>B</b>";
    }

    // gym bars
    const g = game.gym;
    const inGym = game.phase === "gym" && !!g;
    this.gymPanel.style.display = inGym ? "block" : "none";
    if (inGym && g) {
      const bctx = this.bossBarCv.getContext("2d")!;
      bctx.clearRect(0, 0, this.bossBarCv.width, this.bossBarCv.height);
      drawCells(bctx, {
        value: g.bossHP / 90, cells: 12,
        color: css(PAL.extra.gymPurple), hotColor: C.hot, hot: g.warnLane !== null,
        trackColor: "rgba(255,255,255,0.10)",
      });
      const uctx = this.buddyBarCv.getContext("2d")!;
      uctx.clearRect(0, 0, this.buddyBarCv.width, this.buddyBarCv.height);
      drawCells(uctx, {
        value: g.buddyHP / 60, cells: 8,
        color: C.accent, hotColor: C.hot, hot: g.buddyHP < 20,
        trackColor: "rgba(255,255,255,0.10)",
      });
    }
  }

  results(game: Game): void {
    const dexEl = this.resultsEl.querySelector(".res-dex")!;
    dexEl.innerHTML = "";
    for (const id of DEX_ORDER) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 108;
      dexEl.appendChild(cv);
      this.drawDexIcon(cv, id, game.dex.has(id));
    }
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `DEX <b>${game.dexCount()}/6</b> · CAUGHT <b>${game.catches}</b><br/>` +
      `STEPS <b>${game.steps}</b> · TIME <b>${fmtTime(game.time)}</b><br/>` +
      (game.dexCount() === 6
        ? `<span style="color:${C.hot}">FULL DEX — THE NEIGHBORHOOD IS COMPLETE</span>`
        : `missing: ${DEX_ORDER.filter((id) => !game.dex.has(id)).map((id) => SPECIES[id].name).join(", ") || "none"}`);
    this.resultsEl.style.display = "flex";
  }
}
