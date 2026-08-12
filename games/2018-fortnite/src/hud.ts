/**
 * hud.ts — the toy HUD: chunky rounded ink panels in the house language.
 * Alive + kills, storm line, kill feed, mats counters (wood/brick/metal),
 * HP cells, weapon panel, the build bar with ghost-piece slots, crosshair,
 * chest prompt, VICTORY ROYALE banner and the stats card. ~30 Hz.
 */
import { injectHudStyles, MessageFlash, drawCells, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import { TILTED, FARM, HILL, ISLAND_R } from "./map";
import type { Game } from "./game";

const C = hudColors(PAL);
const PINK = css(PAL.accents.primary);

export class HUD {
  private flash: MessageFlash;
  private aliveEl: HTMLElement;
  private killsEl: HTMLElement;
  private stormEl: HTMLElement;
  private feedEl: HTMLElement;
  private matsEl: HTMLElement;
  private hpCv: HTMLCanvasElement;
  private weaponEl: HTMLElement;
  private buildBarEl: HTMLElement;
  private mapCv: HTMLCanvasElement;
  private crossEl: HTMLElement;
  private promptEl: HTMLElement;
  private bannerEl: HTMLElement;
  private resultsEl: HTMLElement;
  private feed: { text: string; mine: boolean; t: number }[] = [];
  private hitT = 0;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-alive" class="ty-panel ty-txt">ALIVE <b>12</b> · KILLS <b class="k">0</b></div>
      <div id="hud-storm" class="ty-txt"></div>
      <div id="hud-feed"></div>
      <div id="hud-mats" class="ty-panel ty-txt">
        <span class="mat wood">🪵 <b>0</b></span>
        <span class="mat brick">🧱 <b>0</b></span>
        <span class="mat metal">🔩 <b>0</b></span>
      </div>
      <div id="hud-vitals" class="ty-panel"><canvas width="360" height="44"></canvas></div>
      <div id="hud-weapon" class="ty-panel ty-txt"></div>
      <div id="hud-builds" class="ty-txt">
        <div class="slot" data-p="wall">WALL</div>
        <div class="slot" data-p="ramp">RAMP</div>
        <div class="slot" data-p="floor">FLOOR</div>
        <div class="slot" data-p="cone">CONE</div>
      </div>
      <div id="hud-map" class="ty-panel"><canvas width="200" height="200"></canvas></div>
      <div id="hud-cross"><div class="dot"></div></div>
      <div id="hud-prompt" class="ty-panel ty-txt"></div>
      <div id="hud-msg"></div>
      <div id="hud-banner" class="ty-txt">#1 VICTORY<br/>ROYALE</div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1 id="res-title">VICTORY ROYALE</h1>
        <div class="sub" id="res-sub">LAST ONE BUILDING</div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — DROP AGAIN</div>
      </div></div>
    `;

    const style = document.createElement("style");
    style.textContent = /* css */ `
      .ty-panel { border-radius: 14px; }
      #hud-alive { top: 22px; right: 26px; padding: 8px 18px; font-size: 18px; color: ${C.paper}; }
      #hud-alive b { color: ${PINK}; font-size: 24px; }
      #hud-storm { position: absolute; top: 66px; left: 50%; transform: translateX(-50%);
        font-size: 16px; letter-spacing: 0.14em; color: ${css(PAL.extra.storm)};
        text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-feed { position: absolute; top: 76px; right: 26px; text-align: right;
        font: italic 800 14px var(--ty-font); }
      #hud-feed div { color: #e8d0f0; text-shadow: 2px 2px 0 ${C.ink}; margin: 3px 0; }
      #hud-feed div.mine { color: ${PINK}; }
      #hud-mats { right: 26px; top: 70px; padding: 8px 16px; font-size: 16px; color: ${C.paper};
        display: flex; gap: 14px; }
      #hud-mats .mat b { font-size: 20px; }
      #hud-mats .wood b { color: ${css(PAL.extra.wood)}; }
      #hud-mats .brick b { color: ${css(PAL.extra.brick)}; }
      #hud-mats .metal b { color: ${css(PAL.extra.metal)}; }
      #hud-vitals { left: 26px; bottom: 24px; padding: 8px 12px; }
      #hud-vitals canvas { width: 180px; height: 22px; display: block; }
      #hud-weapon { right: 26px; bottom: 24px; padding: 10px 18px; text-align: right;
        font-size: 15px; color: ${C.paper}; display: none; }
      #hud-weapon .wname { color: ${PINK}; font-size: 17px; letter-spacing: 0.08em; }
      #hud-weapon .ammo { font-size: 25px; color: #fff; }
      #hud-weapon .ammo small { font-size: 13px; color: #e8d0f0; }
      #hud-builds { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
        display: none; gap: 10px; }
      #hud-builds .slot {
        padding: 10px 18px; font-size: 15px; color: ${C.paper};
        background: var(--ty-fill); border: 3px solid var(--ty-ink); border-radius: 12px;
        box-shadow: 4px 4px 0 color-mix(in srgb, var(--ty-ink-deep) 55%, transparent);
        transform: skewX(-6deg);
      }
      #hud-builds .slot.on { background: ${PINK}; color: ${C.ink}; }
      #hud-map { left: 26px; top: 22px; padding: 4px; border-radius: 14px; }
      #hud-map canvas { width: 100px; height: 100px; display: block; }
      #hud-cross { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); display: none; }
      #hud-cross .dot { width: 6px; height: 6px; background: #fff; border: 2px solid ${C.ink};
        transform: rotate(45deg); }
      #hud-cross.hit .dot { background: ${PINK}; transform: rotate(45deg) scale(1.8); }
      #hud-prompt { left: 50%; bottom: 96px; transform: translateX(-50%) skewX(-6deg);
        padding: 8px 22px; font-size: 15px; letter-spacing: 0.1em; color: ${C.paper}; display: none;
        border-radius: 12px; }
      #hud-prompt b { color: ${PINK}; }
      #hud-banner {
        position: absolute; left: 50%; top: 18%; transform: translateX(-50%) skewX(-6deg);
        font-size: 74px; font-weight: 900; font-style: italic; text-align: center;
        color: #ffd23f; line-height: 1.02; display: none;
        text-shadow: 4px 4px 0 ${PINK}, 9px 9px 0 ${C.ink};
        animation: ty-pulse 1.2s steps(2) infinite;
      }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(36,24,56,0.45); }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.4em; font-size: 12px; margin-bottom: 18px; }
      #hud-results .res-stats { font-size: 18px; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${PINK}; }
      #hud-results .again { margin-top: 22px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.aliveEl = root.querySelector("#hud-alive")!;
    this.killsEl = root.querySelector("#hud-alive .k")!;
    this.stormEl = root.querySelector("#hud-storm")!;
    this.feedEl = root.querySelector("#hud-feed")!;
    this.matsEl = root.querySelector("#hud-mats")!;
    this.hpCv = root.querySelector("#hud-vitals canvas")!;
    this.weaponEl = root.querySelector("#hud-weapon")!;
    this.buildBarEl = root.querySelector("#hud-builds")!;
    this.mapCv = root.querySelector("#hud-map canvas")!;
    this.crossEl = root.querySelector("#hud-cross")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.bannerEl = root.querySelector("#hud-banner")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  killFeed(text: string, mine: boolean): void {
    this.feed.unshift({ text, mine, t: 6 });
    if (this.feed.length > 5) this.feed.pop();
    this.renderFeed();
  }

  private renderFeed(): void {
    this.feedEl.innerHTML = this.feed.map((f) => `<div class="${f.mine ? "mine" : ""}">${f.text}</div>`).join("");
  }

  hitmark(kill: boolean): void {
    this.hitT = kill ? 0.5 : 0.25;
    this.crossEl.classList.add("hit");
  }

  banner(show: boolean): void {
    this.bannerEl.style.display = show ? "block" : "none";
  }

  prompt(html: string): void {
    this.promptEl.style.display = html ? "block" : "none";
    if (html) this.promptEl.innerHTML = html;
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
    if (this.hitT > 0) {
      this.hitT -= dtMs / 1000;
      if (this.hitT <= 0) this.crossEl.classList.remove("hit");
    }
    const before = this.feed.length;
    this.feed = this.feed.filter((f) => (f.t -= dtMs / 1000) > 0);
    if (this.feed.length !== before) this.renderFeed();
  }

  update(game: Game): void {
    const p = game.player;
    this.aliveEl.innerHTML = `ALIVE <b>${game.bots.length ? game.aliveCount() : 12}</b> · KILLS <b class="k">${game.kills}</b>`;
    this.matsEl.innerHTML =
      `<span class="mat wood">🪵 <b>${p.mats.wood}</b></span>` +
      `<span class="mat brick">🧱 <b>${p.mats.brick}</b></span>` +
      `<span class="mat metal">🔩 <b>${p.mats.metal}</b></span>`;

    if (game.phase === "ground" && game.stage > 0) {
      const inZone = Math.hypot(p.x - game.wall.cx, p.z - game.wall.cz) <= game.wall.r;
      this.stormEl.textContent = inZone ? `STORM ${game.stage} — EYE OF THE STORM` : "!! IN THE STORM — RUN !!";
      this.stormEl.style.color = inZone ? css(PAL.extra.storm) : "#ff8ac8";
    } else {
      this.stormEl.textContent = "";
    }

    const hp = this.hpCv.getContext("2d")!;
    hp.clearRect(0, 0, this.hpCv.width, this.hpCv.height);
    drawCells(hp, {
      value: p.hp / 100, cells: 10,
      color: "#7fe06a", hotColor: "#ff5a5a", hot: p.hp < 30,
      trackColor: "rgba(255,255,255,0.10)",
    });

    if (p.weapon && !game.buildMode) {
      this.weaponEl.style.display = "block";
      const name = (p.gold ? "GOLD " : "") + { pistol: "POPPER PISTOL", ar: "RATCHET AR", pump: "DOORKNOB PUMP" }[p.weapon];
      this.weaponEl.innerHTML = p.reloading > 0
        ? `<div class="wname">${name}</div><div class="ammo">RELOADING…</div>`
        : `<div class="wname">${name}</div><div class="ammo">${p.mag}<small> / ∞</small></div>`;
    } else {
      this.weaponEl.style.display = "none";
    }

    // build bar
    this.buildBarEl.style.display = game.buildMode ? "flex" : "none";
    if (game.buildMode) {
      for (const slot of this.buildBarEl.querySelectorAll(".slot")) {
        slot.classList.toggle("on", (slot as HTMLElement).dataset.p === game.buildMode);
      }
    }

    this.crossEl.style.display =
      game.phase === "ground" && !game.buildMode && p.weapon ? "block" : "none";

    this.drawMap(game);
  }

  private drawMap(game: Game): void {
    const c = this.mapCv.getContext("2d")!;
    const w = this.mapCv.width;
    const cx = w / 2;
    const k = (w / 2 - 8) / (ISLAND_R + 30);
    const X = (x: number) => cx + x * k;
    const Z = (z: number) => cx + z * k;
    c.clearRect(0, 0, w, w);
    c.fillStyle = "#dff0d8";
    c.fillRect(0, 0, w, w);
    c.fillStyle = "#8fd08a";
    c.beginPath();
    c.arc(cx, cx, ISLAND_R * k, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = C.ink;
    c.font = "italic 900 10px 'Segoe UI', Arial";
    c.textAlign = "center";
    for (const [p, n] of [[TILTED, "T"], [FARM, "F"], [HILL, "H"]] as const) {
      c.beginPath();
      c.arc(X(p.x), Z(p.z), 3, 0, Math.PI * 2);
      c.fill();
      c.fillText(n, X(p.x), Z(p.z) - 5);
    }
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(X(game.target.cx), Z(game.target.cz), game.target.r * k, 0, Math.PI * 2);
    c.stroke();
    if (game.stage > 0) {
      c.strokeStyle = css(PAL.extra.storm);
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(X(game.wall.cx), Z(game.wall.cz), game.wall.r * k, 0, Math.PI * 2);
      c.stroke();
    }
    const p = game.player;
    c.save();
    c.translate(X(p.x), Z(p.z));
    c.rotate(p.heading);
    c.fillStyle = PINK;
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4, 5);
    c.lineTo(-4, 5);
    c.closePath();
    c.fill();
    c.restore();
  }

  results(game: Game): void {
    (this.resultsEl.querySelector("#res-title") as HTMLElement).textContent = game.won
      ? "VICTORY ROYALE"
      : `#${game.placement} / 12`;
    (this.resultsEl.querySelector("#res-sub") as HTMLElement).textContent = game.won
      ? "#1 — LAST ONE BUILDING"
      : "THE STORM REMEMBERS";
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `KILLS <b>${game.kills}</b> · DAMAGE <b>${Math.round(game.damage)}</b><br/>` +
      `BUILDS PLACED <b>${game.buildsPlaced}</b> · MATS HARVESTED <b>${game.matsHarvested}</b><br/>` +
      `SURVIVED <b>${fmtTime(game.time)}</b> · PLACEMENT <b>#${game.placement}</b>`;
    this.resultsEl.style.display = "flex";
    this.banner(false);
  }
}
