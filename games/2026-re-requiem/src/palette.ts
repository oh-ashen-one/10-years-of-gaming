/**
 * palette.ts — the 2026 movie: flashlight horror. Near-black value
 * structure; one sickly green-white tube light per corridor; the warm
 * amber cone of the flashlight; cold moon through the skylights; blood in
 * banded ink-red. Ink turned UP — horror reads in silhouettes.
 */
import { extendPalette } from "@tenyears/core";

export const PAL = extendPalette({
  ink: { line: 0x0a0d0a, deep: 0x05060a },
  sky: {
    ladder: [
      { at: -1.0, color: 0x2a3440 },  // storm horizon
      { at: 0.02, color: 0x3a4a58 },
      { at: 0.1, color: 0x232c3a },
      { at: 0.25, color: 0x161c28 },
      { at: 0.5, color: 0x0b0e16 },
      { at: 0.72, color: 0x05060a },  // near-black zenith
    ],
    abyss: 0x0a0d14,
    sunCore: 0xd8e4f0,      // cold moon
    sunDisc: 0xb8c8d8,
    sunGlow: 0x6a7a94,
    cloudTop: 0x11151f,
    cloudRim: 0x4a5a70,
  },
  terrain: {
    lit: 0x4a5250,      // corridor tile under the cone
    litHot: 0x6a7268,
    mid: 0x323a3a,      // wall plaster
    shadow: 0x161a1c,
    deep: 0x0a0c10,
  },
  accents: {
    primary: 0xc8d4c8,     // sickly green-white (tube light)
    primaryDeep: 0x3a4a3a,
    rimHot: 0xe8f0e0,
    rimCool: 0x6a8aa8,
  },
  atmosphere: {
    haze: 0x1a2028,        // the dark itself
    silhouetteFar: 0x2a3238,
    silhouetteMid: 0x1c2228,
    silhouetteNear: 0x10141a,
  },
  extra: {
    tube: 0xd8e8d8,       // the corridor tube light
    tubeDim: 0x3a4a42,
    cone: 0xffd9a0,       // the flashlight's warm amber
    moon: 0x8aa8c8,       // skylight cold
    blood: 0x6a1414,      // banded ink-red
    bloodHot: 0x9a2424,
    door: 0x4a4438,
    doorMetal: 0x5a6068,
    gown: 0x9aa49a,       // shambler patient gown
    skin: 0x8a8a7a,       // grey skin
    pursuer: 0x1a1c22,    // its long coat
    pursuerSkin: 0xc8c4b8, // the pale face
    herb: 0x5a8a4a,
    fuse: 0xc8a84a,
    crank: 0x8a8a92,
    key: 0xd8b84a,
    ammo: 0x8a7a4a,
    hpRed: 0xb03030,
    danger: 0xd83a2a,
    elevator: 0x6a7078,
  },
});
