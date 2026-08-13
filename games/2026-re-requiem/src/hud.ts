/**
 * hud.ts — the near-none horror HUD: an ECG corner (the blip slows as you
 * bleed), the ink-serif ammo count, item-get cards, the F-interact prompt,
 * keyhole door plates, the 6-slot inventory grid (mark herb + herb =
 * medkit), the examine beat's item name, the FLATLINE veil, and the
 * SURVIVED card with shots/accuracy/herbs/time.
 */
import { injectHudStyles, MessageFlash, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game, ItemKind } from "./game";

const C = hudColors(PAL);
const PAPER = css(PAL.accents.primary);
const GOLD = css(PAL.extra.key);

const ITEM_LABEL: Record<ItemKind, string> = {
  herb: "GREEN HERB",
  medkit: "MEDKIT",
  fuse: "FUSE",
  crank: "CRANK",
  liftkey: "ELEVATOR KEY",
};

export class HUD {
  private flash: MessageFlash;
  private rootEl: HTMLElement;
  private ecgBlip: HTMLElement;
  private ecgLabel: HTMLElement;
  private ammoEl: HTMLElement;
  private promptEl: HTMLElement;
  private cardEl: HTMLElement;
  private cardTitle: HTMLElement;
  private cardSub: HTMLElement;
  private invEl: HTMLElement;
  private invGrid: HTMLElement;
  private invHint: HTMLElement;
  private examineEl: HTMLElement;
  private examineName: HTMLElement;
  private fellEl: HTMLElement;
  private resultsEl: HTMLElement;
  private cardT = 0;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    this.rootEl = root;
    root.innerHTML = `
      <div id="hud-ecg"><svg viewBox="0 0 120 36" width="120" height="36">
        <path d="M0,18 L30,18 L38,18 L44,6 L52,30 L58,12 L64,18 L120,18"
          fill="none" stroke="#c8d4c8" stroke-width="2"/>
      </svg><div class="hr">♥</div></div>
      <div id="hud-ammo">12</div>
      <div id="hud-prompt"></div>
      <div id="hud-card"><div class="inner"><div class="title"></div><div class="sub"></div></div></div>
      <div id="hud-inv"><div class="frame">
        <div class="cap">INVENTORY</div>
        <div class="grid"></div>
        <div class="hint"></div>
      </div></div>
      <div id="hud-examine"><div class="name"></div><div class="sub">F — PUT IT BACK</div></div>
      <div id="hud-msg"></div>
      <div id="hud-fell"><span class="big">FLATLINE</span><span class="sub">the ward keeps you</span></div>
      <div id="hud-results"><div class="card">
        <h1>SURVIVED</h1>
        <div class="sub">ST. VERONICA'S · WARD A — THE DOORS SHUT ON ITS HAND</div>
        <div class="res-stats"></div>
        <div class="again">ENTER — ONCE MORE</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-ecg { position: absolute; left: 24px; bottom: 22px; display: none; align-items: center; gap: 8px; }
      #hud-ecg .hr { color: ${css(PAL.extra.hpRed)}; font-size: 18px; animation: ty-pulse 1s steps(2) infinite; }
      #hud-ammo { position: absolute; right: 28px; bottom: 20px; display: none;
        font: 34px Georgia, serif; color: ${PAPER}; letter-spacing: 0.1em;
        text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-prompt { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%);
        font: italic 17px Georgia, serif; color: ${PAPER}; letter-spacing: 0.15em;
        text-shadow: 2px 2px 0 ${C.ink}; display: none; white-space: nowrap; }
      #hud-card { position: absolute; left: 50%; top: 30%; transform: translateX(-50%);
        display: none; }
      #hud-card .inner { border: 2px solid #3a4a3a; background: rgba(5,6,10,0.88);
        box-shadow: 6px 6px 0 rgba(0,0,0,0.5); padding: 14px 30px; text-align: center; }
      #hud-card .title { font: 22px Georgia, serif; color: ${PAPER}; letter-spacing: 0.2em; }
      #hud-card .sub { font: italic 12px Georgia, serif; color: ${C.accent}; letter-spacing: 0.2em; margin-top: 5px; }
      #hud-inv { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
        background: rgba(5,6,10,0.72); }
      #hud-inv .frame { border: 3px solid #3a4a3a; background: rgba(8,10,12,0.96);
        box-shadow: 10px 10px 0 rgba(0,0,0,0.55); padding: 26px 34px; }
      #hud-inv .cap { font: italic 15px Georgia, serif; color: ${C.accent}; letter-spacing: 0.4em; margin-bottom: 14px; }
      #hud-inv .grid { display: grid; grid-template-columns: repeat(3, 150px); gap: 10px; }
      #hud-inv .slot { border: 2px solid #2c3630; background: rgba(16,20,18,0.9); height: 62px;
        display: flex; align-items: center; justify-content: center; text-align: center;
        font: 13px Georgia, serif; color: ${PAPER}; letter-spacing: 0.08em; padding: 4px; }
      #hud-inv .slot.cursor { border-color: ${GOLD}; box-shadow: 0 0 12px rgba(216,184,74,0.35); }
      #hud-inv .slot.marked { border-color: ${css(PAL.extra.herb)}; background: rgba(90,138,74,0.18); }
      #hud-inv .hint { margin-top: 14px; font: italic 13px Georgia, serif; color: ${C.paper};
        letter-spacing: 0.12em; text-align: center; }
      #hud-examine { position: absolute; left: 50%; bottom: 90px; transform: translateX(-50%);
        display: none; text-align: center; }
      #hud-examine .name { font: italic 22px Georgia, serif; color: ${GOLD}; letter-spacing: 0.25em; }
      #hud-examine .sub { font: 12px Georgia, serif; color: ${C.paper}; letter-spacing: 0.2em; margin-top: 6px; }
      #hud-fell { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
        flex-direction: column; opacity: 0; transition: opacity 1.6s ease-in, background 1.6s; }
      #hud-fell .big { font: 76px Georgia, serif; color: #b03030; letter-spacing: 0.14em;
        text-shadow: 0 0 34px rgba(0,0,0,0.9); }
      #hud-fell .sub { font: italic 15px Georgia, serif; color: ${C.paper}; letter-spacing: 0.4em; margin-top: 8px; }
      #hud-fell.on { display: flex; opacity: 1; background: rgba(4,4,6,0.6); }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(5,6,10,0.66); }
      #hud-results .card { border: 3px solid #3a4a3a; background: rgba(8,10,12,0.95);
        box-shadow: 10px 10px 0 rgba(0,0,0,0.55); padding: 36px 60px; text-align: center; }
      #hud-results h1 { font: 46px Georgia, serif; color: ${PAPER}; letter-spacing: 0.18em; margin: 0 0 6px; }
      #hud-results .sub { font: 11px Georgia, serif; color: ${C.accent}; letter-spacing: 0.3em; margin-bottom: 20px; }
      #hud-results .res-stats { font: 16px Georgia, serif; line-height: 2.1; color: ${C.paper}; }
      #hud-results .res-stats b { color: ${GOLD}; }
      #hud-results .again { margin-top: 24px; font: italic 14px Georgia, serif;
        letter-spacing: 0.25em; color: ${C.paper}; animation: ty-pulse 1.6s steps(2) infinite; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.ecgBlip = root.querySelector("#hud-ecg .hr")!;
    this.ecgLabel = root.querySelector("#hud-ecg svg")!;
    this.ammoEl = root.querySelector("#hud-ammo")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.cardEl = root.querySelector("#hud-card")!;
    this.cardTitle = root.querySelector("#hud-card .title")!;
    this.cardSub = root.querySelector("#hud-card .sub")!;
    this.invEl = root.querySelector("#hud-inv")!;
    this.invGrid = root.querySelector("#hud-inv .grid")!;
    this.invHint = root.querySelector("#hud-inv .hint")!;
    this.examineEl = root.querySelector("#hud-examine")!;
    this.examineName = root.querySelector("#hud-examine .name")!;
    this.fellEl = root.querySelector("#hud-fell")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
    if (this.cardT > 0) {
      this.cardT -= dtMs;
      if (this.cardT <= 0) this.cardEl.style.display = "none";
    }
  }

  /** the item-get / plate card */
  card(title: string, sub: string, ms = 2200): void {
    this.cardTitle.textContent = title;
    this.cardSub.textContent = sub;
    this.cardEl.style.display = "block";
    this.cardT = ms;
  }

  fell(on: boolean): void {
    this.fellEl.classList.toggle("on", on);
  }

  examine(kind: ItemKind | null): void {
    this.examineEl.style.display = kind ? "block" : "none";
    if (kind) this.examineName.textContent = ITEM_LABEL[kind];
  }

  update(game: Game, invOpen: boolean, cursor: number): void {
    const p = game.player;
    const show = game.phase === "play" || game.phase === "finale";
    (this.rootEl.querySelector("#hud-ecg") as HTMLElement).style.display = show ? "flex" : "none";
    this.ammoEl.style.display = show ? "block" : "none";
    this.ammoEl.textContent = String(p.ammo);
    // the ECG blip slows as you bleed
    this.ecgBlip.style.animationDuration = `${0.5 + (p.hp / p.maxHp) * 1.1}s`;
    this.ecgLabel.style.opacity = String(0.4 + (p.hp / p.maxHp) * 0.6);

    this.promptEl.style.display = game.prompt && !invOpen ? "block" : "none";
    if (game.prompt) this.promptEl.textContent = game.prompt;

    this.invEl.style.display = invOpen ? "flex" : "none";
    if (invOpen) {
      this.invGrid.innerHTML = game.slots
        .map((s, i) => {
          const cls = ["slot", i === cursor ? "cursor" : "", i === game.marked ? "marked" : ""].join(" ");
          return `<div class="${cls}">${s ? ITEM_LABEL[s] : "—"}</div>`;
        })
        .join("");
      this.invHint.textContent = game.marked !== null
        ? "F — COMBINE WITH THE MARKED HERB"
        : "ARROWS — CURSOR · F — USE / MARK / EXAMINE · TAB — CLOSE";
    }
  }

  results(game: Game): void {
    const acc = game.shotsFired > 0 ? Math.round((game.hits / game.shotsFired) * 100) : 0;
    const herbsLeft = game.slots.filter((s) => s === "herb" || s === "medkit").length;
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `SHOTS FIRED <b>${game.shotsFired}</b> · ACCURACY <b>${acc}%</b><br/>` +
      `HERBS LEFT <b>${herbsLeft}</b> · DEATHS <b>${game.deaths}</b><br/>` +
      `TIME <b>${fmtTime(game.time)}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
