/**
 * palette.ts — the studio palette architecture.
 *
 * One semantic STRUCTURE is fixed by the franchise (ink / sky ladder /
 * terrain bands / accents / haze + silhouettes); each game swaps the VALUES
 * to change the movie. `extendPalette` deep-merges per-game overrides onto
 * the base and accepts an `extra` bag for game-specific named hexes, so no
 * subsystem ever hardcodes a rogue hex.
 *
 * `col()` is a shared THREE.Color cache keyed by hex value — cheap to call
 * in hot paths, but NEVER mutate the returned color (clone first).
 */
import * as THREE from "three";

export interface SkyLadderStop {
  /** elevation (view-dir y) at which this band kicks in */
  at: number;
  color: number;
}

export interface Palette {
  ink: {
    /** outlines, HUD borders */
    line: number;
    /** darkest ink — vignette, backdrops */
    deep: number;
  };
  sky: {
    /** elevation band ladder, low -> high (first entry = base band) */
    ladder: SkyLadderStop[];
    /** below-horizon fallback */
    abyss: number;
    sunCore: number;
    sunDisc: number;
    sunGlow: number;
    cloudTop: number;
    cloudRim: number;
  };
  terrain: {
    lit: number;
    litHot: number;
    mid: number;
    shadow: number;
    deep: number;
  };
  accents: {
    primary: number;
    primaryDeep: number;
    rimHot: number;
    rimCool: number;
  };
  atmosphere: {
    haze: number;
    silhouetteFar: number;
    silhouetteMid: number;
    silhouetteNear: number;
  };
  /** game-specific named hexes (creature colors, team pairs, UI pops) */
  extra: Record<string, number>;
}

/**
 * The studio default movie: a warm golden-hour read. Games override values,
 * never the shape — a viewer should clock "same team" from the structure.
 */
export const basePalette: Palette = {
  ink: { line: 0x241433, deep: 0x150a24 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xff8a3d },   // horizon band (base)
      { at: 0.014, color: 0xffc36b },  // hot strip over the horizon
      { at: 0.06, color: 0xe0567d },   // rose
      { at: 0.14, color: 0x7a3f8f },   // violet
      { at: 0.3, color: 0x3a2568 },    // upper indigo
      { at: 0.55, color: 0x1c1444 },   // zenith
    ],
    abyss: 0x1a0f2e,
    sunCore: 0xfff3cf,
    sunDisc: 0xffdc9e,
    sunGlow: 0xffc36b,
    cloudTop: 0x2e1748,
    cloudRim: 0xffb067,
  },
  terrain: {
    lit: 0xd98848,
    litHot: 0xf0a95c,
    mid: 0x9c5f58,
    shadow: 0x4a3678,
    deep: 0x33235c,
  },
  accents: {
    primary: 0x35e0c8,
    primaryDeep: 0x128f84,
    rimHot: 0xffa03c,
    rimCool: 0x3fd8cf,
  },
  atmosphere: {
    haze: 0xe87a44,
    silhouetteFar: 0x8f4a78,
    silhouetteMid: 0x61305f,
    silhouetteNear: 0x3a2050,
  },
  extra: {},
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type PaletteOverrides = DeepPartial<Omit<Palette, "extra">> & {
  extra?: Record<string, number>;
};

function merge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || Array.isArray(over)) return (over ?? base) as T;
  if (typeof base === "object" && typeof over === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
    return out as T;
  }
  return over as T;
}

/** Per-game palette: base structure, game values. */
export function extendPalette(overrides: PaletteOverrides): Palette {
  return merge(basePalette, overrides);
}

/* -------------------------------------------------- cached color helper -- */

const cache = new Map<number, THREE.Color>();

/** Shared THREE.Color for a hex value (do NOT mutate; clone if you must). */
export function col(hex: number): THREE.Color {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    cache.set(hex, c);
  }
  return c;
}

/** CSS `#rrggbb` for a hex value (HUD / canvas2d use). */
export function css(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}

/** Linear interpolate two hex colors, returns a fresh THREE.Color. */
export function mixCol(a: number, b: number, t: number): THREE.Color {
  return col(a).clone().lerp(col(b), t);
}
