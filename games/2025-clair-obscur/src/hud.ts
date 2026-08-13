/**
 * hud.ts — the ornate ink-gold HUD: the HP plate, AP pips as paint daubs,
 * the battle menu card (1–3 + Q), the overpaint gauge, the enemy-turn
 * prompt with its key calligraphed, the parry flash ring, the free-aim bar
 * (the dot sways — fire when it crosses the gold), the mime's gradient
 * shield pips, the Marionette's plate, the EXPEDITION FALLS veil, FOR
 * THOSE WHO COME AFTER, and the results card.
 */
import { injectHudStyles, MessageFlash, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game } from "./game";

const C = hudColors(PAL);
const GOLD = css(PAL.accents.primary);
const ROSE = css(PAL.extra.rose);

export class HUD {
  private flash: MessageFlash;
  private vitalsEl: HTMLElement;
  private hpBar: HTMLElement;
  private apEl: HTMLElement;
  private menuEl: HTMLElement;
  private meterFill: HTMLElement;
  private meterEl: HTMLElement;
  private promptEl: HTMLElement;
  private aimEl: HTMLElement;
  private aimDot: HTMLElement;
  private ringEl: HTMLElement;
  private foeEl: HTMLElement;
  private foeName: HTMLElement;
  private foeBar: HTMLElement;
  private foePips: HTMLElement;
  private pictosEl: HTMLElement;
  private fellEl: HTMLElement;
  private cardEl: HTMLElement;
  private resultsEl: HTMLElement;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-vitals">
        <div class="plate">
          <div class="bar hp"><div class="fill"></div></div>
          <div id="hud-ap"></div>
          <div id="hud-meter"><div class="label">OVERPAINT</div><div class="gauge"><div class="fill"></div></div></div>
        </div>
        <div id="hud-pictos"></div>
      </div>
      <div id="hud-menu" class="plate">
        <div class="mi"><span class="k">1</span> STRIKE <span class="cost">●</span></div>
        <div class="mi"><span class="k">2</span> FREE AIM <span class="cost">●●</span></div>
        <div class="mi"><span class="k">3</span> INK LANCE <span class="cost">●●●</span></div>
        <div class="mi op"><span class="k">Q</span> OVERPAINT <span class="cost">gauge</span></div>
        <div class="mi dim"><span class="k">↵</span> END TURN</div>
      </div>
      <div id="hud-foe"><div class="name"></div><div class="bar"><div class="fill"></div></div><div class="pips"></div></div>
      <div id="hud-prompt"></div>
      <div id="hud-aim"><div class="track"><div class="zone"></div><div class="dot"></div></div>
        <div class="hint">ENTER — FIRE ON THE GOLD</div></div>
      <div id="hud-ring"></div>
      <div id="hud-msg"></div>
      <div id="hud-fell"><span class="big">THE EXPEDITION FALLS</span><span class="sub">the flag still flies</span></div>
      <div id="hud-card"><span class="big">FOR THOSE<br/>WHO COME AFTER</span><span class="sub">— expedition 34 —</span></div>
      <div id="hud-results"><div class="card">
        <h1>FOR THOSE WHO COME AFTER</h1>
        <div class="sub">THE CURATOR'S MARIONETTE · UNMADE</div>
        <div class="res-stats"></div>
        <div class="again">ENTER — PAINT AGAIN</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      .plate { border: 2px solid #9a6a2a; background: rgba(16,10,24,0.82);
        box-shadow: 5px 5px 0 rgba(0,0,0,0.45); padding: 12px 16px; }
      #hud-vitals { position: absolute; left: 26px; top: 24px; display: none; }
      .bar.hp { width: 230px; height: 9px; background: rgba(16,10,24,0.8);
        border: 1.5px solid ${C.ink}; }
      .bar.hp .fill { height: 100%; background: ${css(PAL.extra.hpRed)}; width: 100%; transition: width 0.12s; }
      #hud-ap { margin-top: 8px; display: flex; gap: 8px; }
      #hud-ap .daub { width: 15px; height: 15px; border-radius: 50% 45% 55% 40%;
        background: ${ROSE}; box-shadow: 0 0 6px rgba(232,154,168,0.5); }
      #hud-ap .daub.spent { background: transparent; border: 1.5px solid #6a5a68; box-shadow: none; }
      #hud-meter { margin-top: 8px; display: flex; align-items: center; gap: 8px; }
      #hud-meter .label { font: italic 10px Georgia, serif; color: ${C.accent}; letter-spacing: 0.2em; }
      #hud-meter .gauge { width: 110px; height: 7px; border: 1.5px solid ${C.ink}; background: rgba(16,10,24,0.8); }
      #hud-meter .fill { height: 100%; width: 0%; background: ${css(PAL.extra.overpaint)}; transition: width 0.2s; }
      #hud-meter.full .label { color: ${css(PAL.extra.overpaint)}; animation: ty-pulse 1s steps(2) infinite; }
      #hud-pictos { margin-top: 8px; font: 12px Georgia, serif; color: ${GOLD}; letter-spacing: 0.15em; }
      #hud-menu { position: absolute; left: 26px; bottom: 30px; display: none; }
      #hud-menu .mi { font: italic 15px Georgia, serif; color: ${C.paper}; margin: 5px 0; }
      #hud-menu .mi .k { color: ${GOLD}; font-style: normal; font-weight: 900; margin-right: 8px; }
      #hud-menu .mi .cost { color: ${ROSE}; margin-left: 8px; font-size: 11px; }
      #hud-menu .mi.op { display: none; }
      #hud-menu .mi.dim { opacity: 0.55; }
      #hud-foe { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%);
        width: 500px; display: none; text-align: center; }
      #hud-foe .name { font: italic 19px Georgia, serif; color: ${C.paper};
        letter-spacing: 0.22em; margin-bottom: 5px; text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-foe .bar { width: 500px; height: 9px; background: rgba(16,10,24,0.75); border: 2px solid #3a2c3a; }
      #hud-foe .fill { height: 100%; background: ${css(PAL.extra.hpRed)}; width: 100%; transition: width 0.15s; }
      #hud-foe .pips { margin-top: 5px; font-size: 13px; letter-spacing: 0.4em; color: ${GOLD}; }
      #hud-prompt { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%);
        font: italic 900 26px Georgia, serif; color: ${GOLD}; letter-spacing: 0.12em;
        text-shadow: 2px 2px 0 ${C.ink}; display: none; white-space: nowrap;
        animation: ty-pulse 0.7s steps(2) infinite; }
      #hud-aim { position: absolute; left: 50%; bottom: 190px; transform: translateX(-50%);
        display: none; text-align: center; }
      #hud-aim .track { position: relative; width: 340px; height: 14px; border: 2px solid ${C.ink};
        background: rgba(16,10,24,0.8); }
      #hud-aim .zone { position: absolute; left: 50%; top: 0; width: 60px; height: 100%;
        transform: translateX(-50%); background: rgba(255,217,138,0.35); border-left: 2px solid ${GOLD}; border-right: 2px solid ${GOLD}; }
      #hud-aim .dot { position: absolute; top: -3px; width: 8px; height: 18px; background: ${ROSE};
        box-shadow: 0 0 8px rgba(232,154,168,0.8); }
      #hud-aim .hint { margin-top: 6px; font: italic 12px Georgia, serif; color: ${C.paper}; letter-spacing: 0.25em; }
      #hud-ring { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px;
        border: 3px solid ${GOLD}; border-radius: 50%; transform: translate(-50%,-50%) scale(1);
        opacity: 0; pointer-events: none; }
      #hud-ring.flash { animation: parryring 0.55s ease-out; }
      @keyframes parryring {
        0% { opacity: 1; transform: translate(-50%,-50%) scale(0.4); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4); }
      }
      #hud-fell, #hud-card { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; flex-direction: column; text-align: center;
        opacity: 0; transition: opacity 1.6s ease-in, background 1.6s; }
      #hud-fell .big { font: italic 54px Georgia, serif; color: #c04848; letter-spacing: 0.12em; text-shadow: 0 0 30px rgba(0,0,0,0.85); }
      #hud-fell .sub { font: italic 15px Georgia, serif; color: ${C.paper}; letter-spacing: 0.4em; margin-top: 10px; }
      #hud-fell.on { display: flex; opacity: 1; background: rgba(12,8,16,0.55); }
      #hud-card .big { font: italic 64px Georgia, serif; color: ${GOLD}; letter-spacing: 0.1em; line-height: 1.4;
        text-shadow: 3px 3px 0 ${C.ink}, 0 0 50px rgba(255,217,138,0.4); }
      #hud-card .sub { font: italic 15px Georgia, serif; color: ${C.paper}; letter-spacing: 0.5em; margin-top: 14px; }
      #hud-card.on { display: flex; opacity: 1; background: rgba(12,8,16,0.45); }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(16,10,24,0.62); }
      #hud-results .card { border: 3px solid #9a6a2a; background: rgba(20,14,28,0.94);
        box-shadow: 10px 10px 0 rgba(0,0,0,0.5); padding: 36px 60px; text-align: center; }
      #hud-results h1 { font: italic 34px Georgia, serif; color: ${GOLD}; margin: 0 0 6px; }
      #hud-results .sub { font: 12px Georgia, serif; color: ${C.accent}; letter-spacing: 0.4em; margin-bottom: 20px; }
      #hud-results .res-stats { font: 17px Georgia, serif; line-height: 2.1; color: ${C.paper}; }
      #hud-results .res-stats b { color: ${GOLD}; }
      #hud-results .again { margin-top: 24px; font: italic 14px Georgia, serif;
        letter-spacing: 0.25em; color: ${C.paper}; animation: ty-pulse 1.6s steps(2) infinite; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.vitalsEl = root.querySelector("#hud-vitals")!;
    this.hpBar = root.querySelector(".bar.hp .fill")!;
    this.apEl = root.querySelector("#hud-ap")!;
    this.menuEl = root.querySelector("#hud-menu")!;
    this.meterEl = root.querySelector("#hud-meter")!;
    this.meterFill = root.querySelector("#hud-meter .fill")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.aimEl = root.querySelector("#hud-aim")!;
    this.aimDot = root.querySelector("#hud-aim .dot")!;
    this.ringEl = root.querySelector("#hud-ring")!;
    this.foeEl = root.querySelector("#hud-foe")!;
    this.foeName = root.querySelector("#hud-foe .name")!;
    this.foeBar = root.querySelector("#hud-foe .fill")!;
    this.foePips = root.querySelector("#hud-foe .pips")!;
    this.pictosEl = root.querySelector("#hud-pictos")!;
    this.fellEl = root.querySelector("#hud-fell")!;
    this.cardEl = root.querySelector("#hud-card")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
  }

  /** the parry flash ring — one CSS flash per call */
  parryRing(): void {
    this.ringEl.classList.remove("flash");
    void this.ringEl.offsetWidth; // restart the animation
    this.ringEl.classList.add("flash");
  }

  fell(on: boolean): void {
    this.fellEl.classList.toggle("on", on);
  }

  card(on: boolean): void {
    this.cardEl.classList.toggle("on", on);
  }

  private static readonly NAMES: Record<string, string> = {
    brushling: "BRUSHLING",
    mime: "THE FENCED MIME",
    marionette: "THE CURATOR'S MARIONETTE",
  };

  update(game: Game): void {
    const p = game.player;
    const show = game.phase !== "title";
    this.vitalsEl.style.display = show ? "block" : "none";
    if (!show) return;

    this.hpBar.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    this.pictosEl.textContent = [...game.pictos].map((id) => (id === "pictoHp" ? "▣ VITAL DAUB" : "▣ HONED NIB")).join("  ");

    const b = game.battle;
    const inBattle = game.phase === "battle" && !!b;
    this.menuEl.style.display = inBattle && b!.turn === "player" ? "block" : "none";
    (this.menuEl.querySelector(".mi.op") as HTMLElement).style.display = game.meter >= 100 ? "block" : "none";

    // AP daubs
    const ap = inBattle && b!.turn === "player" ? b!.ap : 0;
    let daubs = "";
    for (let i = 0; i < 3; i++) daubs += `<div class="daub${i < ap ? "" : " spent"}"></div>`;
    this.apEl.innerHTML = daubs;

    this.meterFill.style.width = `${game.meter}%`;
    this.meterEl.classList.toggle("full", game.meter >= 100);

    // the foe plate
    const t = game.target();
    this.foeEl.style.display = inBattle && t ? "block" : "none";
    if (inBattle && t) {
      this.foeName.textContent = HUD.NAMES[t.kind];
      this.foeBar.style.width = `${(t.hp / t.maxHp) * 100}%`;
      this.foePips.textContent = t.shield > 0 ? "◆".repeat(t.shield) + " GRADIENT" : t.kind === "mime" ? "◇ shield broken" : "";
    }

    // the enemy-turn prompt
    const atk = inBattle ? b!.incoming : null;
    this.promptEl.style.display = atk ? "block" : "none";
    if (atk) this.promptEl.textContent = atk.label;

    // the free-aim bar
    this.aimEl.style.display = game.aim ? "block" : "none";
    if (game.aim) {
      const x = 50 + Math.sin(game.aimPhase) * 46; // sway across the track
      this.aimDot.style.left = `calc(${x}% - 4px)`;
    }
  }

  results(game: Game): void {
    const pct = game.parryAttempts > 0 ? Math.round((game.parriesLanded / game.parryAttempts) * 100) : 0;
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `TURNS <b>${game.turns}</b> · TIME <b>${fmtTime(game.time)}</b><br/>` +
      `PARRIES <b>${game.parriesLanded}/${game.parryAttempts}</b> — <b>${pct}%</b> · DODGES <b>${game.dodges}</b><br/>` +
      `DAMAGE DEALT <b>${game.damageDealt}</b> · DEATHS <b>${game.deaths}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
