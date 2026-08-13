/**
 * hud.ts — the tabletop HUD: the dialogue card (speaker lines + numbered
 * choices with skill tags), the bottom hotbar ribbon (1–4 with action/
 * bonus pips), the initiative portrait strip, floating damage/verdict
 * numbers, gold counter, the loot beat, and the results card with the
 * FULL rolls history. Serif, candle-and-ink.
 */
import { injectHudStyles, MessageFlash, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import type { Game, Combatant, DialogueChoice, RollRecord } from "./game";

const C = hudColors(PAL);
const GOLD = css(PAL.accents.primary);

export class HUD {
  private flash: MessageFlash;
  private dlgEl: HTMLElement;
  private dlgLines: HTMLElement;
  private dlgChoices: HTMLElement;
  private hotbarEl: HTMLElement;
  private initEl: HTMLElement;
  private goldEl: HTMLElement;
  private resultsEl: HTMLElement;
  private numsRoot: HTMLElement;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-gold" class="ty-panel"></div>
      <div id="hud-init"></div>
      <div id="hud-hotbar"></div>
      <div id="hud-dialogue"><div class="dlg-card">
        <div class="lines"></div>
        <div class="choices"></div>
      </div></div>
      <div id="hud-msg"></div>
      <div id="hud-nums"></div>
      <div id="hud-results"><div class="card">
        <h1>THE TOLLHOUSE — CLEARED</h1>
        <div class="sub" id="res-sub"></div>
        <div class="rolls"></div>
        <div class="res-stats"></div>
        <div class="again">ENTER — ANOTHER TALE</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud * { font-family: Georgia, serif; }
      #hud-gold { position: absolute; right: 26px; top: 22px; padding: 8px 18px;
        font: italic 900 18px Georgia, serif; color: ${GOLD}; }
      #hud-init { position: absolute; left: 50%; top: 18px; transform: translateX(-50%);
        display: none; gap: 8px; }
      #hud-init .pip { padding: 5px 12px; border: 2px solid ${C.ink};
        background: rgba(16,10,20,0.8); font: italic 800 12px Georgia, serif;
        color: ${C.paper}; letter-spacing: 0.06em; }
      #hud-init .pip.foe { border-color: #6a2a2a; color: #e08a8a; }
      #hud-init .pip.on { border-color: ${GOLD}; color: ${GOLD}; box-shadow: 0 0 12px rgba(240,216,144,0.35); }
      #hud-hotbar { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%);
        display: none; gap: 8px; }
      #hud-hotbar .ab { padding: 8px 16px; border: 3px solid ${C.ink};
        background: rgba(16,10,20,0.85); font: italic 900 13px Georgia, serif;
        color: ${C.paper}; text-align: center; }
      #hud-hotbar .ab .k { color: ${GOLD}; }
      #hud-hotbar .ab.used { opacity: 0.35; }
      #hud-hotbar .ab.bonus { border-color: #8a5a2a; }
      #hud-dialogue { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%);
        width: 640px; display: none; }
      .dlg-card { border: 3px solid #8a5a2a; background: rgba(16,10,20,0.94);
        box-shadow: 8px 8px 0 rgba(0,0,0,0.5); padding: 20px 28px; }
      .dlg-card .lines { margin-bottom: 12px; }
      .dlg-card .line { font: 16px Georgia, serif; color: ${C.paper}; margin: 7px 0; }
      .dlg-card .line b { font-style: italic; }
      .dlg-card .choices .ch { font: italic 700 15px Georgia, serif; color: ${GOLD};
        margin: 6px 0; }
      .dlg-card .choices .ch .n { color: ${C.paper}; margin-right: 8px; }
      #hud-nums { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      #hud-nums .n { position: absolute; font: italic 900 22px Georgia, serif;
        transform: translate(-50%,-50%); text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-results { position: absolute; inset: 0; display: none;
        align-items: center; justify-content: center; background: rgba(16,10,20,0.55); }
      #hud-results .card { border: 3px solid #8a5a2a; background: rgba(16,10,20,0.95);
        box-shadow: 10px 10px 0 rgba(0,0,0,0.5); padding: 30px 46px; min-width: 520px;
        max-height: 80vh; overflow: auto; }
      #hud-results h1 { font: italic 34px Georgia, serif; color: ${GOLD}; margin: 0 0 4px; }
      #hud-results .sub { font: 12px Georgia, serif; color: ${C.accent}; letter-spacing: 0.35em; margin-bottom: 14px; }
      #hud-results .rolls { font: 13.5px Georgia, serif; color: ${C.paper}; line-height: 1.7;
        border-top: 1px solid #3a2a3a; border-bottom: 1px solid #3a2a3a; padding: 10px 0; margin-bottom: 12px; }
      #hud-results .rolls .crit { color: ${GOLD}; font-weight: 900; }
      #hud-results .rolls .fail { color: #e08a8a; }
      #hud-results .res-stats { font: 16px Georgia, serif; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${GOLD}; }
      #hud-results .again { margin-top: 18px; text-align: center; font: italic 14px Georgia, serif;
        letter-spacing: 0.25em; color: ${C.paper}; animation: ty-pulse 1.6s steps(2) infinite; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.dlgEl = root.querySelector("#hud-dialogue")!;
    this.dlgLines = root.querySelector(".dlg-card .lines")!;
    this.dlgChoices = root.querySelector(".dlg-card .choices")!;
    this.hotbarEl = root.querySelector("#hud-hotbar")!;
    this.initEl = root.querySelector("#hud-init")!;
    this.goldEl = root.querySelector("#hud-gold")!;
    this.resultsEl = root.querySelector("#hud-results")!;
    this.numsRoot = root.querySelector("#hud-nums")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
  }

  /* ------------------------------------------------------------ dialogue -- */

  dialogueShow(): void {
    this.dlgEl.style.display = "block";
    this.dlgLines.innerHTML = "";
    this.dlgChoices.innerHTML = "";
  }

  dialogueLine(who: string, text: string): void {
    const d = document.createElement("div");
    d.className = "line";
    d.innerHTML = `<b style="color:${who === "YOU" ? C.accent : who === "MAGE" ? "#b88aff" : GOLD}">${who}</b> — ${text}`;
    this.dlgLines.appendChild(d);
  }

  dialogueChoices(choices: DialogueChoice[]): void {
    this.dlgChoices.innerHTML = "";
    choices.forEach((c, i) => {
      const d = document.createElement("div");
      d.className = "ch";
      d.innerHTML = `<span class="n">${i + 1}.</span>${c.label}`;
      this.dlgChoices.appendChild(d);
    });
  }

  dialogueHide(): void {
    this.dlgEl.style.display = "none";
  }

  /* -------------------------------------------------------------- combat -- */

  updateCombat(game: Game): void {
    const c = game.combat;
    if (!c || game.phase !== "combat") {
      this.initEl.style.display = "none";
      this.hotbarEl.style.display = "none";
      return;
    }
    // initiative strip
    this.initEl.style.display = "flex";
    const active = game.active();
    this.initEl.innerHTML = c.order
      .map((o) => `<div class="pip ${o.side === "enemy" ? "foe" : ""} ${o === active ? "on" : ""} ${o.alive ? "" : "dead"}" style="${o.alive ? "" : "opacity:0.3;text-decoration:line-through"}">${o.name} ${o.alive ? o.hp : ""}</div>`)
      .join("");
    // hotbar
    if (active?.kind === "player") {
      this.hotbarEl.style.display = "flex";
      const abs = [
        { k: 1, name: "STRIKE", used: active.actionUsed, bonus: false },
        { k: 2, name: "SHOVE", used: active.actionUsed, bonus: false },
        { k: 3, name: "DIP BLADE", used: active.bonusUsed, bonus: true },
        { k: 4, name: "BARREL", used: active.actionUsed, bonus: false },
      ];
      this.hotbarEl.innerHTML = abs
        .map((a) => `<div class="ab ${a.used ? "used" : ""} ${a.bonus ? "bonus" : ""}"><span class="k">${a.k}</span> ${a.name}</div>`)
        .join("") + `<div class="ab" style="border-color:${GOLD}"><span class="k">↵</span> END TURN</div>`;
    } else {
      this.hotbarEl.style.display = "none";
    }
  }

  /* --------------------------------------------------------------- numbers -- */

  spawnNum(sx: number, sy: number, text: string, color: string): void {
    const el = document.createElement("div");
    el.className = "n";
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    this.numsRoot.appendChild(el);
    const t0 = performance.now();
    const tick = () => {
      const k = (performance.now() - t0) / 900;
      if (k >= 1) {
        el.remove();
        return;
      }
      el.style.transform = `translate(-50%, ${(-50 - k * 60).toFixed(0)}px) scale(${1.3 - k * 0.4})`;
      el.style.opacity = String(1 - k * k);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  update(game: Game): void {
    this.goldEl.textContent = `◈ ${game.gold} gold${game.cloak ? " · cloak" : ""}`;
  }

  results(game: Game): void {
    const subs: Record<string, string> = {
      free: "TALKED THROUGH — NOT A DROP SPILLED",
      cowed: "COWED HIM — NOT A DROP SPILLED",
      robbed: "POLITELY ROBBED — BUT ALIVE",
      fight: "BLOOD ON THE BRIDGE",
      "fight-surprised": "HE NEVER SAW IT COMING",
    };
    (this.resultsEl.querySelector("#res-sub") as HTMLElement).textContent =
      subs[game.path ?? "fight"] ?? "";
    const rolls = this.resultsEl.querySelector(".rolls") as HTMLElement;
    rolls.innerHTML =
      "<b>THE ROLLS</b><br/>" +
      game.rolls
        .map((r) => {
          const cls = r.crit === "crit" ? "crit" : !r.success ? "fail" : "";
          const dc = r.dc > 0 ? ` vs DC ${r.dc}` : "";
          const verdict = r.crit === "crit" ? " — CRIT!" : r.crit === "critfail" ? " — CRIT FAIL" : r.dc > 0 ? (r.success ? " ✓" : " ✗") : "";
          return `<span class="${cls}">${r.label}: ${r.roll}${r.mod ? ` + ${r.mod}` : ""} = ${r.total}${dc}${verdict}</span>`;
        })
        .join("<br/>");
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `BODIES IN THE RIVER <b>${game.bodiesInRiver}</b> · KILLS <b>${game.kills}</b><br/>` +
      `GOLD <b>${game.gold}</b> · LOOT <b>${game.cloak ? "the cloak + 500" : "none"}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
