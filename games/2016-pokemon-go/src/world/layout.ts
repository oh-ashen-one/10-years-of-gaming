/**
 * layout.ts — the neighborhood, authored as named beats (render-free).
 *
 * A procedural-but-authored grid: streets on an 80 m pitch, 4×4 blocks,
 * and four hand-placed places that carry the game's beats:
 *
 *   CROWN PLAZA      (-40,-40)  the gym tower; the 8:00 battle beat
 *   WHISTLE PARK     (120,-40)  east park; dense grass spawns
 *   DANDELION GREEN  (-120,40)  west park; quiet, lizards
 *   MIRROR POND      (40,120)   the pond; turtles + the rare gold duck
 *   HOME CORNER      (0,0)      street crossing where the player spawns
 *
 * The biome map is THE spatial truth: baked once into a grid that BOTH the
 * ground shader (as a texture) and the game logic (spawn director, water
 * blocking) read. One truth, no drift.
 */

export type Biome = "street" | "sidewalk" | "park" | "water" | "plaza" | "lawn";

export const WORLD_SIZE = 400;          // ground plane extent
export const WORLD_HALF = WORLD_SIZE / 2;
const PITCH = 80;                        // street grid pitch
const STREET_W = 9;
const SIDEWALK_W = 4;
const STREET_LINES = [-160, -80, 0, 80, 160];

/** Named places, world coords. */
export const PLACES = {
  plaza: { x: -40, z: -40, r: 30 },
  parkEast: { x: 120, z: -40, r: 34 },
  parkWest: { x: -120, z: 40, r: 34 },
  pond: { x: 40, z: 120, rx: 24, rz: 18 },
  home: { x: 9, z: 9 },
  gym: { x: -40, z: -40 },   // tower base at plaza center
} as const;

const PARK_CELLS = [
  { x: PLACES.parkEast.x, z: PLACES.parkEast.z },
  { x: PLACES.parkWest.x, z: PLACES.parkWest.z },
];

/* ---------------------------------------------------------- biome bake -- */

export const BIOME_ID: Record<Biome, number> = {
  lawn: 0,
  street: 1,
  sidewalk: 2,
  park: 3,
  water: 4,
  plaza: 5,
};
export const ID_BIOME: Biome[] = ["lawn", "street", "sidewalk", "park", "water", "plaza"];

export const BIOME_RES = 256;
const grid = new Uint8Array(BIOME_RES * BIOME_RES);

function classify(x: number, z: number): Biome {
  // plaza disc first (it owns its block)
  const pd = Math.hypot(x - PLACES.plaza.x, z - PLACES.plaza.z);
  if (pd < PLACES.plaza.r) return "plaza";

  // pond ellipse
  const pe =
    ((x - PLACES.pond.x) / PLACES.pond.rx) ** 2 + ((z - PLACES.pond.z) / PLACES.pond.rz) ** 2;
  if (pe < 1) return "water";

  // streets + sidewalks
  let onStreet = false;
  let onSidewalk = false;
  for (const s of STREET_LINES) {
    const dx = Math.abs(x - s);
    const dz = Math.abs(z - s);
    if (dx < STREET_W / 2 || dz < STREET_W / 2) onStreet = true;
    if (dx < STREET_W / 2 + SIDEWALK_W || dz < STREET_W / 2 + SIDEWALK_W) onSidewalk = true;
  }
  if (onStreet) return "street";
  if (onSidewalk) return "sidewalk";

  // parks own their blocks
  for (const p of PARK_CELLS) {
    if (Math.abs(x - p.x) < 34 && Math.abs(z - p.z) < 34) return "park";
  }
  // pond block is grass around the water
  if (Math.abs(x - PLACES.pond.x) < 34 && Math.abs(z - PLACES.pond.z) < 34) return "park";

  return "lawn";
}

for (let j = 0; j < BIOME_RES; j++) {
  for (let i = 0; i < BIOME_RES; i++) {
    const x = (i / (BIOME_RES - 1)) * WORLD_SIZE - WORLD_HALF;
    const z = (j / (BIOME_RES - 1)) * WORLD_SIZE - WORLD_HALF;
    grid[j * BIOME_RES + i] = BIOME_ID[classify(x, z)];
  }
}

/** The one biome truth, read by logic and (via texture) the ground shader. */
export function biomeAt(x: number, z: number): Biome {
  const i = Math.round(((x + WORLD_HALF) / WORLD_SIZE) * (BIOME_RES - 1));
  const j = Math.round(((z + WORLD_HALF) / WORLD_SIZE) * (BIOME_RES - 1));
  if (i < 0 || j < 0 || i >= BIOME_RES || j >= BIOME_RES) return "lawn";
  return ID_BIOME[grid[j * BIOME_RES + i]];
}

/** Raw bake for the ground shader's DataTexture. */
export function biomeGrid(): Uint8Array {
  return grid;
}

/** The world is flat — one height truth, here for discipline (§2.4). */
export function heightAt(_x: number, _z: number): number {
  return 0;
}

/** Walkable check: water and the gym tower base block movement. */
export function walkable(x: number, z: number): boolean {
  if (Math.abs(x) > WORLD_HALF - 6 || Math.abs(z) > WORLD_HALF - 6) return false;
  if (biomeAt(x, z) === "water") return false;
  if (Math.hypot(x - PLACES.gym.x, z - PLACES.gym.z) < 8) return false;
  return true;
}

/** A random point on the pond shore ring (for pond spawns). */
export function pondShorePoint(angle: number, out: { x: number; z: number }): void {
  const r = 1.18; // just outside the ellipse
  out.x = PLACES.pond.x + Math.cos(angle) * PLACES.pond.rx * r;
  out.z = PLACES.pond.z + Math.sin(angle) * PLACES.pond.rz * r;
}

/** Distance to the pond water edge (for "near water" spawn rules). */
export function nearWater(x: number, z: number, margin = 12): boolean {
  const e =
    ((x - PLACES.pond.x) / (PLACES.pond.rx + margin)) ** 2 +
    ((z - PLACES.pond.z) / (PLACES.pond.rz + margin)) ** 2;
  return e < 1 && biomeAt(x, z) !== "water";
}
