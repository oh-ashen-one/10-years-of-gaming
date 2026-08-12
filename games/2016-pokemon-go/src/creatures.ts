/**
 * creatures.ts — the dex. Six original kitbash species, poster proportions
 * (big heads, bigger eyes), each with a distinct silhouette and idle
 * behavior. All spheres/capsules/cones, cel-shaded, inked — generated in
 * code, no ripped designs.
 *
 * Behavior styles drive both the walk-phase idle and the catch-scene hop:
 *   hopper  — bouncy vertical hops (Nibbit, Gildquack)
 *   flutter — hovers and dips (Plumeck, Vesper)
 *   darter  — quick sideways darts (Slinko)
 *   sitter  — barely moves, slow rock (Basker)
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";
import type { Biome } from "./world/layout";

export type SpeciesId = "nibbit" | "plumeck" | "basker" | "slinko" | "vesper" | "gildquack";
export type Behavior = "hopper" | "flutter" | "darter" | "sitter";

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  blurb: string;
  difficulty: 0 | 1 | 2;      // ring color: green / yellow / red
  baseCatch: number;           // base catch probability on a clean hit
  biomes: Biome[];             // where the spawn director offers it
  weight: number;              // spawn weight within its biomes
  scale: number;               // overall size multiplier
  behavior: Behavior;
  colors: { body: number; belly: number; accent: number };
  rare?: boolean;              // gold duck rules (flees twice)
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  nibbit: {
    id: "nibbit", name: "NIBBIT", blurb: "A crumbs-first optimist.",
    difficulty: 0, baseCatch: 0.8, biomes: ["park", "lawn"], weight: 3,
    scale: 0.55, behavior: "hopper",
    colors: { body: 0xd8a86a, belly: 0xfff0d8, accent: 0x8a5a3a },
  },
  plumeck: {
    id: "plumeck", name: "PLUMECK", blurb: "Pecks at sidewalk fries.",
    difficulty: 0, baseCatch: 0.72, biomes: ["park", "street", "sidewalk", "lawn"], weight: 3,
    scale: 0.5, behavior: "flutter",
    colors: { body: 0x3fb8c8, belly: 0xe8f8f8, accent: 0xff9a5a },
  },
  basker: {
    id: "basker", name: "BASKER", blurb: "Owns the warm flat rock.",
    difficulty: 1, baseCatch: 0.58, biomes: ["park"], weight: 2,
    scale: 0.62, behavior: "sitter",
    colors: { body: 0x6aa84f, belly: 0xe8e0b8, accent: 0x7a5a3a },
  },
  slinko: {
    id: "slinko", name: "SLINKO", blurb: "Fast. Gone. Back again.",
    difficulty: 1, baseCatch: 0.55, biomes: ["park", "lawn"], weight: 2,
    scale: 0.5, behavior: "darter",
    colors: { body: 0x9adf4f, belly: 0xf0ffd8, accent: 0x4a8a3a },
  },
  vesper: {
    id: "vesper", name: "VESPER", blurb: "Sleeps under the lamp posts.",
    difficulty: 1, baseCatch: 0.48, biomes: ["street", "sidewalk"], weight: 2,
    scale: 0.5, behavior: "flutter",
    colors: { body: 0x6a5ab8, belly: 0xcfc0f0, accent: 0x3a2f78 },
  },
  gildquack: {
    id: "gildquack", name: "GILDQUACK", blurb: "The pond's gilded rumor.",
    difficulty: 2, baseCatch: 0.4, biomes: ["park"], weight: 1,
    scale: 0.6, behavior: "hopper", rare: true,
    colors: { body: PAL.extra.gold, belly: 0xfff3c8, accent: 0xd89a2a },
  },
};

export const DEX_ORDER: SpeciesId[] = ["nibbit", "plumeck", "basker", "slinko", "vesper", "gildquack"];

/* ------------------------------------------------------------- kitbash -- */

export type CritterMode = "idle" | "flee" | "dizzy" | "statue";

export interface CritterRig {
  group: THREE.Group;
  species: SpeciesDef;
  update(dt: number, time: number, mode: CritterMode): void;
}

function eyePair(parent: THREE.Object3D, y: number, z: number, spread: number, r: number): void {
  const white = makeCelMaterial({ color: 0xffffff, specBand: 0.9, specPow: 60, rim: 0.2 });
  const pupil = makeCelMaterial({ color: 0x1a1a2e, rim: 0.1 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), white);
    w.position.set(s * spread, y, z);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 8, 8), pupil);
    p.position.set(s * spread, y, z + r * 0.7);
    parent.add(w, p);
  }
}

export function buildCritter(id: SpeciesId): CritterRig {
  const def = SPECIES[id];
  const c = def.colors;
  const g = new THREE.Group();
  const body = new THREE.Group();   // hops/tilts
  g.add(body);

  const mBody = makeCelMaterial({ color: c.body, specBand: 0.35, specPow: 38, rim: 0.55 });
  const mBelly = makeCelMaterial({ color: c.belly, rim: 0.35 });
  const mAccent = makeCelMaterial({ color: c.accent, rim: 0.4 });

  // shared body plan: round trunk + light belly patch + face on +Z
  const trunk = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), mBody);
  trunk.position.y = 0.55;
  trunk.scale.set(1, 0.95, 0.9);
  body.add(trunk);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mBelly);
  belly.position.set(0, 0.45, 0.22);
  belly.scale.set(0.9, 0.85, 0.6);
  body.add(belly);

  const parts: THREE.Object3D[] = [];

  switch (id) {
    case "nibbit": {
      // mouse: two huge ear domes + buck-tooth hint + tail curl
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mBody);
        ear.position.set(s * 0.26, 1.05, 0);
        ear.scale.set(0.8, 1.1, 0.35);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mBelly);
        inner.position.set(s * 0.26, 1.05, 0.06);
        inner.scale.set(0.6, 0.9, 0.2);
        body.add(ear, inner);
        parts.push(ear);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 6), mAccent);
      tail.position.set(0, 0.3, -0.55);
      tail.rotation.x = Math.PI / 2.4;
      body.add(tail);
      eyePair(body, 0.72, 0.38, 0.2, 0.13);
      break;
    }
    case "plumeck": {
      // bird: beak cone, head tuft, two flat wings, tail fan
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), mAccent);
      beak.position.set(0, 0.68, 0.55);
      beak.rotation.x = Math.PI / 2;
      body.add(beak);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), mAccent);
      tuft.position.set(0, 1.05, -0.05);
      tuft.rotation.x = -0.4;
      body.add(tuft);
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mAccent);
        wing.position.set(s * 0.5, 0.6, -0.05);
        wing.scale.set(0.25, 0.7, 0.9);
        wing.rotation.z = s * 0.5;
        body.add(wing);
        parts.push(wing);
      }
      eyePair(body, 0.78, 0.38, 0.22, 0.12);
      break;
    }
    case "basker": {
      // turtle: big dome shell + stubby head poking out
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mAccent);
      shell.position.y = 0.42;
      shell.scale.set(1, 0.75, 1);
      body.add(shell);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.09, 8, 20), mBelly);
      rim.position.y = 0.42;
      rim.rotation.x = Math.PI / 2;
      body.add(rim);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mBody);
      head.position.set(0, 0.62, 0.62);
      body.add(head);
      eyePair(head, 0.08, 0.16, 0.13, 0.09);
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), mBody);
        foot.position.set(sx * 0.45, 0.14, sz * 0.4);
        body.add(foot);
      }
      break;
    }
    case "slinko": {
      // lizard: long body, swept crest, long whiplash tail
      trunk.scale.set(0.85, 0.8, 1.35);
      belly.position.z = 0.3;
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), mAccent);
      crest.position.set(0, 1.0, -0.1);
      crest.rotation.x = -0.6;
      body.add(crest);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 8), mBody);
      tail.position.set(0, 0.4, -1.0);
      tail.rotation.x = -Math.PI / 2.2;
      body.add(tail);
      parts.push(tail);
      eyePair(body, 0.75, 0.55, 0.2, 0.12);
      break;
    }
    case "vesper": {
      // bat: big triangle ears, wide flat wings, no legs
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 4), mAccent);
        ear.position.set(s * 0.22, 1.08, 0);
        body.add(ear);
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mAccent);
        wing.position.set(s * 0.55, 0.6, -0.05);
        wing.scale.set(0.9, 0.35, 0.5);
        wing.rotation.z = s * 0.35;
        body.add(wing);
        parts.push(wing);
      }
      eyePair(body, 0.7, 0.4, 0.18, 0.12);
      break;
    }
    case "gildquack": {
      // the rare gold duck: flat bill, smug tuft, tail feathers
      const bill = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mAccent);
      bill.position.set(0, 0.66, 0.5);
      bill.scale.set(1.4, 0.45, 1);
      body.add(bill);
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mAccent);
      tuft.position.set(0, 1.06, -0.06);
      tuft.scale.set(0.7, 1.3, 0.7);
      body.add(tuft);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), mBody);
      tail.position.set(0, 0.62, -0.55);
      tail.rotation.x = -Math.PI / 2.6;
      body.add(tail);
      eyePair(body, 0.82, 0.36, 0.2, 0.12);
      break;
    }
  }

  g.scale.setScalar(def.scale);
  addOutline(g, 2.2, col(PAL.ink.line));

  // behavior state
  let dartT = 0;
  let dartDir = 1;

  return {
    group: g,
    species: def,
    update(_dt, time, mode) {
      const t = time * 1 + def.id.length; // per-species phase offset
      if (mode === "statue") {
        body.position.y = 0;
        g.rotation.y = time * 1.4; // gym-top spinner
        return;
      }
      const excite = mode === "flee" ? 2.2 : mode === "dizzy" ? 0.4 : 1;
      switch (def.behavior) {
        case "hopper":
          body.position.y = Math.abs(Math.sin(t * 3.1 * excite)) * 0.22 * excite;
          body.rotation.x = Math.sin(t * 3.1 * excite) * 0.08;
          break;
        case "flutter":
          body.position.y = 0.25 + Math.sin(t * 2.2 * excite) * 0.12 * excite;
          for (const p of parts) p.rotation.z = Math.sign(p.position.x) * (0.4 + Math.sin(t * 9 * excite) * 0.45);
          break;
        case "darter": {
          dartT -= _dt;
          if (dartT <= 0) {
            dartT = 0.8 + Math.random() * 1.4 / excite;
            dartDir = Math.random() < 0.5 ? -1 : 1;
          }
          const dart = Math.max(0, dartT - 0.5) * dartDir * 1.6;
          body.position.x = dart * 0.4;
          body.rotation.y = -dart * 0.5;
          body.position.y = Math.abs(Math.sin(t * 6)) * 0.06;
          break;
        }
        case "sitter":
          body.position.y = 0;
          body.rotation.z = Math.sin(t * 0.9) * 0.05;
          body.rotation.x = Math.sin(t * 0.7) * 0.04;
          break;
      }
      if (mode === "dizzy") body.rotation.z = Math.sin(t * 10) * 0.18;
    },
  };
}

/** Silhouette fill color for dex cells (uncaught = ink silhouette). */
export function dexColor(id: SpeciesId): number {
  return SPECIES[id].colors.body;
}
