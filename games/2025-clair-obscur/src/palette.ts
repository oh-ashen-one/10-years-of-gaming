/**
 * palette.ts — the 2025 movie: rose-gold on ink-navy, painted impossible.
 *
 * A Belle Époque valley brushed in rose-gold light against deep ink-navy
 * shadow; gilded frame gold; petals in powdered pinks; the canvas sky's
 * gold leaf. Structure from the studio base; values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x1c1424, deep: 0x100a18 },
  sky: {
    ladder: [
      { at: -1.0, color: 0xf0c8a0 },  // rose-gold horizon
      { at: 0.015, color: 0xffd98a }, // gold-leaf seep
      { at: 0.08, color: 0xe0a0a8 },  // powdered rose
      { at: 0.22, color: 0x9a6a8a },
      { at: 0.45, color: 0x4a3460 },
      { at: 0.68, color: 0x1c1830 },  // ink-navy zenith
    ],
    abyss: 0x2c2438,
    sunCore: 0xfff3d8,
    sunDisc: 0xffe0a0,
    sunGlow: 0xf0b86a,
    cloudTop: 0x3a2c4a,
    cloudRim: 0xf0b86a,
  },
  terrain: {
    lit: 0xc8988a,      // painted rose grass
    litHot: 0xe0b898,
    mid: 0x8a6a7a,
    shadow: 0x3a2c44,
    deep: 0x241c30,
  },
  accents: {
    primary: 0xffd98a,     // gold leaf
    primaryDeep: 0x9a6a2a,
    rimHot: 0xffe9b0,
    rimCool: 0x8aa8d8,
  },
  atmosphere: {
    haze: 0xd8a88a,        // rose haze
    silhouetteFar: 0x6a4a5a,   // valley ridges
    silhouetteMid: 0x4a3448,   // rooflines
    silhouetteNear: 0x2c2038,  // ink groves
  },
  extra: {
    gold: 0xffd98a,
    goldHot: 0xffe9b0,
    frame: 0xd8a84a,      // gilded frames
    rose: 0xe89aa8,
    petal: 0xf0c0c8,
    petalB: 0xe8a0b0,
    navy: 0x2a2440,       // ink strokes
    canvas: 0xf2e8d8,
    coat: 0x3a4a6a,       // the expeditioner
    scarf: 0xc83a4a,
    brushling: 0x4a3a5a,  // paint imps
    brushTip: 0xe89aa8,
    mime: 0xf0ebe0,
    mimeDark: 0x2a2430,
    marion: 0xb86a8a,     // painted porcelain
    marionDark: 0x3a2a3a,
    hpRed: 0xc04848,
    overpaint: 0xff9a6a,
    picto: 0xffd98a,
    danger: 0xe04a3a,
    stone: 0x7a6a72,
    stoneDark: 0x4a3a48,
  },
});
