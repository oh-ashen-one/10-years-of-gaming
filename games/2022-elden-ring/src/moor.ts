/**
 * moor.ts — the misted valley beneath the golden tree (render-free).
 *
 *   FIRST STEP GRACE  (0,0)        spawn + checkpoint
 *   THE PATH NORTH    z 0 → -140   three soldier packs teach the moves
 *   SCARAB HOLLOW     (30,-70)     a scarab worth a flask
 *   GATEHOUSE GRACE   (0,-140)     last rest before the fog gate
 *   FOG GATE          (0,-158)     the white wall
 *   WARDEN'S BRIDGE   (0,-185)     a stone span over the mist-chasm
 *   THE GOLDEN TREE   far north    the sky's whole point
 *
 * heightAt() is THE height truth. The path is a carved ramp descending
 * north; the bridge is a flat span; the chasm beyond is a kill-free
 * visual (walls keep the player in).
 */
import { fbm } from "@tenyears/core";

export const WORLD = 300;
export const GRACE_START = { x: 0, z: 0 };
export const GRACE_GATE = { x: 0, z: -140 };
export const FOG_GATE = { x: 0, z: -158, w: 12 };
export const BRIDGE = { x: 0, z: -185, w: 16, len: 34 };
export const TREE_POS = { x: 30, z: -420 };
export const SCARAB = { x: 30, z: -70 };

export const PACKS: { x: number; z: number; n: number }[] = [
  { x: 0, z: -40, n: 2 },   // pack one: the lesson
  { x: -14, z: -80, n: 2 }, // pack two: the test
  { x: 10, z: -112, n: 2 }, // pack three: the exam (drops the hint)
];

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The one height truth: moor bumps, the north ramp, the flat bridge. */
export function heightAt(x: number, z: number): number {
  let h = fbm(x * 0.02 + 1.9, z * 0.02 + 4.4, 3) * 4 - 1.5;
  // the path corridor north stays walkable
  const onPath = sstep(24, 8, Math.abs(x));
  h *= 1 - onPath * 0.7;
  // the bridge span is flat (soft rectangle mask)
  const bx = 1 - sstep(BRIDGE.w * 0.7, BRIDGE.w * 1.6, Math.abs(x - BRIDGE.x));
  const bz = 1 - sstep(BRIDGE.len * 0.6, BRIDGE.len * 1.1, Math.abs(z - BRIDGE.z));
  const flat = Math.min(bx, bz);
  h = h * (1 - flat) + (-2) * flat;
  // chasm walls off the world edges east/west — raise the rims
  h += sstep(60, 110, Math.abs(x)) * 22;
  h += sstep(40, 80, z) * 18;      // south rim behind spawn
  h += sstep(-215, -260, z) * 30;  // beyond the bridge: the chasm far wall
  return h;
}

/** walkable bounds (soft walls) */
export function inBounds(x: number, z: number): boolean {
  if (Math.abs(x) > 70) return false;
  if (z > 30) return false;
  if (z < -BRIDGE.z - BRIDGE.len / 2 + 2 && Math.abs(x) > BRIDGE.w / 2 - 1) return false; // stay on the bridge
  if (z < -232) return false;
  return true;
}

/** through the fog gate? */
export function pastGate(z: number): boolean {
  return z < FOG_GATE.z;
}
