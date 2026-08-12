/**
 * palette.ts — the 2018 movie: toy saturday-morning.
 *
 * Saturated grass greens, bubblegum accents, big puffy cel clouds with
 * pink rims, a purple-pink storm. Chunky and cheerful. Structure from the
 * studio base; values only. No rogue hexes anywhere else.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x402a58, deep: 0x241838 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xfff0c8 },  // cream horizon
      { at: 0.015, color: 0xc8f0e0 }, // pale mint
      { at: 0.07, color: 0x8fe0f0 },  // bright cyan
      { at: 0.16, color: 0x58c8f0 },  // toy blue
      { at: 0.34, color: 0x48a0e8 },  // upper
      { at: 0.58, color: 0x3888d8 },  // zenith
    ],
    abyss: 0x3a5a98,
    sunCore: 0xfff8e0,
    sunDisc: 0xffe9a0,
    sunGlow: 0xffd98a,
    cloudTop: 0xffffff,       // big puffy white
    cloudRim: 0xffb8d8,       // bubblegum underlit rims
  },
  terrain: {
    lit: 0x4fc85a,      // saturated grass
    litHot: 0x7fe06a,   // sunlit crest
    mid: 0x3aa86a,      // mid green
    shadow: 0x4a5a9e,   // cool shade
    deep: 0x342a68,     // deepest
  },
  accents: {
    primary: 0xff5fa8,     // bubblegum pink
    primaryDeep: 0xc83a80,
    rimHot: 0xffd98a,
    rimCool: 0xa8f0e8,
  },
  atmosphere: {
    haze: 0xd8c8f0,
    silhouetteFar: 0x9a8ac8,   // rolling hills
    silhouetteMid: 0x7a68b0,
    silhouetteNear: 0x5a4898,  // tilted water tower ridge
  },
  extra: {
    storm: 0xb05ff0,
    stormDeep: 0x7a2ac8,
    wood: 0xb08858,
    brick: 0xc86a5a,
    metal: 0x9aa8b8,
    chest: 0xffd23f,
    chestDeep: 0xc89a2a,
    dirt: 0xc0a878,
    road: 0x8a84a8,
    wheat: 0xf0d878,
    barnRed: 0xe04a3a,
    silo: 0xd8d0c0,
    towerA: 0x5a8ae0,     // tilted-lite tower blues/pinks/cream
    towerB: 0xff8ac8,
    towerC: 0xf0ece0,
    towerD: 0x68d0b8,
    towerE: 0xffb85a,
    carA: 0x68d0f0,
    carB: 0xff8a5a,
    carC: 0xf0e85a,
    ghostOk: 0x5ff0a8,
    ghostBad: 0xff5a5a,
    leafA: 0x4fc85a,
    leafB: 0x2a9a4a,
    busBlue: 0x4a7ae0,
  },
});
