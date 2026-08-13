/**
 * minigames.ts — the five task UIs. Modal canvas panels in the house
 * language, keyboard-only (arrows + Space): wires by color, asteroids
 * aim-shoot, fuel hold-fill, download progress, divert arrow sequence.
 * Self-contained UI layer — each calls onComplete(task) when finished.
 */
import { hudColors, css } from "@tenyears/core";
import { PAL } from "./palette";

const C = hudColors(PAL);

export class Minigames {
  active: string | null = null;
  onComplete: (task: string) => void = () => {};
  onClose: () => void = () => {};

  private overlay: HTMLElement;
  private cv: HTMLCanvasElement;
  private titleEl: HTMLElement;
  private hintEl: HTMLElement;
  private state: Record<string, unknown> = {};

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.id = "minigame";
    this.overlay.innerHTML = `<div class="ty-card ty-txt mg-card"><h1 class="mg-title"></h1><canvas width="640" height="400"></canvas><div class="mg-hint"></div></div>`;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #minigame { position: fixed; inset: 0; z-index: 20; display: none;
        align-items: center; justify-content: center; background: rgba(10,12,24,0.55);
        pointer-events: auto; }
      .mg-card { min-width: 0; padding: 22px 30px; text-align: center; }
      .mg-card h1 { font-size: 26px; margin: 0 0 10px; }
      .mg-card canvas { width: 480px; height: 300px; background: rgba(255,255,255,0.05);
        border: 3px solid var(--ty-ink); }
      .mg-hint { margin-top: 10px; font-size: 13px; letter-spacing: 0.14em; color: var(--ty-paper); }
      .mg-hint b { color: var(--ty-accent); }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlay);
    this.cv = this.overlay.querySelector("canvas")!;
    this.titleEl = this.overlay.querySelector(".mg-title")!;
    this.hintEl = this.overlay.querySelector(".mg-hint")!;
  }

  open(task: string): void {
    this.active = task;
    this.state = this.freshState(task);
    this.overlay.style.display = "flex";
    this.titleEl.textContent = {
      wires: "FIX WIRING",
      asteroids: "CLEAR ASTEROIDS",
      fuel: "FUEL ENGINES",
      download: "DOWNLOAD DATA",
      divert: "DIVERT POWER",
    }[task] ?? task;
    this.hintEl.innerHTML = {
      wires: "<b>↑↓</b> pick · <b>SPACE</b> connect matching colors",
      asteroids: "<b>ARROWS</b> aim · <b>SPACE</b> shoot",
      fuel: "hold <b>SPACE</b> to fill · release in the green band",
      download: "<b>SPACE</b> to start · hold the connection…",
      divert: "press the shown <b>ARROWS</b> in order",
    }[task] ?? "";
  }

  close(): void {
    this.active = null;
    this.overlay.style.display = "none";
    this.onClose();
  }

  private freshState(task: string): Record<string, unknown> {
    switch (task) {
      case "wires": {
        const colors = ["#e03a4a", "#3a68e0", "#f0e05a"];
        const right = [...colors].sort(() => Math.random() - 0.5);
        return { colors, right, selL: 0, selR: 0, picked: null as number | null, done: [] as boolean[] };
      }
      case "asteroids": {
        return {
          cx: 320, cy: 340,
          rocks: Array.from({ length: 5 }, (_, i) => ({
            x: 60 + i * 120 + Math.random() * 40, y: -20 - i * 55, r: 16 + Math.random() * 10,
            vx: (Math.random() - 0.5) * 30, vy: 26 + Math.random() * 18, dead: false,
          })),
          shots: [] as { x: number; y: number }[],
          flash: 0,
        };
      }
      case "fuel":
        return { level: 0.1, holding: false, done: false };
      case "download":
        return { progress: 0, started: false };
      case "divert": {
        const seq = ["left", "up", "right", "down"].sort(() => Math.random() - 0.5).slice(0, 3);
        return { seq, at: 0, flashBad: 0 };
      }
      default:
        return {};
    }
  }

  /* -------------------------------------------------------------- input -- */

  key(code: string): void {
    // SpaceDown doubles as the discrete Space press outside fuel
    if (code === "SpaceDown" && this.active !== "fuel") code = "Space";
    const s = this.state;
    switch (this.active) {
      case "wires": {
        const st = s as { selL: number; selR: number; picked: number | null; done: boolean[]; colors: string[]; right: string[] };
        if (st.picked === null) {
          if (code === "ArrowUp") st.selL = (st.selL + 2) % 3;
          if (code === "ArrowDown") st.selL = (st.selL + 1) % 3;
          if (code === "Space" && !st.done[st.selL]) st.picked = st.selL;
        } else {
          if (code === "ArrowUp") st.selR = (st.selR + 2) % 3;
          if (code === "ArrowDown") st.selR = (st.selR + 1) % 3;
          if (code === "Space") {
            if (st.right[st.selR] === st.colors[st.picked]) {
              st.done[st.picked] = true;
              st.picked = null;
              if (st.done.every(Boolean)) this.finish("wires");
            } else {
              st.picked = null; // mismatch — release
            }
          }
        }
        break;
      }
      case "asteroids": {
        if (code === "Space") {
          const st = s as { cx: number; cy: number; shots: { x: number; y: number }[] };
          st.shots.push({ x: st.cx, y: st.cy });
        }
        break;
      }
      case "fuel": {
        if (code === "SpaceDown") (s as { holding: boolean }).holding = true;
        if (code === "SpaceUp") {
          const st = s as { holding: boolean; level: number };
          st.holding = false;
          if (st.level >= 0.75 && st.level <= 0.96) this.finish("fuel");
          else if (st.level >= 1) st.level = 0.3; // overflowed
        }
        break;
      }
      case "download": {
        if (code === "Space") (s as { started: boolean }).started = true;
        break;
      }
      case "divert": {
        const st = s as { seq: string[]; at: number; flashBad: number };
        const want = st.seq[st.at];
        const got = code === "ArrowLeft" ? "left" : code === "ArrowRight" ? "right" : code === "ArrowUp" ? "up" : code === "ArrowDown" ? "down" : null;
        if (got) {
          if (got === want) {
            st.at++;
            if (st.at >= st.seq.length) this.finish("divert");
          } else {
            st.at = 0;
            st.flashBad = 0.4;
          }
        }
        break;
      }
    }
  }

  private selBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.strokeRect(x, y, w, h);
  }

  private finish(task: string): void {
    const t = task;
    this.close();
    this.onComplete(t);
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number): void {
    if (!this.active) return;
    const s = this.state;
    const g = this.cv.getContext("2d")!;
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);

    switch (this.active) {
      case "wires": {
        const st = s as { colors: string[]; right: string[]; selL: number; selR: number; picked: number | null; done: boolean[] };
        st.colors.forEach((c, i) => {
          const y = 90 + i * 110;
          const done = st.done[i];
          const ri = st.right.indexOf(c);
          g.strokeStyle = c;
          g.lineWidth = done ? 10 : 4;
          g.globalAlpha = done ? 1 : 0.45;
          g.beginPath();
          g.moveTo(70, y);
          g.bezierCurveTo(220, y, 400, 90 + ri * 110, 570, 90 + ri * 110);
          g.stroke();
          g.globalAlpha = 1;
          // endpoints
          g.fillStyle = c;
          g.fillRect(52, y - 16, 18, 32);
          g.fillRect(570, 90 + ri * 110 - 16, 18, 32);
          // selectors
          if (st.picked === null && st.selL === i) this.selBox(g, 40, y - 24, 42, 48);
          if (st.picked !== null && st.selR === ri) this.selBox(g, 560, 90 + ri * 110 - 24, 42, 48);
        });
        break;
      }
      case "asteroids": {
        const st = s as {
          cx: number; cy: number; flash: number;
          rocks: { x: number; y: number; r: number; vx: number; vy: number; dead: boolean }[];
          shots: { x: number; y: number }[];
        };
        // stars
        g.fillStyle = "rgba(255,255,255,0.25)";
        for (let i = 0; i < 30; i++) g.fillRect((i * 173) % W, (i * 97) % H, 2, 2);
        for (const r of st.rocks) {
          if (r.dead) continue;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          if (r.y > H + 30) r.y = -30;
          g.fillStyle = "#8a8a9a";
          g.beginPath();
          g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = C.ink;
          g.lineWidth = 3;
          g.stroke();
        }
        for (const sh of st.shots) sh.y -= 420 * dt;
        st.shots = st.shots.filter((sh) => sh.y > -10);
        g.fillStyle = "#ffe9a8";
        for (const sh of st.shots) g.fillRect(sh.x - 3, sh.y - 12, 6, 14);
        // hits
        for (const sh of st.shots) {
          for (const r of st.rocks) {
            if (!r.dead && Math.hypot(sh.x - r.x, sh.y - r.y) < r.r + 6) {
              r.dead = true;
              sh.y = -99;
            }
          }
        }
        if (st.rocks.every((r) => r.dead)) {
          this.finish("asteroids");
          return;
        }
        // crosshair
        g.strokeStyle = C.accent;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(st.cx, st.cy, 14, 0, Math.PI * 2);
        g.moveTo(st.cx - 22, st.cy);
        g.lineTo(st.cx + 22, st.cy);
        g.moveTo(st.cx, st.cy - 22);
        g.lineTo(st.cx, st.cy + 22);
        g.stroke();
        break;
      }
      case "fuel": {
        const st = s as { level: number; holding: boolean };
        if (st.holding) st.level = Math.min(1, st.level + dt * 0.55);
        const x = 120, y = 60, w = 400, h = 60;
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(x, y, w, h);
        // target band
        g.fillStyle = "rgba(127,216,232,0.35)";
        g.fillRect(x + w * 0.75, y - 8, w * 0.21, h + 16);
        g.fillStyle = st.level > 0.96 ? "#e03a4a" : C.accent;
        g.fillRect(x, y, w * Math.min(1, st.level), h);
        g.strokeStyle = C.ink;
        g.lineWidth = 4;
        g.strokeRect(x, y, w, h);
        g.fillStyle = C.paper;
        g.font = "italic 900 20px 'Segoe UI', Arial";
        g.textAlign = "center";
        g.fillText(st.holding ? "FILLING…" : "hold SPACE", W / 2, y + h + 50);
        break;
      }
      case "download": {
        const st = s as { progress: number; started: boolean };
        if (st.started) st.progress += dt / 5;
        if (st.progress >= 1) {
          this.finish("download");
          return;
        }
        const x = 100, y = 150, w = 440, h = 44;
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(x, y, w, h);
        g.fillStyle = C.accent;
        const blocks = Math.floor(st.progress * 12);
        for (let i = 0; i < blocks; i++) g.fillRect(x + 6 + i * ((w - 12) / 12), y + 6, (w - 12) / 12 - 6, h - 12);
        g.strokeStyle = C.ink;
        g.lineWidth = 4;
        g.strokeRect(x, y, w, h);
        g.fillStyle = C.paper;
        g.font = "italic 900 22px 'Segoe UI', Arial";
        g.textAlign = "center";
        g.fillText(st.started ? `DOWNLOADING ${Math.floor(st.progress * 100)}%` : "press SPACE to start", W / 2, y - 30);
        break;
      }
      case "divert": {
        const st = s as { seq: string[]; at: number; flashBad: number };
        st.flashBad = Math.max(0, st.flashBad - dt);
        const arrows: Record<string, string> = { left: "←", up: "↑", right: "→", down: "↓" };
        st.seq.forEach((dir, i) => {
          const x = W / 2 + (i - 1) * 110;
          const done = i < st.at;
          g.fillStyle = done ? C.accent : st.flashBad > 0 ? "#e03a4a" : "rgba(255,255,255,0.1)";
          g.fillRect(x - 40, 140, 80, 80);
          g.strokeStyle = C.ink;
          g.lineWidth = 4;
          g.strokeRect(x - 40, 140, 80, 80);
          g.fillStyle = done ? C.ink : C.paper;
          g.font = "900 46px 'Segoe UI', Arial";
          g.textAlign = "center";
          g.fillText(arrows[dir], x, 198);
        });
        break;
      }
    }

    // continuous movement for asteroids crosshair
    if (this.active === "asteroids") {
      const st = this.state as { cx: number; cy: number };
      st.cx += this.axisX * 320 * dt;
      st.cy += this.axisY * 260 * dt;
      st.cx = Math.max(20, Math.min(W - 20, st.cx));
      st.cy = Math.max(20, Math.min(H - 20, st.cy));
    }
  }

  /** held-arrow axes, fed by main each frame */
  axisX = 0;
  axisY = 0;
}
