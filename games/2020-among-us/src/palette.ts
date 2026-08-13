/**
 * palette.ts — the 2020 movie: the bean one.
 *
 * Flat ship grays, per-room accent floors, candy crew colors with banded
 * visor shine, warm interior light against cold space through the windows.
 * Structure from the studio base; values only.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x141a30, deep: 0x0a0c18 },
  sky: {
    ladder: [
      { at: -1.0, color: 0x0a0c18 },  // space
      { at: 0.0, color: 0x10142a },
      { at: 0.1, color: 0x161c3a },
      { at: 0.3, color: 0x1c2450 },
      { at: 0.55, color: 0x141a38 },
      { at: 0.8, color: 0x0e1228 },
    ],
    abyss: 0x05060e,
    sunCore: 0xffe9b8,      // the cafeteria skylight (warm hero light)
    sunDisc: 0xffd98a,
    sunGlow: 0xffc86a,
    cloudTop: 0x2a3468,
    cloudRim: 0x7fd8e8,
  },
  terrain: {
    lit: 0x8a92a8,      // ship floor gray
    litHot: 0xa8b0c8,
    mid: 0x6a7288,
    shadow: 0x3a4060,
    deep: 0x262c48,
  },
  accents: {
    primary: 0xe03a4a,     // the red — report, emergency, danger
    primaryDeep: 0x9a2433,
    rimHot: 0xffd98a,
    rimCool: 0x7fd8e8,
  },
  atmosphere: {
    haze: 0x3a4a78,
    silhouetteFar: 0x2a3468,
    silhouetteMid: 0x222a58,
    silhouetteNear: 0x1a2048,
  },
  extra: {
    floorCaf: 0x8a94a8,
    floorWeap: 0x7a94a8,
    floorNav: 0x6a8aa8,
    floorShields: 0x8aa89a,
    floorElec: 0xa89a7a,
    floorMed: 0x9aa8b8,
    floorStorage: 0x94886a,
    floorReactor: 0xa88a8a,
    corridor: 0x787f96,
    wallTop: 0xb8c0d4,
    wallSide: 0x6a7288,
    console: 0x4a5268,
    consoleGlow: 0x7fd8e8,
    vent: 0x3a4058,
    beanRed: 0xe03a4a,
    beanBlue: 0x3a68e0,
    beanGreen: 0x3aa85a,
    beanPink: 0xf08ac8,
    beanOrange: 0xf08a3a,
    beanYellow: 0xf0e05a,
    beanBlack: 0x3a3f4a,
    beanWhite: 0xe8ecf4,
    visor: 0x9ae8f0,
    blood: 0xc02838,
    star: 0xf0f4ff,
  },
});

/** candy crew colors in canonical order (testimony uses these names) */
export const CREW_COLORS: { name: string; hex: number }[] = [
  { name: "RED", hex: PAL.extra.beanRed },
  { name: "BLUE", hex: PAL.extra.beanBlue },
  { name: "GREEN", hex: PAL.extra.beanGreen },
  { name: "PINK", hex: PAL.extra.beanPink },
  { name: "ORANGE", hex: PAL.extra.beanOrange },
  { name: "YELLOW", hex: PAL.extra.beanYellow },
  { name: "BLACK", hex: PAL.extra.beanBlack },
  { name: "WHITE", hex: PAL.extra.beanWhite },
  { name: "CYAN", hex: 0x3ad8e0 },
  { name: "PURPLE", hex: 0x9a5ae0 },
];
