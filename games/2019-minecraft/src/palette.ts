/**
 * palette.ts — the 2019 movie: the blocky one.
 *
 * Crisp voxel flats with OUR cel bands per face direction: saturated grass
 * tops, dirt sides, torch-warm pools against indigo night. Square sun by
 * day, square moon by night. No rogue hexes anywhere else.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x1c2438, deep: 0x10142a },
  sky: {
    ladder: [
      { at: -1.0, color: 0xffe0a8 },  // warm dawn/day horizon
      { at: 0.015, color: 0xc8e8f0 },
      { at: 0.07, color: 0x87ceeb },  // THE minecraft blue
      { at: 0.2, color: 0x6ab8e8 },
      { at: 0.4, color: 0x4a90d8 },
      { at: 0.6, color: 0x3a78c8 },
    ],
    abyss: 0x2a3a68,
    sunCore: 0xfff8d8,
    sunDisc: 0xffee9a,
    sunGlow: 0xffd98a,
    cloudTop: 0xffffff,
    cloudRim: 0xfff0c8,
  },
  terrain: {
    lit: 0x6ab04a,      // grass top
    litHot: 0x8fd05a,   // grass top sunlit
    mid: 0x8a6a4a,      // dirt
    shadow: 0x4a4a6e,   // night shade
    deep: 0x2a2a48,
  },
  accents: {
    primary: 0x8fd05a,
    primaryDeep: 0x4a8a3a,
    rimHot: 0xffd98a,
    rimCool: 0xa8d8f0,
  },
  atmosphere: {
    haze: 0xc8d8e8,
    silhouetteFar: 0x9aa8c8,    // blocky mountains
    silhouetteMid: 0x7a88b8,
    silhouetteNear: 0x5a68a0,
  },
  extra: {
    night0: 0x1a2044,     // indigo night sky
    night1: 0x2a3468,
    moon: 0xe8ecf8,
    torch: 0xffb84a,
    grassTop: 0x6ab04a,
    grassSide: 0x8a6a4a,
    dirt: 0x8a6a4a,
    stone: 0x8a8a92,
    cobble: 0x7a7a84,
    log: 0x6a4a2a,
    logTop: 0x9a7a4a,
    leaves: 0x3a8a3a,
    planks: 0xb08a54,
    coal: 0x2a2a2e,
    iron: 0xd8b49a,
    table: 0x9a7248,
    door: 0x8a6a3a,
    zombie: 0x4a8a5a,
    skeleton: 0xd8d8d0,
    creeper: 0x5aaa4a,
    heart: 0xe03a3a,
  },
});
