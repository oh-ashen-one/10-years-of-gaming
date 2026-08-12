/**
 * palette.ts — the 2016 movie: a cheerful Saturday-morning neighborhood.
 *
 * Teal morning sky ladder, big warm sun, flat park greens, cream sidewalks,
 * a purple gym tower with gold trim. Structure comes from the studio base;
 * only values change. No rogue hexes anywhere else in the game — creatures,
 * HUD and FX all pull from here (`PAL.extra` for game-specific pops).
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x232a55, deep: 0x171c36 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xffe9b8 },  // warm cream horizon
      { at: 0.015, color: 0xb8f0dc }, // pale mint
      { at: 0.07, color: 0x7fe0d0 },  // teal
      { at: 0.16, color: 0x4cc4c8 },  // bright cyan-teal
      { at: 0.34, color: 0x3a9ec8 },  // morning blue
      { at: 0.58, color: 0x2f6fb8 },  // zenith blue
    ],
    abyss: 0x2a3a68,
    sunCore: 0xfff8e0,
    sunDisc: 0xffe9a8,
    sunGlow: 0xffd98a,
    cloudTop: 0xe8f6f2,
    cloudRim: 0xffd9a0,
  },
  terrain: {
    lit: 0x63c96a,      // park grass in sun
    litHot: 0x8fe07a,   // grass crest / mow stripes
    mid: 0x9b94b8,      // street asphalt (soft violet-gray)
    shadow: 0x4a5a9e,   // cool shadow band
    deep: 0x2f3a72,     // deepest shadow
  },
  accents: {
    primary: 0x18c8b8,     // phone UI teal
    primaryDeep: 0x0f8f88,
    rimHot: 0xffd98a,      // morning sun rim
    rimCool: 0xa8f0e8,
  },
  atmosphere: {
    haze: 0xcfe8e0,             // light morning haze
    silhouetteFar: 0x8fb8d8,    // city rooftops
    silhouetteMid: 0x6a94c0,
    silhouetteNear: 0x4a70a8,
  },
  extra: {
    sidewalk: 0xe8e0cc,
    plazaA: 0xd8cce8,      // plaza tile light
    plazaB: 0xb8a8d8,      // plaza tile dark
    water: 0x3fd0e0,
    waterDeep: 0x28a8c8,
    gymPurple: 0x8f5fd8,
    gymDeep: 0x6a3fb0,
    gold: 0xffd23f,
    ballRed: 0xff5a5a,
    ballWhite: 0xfff6e8,
    ringGreen: 0x35e08a,
    ringYellow: 0xffd23f,
    ringRed: 0xff5a5a,
    leafA: 0x8fe07a,
    leafB: 0xffd23f,
    leafC: 0xff9a8a,
    promptBg: 0x171c36,
  },
});
