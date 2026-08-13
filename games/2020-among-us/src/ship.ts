/**
 * ship.ts — the Skeld-lite, authored as data (render-free).
 *
 * Eight named rooms plus corridors, walls as SEGMENTS (with door gaps) —
 * one wall list drives collision, the LOS visibility polygon, and the
 * mesh builder. Vents form the impostor's escape graph. Task stations,
 * the emergency button and the airlock are placed props.
 *
 * Layout (x → east, z → south, meters):
 *
 *        WEAPONS     CAFETERIA     NAVIGATION
 *           MEDBAY   (corr)    SHIELDS
 *        ELECTRICAL   STORAGE
 *           REACTOR
 */
import { PAL } from "./palette";

export interface Room {
  name: string;
  x: number; z: number;   // center
  w: number; d: number;   // full extents
  floor: number;          // accent floor color
}

export const ROOMS: Room[] = [
  { name: "CAFETERIA", x: 0, z: -22, w: 17, d: 11, floor: PAL.extra.floorCaf },
  { name: "WEAPONS", x: -25, z: -19, w: 12, d: 9, floor: PAL.extra.floorWeap },
  { name: "NAVIGATION", x: 25, z: -21, w: 12, d: 9, floor: PAL.extra.floorNav },
  { name: "MEDBAY", x: -27, z: -6, w: 9, d: 8, floor: PAL.extra.floorMed },
  { name: "SHIELDS", x: 24, z: 6, w: 10, d: 8, floor: PAL.extra.floorShields },
  { name: "ELECTRICAL", x: -22, z: 9, w: 10, d: 8, floor: PAL.extra.floorElec },
  { name: "STORAGE", x: 1, z: 18, w: 14, d: 10, floor: PAL.extra.floorStorage },
  { name: "REACTOR", x: -34, z: 20, w: 9, d: 9, floor: PAL.extra.floorReactor },
];

/** corridor floor strips (visual + walkable truth) */
export const CORRIDORS: { x: number; z: number; w: number; d: number }[] = [
  { x: -13.5, z: -20.5, w: 10, d: 3.5 },  // caf ↔ weapons
  { x: 13.5, z: -21.5, w: 10, d: 3.5 },   // caf ↔ navigation
  { x: -22, z: -13, w: 3.5, d: 10 },      // weapons ↔ medbay ↔ …
  { x: -22, z: 0.5, w: 3.5, d: 9 },       // medbay ↔ electrical
  { x: 0, z: -8, w: 3.5, d: 17 },         // caf ↔ storage spine
  { x: 15.5, z: 6, w: 13, d: 3.5 },       // spine ↔ shields
  { x: -12, z: 9.5, w: 10, d: 3.5 },      // electrical ↔ spine
  { x: -8, z: 16, w: 3.5, d: 9 },         // storage west link
  { x: -22.5, z: 18, w: 15, d: 3.5 },     // electrical/storage ↔ reactor
  { x: 1, z: 5, w: 3.5, d: 8 },           // spine ↔ storage
];

export interface Seg { x1: number; z1: number; x2: number; z2: number }

/* Walls: room perimeters with door gaps toward corridors. Built once. */
function roomWalls(): Seg[] {
  const segs: Seg[] = [];
  // door table: room name → list of [side, offsetAlongSide]
  type Side = "N" | "S" | "E" | "W";
  const doors: Record<string, [Side, number][]> = {
    CAFETERIA: [["W", 1.5], ["E", 0.5], ["S", 0]],
    WEAPONS: [["E", -1], ["S", 1.5]],
    NAVIGATION: [["W", -0.5], ["S", 0]],
    MEDBAY: [["E", 0], ["S", 0]],
    SHIELDS: [["W", 0], ["N", -1]],
    ELECTRICAL: [["E", -0.5], ["N", 0], ["S", 1]],
    STORAGE: [["N", -1], ["W", 1], ["N", 3]],
    REACTOR: [["E", 0]],
  };
  const GAP = 2.6; // door width
  for (const r of ROOMS) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2;
    const z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    const ds = doors[r.name] ?? [];
    const sides: { side: Side; a: [number, number]; b: [number, number] }[] = [
      { side: "N", a: [x0, z0], b: [x1, z0] },
      { side: "S", a: [x0, z1], b: [x1, z1] },
      { side: "W", a: [x0, z0], b: [x0, z1] },
      { side: "E", a: [x1, z0], b: [x1, z1] },
    ];
    for (const s of sides) {
      const horizontal = s.side === "N" || s.side === "S";
      const len = horizontal ? r.w : r.d;
      const gaps = ds
        .filter(([side]) => side === s.side)
        .map(([, off]) => len / 2 + off)
        .sort((a, b) => a - b);
      let cur = 0;
      const spans: [number, number][] = [];
      for (const g of gaps) {
        const g0 = Math.max(0, g - GAP / 2);
        const g1 = Math.min(len, g + GAP / 2);
        if (g0 > cur + 0.05) spans.push([cur, g0]);
        cur = g1;
      }
      if (cur < len - 0.05) spans.push([cur, len]);
      for (const [a, b] of spans) {
        if (horizontal) {
          segs.push({
            x1: s.a[0] + a, z1: s.a[1],
            x2: s.a[0] + b, z2: s.a[1],
          });
        } else {
          segs.push({
            x1: s.a[0], z1: s.a[1] + a,
            x2: s.a[0], z2: s.a[1] + b,
          });
        }
      }
    }
  }
  return segs;
}

/** corridor long-edge walls (so corridors are corridors, not open floor) */
function corridorWalls(): Seg[] {
  const segs: Seg[] = [];
  for (const c of CORRIDORS) {
    const x0 = c.x - c.w / 2, x1 = c.x + c.w / 2;
    const z0 = c.z - c.d / 2, z1 = c.z + c.d / 2;
    if (c.w > c.d) {
      // horizontal corridor: walls on N and S edges, with gaps at room doors
      segs.push({ x1: x0, z1: z0, x2: x1, z2: z0 });
      segs.push({ x1: x0, z1: z1, x2: x1, z2: z1 });
    } else {
      segs.push({ x1: x0, z1: z0, x2: x0, z2: z1 });
      segs.push({ x1: x1, z1: z0, x2: x1, z2: z1 });
    }
  }
  return segs;
}

export const WALLS: Seg[] = [...roomWalls(), ...corridorWalls()];

/* ------------------------------------------------------------- queries -- */

function pointInRect(x: number, z: number, r: { x: number; z: number; w: number; d: number }): boolean {
  return Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2;
}

export function roomAt(x: number, z: number): Room | null {
  for (const r of ROOMS) if (pointInRect(x, z, r)) return r;
  return null;
}

/** walkable = inside a room or corridor, not through a wall */
export function inFloor(x: number, z: number): boolean {
  if (roomAt(x, z)) return true;
  for (const c of CORRIDORS) if (pointInRect(x, z, c)) return true;
  return false;
}

/** segment/point distance for collision push-out */
export function segPointDist(s: Seg, x: number, z: number): { d: number; nx: number; nz: number } {
  const vx = s.x2 - s.x1;
  const vz = s.z2 - s.z1;
  const len2 = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / len2));
  const px = s.x1 + vx * t;
  const pz = s.z1 + vz * t;
  const dx = x - px;
  const dz = z - pz;
  const d = Math.hypot(dx, dz) || 0.0001;
  return { d, nx: dx / d, nz: dz / d };
}

/** does the segment block the line a→b? (cheap 2D segment intersection) */
export function segBlocks(s: Seg, ax: number, az: number, bx: number, bz: number): boolean {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = s.x2 - s.x1;
  const sZ = s.z2 - s.z1;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((s.x1 - ax) * sZ - (s.z1 - az) * sX) / denom;
  const u = ((s.x1 - ax) * rZ - (s.z1 - az) * rX) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/** line-of-sight between two points against the wall list */
export function hasLOS(ax: number, az: number, bx: number, bz: number): boolean {
  for (const s of WALLS) {
    if (segBlocks(s, ax, az, bx, bz)) return false;
  }
  return true;
}

/* --------------------------------------------------------------- props -- */

export interface Station { task: string; label: string; room: string; x: number; z: number }
export const STATIONS: Station[] = [
  { task: "wires", label: "FIX WIRING", room: "ELECTRICAL", x: -22, z: 12 },
  { task: "asteroids", label: "CLEAR ASTEROIDS", room: "WEAPONS", x: -28, z: -20 },
  { task: "fuel", label: "FUEL ENGINES", room: "STORAGE", x: 4, z: 21 },
  { task: "download", label: "DOWNLOAD DATA", room: "NAVIGATION", x: 28, z: -22 },
  { task: "divert", label: "DIVERT POWER", room: "REACTOR", x: -35, z: 22 },
];

export const BUTTON = { x: 0, z: -22 };        // cafeteria center table
export const AIRLOCK = { x: 1, z: 24 };        // storage south edge
export const VENTS: { x: number; z: number; to: number }[] = [
  { x: -34, z: 17, to: 1 },   // reactor →
  { x: -25, z: 12, to: 2 },   // electrical →
  { x: 5, z: 15, to: 3 },     // storage →
  { x: 26, z: 4, to: 0 },     // shields → reactor
];

export const PLAYER_SPAWN = { x: 0, z: -24 };
