/**
 * hud.ts — the voxel HUD: hotbar ink panels with item swatches, ten
 * hearts, crosshair dot, the craft menu (2×2 always, 3×3 near a table),
 * day-clock chip, death veil, YOU SURVIVED results card. House language,
 * palette only, ~30 Hz.
 */
import { injectHudStyles, MessageFlash, fmtTime, hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";
import { Game, HOTBAR, RECIPES, type Item, type Recipe } from "./game";

const C = hudColors(PAL);
const GREEN = css(PAL.accents.primary);

const ITEM_STYLE: Record<Item, { c: string; label: string }> = {
  planks: { c: css(PAL.extra.planks), label: "PLK" },
  cobble: { c: css(PAL.extra.cobble), label: "COB" },
  dirt: { c: css(PAL.extra.dirt), label: "DRT" },
  log: { c: css(PAL.extra.log), label: "LOG" },
  torch: { c: css(PAL.extra.torch), label: "TRC" },
  table: { c: css(PAL.extra.table), label: "TBL" },
  door: { c: css(PAL.extra.door), label: "DOR" },
  coal: { c: css(PAL.extra.coal), label: "COL" },
  iron: { c: css(PAL.extra.iron), label: "IRN" },
  stick: { c: "#c8a878", label: "STK" },
  woodpick: { c: "#c8a05a", label: "WPX" },
  stonepick: { c: "#9a9aa4", label: "SPX" },
  sword: { c: "#e8e0d0", label: "SWD" },
};

export class HUD {
  private flash: MessageFlash;
  private heartsCv: HTMLCanvasElement;
  private hotbarEl: HTMLElement;
  private clockEl: HTMLElement;
  private craftEl: HTMLElement;
  private recipeEl: HTMLElement;
  private deathEl: HTMLElement;
  private resultsEl: HTMLElement;
  private gainEl: HTMLElement;
  private gainT = 0;
  craftOpen = false;
  onCraft: ((id: string) => void) | null = null;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-clock" class="ty-panel ty-txt">DAY</div>
      <div id="hud-hearts" class="ty-panel"><canvas width="380" height="40"></canvas></div>
      <div id="hud-hotbar" class="ty-panel"></div>
      <div id="hud-cross"></div>
      <div id="hud-gain" class="ty-txt"></div>
      <div id="hud-msg"></div>
      <div id="hud-craft"><div class="ty-card ty-txt">
        <h1>CRAFT</h1>
        <div class="sub" id="craft-sub">2×2 — INVENTORY</div>
        <div class="recipes"></div>
        <div class="hint">E — CLOSE</div>
      </div></div>
      <div id="hud-death" class="ty-txt">YOU DIED<br/><small>respawning…</small></div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1>YOU SURVIVED</h1>
        <div class="sub">DAWN BREAKS OVER THE VALLEY</div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — NEW WORLD</div>
      </div></div>
    `;

    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-clock { top: 22px; left: 50%; transform: translateX(-50%) skewX(-6deg);
        padding: 7px 20px; font-size: 15px; letter-spacing: 0.2em; color: ${C.paper}; }
      #hud-hearts { left: 26px; bottom: 76px; padding: 5px 10px; }
      #hud-hearts canvas { width: 190px; height: 20px; display: block; }
      #hud-hotbar { left: 50%; bottom: 20px; transform: translateX(-50%) skewX(-6deg);
        display: flex; gap: 5px; padding: 6px; }
      .slot { width: 46px; height: 46px; background: rgba(255,255,255,0.07);
        border: 3px solid ${C.ink}; position: relative; }
      .slot.on { border-color: ${GREEN}; box-shadow: 0 0 0 2px ${GREEN}; }
      .slot .sw { position: absolute; inset: 6px; }
      .slot .n { position: absolute; right: 2px; bottom: 0; font: italic 900 13px var(--ty-font);
        color: #fff; text-shadow: 2px 2px 0 ${C.ink}; }
      .slot .k { position: absolute; left: 3px; top: 0; font: 900 10px var(--ty-font);
        color: rgba(255,255,255,0.5); }
      .slot .lb { position: absolute; left: 0; right: 0; bottom: -16px; text-align: center;
        font: italic 900 9px var(--ty-font); color: ${C.paper}; letter-spacing: 0.06em; }
      #hud-cross { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px;
        transform: translate(-50%,-50%); background: #fff; border: 2px solid ${C.ink}; }
      #hud-gain { position: absolute; right: 30px; bottom: 90px; font-size: 16px;
        color: ${GREEN}; text-shadow: 2px 2px 0 ${C.ink}; }
      #hud-craft { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(16,20,42,0.5); pointer-events: auto; }
      #hud-craft .ty-card { min-width: 420px; }
      #hud-craft h1 { font-size: 34px; }
      #hud-craft .sub { color: ${C.accent}; letter-spacing: 0.35em; font-size: 11px; margin-bottom: 14px; }
      #hud-craft .recipes { display: flex; flex-direction: column; gap: 6px; }
      #hud-craft .recipes button {
        all: unset; display: flex; justify-content: space-between; cursor: pointer;
        font: italic 800 15px var(--ty-font); color: ${C.paper};
        background: rgba(255,255,255,0.07); border: 3px solid ${C.ink};
        padding: 8px 14px; transform: skewX(-4deg);
      }
      #hud-craft .recipesbutton:hover { background: rgba(255,255,255,0.16); }
      #hud-craft .recipes button.ok { border-color: ${GREEN}; color: #fff; }
      #hud-craft .recipes button.no { opacity: 0.45; }
      #hud-craft .recipes button .cost { font-size: 12px; color: ${C.accent}; }
      #hud-craft .hint { margin-top: 14px; text-align: center; font-size: 12px;
        letter-spacing: 0.2em; color: ${C.paper}; }
      #hud-death { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; flex-direction: column; background: rgba(90,10,20,0.55);
        font-size: 84px; font-weight: 900; font-style: italic; color: #f0d8d8;
        text-shadow: 6px 6px 0 ${C.ink}; text-align: center; }
      #hud-death small { font-size: 22px; letter-spacing: 0.3em; }
      #hud-results { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(16,20,42,0.45); }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.4em; font-size: 12px; margin-bottom: 18px; }
      #hud-results .res-stats { font-size: 18px; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${GREEN}; }
      #hud-results .again { margin-top: 22px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.heartsCv = root.querySelector("#hud-hearts canvas")!;
    this.hotbarEl = root.querySelector("#hud-hotbar")!;
    this.clockEl = root.querySelector("#hud-clock")!;
    this.craftEl = root.querySelector("#hud-craft")!;
    this.recipeEl = root.querySelector("#hud-craft .recipes")!;
    this.deathEl = root.querySelector("#hud-death")!;
    this.resultsEl = root.querySelector("#hud-results")!;
    this.gainEl = root.querySelector("#hud-gain")!;

    // hotbar slots
    HOTBAR.forEach((item, i) => {
      const st = ITEM_STYLE[item];
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.innerHTML = `<span class="k">${i + 1}</span><div class="sw" style="background:${st.c}"></div><span class="n"></span><div class="lb">${st.label}</div>`;
      this.hotbarEl.appendChild(slot);
    });
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  gain(item: Item, n: number): void {
    this.gainEl.textContent = `+${n} ${ITEM_STYLE[item].label}`;
    this.gainT = 1.4;
  }

  toggleCraft(game: Game): void {
    this.craftOpen = !this.craftOpen;
    this.craftEl.style.display = this.craftOpen ? "flex" : "none";
    if (this.craftOpen) this.renderCraft(game);
  }

  closeCraft(): void {
    this.craftOpen = false;
    this.craftEl.style.display = "none";
  }

  private renderCraft(game: Game): void {
    const near = game.nearTable();
    (this.craftEl.querySelector("#craft-sub") as HTMLElement).textContent =
      near ? "3×3 — CRAFTING TABLE" : "2×2 — INVENTORY (table unlocks more)";
    this.recipeEl.innerHTML = "";
    for (const r of RECIPES) {
      const btn = document.createElement("button");
      const locked = r.grid === "3x3" && !near;
      const ok = game.canCraft(r);
      btn.className = ok ? "ok" : "no";
      const cost = Object.entries(r.cost).map(([k, n]) => `${n} ${ITEM_STYLE[k as Item].label}`).join(" + ");
      btn.innerHTML = `<span>${r.name}</span><span class="cost">${locked ? "NEEDS TABLE" : cost}</span>`;
      if (ok) {
        btn.addEventListener("click", () => {
          this.onCraft?.(r.id);
          this.renderCraft(game);
        });
      }
      this.recipeEl.appendChild(btn);
    }
  }

  tick(dtMs: number, game: Game): void {
    this.flash.tick(dtMs);
    if (this.gainT > 0) {
      this.gainT -= dtMs / 1000;
      if (this.gainT <= 0) this.gainEl.textContent = "";
    }
    this.deathEl.style.display = game.player.dead ? "flex" : "none";
    if (this.craftOpen) this.renderCraft(game);
  }

  update(game: Game): void {
    // hearts
    const c = this.heartsCv.getContext("2d")!;
    const w = this.heartsCv.width;
    c.clearRect(0, 0, w, this.heartsCv.height);
    const hearts = game.player.hp / 2;
    for (let i = 0; i < 10; i++) {
      const x = 8 + i * 36;
      const full = hearts >= i + 1;
      const half = !full && hearts > i;
      c.fillStyle = full ? css(PAL.extra.heart) : half ? "#a04a4a" : "rgba(255,255,255,0.12)";
      // pixel heart
      c.fillRect(x + 4, 4, 10, 8);
      c.fillRect(x + 18, 4, 10, 8);
      c.fillRect(x, 8, 32, 10);
      c.fillRect(x + 4, 18, 24, 6);
      c.fillRect(x + 10, 24, 12, 6);
      c.fillRect(x + 14, 30, 4, 4);
    }

    // clock
    const t = game.time;
    const label = t < 300 ? "DAY" : t < 330 ? "DUSK" : t < 600 ? "NIGHT" : "DAWN";
    this.clockEl.textContent = `${label} · ${fmtTime(t)}`;
    this.clockEl.style.color = label === "NIGHT" ? "#8a9ae0" : label === "DAY" ? C.paper : css(PAL.extra.torch);

    // hotbar counts + selection
    const slots = this.hotbarEl.querySelectorAll(".slot");
    HOTBAR.forEach((item, i) => {
      const slot = slots[i] as HTMLElement;
      slot.classList.toggle("on", i === game.hotbarSel);
      const n = item === "woodpick"
        ? (game.count("stonepick") > 0 ? "SPX" : game.count("woodpick") > 0 ? "WPX" : "")
        : item === "sword"
          ? (game.count("sword") > 0 ? "" : "—")
          : String(game.count(item) || "");
      (slot.querySelector(".n") as HTMLElement).textContent = n;
    });
  }

  results(game: Game): void {
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `BLOCKS MINED <b>${game.blocksMined}</b> · PLACED <b>${game.blocksPlaced}</b><br/>` +
      `MOBS SLAIN <b>${game.mobsSlain}</b> · DEATHS <b>${game.deaths}</b><br/>` +
      `SHELTER <b>${game.shelterSecured ? "SECURED" : "NEVER BUILT"}</b> · TIME <b>${fmtTime(game.time)}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
