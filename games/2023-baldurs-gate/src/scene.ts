/**
 * scene.ts — the tollhouse bridge, authored as data (render-free).
 *
 * The river runs east–west; the bridge crosses it southbound; the
 * tollhouse squats on the south bank with its toll chest. Zones that
 * matter: the RIVER (shove things into it = the kill), the BRIDGE deck
 * (the stage), the dialogue trigger at the bridge's north foot.
 *
 *   NORTH BANK     approach grass, the party's start
 *   RIVER          z ∈ [-4, 4] — the blue band
 *   THE BRIDGE     x ∈ [-3, 3] over the river
 *   TOLLHOUSE      south bank yard + cottage + chest + candles
 *   TAVERN CORNER  far east — the title diorama (candle-lit table, dice)
 */

export const RIVER = { z0: -4, z1: 4 };
export const BRIDGE = { x0: -3.2, x1: 3.2, z0: -9, z1: 9 };
export const PARTY_START = { x: 0, z: -22 };
export const TOLLKEEPER_AT = { x: 0, z: -7 };       // blocks the bridge foot
export const DIALOGUE_TRIGGER = { x: 0, z: -12, r: 3.5 };
export const TOLLHOUSE = { x: 12, z: 14 };
export const CHEST = { x: 10.5, z: 11.5 };
export const TAVERN = { x: 70, z: 40 };             // title diorama corner
export const GUARDS_AT = [
  { x: -8, z: 10 },
  { x: 6, z: 12 },
  { x: 14, z: 6 },
];

/** in the drink? (not on the bridge deck) */
export function inRiver(x: number, z: number): boolean {
  return z > RIVER.z0 && z < RIVER.z1 && !(x > BRIDGE.x0 && x < BRIDGE.x1);
}

/** walkable scene bounds */
export function inBounds(x: number, z: number): boolean {
  if (inRiver(x, z)) return false; // (for walking — shoves can put you there)
  if (Math.abs(x) > 34 || Math.abs(z) > 30) return false;
  // tollhouse walls block
  if (Math.abs(x - TOLLHOUSE.x) < 4.5 && Math.abs(z - (TOLLHOUSE.z + 3)) < 3.5) return false;
  return true;
}

/** candle positions (dip-the-blade spots) */
export const CANDLES = [
  { x: -4.5, z: -6 },
  { x: 4.5, z: 6 },
  { x: 8, z: 13 },
  { x: 14, z: 10 },
];
