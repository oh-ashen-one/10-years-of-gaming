/**
 * hud.ts — the battleground HUD in the house language: compass strip,
 * kill feed, alive counter, minimap with the white/blue circles, HP +
 * armor pips, weapon panel, crosshair with hit flash, zone warnings, the
 * WINNER WINNER CHICKEN DINNER banner and the stats card. Canvas
 * instruments over strings, palette hexes only, ~30 Hz.
 */
import { injectHudStyles, MessageFlash, drawCells, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import { COMPOUNDS, ISLAND_R } from "./island";
import type { Game } from "./game";

const C = hudColors(PAL);
const ORANGE = css(PAL.accents.primary);

export class HUD {
  private flash: MessageFlash;
  private compassCv: HTMLCanvasElement;
  private feedEl: HTMLElement;
  private aliveEl: HTMLElement;
  private zoneEl: HTMLElement;
  private hpCv: HTMLCanvasElement;
  private armorEl: HTMLElement;
  private weaponEl: HTMLElement;
  private mapCv: HTMLCanvasElement;
  private bigMapEl: HTMLElement;
  private bigMapCv: HTMLCanvasElement;
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
      <div id="hud-compass" class="ty-panel"><canvas width="760" height="56"></canvas></div>
      <div id="hud-alive" class="ty-panel ty-txt">ALIVE <b>16</b></div>
      <div id="hud-zone" class="ty-txt"></div>
      <div id="hud-feed"></div>
      <div id="hud-vitals" class="ty-panel">
        <canvas width="360" height="44"></canvas>
        <div class="armor ty-txt"></div>
      </div>
      <div id="hud-weapon" class="ty-panel ty-txt"></div>
      <div id="hud-map" class="ty-panel"><canvas width="220" height="220"></canvas></div>
      <div id="hud-bigmap"><canvas width="640" height="640"></canvas></div>
      <div id="hud-cross"><div class="dot"></div></div>
      <div id="hud-prompt" class="ty-panel ty-txt"></div>
      <div id="hud-msg"></div>
      <div id="hud-banner" class="ty-txt">WINNER WINNER<br/>CHICKEN DINNER</div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1 id="res-title">CHICKEN DINNER</h1>
        <div class="sub" id="res-sub">LAST ONE STANDING</div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — DROP AGAIN</div>
      </div></div>
    `;

    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-compass { top: 18px; left: 50%; transform: translateX(-50%) skewX(-6deg); padding: 2px 10px; }
      #hud-compass canvas { width: 380px; height: 28px; display: block; }
      #hud-alive { top: 22px; right: 26px; padding: 8px 18px; font-size: 20px; color: ${C.paper}; }
      #hud-alive b { color: ${ORANGE}; font-size: 26px; }
      #hud-zone { position: absolute; top: 62px; left: 50%; transform: translateX(-50%);
        font-size: 16px; letter-spacing: 0.14em; color: ${css(PAL.extra.zoneBlue)};
        text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-feed { position: absolute; top: 70px; right: 26px; text-align: right;
        font: italic 800 14px var(--ty-font); letter-spacing: 0.04em; }
      #hud-feed div { color: #cfc4e8; text-shadow: 2px 2px 0 ${C.ink}; margin: 3px 0; }
      #hud-feed div.mine { color: ${ORANGE}; }
      #hud-vitals { left: 26px; bottom: 24px; padding: 8px 12px; }
      #hud-vitals canvas { width: 180px; height: 22px; display: block; }
      #hud-vitals .armor { font-size: 12px; letter-spacing: 0.14em; color: ${css(PAL.extra.armor)};
        margin-top: 4px; }
      #hud-weapon { right: 26px; bottom: 24px; padding: 10px 18px; text-align: right;
        font-size: 15px; color: ${C.paper}; display: none; }
      #hud-weapon .wname { color: ${ORANGE}; font-size: 18px; letter-spacing: 0.08em; }
      #hud-weapon .ammo { font-size: 26px; color: #fff; }
      #hud-weapon .ammo small { font-size: 13px; color: #cfc4e8; }
      #hud-map { left: 26px; top: 22px; padding: 4px; }
      #hud-map canvas { width: 110px; height: 110px; display: block; }
      #hud-bigmap { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(26,22,46,0.6); }
      #hud-bigmap canvas { width: 480px; height: 480px; border: 4px solid ${C.ink};
        box-shadow: 10px 10px 0 rgba(26,22,46,0.5); }
      #hud-cross { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
        display: none; }
      #hud-cross .dot { width: 6px; height: 6px; background: #fff; border: 2px solid ${C.ink};
        transform: rotate(45deg); }
      #hud-cross.hit .dot { background: ${ORANGE}; transform: rotate(45deg) scale(1.8); }
      #hud-prompt { left: 50%; bottom: 96px; transform: translateX(-50%) skewX(-6deg);
        padding: 8px 22px; font-size: 15px; letter-spacing: 0.1em; color: ${C.paper}; display: none; }
      #hud-prompt b { color: ${ORANGE}; }
      #hud-banner {
        position: absolute; left: 50%; top: 20%; transform: translateX(-50%) skewX(-6deg);
        font-size: 64px; font-weight: 900; font-style: italic; text-align: center;
        color: #ffe9c0; line-height: 1.05; display: none;
        text-shadow: 4px 4px 0 ${ORANGE}, 9px 9px 0 ${C.ink};
        animation: ty-pulse 1.2s steps(2) infinite;
      }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(26,22,46,0.45); }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.4em; font-size: 12px; margin-bottom: 18px; }
      #hud-results .res-stats { font-size: 18px; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${ORANGE}; }
      #hud-results .again { margin-top: 22px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.compassCv = root.querySelector("#hud-compass canvas")!;
    this.feedEl = root.querySelector("#hud-feed")!;
    this.aliveEl = root.querySelector("#hud-alive")!;
    this.zoneEl = root.querySelector("#hud-zone")!;
    this.hpCv = root.querySelector("#hud-vitals canvas")!;
    this.armorEl = root.querySelector("#hud-vitals .armor")!;
    this.weaponEl = root.querySelector("#hud-weapon")!;
    this.mapCv = root.querySelector("#hud-map canvas")!;
    this.bigMapEl = root.querySelector("#hud-bigmap")!;
    this.bigMapCv = root.querySelector("#hud-bigmap canvas")!;
    this.crossEl = root.querySelector("#hud-cross")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.bannerEl = root.querySelector("#hud-banner")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  /* ------------------------------------------------------------- pieces -- */

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  killFeed(text: string, mine: boolean): void {
    this.feed.unshift({ text, mine, t: 6 });
    if (this.feed.length > 5) this.feed.pop();
    this.renderFeed();
  }

  private renderFeed(): void {
    this.feedEl.innerHTML = this.feed
      .map((f) => `<div class="${f.mine ? "mine" : ""}">${f.text}</div>`)
      .join("");
  }

  hitmark(kill: boolean): void {
    this.hitT = kill ? 0.5 : 0.25;
    this.crossEl.classList.add("hit");
  }

  /** Offset the crosshair by the aim nudge (radians → pixels). */
  setCross(nx: number, ny: number): void {
    this.crossEl.style.transform = `translate(calc(-50% + ${(-nx * 900).toFixed(0)}px), calc(-50% + ${(ny * 900).toFixed(0)}px))`;
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
    let dirty = false;
    for (const f of this.feed) {
      f.t -= dtMs / 1000;
      if (f.t <= 0) dirty = true;
    }
    const before = this.feed.length;
    this.feed = this.feed.filter((f) => f.t > 0);
    if (dirty || this.feed.length !== before) this.renderFeed();
  }

  /* ------------------------------------------------------------ update -- */

  update(game: Game, bigMap: boolean, camYaw: number): void {
    const p = game.player;
    this.aliveEl.innerHTML = `ALIVE <b>${game.bots.length ? game.aliveCount() : 16}</b>`;

    // zone line
    if (game.phase === "ground") {
      const inZone =
        Math.hypot(p.x - game.wall.cx, p.z - game.wall.cz) <= game.wall.r;
      this.zoneEl.textContent = game.stage === 0
        ? ""
        : inZone
          ? `ZONE ${game.stage} — STAY IN THE WHITE CIRCLE`
          : "!! OUTSIDE THE ZONE — RUN !!";
      this.zoneEl.style.color = inZone ? css(PAL.extra.zoneBlue) : css(PAL.extra.blood);
    } else {
      this.zoneEl.textContent = "";
    }

    // vitals
    const hp = this.hpCv.getContext("2d")!;
    hp.clearRect(0, 0, this.hpCv.width, this.hpCv.height);
    drawCells(hp, {
      value: p.hp / 100, cells: 10,
      color: "#f0ece0", hotColor: css(PAL.extra.blood), hot: p.hp < 30,
      trackColor: "rgba(255,255,255,0.10)",
    });
    this.armorEl.textContent = p.armor ? "■ ARMOR VEST" : "□ no armor";

    // weapon panel
    if (p.weapon) {
      this.weaponEl.style.display = "block";
      const wdef = game.player.weapon ? weaponName(game) : "";
      this.weaponEl.innerHTML = p.reloading > 0
        ? `<div class="wname">${wdef}</div><div class="ammo">RELOADING…</div>`
        : `<div class="wname">${wdef}</div><div class="ammo">${p.mag}<small> / ∞</small></div>`;
    } else {
      this.weaponEl.style.display = "none";
    }

    this.crossEl.style.display = game.phase === "ground" && !p.inBuggy && p.weapon ? "block" : "none";

    // compass
    this.drawCompass(camYaw);

    // maps
    this.drawMap(this.mapCv, game, 1);
    this.bigMapEl.style.display = bigMap ? "flex" : "none";
    if (bigMap) this.drawMap(this.bigMapCv, game, 2.6);
  }

  private drawCompass(yaw: number): void {
    const c = this.compassCv.getContext("2d")!;
    const w = this.compassCv.width;
    const h = this.compassCv.height;
    c.clearRect(0, 0, w, h);
    c.font = "italic 900 22px 'Segoe UI', Arial";
    c.textAlign = "center";
    const heading = ((yaw * 180) / Math.PI + 360) % 360;
    for (let deg = -60; deg <= 60; deg += 5) {
      const d = (heading + deg + 360) % 360;
      const x = w / 2 + deg * (w / 130);
      const major = d % 45 < 5 || d % 45 > 40;
      c.fillStyle = major ? ORANGE : "rgba(240,236,224,0.5)";
      c.fillRect(x - 1, h - (major ? 22 : 14), 2, major ? 22 : 14);
      if (d % 90 === 0) {
        const label = ["N", "E", "S", "W"][Math.round(d / 90) % 4];
        c.fillStyle = "#ffe9c0";
        c.fillText(label, x, 20);
      }
    }
  }

  private drawMap(cv: HTMLCanvasElement, game: Game, scale: number): void {
    const c = cv.getContext("2d")!;
    const w = cv.width;
    const cx = w / 2;
    const k = (w / 2 - 8 * scale) / (ISLAND_R + 40);
    const X = (x: number) => cx + x * k;
    const Z = (z: number) => cx + z * k;
    c.clearRect(0, 0, w, w);
    // paper + island
    c.fillStyle = css(PAL.extra.mapPaper);
    c.fillRect(0, 0, w, w);
    c.fillStyle = "#9ab06a";
    c.beginPath();
    c.arc(cx, cx, ISLAND_R * k, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e0c878";
    c.fillRect(X(45), Z(5), 150 * k, 110 * k);
    // compounds
    c.fillStyle = C.ink;
    c.font = `italic 900 ${Math.round(11 * scale)}px 'Segoe UI', Arial`;
    c.textAlign = "center";
    for (const cp of COMPOUNDS) {
      c.beginPath();
      c.arc(X(cp.x), Z(cp.z), 3 * scale, 0, Math.PI * 2);
      c.fill();
      if (scale > 2) c.fillText(cp.name, X(cp.x), Z(cp.z) - 6 * scale);
    }
    // white next circle + blue wall
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2 * scale;
    c.beginPath();
    c.arc(X(game.target.cx), Z(game.target.cz), game.target.r * k, 0, Math.PI * 2);
    c.stroke();
    if (game.stage > 0) {
      c.strokeStyle = css(PAL.extra.zoneBlue);
      c.lineWidth = 2.5 * scale;
      c.beginPath();
      c.arc(X(game.wall.cx), Z(game.wall.cz), game.wall.r * k, 0, Math.PI * 2);
      c.stroke();
    }
    // buggy + player
    c.fillStyle = css(PAL.extra.buggy);
    c.fillRect(X(game.buggy.x) - 3 * scale, Z(game.buggy.z) - 3 * scale, 6 * scale, 6 * scale);
    const p = game.player;
    c.save();
    c.translate(X(p.x), Z(p.z));
    c.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)));
    c.fillStyle = ORANGE;
    c.beginPath();
    c.moveTo(0, -6 * scale);
    c.lineTo(4 * scale, 5 * scale);
    c.lineTo(-4 * scale, 5 * scale);
    c.closePath();
    c.fill();
    c.restore();
  }

  results(game: Game): void {
    (this.resultsEl.querySelector("#res-title") as HTMLElement).textContent = game.won
      ? "CHICKEN DINNER"
      : `#${game.placement} / 16`;
    (this.resultsEl.querySelector("#res-sub") as HTMLElement).textContent = game.won
      ? "WINNER WINNER — LAST ONE STANDING"
      : "THE ISLAND CLAIMS ANOTHER";
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `KILLS <b>${game.kills}</b> · DAMAGE <b>${Math.round(game.damage)}</b><br/>` +
      `SURVIVED <b>${fmtTime(game.time)}</b> · PLACEMENT <b>#${game.placement}</b>`;
    this.resultsEl.style.display = "flex";
    this.banner(false);
  }
}

function weaponName(game: Game): string {
  const w = game.player.weapon;
  if (!w) return "";
  return { rifle: "DUSTER RIFLE", smg: "WASP SMG", shotgun: "GATEKEEPER" }[w];
}
