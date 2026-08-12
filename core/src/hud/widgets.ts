/**
 * widgets.ts — canvas2d HUD instruments in the house language (§2.5).
 *
 * Instruments, not strings: arcs, cells, real minimap polylines, big italic
 * message flashes. Everything takes explicit colors (from the game's
 * palette via `css()`) — no rogue hexes. Games compose these into their own
 * HUD panels; ~30 Hz updates are plenty.
 *
 * All draw functions assume the caller clears the canvas first and use the
 * canvas's own pixel dimensions (draw at 2× for retina, scale via CSS).
 */
import { css, type Palette } from "../world/palette";

/* ----------------------------------------------------------- arc gauge -- */

export interface ArcGaugeOptions {
  /** 0..1 fill */
  value: number;
  color: string;
  /** fill color while "hot" (boosting, bursting) */
  hotColor?: string;
  hot?: boolean;
  trackColor: string;
  tickColor: string;
  /** center readout; omit for a bare arc */
  label?: string;
  labelColor?: string;
  subLabel?: string;
  subColor?: string;
  ticks?: number;
}

/** Sweep gauge: 270° arc, hard band fill, square ticks, italic readout. */
export function drawArcGauge(ctx: CanvasRenderingContext2D, o: ArcGaugeOptions): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.62;
  const r = w * 0.36;
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  const t = Math.min(1, Math.max(0, o.value));

  c_arc(ctx, cx, cy, r, a0, a0 + sweep, o.trackColor, 16);
  c_arc(ctx, cx, cy, r, a0, a0 + sweep * t, o.hot ? (o.hotColor ?? o.color) : o.color, 16);

  const ticks = o.ticks ?? 10;
  ctx.strokeStyle = o.tickColor;
  ctx.lineWidth = 4;
  for (let i = 0; i <= ticks; i++) {
    const a = a0 + sweep * (i / ticks);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
    ctx.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12));
    ctx.stroke();
  }

  if (o.label !== undefined) {
    ctx.fillStyle = o.labelColor ?? "#ffffff";
    ctx.font = "italic 900 64px 'Segoe UI', Arial";
    ctx.textAlign = "center";
    ctx.fillText(o.label, cx, cy + 8);
  }
  if (o.subLabel) {
    ctx.font = "italic 900 20px 'Segoe UI', Arial";
    ctx.fillStyle = o.subColor ?? o.color;
    ctx.fillText(o.subLabel, cx, cy + 34);
  }
}

function c_arc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  a0: number, a1: number, style: string, width: number,
): void {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
}

/* ------------------------------------------------------ segmented cells -- */

export interface CellsOptions {
  /** 0..1 fill */
  value: number;
  cells: number;
  color: string;
  hotColor?: string;
  hot?: boolean;
  trackColor: string;
  /** draw direction */
  vertical?: boolean;
}

/** Quantized cell meter (boost, HP pips, ammo) — hard steps, no gradient. */
export function drawCells(ctx: CanvasRenderingContext2D, o: CellsOptions): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const padX = 8;
  const padY = 10;
  ctx.fillStyle = o.trackColor;
  ctx.fillRect(padX, padY, w - padX * 2, h - padY * 2);
  ctx.fillStyle = o.hot ? (o.hotColor ?? o.color) : o.color;
  const lit = Math.ceil(Math.min(1, Math.max(0, o.value)) * o.cells);
  for (let i = 0; i < lit; i++) {
    if (o.vertical) {
      const cellH = (h - padY * 2) / o.cells;
      ctx.fillRect(padX, h - padY - (i + 1) * cellH + 3, w - padX * 2, cellH - 5);
    } else {
      const cellW = (w - padX * 2) / o.cells;
      ctx.fillRect(padX + i * cellW + 2, padY, cellW - 5, h - padY * 2);
    }
  }
}

/* -------------------------------------------------------------- minimap -- */

export interface MapDot {
  x: number;
  z: number;
  heading?: number;
  color: string;
  me?: boolean;
}

/**
 * World→map transform over a set of world-space polylines. Build once from
 * the course/zone points; `toMap` converts live positions every frame.
 */
export class MinimapTransform {
  private minX = 0;
  private minZ = 0;
  private sc = 1;
  private offX = 0;
  private offZ = 0;

  constructor(
    worldPts: readonly { x: number; z: number }[],
    public readonly width: number,
    public readonly height: number,
    public readonly pad = 22,
  ) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of worldPts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const sx = (width - pad * 2) / Math.max(1e-6, maxX - minX);
    const sz = (height - pad * 2) / Math.max(1e-6, maxZ - minZ);
    this.sc = Math.min(sx, sz);
    this.offX = ((width - pad * 2) - (maxX - minX) * this.sc) / 2;
    this.offZ = ((height - pad * 2) - (maxZ - minZ) * this.sc) / 2;
    this.minX = minX;
    this.minZ = minZ;
  }

  toMap(x: number, z: number): [number, number] {
    return [
      this.pad + (x - this.minX) * this.sc + this.offX,
      this.pad + (z - this.minZ) * this.sc + this.offZ,
    ];
  }
}

/** Polyline track + inked dots with heading ticks. A REAL map, not a radar. */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  polylines: readonly (readonly [number, number][])[],
  dots: readonly MapDot[],
  o: { lineColor: string; inkColor: string; closed?: boolean },
): void {
  for (const pts of polylines) {
    ctx.strokeStyle = o.lineColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z)));
    if (o.closed !== false) ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = o.inkColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const d of dots) {
    ctx.fillStyle = d.color;
    ctx.strokeStyle = o.inkColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.z, d.me ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (d.heading !== undefined) {
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(d.x, d.z);
      ctx.lineTo(d.x + Math.sin(d.heading) * 9, d.z + Math.cos(d.heading) * 9);
      ctx.stroke();
    }
  }
}

/* -------------------------------------------------------- message flash -- */

/**
 * Big italic center-screen flash ("GO!!", "YOU DIED"). Uses `.ty-msg`;
 * call `injectHudStyles` first. `tick(dtMs)` hides it when time runs out.
 */
export class MessageFlash {
  private timer = 0;

  constructor(public readonly el: HTMLElement) {
    el.classList.add("ty-msg");
    el.style.display = "none";
  }

  show(text: string, ms: number, warn = false): void {
    this.el.textContent = text;
    this.el.style.display = "block";
    this.el.classList.toggle("ty-warn", warn);
    this.timer = ms;
  }

  tick(dtMs: number): void {
    if (this.timer > 0) {
      this.timer -= dtMs;
      if (this.timer <= 0) this.el.style.display = "none";
    }
  }
}

/* ----------------------------------------------------------- formatting -- */

/** m:ss.cc race-clock formatting; Infinity renders as a placeholder. */
export function fmtTime(t: number): string {
  if (!isFinite(t)) return "--:--.-";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** Convenience: pull CSS strings for the widget colors from a palette. */
export function hudColors(palette: Palette): {
  ink: string; inkDeep: string; paper: string;
  accent: string; accentDeep: string; hot: string;
} {
  return {
    ink: css(palette.ink.line),
    inkDeep: css(palette.ink.deep),
    paper: css(palette.sky.sunCore),
    accent: css(palette.accents.primary),
    accentDeep: css(palette.accents.primaryDeep),
    hot: css(palette.accents.rimHot),
  };
}
