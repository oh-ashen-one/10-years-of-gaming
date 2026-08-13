/**
 * hud.ts — the anime HUD: stamina arc, HP cells, the two element
 * diamonds (stance), the burst icon with its energy ring, the quest
 * ribbon, the boss bar with ink frame, the burst BANNER card, and the
 * results card. House language, palette only, ~30 Hz.
 */
import { injectHudStyles, MessageFlash, drawCells, drawArcGauge, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game } from "./game";

const C = hudColors(PAL);
const GALE = css(PAL.extra.gale);
const FLAME = css(PAL.extra.flame);

const QUESTS = [
  "CLEAR THE MOSSLUNK CAMP",
  "CLIMB THE MARKED CLIFF →",
  "RIDE THE UPDRAFT RINGS →",
  "FELL THE RUIN WARDEN",
  "CLAIM THE CHEST",
];

export class HUD {
  private flash: MessageFlash;
  private questEl: HTMLElement;
  private stamCv: HTMLCanvasElement;
  private hpCv: HTMLCanvasElement;
  private stanceA: HTMLElement;
  private stanceB: HTMLElement;
  private burstCv: HTMLCanvasElement;
  private bossEl: HTMLElement;
  private bossCv: HTMLCanvasElement;
  private bannerEl: HTMLElement;
  private resultsEl: HTMLElement;
  private bannerT = 0;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-quest" class="ty-panel ty-txt"></div>
      <div id="hud-vitals" class="ty-panel">
        <canvas id="hp" width="360" height="40"></canvas>
        <canvas id="stam" width="360" height="30"></canvas>
      </div>
      <div id="hud-elems">
        <div class="dia on" id="dia-wind">◆</div>
        <div class="dia" id="dia-flame">◆</div>
        <div id="burst" class="ty-panel"><canvas width="120" height="120"></canvas><div class="q">Q</div></div>
      </div>
      <div id="hud-boss" class="ty-panel ty-txt"><div class="name">RUIN WARDEN</div><canvas width="600" height="40"></canvas></div>
      <div id="hud-banner" class="ty-txt"></div>
      <div id="hud-msg"></div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1>WARDEN FELLED</h1>
        <div class="sub">THE VALLEY WIND SETTLES</div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — WALK AGAIN</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-quest { top: 24px; left: 50%; transform: translateX(-50%) skewX(-6deg);
        padding: 8px 22px; font-size: 14px; letter-spacing: 0.22em; color: ${C.paper}; }
      #hud-quest b { color: ${GALE}; }
      #hud-vitals { left: 26px; bottom: 24px; padding: 8px 12px; }
      #hud-vitals canvas { display: block; }
      #hud-vitals #hp { width: 180px; height: 20px; }
      #hud-vitals #stam { width: 180px; height: 15px; margin-top: 4px; }
      #hud-elems { position: absolute; right: 26px; bottom: 24px; display: flex;
        align-items: flex-end; gap: 12px; }
      #hud-elems .dia { font-size: 34px; color: #3a4268; text-shadow: 2px 2px 0 ${C.ink};
        transform: rotate(0deg); opacity: 0.5; }
      #hud-elems .dia.on { opacity: 1; }
      #dia-wind.on { color: ${GALE}; }
      #dia-flame.on { color: ${FLAME}; }
      #burst { position: relative; padding: 4px; }
      #burst canvas { width: 60px; height: 60px; display: block; }
      #burst .q { position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: center; font: italic 900 26px var(--ty-font); color: ${C.paper};
        text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-boss { top: 60px; left: 50%; transform: translateX(-50%) skewX(-6deg);
        padding: 8px 18px 12px; display: none; text-align: center; }
      #hud-boss .name { font-size: 15px; letter-spacing: 0.3em; color: ${C.paper}; margin-bottom: 5px; }
      #hud-boss canvas { width: 300px; height: 20px; display: block; }
      #hud-banner {
        position: absolute; left: 50%; top: 30%; transform: translateX(-50%) skewX(-6deg);
        font-size: 46px; font-weight: 900; font-style: italic; text-align: center;
        color: #fff; display: none; letter-spacing: 0.06em;
        padding: 12px 40px; border: 4px solid ${C.ink};
        background: rgba(28,36,80,0.85);
        text-shadow: 3px 3px 0 ${C.ink};
      }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(17,22,64,0.5); }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.4em; font-size: 12px; margin-bottom: 16px; }
      #hud-results .res-stats { font-size: 18px; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${GALE}; }
      #hud-results .again { margin-top: 20px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.questEl = root.querySelector("#hud-quest")!;
    this.stamCv = root.querySelector("#stam")!;
    this.hpCv = root.querySelector("#hp")!;
    this.stanceA = root.querySelector("#dia-wind")!;
    this.stanceB = root.querySelector("#dia-flame")!;
    this.burstCv = root.querySelector("#burst canvas")!;
    this.bossEl = root.querySelector("#hud-boss")!;
    this.bossCv = root.querySelector("#hud-boss canvas")!;
    this.bannerEl = root.querySelector("#hud-banner")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  banner(text: string, color: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.style.color = color;
    this.bannerEl.style.display = "block";
    this.bannerT = 1.3;
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
    if (this.bannerT > 0) {
      this.bannerT -= dtMs / 1000;
      if (this.bannerT <= 0) this.bannerEl.style.display = "none";
    }
  }

  update(game: Game): void {
    const p = game.player;
    this.questEl.innerHTML = `✦ <b>${QUESTS[game.quest] ?? "DONE"}</b>`;

    const hp = this.hpCv.getContext("2d")!;
    hp.clearRect(0, 0, this.hpCv.width, this.hpCv.height);
    drawCells(hp, {
      value: p.hp / 100, cells: 10,
      color: "#8fe07a", hotColor: "#ff5a5a", hot: p.hp < 30,
      trackColor: "rgba(255,255,255,0.10)",
    });
    const st = this.stamCv.getContext("2d")!;
    st.clearRect(0, 0, this.stamCv.width, this.stamCv.height);
    drawCells(st, {
      value: p.stamina / 100, cells: 14,
      color: css(PAL.extra.stamina), hotColor: css(PAL.extra.energy), hot: p.gliding || p.climbing,
      trackColor: "rgba(255,255,255,0.08)",
    });

    this.stanceA.classList.toggle("on", p.stance === 1);
    this.stanceB.classList.toggle("on", p.stance === 2);

    // burst energy ring
    const b = this.burstCv.getContext("2d")!;
    b.clearRect(0, 0, 120, 120);
    drawArcGauge(b, {
      value: p.energy / 100,
      color: p.energy >= 100 ? css(PAL.extra.energy) : "#8a94c8",
      hot: p.energy >= 100,
      hotColor: "#fff3c8",
      trackColor: "rgba(255,255,255,0.10)",
      tickColor: C.ink,
      ticks: 8,
    });

    // boss bar (two segments' worth of HP)
    const show = game.phase === "boss" && game.boss.state !== "dead";
    this.bossEl.style.display = show ? "block" : "none";
    if (show) {
      const bc = this.bossCv.getContext("2d")!;
      bc.clearRect(0, 0, 600, 40);
      drawCells(bc, {
        value: game.boss.hp / game.boss.maxHp, cells: 16,
        color: css(PAL.extra.core), hotColor: "#ffffff", hot: game.boss.coreOut,
        trackColor: "rgba(255,255,255,0.08)",
      });
    }
  }

  results(game: Game): void {
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `TIME <b>${fmtTime(game.time)}</b> · DAMAGE <b>${Math.round(game.damageDealt)}</b><br/>` +
      `CHESTS <b>${game.chests}</b> · BIGGEST SWIRL <b>${game.biggestSwirl}</b> · FALLS <b>${game.deaths}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
