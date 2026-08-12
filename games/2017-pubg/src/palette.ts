/**
 * palette.ts — the 2017 movie: a dusty late-afternoon island.
 *
 * Azure sky ladder under a high warm sun, pale wheat, olive grass, white
 * cottages, lilac haze. Structure from the studio base; values only.
 * Everything in the game pulls from here — no rogue hexes.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x2b2440, deep: 0x1a162e },
  sky: {
    ladder: [
      { at: -1.0, color: 0xffd9a8 },  // dusty warm horizon
      { at: 0.015, color: 0xf0e0b8 }, // pale straw
      { at: 0.07, color: 0xb8dcf0 },  // hazy azure
      { at: 0.16, color: 0x78b8e8 },  // azure
      { at: 0.34, color: 0x4a90d8 },  // upper blue
      { at: 0.58, color: 0x3a6fc8 },  // zenith
    ],
    abyss: 0x3a4a78,
    sunCore: 0xfff8e8,
    sunDisc: 0xffeec0,
    sunGlow: 0xffd9a0,
    cloudTop: 0xf4f0e4,
    cloudRim: 0xffd9a0,
  },
  terrain: {
    lit: 0xe0c878,      // pale wheat in sun
    litHot: 0xf0dda0,   // wheat crest
    mid: 0x8a9a5a,      // olive grass
    shadow: 0x5a6a8a,   // cool shadow
    deep: 0x3f4a6e,     // deepest shade
  },
  accents: {
    primary: 0xf2952a,     // the orange — kills, prompts, dinner
    primaryDeep: 0xc86a1a,
    rimHot: 0xffd9a0,
    rimCool: 0xa8d8f0,
  },
  atmosphere: {
    haze: 0xd8c8e0,             // lilac haze
    silhouetteFar: 0xb0a0cc,    // distant ridge
    silhouetteMid: 0x8f7ab5,    // treelines
    silhouetteNear: 0x6a5898,   // radar station ridge
  },
  extra: {
    zoneBlue: 0x3fa8ff,
    zoneDeep: 0x1a6fd8,
    cottage: 0xf0ece0,
    roof: 0xc86a4a,
    barn: 0xb8563c,
    dirt: 0xb09a78,
    sand: 0xe8d8a8,
    water: 0x3f88c8,
    waterDeep: 0x2a68a8,
    wheat: 0xe0c878,
    wheatDark: 0xc0a858,
    trunk: 0x7a5a40,
    pine: 0x5a7a4a,
    buggy: 0xc83c2a,
    blood: 0xd83a2a,
    armor: 0x6a7a8a,
    medkit: 0xf0f0f0,
    rifle: 0x4a4a55,
    mapPaper: 0xe8ddc0,
  },
});
