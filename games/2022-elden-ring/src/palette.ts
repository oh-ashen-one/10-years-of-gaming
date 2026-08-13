/**
 * palette.ts — the 2022 movie: golden gloom.
 *
 * Desaturated moor greens and slate beneath one overexposed GOLDEN TREE
 * (the hero light — its glow is the sun of this world). Mist in quantized
 * bands, ruined arches, hammered-metal armor via painted matcap, thin
 * grim ink. Serif-leaning accents. Values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x14181a, deep: 0x0a0d0c },
  sky: {
    ladder: [
      { at: -1.0, color: 0x8a94a0 },  // slate horizon
      { at: 0.015, color: 0xc8b878 }, // gold seep near the tree's glow
      { at: 0.08, color: 0x7a86a0 },  // cold gray-blue
      { at: 0.2, color: 0x4a5468 },
      { at: 0.4, color: 0x323a48 },
      { at: 0.6, color: 0x1e242e },   // gloom zenith
    ],
    abyss: 0x14181c,
    sunCore: 0xfff3c8,      // the tree's overexposed heart
    sunDisc: 0xffd98a,
    sunGlow: 0xe8b84a,
    cloudTop: 0x3a4250,
    cloudRim: 0xe8c86a,     // gold-licked mist clouds
  },
  terrain: {
    lit: 0x6a7a5a,      // moor green, desaturated
    litHot: 0x8a9a6a,
    mid: 0x4a5560,      // slate
    shadow: 0x2e3640,
    deep: 0x1a2028,
  },
  accents: {
    primary: 0xe8c86a,     // grace gold
    primaryDeep: 0x8a6a2a,
    rimHot: 0xffe9a8,
    rimCool: 0x8aa8c8,
  },
  atmosphere: {
    haze: 0x9aa494,             // greenish mist
    silhouetteFar: 0x6a7488,    // ruined arches
    silhouetteMid: 0x4a5468,
    silhouetteNear: 0x323a48,
  },
  extra: {
    gold: 0xffd76a,
    goldHot: 0xfff3c8,
    grace: 0xffe9a8,
    stone: 0x7a8088,
    stoneDark: 0x4a5058,
    fogGate: 0xd8c8a0,
    tarnish: 0x5a6a8a,      // player cloak
    armor: 0x8a94a8,
    soldier: 0x5a5f4a,
    warden: 0x6a5a7a,       // warden robe
    hammer: 0xffd76a,
    blood: 0x8a2430,
    scarab: 0xc8a84a,
    hpRed: 0x9a2a2a,
    stamGreen: 0x5a8a4a,
    focusBlue: 0x4a6a9a,
  },
});
