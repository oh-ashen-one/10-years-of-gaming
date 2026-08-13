/**
 * palette.ts — the 2021 movie: the anime meadow.
 *
 * Luminous teal-green grass, huge white cel clouds, cyan sky ladder, a
 * low gold hero sun. Element accents: gale teal (wind) and ember orange
 * (flame). Structure from the studio base; values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x1c2450, deep: 0x111640 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xffe9b8 },  // warm gold horizon
      { at: 0.015, color: 0xc8f0e0 },
      { at: 0.07, color: 0x8fe8f0 },  // cyan
      { at: 0.16, color: 0x58d0f0 },
      { at: 0.34, color: 0x48a8e8 },
      { at: 0.58, color: 0x3890d8 },  // zenith
    ],
    abyss: 0x2a4a88,
    sunCore: 0xfff8dc,
    sunDisc: 0xffe9a0,
    sunGlow: 0xffd98a,
    cloudTop: 0xffffff,      // huge white cel clouds
    cloudRim: 0xffe0b0,      // gold underlit rims
  },
  terrain: {
    lit: 0x4fd8a8,      // luminous teal-green grass
    litHot: 0x7ff0c0,   // sunlit wave crest
    mid: 0x3aa888,
    shadow: 0x3a5a9e,
    deep: 0x2a3a78,
  },
  accents: {
    primary: 0x3fc8a8,     // gale teal
    primaryDeep: 0x1a8a78,
    rimHot: 0xffd98a,
    rimCool: 0xa8f0e8,
  },
  atmosphere: {
    haze: 0xc8e0e8,
    silhouetteFar: 0x8fb0d8,   // spired city
    silhouetteMid: 0x6a90c0,   // windmill ridge
    silhouetteNear: 0x4a70a8,
  },
  extra: {
    flame: 0xff8a3a,
    flameDeep: 0xe04a2a,
    gale: 0x3fc8a8,
    energy: 0xffe98a,
    stamina: 0x8fe07a,
    bossSteel: 0x7a8aa8,
    bossDark: 0x3a4268,
    core: 0xff5a8a,
    pillar: 0xb8b0c8,
    ruinStone: 0x9a94b8,
    chest: 0xffd23f,
    chestDeep: 0xc88a2a,
    cliff: 0x8a7a9a,
    cliffMark: 0xffd23f,
    flower: 0xff8ac8,
    ribbon: 0xff5f8a,
    heroA: 0x2a3a78,      // twin-tone outfit
    heroB: 0xf0f4ff,
  },
});
