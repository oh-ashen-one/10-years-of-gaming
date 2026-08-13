/**
 * ward.ts — St. Veronica's Ward A, ground floor (render-free).
 *
 *   LOBBY        z 6..-6      the entrance; rain outside
 *   CORRIDOR     x ±2, z -6..-58   the spine; two tube lights, skylight
 *   EXAM ROOM    east z -10..-18   THE FUSE + ammo
 *   WARD A ROOM  west z -22..-30   a herb + ammo, a shambler
 *   WARD B       east z -34        SEALED — the flavor plate
 *   MORGUE       west z -40..-48   THE CRANK, guarded
 *   DIRECTOR'S   east z -46..-54   crank-locked door; the power panel,
 *                                  the desk with the elevator key
 *   ELEVATOR     z -58             the way out
 *
 * Walkability = the union of RECTS (door rects unlock). Walls for the eye
 * come from the same numbers in hospital.ts. One truth.
 */

export interface Rect { x0: number; z0: number; x1: number; z1: number; }

export const LOBBY: Rect = { x0: -5, z0: -6, x1: 5, z1: 6 };
export const CORRIDOR: Rect = { x0: -2, z0: -58, x1: 2, z1: -6 };
export const EXAM: Rect = { x0: 2, z0: -18, x1: 10, z1: -10 };
export const WARDA: Rect = { x0: -10, z0: -30, x1: -2, z1: -22 };
export const MORGUE: Rect = { x0: -11, z0: -48, x1: -2, z1: -40 };
export const DIRECTOR: Rect = { x0: 2, z0: -54, x1: 10, z1: -46 };
export const LIFT: Rect = { x0: -1.6, z0: -60.5, x1: 1.6, z1: -58 };

/* door gaps in the corridor walls */
export const D_EXAM: Rect = { x0: 1.2, z0: -15.8, x1: 2.8, z1: -14.2 };
export const D_WARDA: Rect = { x0: -2.8, z0: -27.8, x1: -1.2, z1: -26.2 };
export const D_MORGUE: Rect = { x0: -2.8, z0: -45.8, x1: -1.2, z1: -44.2 };
export const D_DIRECTOR: Rect = { x0: 1.2, z0: -51.8, x1: 2.8, z1: -50.2 }; // crank-locked
export const D_LIFT: Rect = { x0: -1.6, z0: -59, x1: 1.6, z1: -57.6 };     // the finale

export const WARDB_PLATE = { x: 2, z: -34 }; // "WARD B — SEALED SHUT"

/* items + interactables */
export const FUSE_AT = { x: 8.6, z: -14 };
export const AMMO1_AT = { x: 4, z: -11.5 };
export const HERB1_AT = { x: -8.4, z: -26 };
export const AMMO2_AT = { x: -4, z: -23 };
export const CRANK_AT = { x: -9.6, z: -44 };
export const HERB2_AT = { x: -4, z: -46.5 };
export const PANEL_AT = { x: 9.6, z: -50 };       // in the director's office
export const DESK_KEY_AT = { x: 7.4, z: -52.4 };  // the elevator key (needs light)
export const ELEVATOR_AT = { x: 0, z: -58 };

export const SHAMBLERS_AT = [
  { x: 0.5, z: -24 },   // the corridor one — first contact
  { x: -7, z: -27 },    // the ward A room
  { x: -8, z: -43 },    // the morgue guard
];
export const PURSUER_WAKE = { x: 0, z: -30 };

/* tube lights: one per corridor stretch + the office (dark till power) */
export const TUBES = [
  { x: 0, z: -16 },
  { x: 0, z: -38 },
  { x: 6, z: -50, office: true }, // hums on with the power
];
export const SKYLIGHTS = [
  { x0: -2, z0: -28, x1: 2, z1: -24 },  // corridor moon shaft
  { x0: -3, z0: -2, x1: 3, z1: 2 },     // lobby
];

export function heightAt(_x: number, _z: number): number {
  return 0; // slab-flat; the horror is in the light
}

/** walkable? the union of rects; locked doors drop out of the set */
export function inBounds(x: number, z: number, directorOpen: boolean, liftOpen: boolean): boolean {
  const m = 0.32; // the body radius
  const inR = (r: Rect) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
  if (inR(LOBBY) || inR(CORRIDOR) || inR(EXAM) || inR(WARDA) || inR(MORGUE)) return true;
  if (inR(D_EXAM) || inR(D_WARDA) || inR(D_MORGUE)) return true;
  if (directorOpen && (inR(D_DIRECTOR) || inR(DIRECTOR))) return true;
  if (liftOpen && (inR(D_LIFT) || inR(LIFT))) return true;
  return false;
}
