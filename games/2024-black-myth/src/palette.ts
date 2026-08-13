/**
 * palette.ts — the 2024 movie: ink and gold.
 *
 * Near-black bamboo courts against rice-paper sky; red lacquer temple
 * beams; the low GOLD sun bleeding through a cloud sea; drifting petals
 * the one soft note. Structure from the studio base; values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x18120c, deep: 0x0e0b08 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xf5eedd },  // rice-paper horizon
      { at: 0.015, color: 0xf0d898 }, // gold seep off the cloud sea
      { at: 0.08, color: 0xd8ccb2 },
      { at: 0.22, color: 0x9a9584 },
      { at: 0.45, color: 0x4a463c },
      { at: 0.65, color: 0x181611 },  // near-black zenith
    ],
    abyss: 0x3a382e,
    sunCore: 0xfff6d8,      // the low gold sun
    sunDisc: 0xffe9a8,
    sunGlow: 0xf0c86a,
    cloudTop: 0xd8d0bc,     // the cloud sea
    cloudRim: 0xf0c86a,
  },
  terrain: {
    lit: 0x8a8a72,      // mountain stone
    litHot: 0xa8a488,
    mid: 0x5a5c4e,
    shadow: 0x2e2f28,
    deep: 0x1a1b16,
  },
  accents: {
    primary: 0xe8c86a,     // seal gold
    primaryDeep: 0x8a6a2a,
    rimHot: 0xffe9b0,
    rimCool: 0xb8c8d0,
  },
  atmosphere: {
    haze: 0xcfc8b4,        // paper haze
    silhouetteFar: 0x6a6a5c,   // ridge lines
    silhouetteMid: 0x4a4a40,   // temple roofs
    silhouetteNear: 0x2a2a24,  // bamboo groves
  },
  extra: {
    bamboo: 0x1e2822,     // black bamboo
    bambooTip: 0x2e4034,
    lacquer: 0x8a2a22,    // red temple beams
    lacquerHot: 0xb84a3a,
    gold: 0xe8c86a,
    goldHot: 0xffe9a8,
    petal: 0xf0d8d8,      // drifting petals
    petalB: 0xe4b4c0,
    seal: 0xffd98a,       // immobilize gold
    blood: 0x6a1a1a,      // the blood-pool slam
    stone: 0x7a7a6e,
    stoneDark: 0x4a4a42,
    paper: 0xf2e8c8,
    robe: 0x8a7a5a,       // the monk
    sash: 0x8a2a22,
    tiger: 0xc8862e,      // the Abbot's hide
    tigerDark: 0x2a2018,  // his stripes
    yaoguai: 0x4a5a4a,    // lesser wolf-imps
    yaoguaiDark: 0x2a342a,
    hpRed: 0xb03a3a,
    focus: 0xe8c86a,
    danger: 0xe04a3a,
  },
});
