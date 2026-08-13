/**
 * hud.ts — the minimal souls HUD: one ink-edged HP/stamina bar pair,
 * flask pips, shard counter, boss bar with a serif nameplate, the YOU
 * DIED veil (ink serif, slow fade), GREAT ENEMY FELLED, and the results
 * card. Everything else is banned from the screen (art lock).
 */
import { injectHudStyles, MessageFlash, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game } from "./game";

const C = hudColors(PAL);
const GOLD = css(PAL.accents.primary);

export class HUD {
  private flash: MessageFlash;
  private hpBar: HTMLElement;
  private stamBar: HTMLElement;
  private flasksEl: HTMLElement;
  private shardsEl: HTMLElement;
  private bossEl: HTMLElement;
  private bossBar: HTMLElement;
  private diedEl: HTMLElement;
  private felledEl: HTMLElement;
  private resultsEl: HTMLElement;
  private lockEl: HTMLElement;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-bars">
        <div class="bar hp"><div class="fill"></div></div>
        <div class="bar stam"><div class="fill"></div></div>
        <div id="hud-flasks"></div>
        <div id="hud-shards"></div>
      </div>
      <div id="hud-boss"><div class="name">THE BRIDGE WARDEN</div><div class="bar"><div class="fill"></div></div></div>
      <div id="hud-lock"></div>
      <div id="hud-msg"></div>
      <div id="hud-died">YOU DIED</div>
      <div id="hud-felled">GREAT ENEMY FELLED</div>
      <div id="hud-results"><div class="card">
        <h1>GREAT ENEMY FELLED</h1>
        <div class="sub">THE BRIDGE IS YOURS, TARNISHED</div>
        <div class="res-stats"></div>
        <div class="again">ENTER — RIDE AGAIN</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-bars { position: absolute; left: 26px; top: 24px; }
      .bar { height: 12px; background: rgba(10,13,12,0.75); border: 2px solid ${C.ink};
        box-shadow: 3px 3px 0 rgba(10,13,12,0.5); margin-bottom: 7px; }
      .bar .fill { height: 100%; transition: width 0.12s; }
      .bar.hp { width: 260px; }
      .bar.hp .fill { background: ${css(PAL.extra.hpRed)}; width: 100%; }
      .bar.stam { width: 220px; height: 9px; }
      .bar.stam .fill { background: ${css(PAL.extra.stamGreen)}; width: 100%; }
      #hud-flasks { font: 16px Georgia, serif; letter-spacing: 0.3em; color: ${GOLD}; }
      #hud-shards { font: italic 14px Georgia, serif; color: ${C.paper}; margin-top: 4px; letter-spacing: 0.1em; }
      #hud-boss { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%);
        width: 520px; display: none; }
      #hud-boss .name { font: italic 20px Georgia, serif; color: ${C.paper};
        letter-spacing: 0.24em; margin-bottom: 6px; text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-boss .bar { width: 520px; border-color: #3a3630; }
      #hud-boss .fill { background: #b03a3a; width: 100%; }
      #hud-lock { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px;
        border: 2px solid ${GOLD}; transform: translate(-50%,-50%) rotate(45deg); display: none; }
      #hud-died {
        position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
        font: 84px Georgia, serif; color: #a02828; letter-spacing: 0.12em;
        background: rgba(5,5,5,0.0); text-shadow: 0 0 30px rgba(0,0,0,0.8);
        opacity: 0; transition: opacity 2.2s ease-in, background 2.2s;
      }
      #hud-died.on { display: flex; opacity: 1; background: rgba(5,5,5,0.55); }
      #hud-felled {
        position: absolute; left: 50%; top: 34%; transform: translateX(-50%);
        font: italic 54px Georgia, serif; color: ${GOLD}; letter-spacing: 0.14em;
        text-shadow: 3px 3px 0 ${C.ink}, 0 0 40px rgba(232,200,106,0.4);
        display: none; text-align: center; white-space: nowrap;
      }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(10,13,12,0.6); }
      #hud-results .card { border: 3px solid #8a6a2a; background: rgba(14,18,16,0.92);
        box-shadow: 10px 10px 0 rgba(0,0,0,0.5); padding: 36px 60px; text-align: center; }
      #hud-results h1 { font: italic 40px Georgia, serif; color: ${GOLD}; margin: 0 0 6px; }
      #hud-results .sub { font: 13px Georgia, serif; color: ${C.accent}; letter-spacing: 0.4em; margin-bottom: 20px; }
      #hud-results .res-stats { font: 17px Georgia, serif; line-height: 2.1; color: ${C.paper}; }
      #hud-results .res-stats b { color: ${GOLD}; }
      #hud-results .again { margin-top: 24px; font: italic 14px Georgia, serif;
        letter-spacing: 0.25em; color: ${C.paper}; animation: ty-pulse 1.6s steps(2) infinite; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.hpBar = root.querySelector(".bar.hp .fill")!;
    this.stamBar = root.querySelector(".bar.stam .fill")!;
    this.flasksEl = root.querySelector("#hud-flasks")!;
    this.shardsEl = root.querySelector("#hud-shards")!;
    this.bossEl = root.querySelector("#hud-boss")!;
    this.bossBar = root.querySelector("#hud-boss .fill")!;
    this.diedEl = root.querySelector("#hud-died")!;
    this.felledEl = root.querySelector("#hud-felled")!;
    this.resultsEl = root.querySelector("#hud-results")!;
    this.lockEl = root.querySelector("#hud-lock")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
  }

  youDied(on: boolean): void {
    this.diedEl.classList.toggle("on", on);
  }

  felled(show: boolean): void {
    this.felledEl.style.display = show ? "block" : "none";
  }

  update(game: Game): void {
    const p = game.player;
    this.hpBar.style.width = `${Math.max(0, (p.hp / 100) * 100)}%`;
    this.stamBar.style.width = `${Math.max(0, (p.stamina / 100) * 100)}%`;
    this.flasksEl.textContent = "✦".repeat(p.flasks) + "·".repeat(Math.max(0, p.flaskMax - p.flasks));
    this.shardsEl.textContent = `◈ ${p.shards} shards`;
    this.lockEl.style.display = game.lockTarget ? "block" : "none";

    const bossUp = game.phase === "boss" && game.boss.hp > 0;
    this.bossEl.style.display = bossUp ? "block" : "none";
    if (bossUp) {
      this.bossBar.style.width = `${(game.boss.hp / game.boss.maxHp) * 100}%`;
    }
  }

  results(game: Game): void {
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `DEATHS <b>${game.deaths}</b> · TIME <b>${fmtTime(game.time)}</b><br/>` +
      `HITS TAKEN <b>${game.hitsTaken}</b> · FLASKS LEFT <b>${game.player.flasks}</b><br/>` +
      `SHARDS <b>${game.player.shards}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
