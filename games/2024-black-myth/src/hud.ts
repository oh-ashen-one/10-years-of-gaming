/**
 * hud.ts — the near-invisible Wukong HUD: one thin HP brushstroke, the
 * gourd pip row (4 sips), three focus beads, the stance seal char (崩/戳),
 * the immobilize 封 glyph that dims on cooldown, the combo count when it
 * climbs, the boss plate (brush calligraphy 虎僧 + bar), the YOU FALL veil,
 * YAOGUAI FELLED, and the results card. Everything else is banned (art lock).
 */
import { injectHudStyles, MessageFlash, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game } from "./game";

const C = hudColors(PAL);
const GOLD = css(PAL.accents.primary);
const RED = css(PAL.extra.sash);

export class HUD {
  private flash: MessageFlash;
  private hpBar: HTMLElement;
  private gourdEl: HTMLElement;
  private beadsEl: HTMLElement;
  private stanceEl: HTMLElement;
  private sealEl: HTMLElement;
  private comboEl: HTMLElement;
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
      <div id="hud-vitals">
        <div class="bar hp"><div class="fill"></div></div>
        <div id="hud-gourd"></div>
        <div id="hud-beads"></div>
      </div>
      <div id="hud-stance">崩</div>
      <div id="hud-seal">封</div>
      <div id="hud-combo"></div>
      <div id="hud-boss">
        <div class="plate"><span class="hanzi">虎僧</span><span class="latin">THE TIGER ABBOT</span></div>
        <div class="bar"><div class="fill"></div></div>
      </div>
      <div id="hud-lock"></div>
      <div id="hud-msg"></div>
      <div id="hud-died"><span class="hanzi">命</span><span class="fall">YOU FALL</span></div>
      <div id="hud-felled">YAOGUAI FELLED<span class="hanzi"> — 虎僧 —</span></div>
      <div id="hud-results"><div class="card">
        <h1>YAOGUAI FELLED</h1>
        <div class="sub">虎僧 · THE TIGER ABBOT KNEELS</div>
        <div class="res-stats"></div>
        <div class="again">ENTER — WALK AGAIN</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-vitals { position: absolute; left: 26px; top: 24px; }
      .bar.hp { width: 240px; height: 8px; background: rgba(14,11,8,0.7);
        border: 1.5px solid ${C.ink}; box-shadow: 2px 2px 0 rgba(14,11,8,0.5); }
      .bar.hp .fill { height: 100%; background: ${css(PAL.extra.hpRed)}; width: 100%; transition: width 0.12s; }
      #hud-gourd { margin-top: 7px; font-size: 15px; letter-spacing: 0.35em; color: ${GOLD}; }
      #hud-beads { margin-top: 5px; display: flex; gap: 7px; }
      #hud-beads .bead { width: 13px; height: 13px; border-radius: 50%;
        border: 1.5px solid ${GOLD}; background: transparent; }
      #hud-beads .bead.full { background: ${GOLD}; box-shadow: 0 0 8px rgba(232,200,106,0.6); }
      #hud-beads .bead.part { background: linear-gradient(90deg, ${GOLD} var(--p), transparent var(--p)); }
      #hud-stance { position: absolute; left: 26px; top: 96px; width: 34px; height: 34px;
        border: 2px solid ${RED}; color: ${RED}; font: 20px Georgia, serif;
        display: flex; align-items: center; justify-content: center;
        background: rgba(14,11,8,0.6); }
      #hud-seal { position: absolute; left: 26px; top: 138px; width: 34px; height: 34px;
        border: 2px solid ${GOLD}; color: ${GOLD}; font: 20px Georgia, serif;
        display: flex; align-items: center; justify-content: center;
        background: rgba(14,11,8,0.6); transition: opacity 0.2s; }
      #hud-combo { position: absolute; right: 30px; top: 34%; font: italic 900 30px Georgia, serif;
        color: ${GOLD}; text-shadow: 2px 2px 0 ${C.ink}; letter-spacing: 0.1em; display: none; }
      #hud-boss { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%);
        width: 560px; display: none; text-align: center; }
      #hud-boss .plate { margin-bottom: 6px; }
      #hud-boss .hanzi { font: 34px Georgia, serif; color: ${css(PAL.extra.paper)};
        text-shadow: 2px 2px 0 ${C.ink}; margin-right: 14px; }
      #hud-boss .latin { font: italic 13px Georgia, serif; color: ${C.accent}; letter-spacing: 0.4em; }
      #hud-boss .bar { width: 560px; height: 10px; background: rgba(14,11,8,0.7);
        border: 2px solid #3a3226; }
      #hud-boss .fill { height: 100%; background: ${css(PAL.extra.hpRed)}; width: 100%; transition: width 0.15s; }
      #hud-lock { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px;
        border: 2px solid ${GOLD}; transform: translate(-50%,-50%) rotate(45deg); display: none; }
      #hud-died { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
        flex-direction: column; background: rgba(8,6,4,0.0);
        opacity: 0; transition: opacity 2.0s ease-in, background 2.0s; }
      #hud-died .hanzi { font: 120px Georgia, serif; color: #a02828; text-shadow: 0 0 40px rgba(0,0,0,0.9); }
      #hud-died .fall { font: italic 22px Georgia, serif; color: ${css(PAL.extra.paper)}; letter-spacing: 0.5em; margin-top: 6px; }
      #hud-died.on { display: flex; opacity: 1; background: rgba(8,6,4,0.55); }
      #hud-felled { position: absolute; left: 50%; top: 33%; transform: translateX(-50%);
        font: italic 52px Georgia, serif; color: ${GOLD}; letter-spacing: 0.14em;
        text-shadow: 3px 3px 0 ${C.ink}, 0 0 44px rgba(232,200,106,0.45);
        display: none; white-space: nowrap; }
      #hud-felled .hanzi { font-style: normal; }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(14,11,8,0.6); }
      #hud-results .card { border: 3px solid #8a6a2a; background: rgba(18,14,10,0.94);
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
    this.gourdEl = root.querySelector("#hud-gourd")!;
    this.beadsEl = root.querySelector("#hud-beads")!;
    this.stanceEl = root.querySelector("#hud-stance")!;
    this.sealEl = root.querySelector("#hud-seal")!;
    this.comboEl = root.querySelector("#hud-combo")!;
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
    // near-invisible on the poster: nothing but the scene
    const show = game.phase !== "title";
    this.hpBar.parentElement!.parentElement!.style.display = show ? "block" : "none";
    this.stanceEl.style.display = show ? "flex" : "none";
    this.sealEl.style.display = show ? "flex" : "none";
    if (!show) return;
    this.hpBar.style.width = `${Math.max(0, (p.hp / 100) * 100)}%`;
    this.gourdEl.textContent = "◈".repeat(p.gourd) + "·".repeat(Math.max(0, 4 - p.gourd));
    // focus beads: full / partial / empty
    const beads: string[] = [];
    for (let i = 0; i < 3; i++) {
      const fill = Math.min(1, Math.max(0, p.focus - i));
      if (fill >= 1) beads.push('<div class="bead full"></div>');
      else if (fill > 0.02) beads.push(`<div class="bead part" style="--p:${Math.round(fill * 100)}%"></div>`);
      else beads.push('<div class="bead"></div>');
    }
    this.beadsEl.innerHTML = beads.join("");
    this.stanceEl.textContent = p.stance === "smash" ? "崩" : "戳";
    this.stanceEl.style.borderColor = p.stance === "smash" ? RED : GOLD;
    this.stanceEl.style.color = p.stance === "smash" ? RED : GOLD;
    this.sealEl.style.opacity = game.immobilizeCD > 0 ? "0.25" : "1";
    this.comboEl.style.display = game.combo >= 3 ? "block" : "none";
    if (game.combo >= 3) this.comboEl.textContent = `連 ×${game.combo}`;
    this.lockEl.style.display = game.lockTarget ? "block" : "none";

    const bossUp = game.phase === "boss" && game.boss.hp > 0;
    this.bossEl.style.display = bossUp ? "block" : "none";
    if (bossUp) this.bossBar.style.width = `${(game.boss.hp / game.boss.maxHp) * 100}%`;
  }

  results(game: Game): void {
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `DEATHS <b>${game.deaths}</b> · TIME <b>${fmtTime(game.time)}</b><br/>` +
      `PERFECT DODGES <b>${game.perfectDodges}</b> · LONGEST COMBO <b>連${game.longestCombo}</b><br/>` +
      `HITS TAKEN <b>${game.hitsTaken}</b> · GOURD LEFT <b>${game.player.gourd}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
