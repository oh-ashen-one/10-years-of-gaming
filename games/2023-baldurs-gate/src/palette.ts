/**
 * palette.ts — the 2023 movie: candle and ink.
 *
 * Warm tavern/candle ambers against cool river blues; painterly haze;
 * the chunky d20's gold ink; roofline-and-gallows silhouettes. Structure
 * from the studio base; values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x1c1220, deep: 0x100a14 },
  sky: {
    ladder: [
      { at: -1.0, color: 0x3a4a68 },  // cool river-mist horizon
      { at: 0.015, color: 0xc88a4a }, // candle amber seep
      { at: 0.08, color: 0x4a5a78 },
      { at: 0.2, color: 0x323c58 },
      { at: 0.42, color: 0x22283e },
      { at: 0.62, color: 0x161a2a },  // dusk
    ],
    abyss: 0x10141f,
    sunCore: 0xffe9b0,      // candle-warm hero glow
    sunDisc: 0xffd98a,
    sunGlow: 0xe8a85a,
    cloudTop: 0x2a3248,
    cloudRim: 0xe8a85a,
  },
  terrain: {
    lit: 0x6a7a5a,      // north-bank grass
    litHot: 0x8a9a6a,
    mid: 0x5a5460,      // cobbles
    shadow: 0x2e3444,
    deep: 0x1a1e2e,
  },
  accents: {
    primary: 0xf0d890,     // candle gold / d20 ink
    primaryDeep: 0x8a5a2a,
    rimHot: 0xffe9b0,
    rimCool: 0x8ab8d8,
  },
  atmosphere: {
    haze: 0x6a7a94,
    silhouetteFar: 0x4a5468,   // rooflines
    silhouetteMid: 0x38405a,
    silhouetteNear: 0x262c44,  // gallows
  },
  extra: {
    riverA: 0x3a68a8,
    riverB: 0x2a4a80,
    bridge: 0x8a6a48,
    bridgeDark: 0x5a4632,
    cobble: 0x6a6474,
    tollWall: 0x9a8a78,
    tollRoof: 0x7a3a3a,
    candle: 0xffc86a,
    swordC: 0x3a5a8a,     // the sell-sword
    mageC: 0x8a5ad8,      // the spark mage
    tollC: 0x4a4a52,      // gaunt tollkeeper
    guardC: 0x6a5a4a,
    grease: 0x3a3a30,
    fire: 0xff8a3a,
    danger: 0xe04a3a,
    chest: 0xc89a4a,
    cloak: 0x5a4a8a,
  },
});
