/**
 * world.ts — the voxel truth. One Uint8Array of block ids; EVERYTHING
 * reads it: the mesher bakes it, the physics collides with it, the
 * raycaster breaks/places against it, mob AI walks on it. Bake, never
 * displace-in-shader.
 *
 * The valley (256×256, ~48 deep), authored beats:
 *   SPAWN MEADOW   (100,150)  flat plains, first trees in sight
 *   OAK GROVE      ( 60, 60)  dense punchable oaks
 *   STONE HILL     (185,100)  bare stone rise with coal + iron veins
 *   THE CAVE       mouth (150,100) → chamber (182,100) — ore glints inside
 *
 * Also: DDA raycast, AABB collision helpers, the torch registry (torch
 * glow is baked into chunk meshes by mesher.ts).
 */
import { fbm, hash1 } from "@tenyears/core";

export const SIZE = 256;
export const H = 48;
export const HALF = SIZE / 2;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, COAL: 8, IRON: 9, TORCH: 10, TABLE: 11, DOOR: 12,
} as const;
export type BlockId = (typeof B)[keyof typeof B];

export const SOLID: Set<number> = new Set([B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.LOG, B.LEAVES, B.PLANKS, B.COAL, B.IRON, B.TABLE, B.DOOR]);

export const BLOCK_NAME: Record<number, string> = {
  [B.GRASS]: "Grass", [B.DIRT]: "Dirt", [B.STONE]: "Stone", [B.COBBLE]: "Cobblestone",
  [B.LOG]: "Oak Log", [B.LEAVES]: "Leaves", [B.PLANKS]: "Planks", [B.COAL]: "Coal Ore",
  [B.IRON]: "Iron Ore", [B.TORCH]: "Torch", [B.TABLE]: "Crafting Table", [B.DOOR]: "Door",
};

export const GROVE = { x: 60, z: 60, r: 42 };
export const HILL = { x: 185, z: 100, r: 45 };
export const CAVE_MOUTH = { x: 150, z: 100 };
export const CAVE_CORE = { x: 182, z: 100 };
export const SPAWN = { x: 100, z: 152 };

/* -------------------------------------------------------------- storage -- */

const data = new Uint8Array(SIZE * H * SIZE);

export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < H;
}

export function getBlock(x: number, y: number, z: number): number {
  if (!inBounds(x, y, z)) return B.AIR;
  return data[(x * SIZE + z) * H + y];
}

export function isSolid(x: number, y: number, z: number): boolean {
  if (y < 0) return true;           // bedrock floor
  if (!inBounds(x, y, z)) return false; // open sky / world rim is air
  return SOLID.has(data[(x * SIZE + z) * H + y]);
}

/** chunk dirty callbacks — mesher subscribes */
type DirtyFn = (cx: number, cz: number) => void;
let onDirty: DirtyFn | null = null;
export function setDirtyHandler(fn: DirtyFn): void {
  onDirty = fn;
}

export function setBlock(x: number, y: number, z: number, id: number): void {
  if (!inBounds(x, y, z)) return;
  data[(x * SIZE + z) * H + y] = id;
  if (onDirty) {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    onDirty(cx, cz);
    // edge blocks dirty the neighbor chunk too
    if (x % 16 === 0) onDirty(cx - 1, cz);
    if (x % 16 === 15) onDirty(cx + 1, cz);
    if (z % 16 === 0) onDirty(cx, cz - 1);
    if (z % 16 === 15) onDirty(cx, cz + 1);
  }
}

/** Highest solid block at (x,z) — the surface. */
export function surfaceY(x: number, z: number): number {
  for (let y = H - 1; y >= 0; y--) {
    if (isSolid(x, y, z)) return y;
  }
  return 0;
}

/* ------------------------------------------------------------ generation -- */

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function generateWorld(): void {
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      // plains base + gentle rolls
      let h = 8 + fbm(x * 0.02 + 3.7, z * 0.02 - 1.9, 4) * 7;
      // stone hill: a bare rise
      const hd = Math.hypot(x - HILL.x, z - HILL.z);
      const hill = 15 * (1 - sstep(HILL.r * 0.4, HILL.r, hd));
      h += hill;
      const top = Math.floor(h);
      const rocky = hill > 5;
      for (let y = 0; y <= top; y++) {
        let id: number = B.STONE;
        if (!rocky) {
          if (y === top) id = B.GRASS;
          else if (y > top - 3) id = B.DIRT;
        }
        data[(x * SIZE + z) * H + y] = id;
      }
      // coal veins in any stone, iron only deep in the hill
      if (top > 6) {
        for (let y = 3; y < top - 1; y++) {
          const n = fbm(x * 0.11 + 50, (z * 0.11 + y * 0.13) - 30, 3);
          if (n > 0.72) data[(x * SIZE + z) * H + y] = B.COAL;
          else if (hd < HILL.r && y < top - 4 && n < 0.24) {
            data[(x * SIZE + z) * H + y] = B.IRON;
          }
        }
      }
    }
  }

  // the cave: mouth on the hill's west flank, tube to a chamber
  for (let x = CAVE_MOUTH.x; x <= CAVE_CORE.x + 6; x++) {
    const t = (x - CAVE_MOUTH.x) / (CAVE_CORE.x - CAVE_MOUTH.x);
    const cy = Math.floor(9 + t * 2);
    const cz = CAVE_MOUTH.z + Math.sin(t * Math.PI * 2.2) * 2;
    const r = 1.8 + t * 1.6;
    for (let y = cy - 1; y <= cy + 4; y++) {
      for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (inBounds(xx, y, z) && getBlock(xx, y, z) !== B.AIR) {
            data[(xx * SIZE + z) * H + y] = B.AIR;
          }
        }
      }
    }
  }
  // ore glints in the chamber walls
  for (let i = 0; i < 14; i++) {
    const a = hash1(i * 3.3) * Math.PI * 2;
    const y = 9 + Math.floor(hash1(i * 7.7) * 5);
    const x = Math.floor(CAVE_CORE.x + Math.cos(a) * (3 + hash1(i * 5.1) * 3));
    const z = Math.floor(CAVE_CORE.z + Math.sin(a) * (3 + hash1(i * 9.9) * 3));
    if (inBounds(x, y, z) && getBlock(x, y, z) === B.STONE) {
      data[(x * SIZE + z) * H + y] = i % 3 === 0 ? B.IRON : B.COAL;
    }
  }

  // oak grove + a few plains trees
  let planted = 0;
  for (let i = 0; i < 200 && planted < 46; i++) {
    const inGrove = i < 150;
    const a = hash1(i * 3.17) * Math.PI * 2;
    const r = inGrove ? hash1(i * 7.71) * GROVE.r : 60 + hash1(i * 7.71) * 60;
    const cx = inGrove ? GROVE.x : SPAWN.x;
    const cz = inGrove ? GROVE.z : SPAWN.z;
    const x = Math.floor(cx + Math.cos(a) * r);
    const z = Math.floor(cz + Math.sin(a) * r);
    if (!inBounds(x, 20, z) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8) continue;
    if (getBlock(x, surfaceY(x, z), z) !== B.GRASS) continue;
    plantTree(x, surfaceY(x, z), z, 4 + Math.floor(hash1(i * 13.7) * 2));
    planted++;
  }
}

function plantTree(x: number, y: number, z: number, h: number): void {
  for (let i = 1; i <= h; i++) {
    if (inBounds(x, y + i, z)) data[(x * SIZE + z) * H + y + i] = B.LOG;
  }
  for (let dy = h - 2; dy <= h + 1; dy++) {
    const r = dy > h ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy <= h) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && hash1(x * 3 + z * 7 + dy) > 0.5) continue;
        const yy = y + dy;
        if (inBounds(x + dx, yy, z + dz) && getBlock(x + dx, yy, z + dz) === B.AIR) {
          data[((x + dx) * SIZE + (z + dz)) * H + yy] = B.LEAVES;
        }
      }
    }
  }
}

/* --------------------------------------------------------- torch registry -- */

const torches = new Map<string, { x: number; y: number; z: number }>();

export function addTorch(x: number, y: number, z: number): void {
  torches.set(`${x},${y},${z}`, { x, y, z });
}
export function removeTorch(x: number, y: number, z: number): void {
  torches.delete(`${x},${y},${z}`);
}
export function torchList(): { x: number; y: number; z: number }[] {
  return [...torches.values()];
}
/** 0..1 glow at a point — mesher bakes this per vertex. */
export function torchGlow(x: number, y: number, z: number): number {
  let g = 0;
  for (const t of torches.values()) {
    const d = Math.hypot(t.x - x, t.y - y, t.z - z);
    if (d < 9) g = Math.max(g, 1 - d / 9);
  }
  return g;
}

/* -------------------------------------------------------------- raycast -- */

export interface RayHit {
  x: number; y: number; z: number;      // block hit
  nx: number; ny: number; nz: number;   // face normal (for placement)
  dist: number;
}

/** Voxel DDA — the break/place truth. */
export function raycast(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): RayHit | null {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dx);
  const tDeltaY = Math.abs(1 / dy);
  const tDeltaZ = Math.abs(1 / dz);
  let tMaxX = dx > 0 ? (x + 1 - ox) * tDeltaX : (ox - x) * tDeltaX;
  let tMaxY = dy > 0 ? (y + 1 - oy) * tDeltaY : (oy - y) * tDeltaY;
  let tMaxZ = dz > 0 ? (z + 1 - oz) * tDeltaZ : (oz - z) * tDeltaZ;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  for (let i = 0; i < 256; i++) {
    if (t > maxDist) return null;
    if (isSolid(x, y, z)) return { x, y, z, nx, ny, nz, dist: t };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

/* ------------------------------------------------------------- collision -- */

/** Resolve an AABB move against the voxel grid, axis by axis. */
export function collideAABB(
  px: number, py: number, pz: number,
  dx: number, dy: number, dz: number,
  w: number, h: number,
): { x: number; y: number; z: number; grounded: boolean } {
  let x = px, y = py, z = pz;
  let grounded = false;

  // Y axis
  y += dy;
  {
    const minX = Math.floor(x - w / 2), maxX = Math.floor(x + w / 2 - 1e-6);
    const minZ = Math.floor(z - w / 2), maxZ = Math.floor(z + w / 2 - 1e-6);
    if (dy < 0) {
      const yy = Math.floor(y);
      outer: for (let bx = minX; bx <= maxX; bx++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(bx, yy, bz)) {
            y = yy + 1;
            grounded = true;
            break outer;
          }
        }
      }
    } else if (dy > 0) {
      const yy = Math.floor(y + h);
      for (let bx = minX; bx <= maxX; bx++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(bx, yy, bz)) {
            y = yy - h - 0.001;
            break;
          }
        }
      }
    }
  }

  // X axis
  x += dx;
  {
    const minY = Math.floor(y), maxY = Math.floor(y + h - 1e-6);
    const minZ = Math.floor(z - w / 2), maxZ = Math.floor(z + w / 2 - 1e-6);
    if (dx > 0) {
      const xx = Math.floor(x + w / 2);
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(xx, by, bz)) { x = xx - w / 2 - 0.001; by = maxY + 1; break; }
        }
      }
    } else if (dx < 0) {
      const xx = Math.floor(x - w / 2);
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(xx, by, bz)) { x = xx + 1 + w / 2 + 0.001; by = maxY + 1; break; }
        }
      }
    }
  }

  // Z axis
  z += dz;
  {
    const minY = Math.floor(y), maxY = Math.floor(y + h - 1e-6);
    const minX = Math.floor(x - w / 2), maxX = Math.floor(x + w / 2 - 1e-6);
    if (dz > 0) {
      const zz = Math.floor(z + w / 2);
      for (let by = minY; by <= maxY; by++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(bx, by, zz)) { z = zz - w / 2 - 0.001; by = maxY + 1; break; }
        }
      }
    } else if (dz < 0) {
      const zz = Math.floor(z - w / 2);
      for (let by = minY; by <= maxY; by++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(bx, by, zz)) { z = zz + 1 + w / 2 + 0.001; by = maxY + 1; break; }
        }
      }
    }
  }

  return { x, y, z, grounded };
}

/** Can a mob step up one block here? (cheap pathfind assist) */
export function canStepUp(x: number, y: number, z: number): boolean {
  return isSolid(Math.floor(x), Math.floor(y), Math.floor(z)) &&
    !isSolid(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) &&
    !isSolid(Math.floor(x), Math.floor(y) + 2, Math.floor(z));
}
