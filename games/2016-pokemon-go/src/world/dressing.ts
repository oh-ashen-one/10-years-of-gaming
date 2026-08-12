/**
 * dressing.ts — the neighborhood as geometry. Reads the biome truth from
 * layout.ts and paints it: ground shader (sidewalk grid ink, mow-striped
 * parks, checkerboard plaza, quantized pond sparkle), inked kitbash houses,
 * park trees, street lamps, the purple gym tower with its spinning gold
 * mascot, and the confetti-leaf wind that makes the diorama feel alive.
 *
 * Builder returns rigs: { group, update(dt, state) } (§2.4).
 */
import * as THREE from "three";
import {
  makeCelMaterial, addOutline, col, hash1,
  celEnv, celEnvUniforms, CEL_LIGHT_GLSL, NOISE_GLSL,
} from "@tenyears/core";
import { PAL } from "../palette";
import {
  biomeGrid, BIOME_RES, WORLD_SIZE, WORLD_HALF, PLACES,
} from "./layout";
import { buildCritter, type SpeciesId } from "../creatures";

/* -------------------------------------------------------------- ground -- */

function makeGround(): THREE.Mesh {
  // biome ids baked by layout.ts — the shader reads the same truth logic does
  const data = new Uint8Array(BIOME_RES * BIOME_RES * 4);
  const src = biomeGrid();
  for (let i = 0; i < src.length; i++) {
    data[i * 4] = src[i] * 40; // id spread across the byte for clean sampling
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, BIOME_RES, BIOME_RES, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBiome: { value: tex },
      uWorld: { value: WORLD_SIZE },
      uTime: celEnv.uTime,
      ...celEnvUniforms(),
      uGrassA: { value: col(PAL.terrain.lit).clone() },
      uGrassB: { value: col(PAL.terrain.litHot).clone() },
      uLawn: { value: col(0x58b06a).clone() },
      uStreet: { value: col(0xcfc8e4).clone() },
      uSidewalk: { value: col(PAL.extra.sidewalk).clone() },
      uPlazaA: { value: col(PAL.extra.plazaA).clone() },
      uPlazaB: { value: col(PAL.extra.plazaB).clone() },
      uWaterA: { value: col(PAL.extra.water).clone() },
      uWaterB: { value: col(PAL.extra.waterDeep).clone() },
      uInkLine: { value: col(PAL.ink.line).clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      uniform sampler2D uBiome;
      uniform float uWorld;
      uniform float uTime;
      uniform vec3 uGrassA, uGrassB, uLawn, uStreet, uSidewalk, uPlazaA, uPlazaB;
      uniform vec3 uWaterA, uWaterB, uInkLine;
      ${CEL_LIGHT_GLSL}
      ${NOISE_GLSL}

      void main() {
        vec2 uv = vW.xz / uWorld + 0.5;
        float bid = floor(texture2D(uBiome, uv).r * 255.0 / 40.0 + 0.5);
        vec3 c = uLawn;

        if (bid < 0.5) {                                  // lawn (under houses)
          float n = g_fbm(vW.xz * 0.08, 2);
          c = uLawn * (0.9 + 0.2 * step(0.5, n));
        } else if (bid < 1.5) {                           // street
          // pale asphalt + cream center dashes (the map-read contrast)
          c = uStreet;
          vec2 dl = abs(fract(vW.xz / 80.0 + 0.5) - 0.5) * 80.0;
          float alongX = step(fract(vW.x * 0.125), 0.55) * step(0.3, fract(vW.x * 0.125));
          float alongZ = step(fract(vW.z * 0.125), 0.55) * step(0.3, fract(vW.z * 0.125));
          float dash = max(step(dl.y, 0.7) * alongX, step(dl.x, 0.7) * alongZ);
          c = mix(c, uSidewalk, dash * 0.85);
        } else if (bid < 2.5) {                           // sidewalk: grid ink
          c = uSidewalk;
          vec2 g2 = abs(fract(vW.xz * 0.25) - 0.5);
          float line = step(0.47, max(g2.x, g2.y));
          c = mix(c, uInkLine, line * 0.5);
        } else if (bid < 3.5) {                           // park: mow stripes
          float stripe = step(0.5, fract(vW.x * 0.055));
          c = mix(uGrassA, uGrassB, stripe * 0.55);
        } else if (bid < 4.5) {                           // pond: banded sparkle
          float rip = g_fbm(vW.xz * 0.14 + vec2(uTime * 0.12, 0.0), 3);
          rip = floor(rip * 4.0 + 0.5) / 4.0;
          c = mix(uWaterB, uWaterA, rip);
        } else {                                          // plaza: checker tiles
          vec2 tile = floor(vW.xz * 0.2);
          c = mix(uPlazaA, uPlazaB, mod(tile.x + tile.y, 2.0));
        }

        // flat ground still obeys the two-temperature read + stepped haze
        c *= uAmbient * 0.55 + uSunTint * 0.62;
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  return mesh;
}

/* -------------------------------------------------------------- houses -- */

const HOUSE_WALLS = [0xf0e8d8, 0xe8d8c8, 0xd8e0e8, 0xf0dcc0];
const HOUSE_ROOFS = [0x18b8a8, 0xff8a6a, 0x8f5fd8, 0x4a70a8];

function makeHouse(seed: number): THREE.Group {
  const g = new THREE.Group();
  const w = 7 + hash1(seed * 3.1) * 5;
  const d = 6 + hash1(seed * 5.7) * 4;
  const h = 4 + hash1(seed * 7.3) * 3.5;
  const wall = makeCelMaterial({
    color: HOUSE_WALLS[Math.floor(hash1(seed) * HOUSE_WALLS.length)],
    rim: 0.3,
  });
  const roof = makeCelMaterial({
    color: HOUSE_ROOFS[Math.floor(hash1(seed * 11.7) * HOUSE_ROOFS.length)],
    specBand: 0.4, rim: 0.45,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4), roof);
  cap.position.y = h + h * 0.27;
  cap.rotation.y = Math.PI / 4;
  g.add(body, cap);
  addOutline(g, 2.2, col(PAL.ink.line));
  return g;
}

function buildHouses(parent: THREE.Group): void {
  // one to three houses per lawn block, deterministic by cell
  const cells = [-120, -40, 40, 120];
  let seed = 1;
  for (const bx of cells) {
    for (const bz of cells) {
      const isSpecial =
        (Math.abs(bx - PLACES.plaza.x) < 1 && Math.abs(bz - PLACES.plaza.z) < 1) ||
        (Math.abs(bx - PLACES.parkEast.x) < 1 && Math.abs(bz - PLACES.parkEast.z) < 1) ||
        (Math.abs(bx - PLACES.parkWest.x) < 1 && Math.abs(bz - PLACES.parkWest.z) < 1) ||
        (Math.abs(bx - PLACES.pond.x) < 1 && Math.abs(bz - PLACES.pond.z) < 1);
      if (isSpecial) continue;
      const n = 1 + Math.floor(hash1(seed * 13.7) * 3);
      for (let k = 0; k < n; k++) {
        const a = hash1(seed * 17.3 + k * 5.1) * Math.PI * 2;
        const r = 8 + hash1(seed * 19.9 + k * 7.7) * 16;
        const h = makeHouse(seed * 23.1 + k);
        h.position.set(bx + Math.cos(a) * r, 0, bz + Math.sin(a) * r);
        h.rotation.y = Math.floor(hash1(seed * 29.7 + k) * 4) * (Math.PI / 2);
        parent.add(h);
      }
      seed++;
    }
  }
}

/* ---------------------------------------------------------- parks etc. -- */

function makeTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 2.6, 7),
    makeCelMaterial({ color: 0x8a5a3a, rim: 0.3 }),
  );
  trunk.position.y = 1.3;
  g.add(trunk);
  const leafMat = makeCelMaterial({
    color: hash1(seed) > 0.5 ? PAL.terrain.lit : PAL.terrain.litHot,
    rim: 0.5,
  });
  const blobs = 2 + Math.floor(hash1(seed * 3.3) * 2);
  for (let i = 0; i < blobs; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.6 - i * 0.25, 12, 10), leafMat);
    b.position.set(
      (hash1(seed * 5.1 + i) - 0.5) * 1.6,
      3.1 + i * 1.0,
      (hash1(seed * 7.7 + i) - 0.5) * 1.6,
    );
    g.add(b);
  }
  addOutline(g, 2.0, col(PAL.ink.line));
  return g;
}

function scatterTrees(parent: THREE.Group): void {
  let seed = 100;
  const spots = [PLACES.parkEast, PLACES.parkWest, PLACES.pond];
  for (const p of spots) {
    const range = "rx" in p ? 30 : 30;
    const n = "rx" in p ? 8 : 13;
    for (let i = 0; i < n; i++) {
      const a = hash1(seed * 3.7) * Math.PI * 2;
      const r = 10 + hash1(seed * 9.1) * (range - 8);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      // keep trees out of the pond itself
      if ("rx" in p) {
        const e = ((x - p.x) / (p.rx + 4)) ** 2 + ((z - p.z) / (p.rz + 4)) ** 2;
        if (e < 1) { seed++; continue; }
      }
      const t = makeTree(seed);
      t.position.set(x, 0, z);
      t.rotation.y = hash1(seed * 13.3) * Math.PI;
      parent.add(t);
      seed++;
    }
  }
}

function makeLamp(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 4.6, 6),
    makeCelMaterial({ color: PAL.ink.line, rim: 0.3 }),
  );
  pole.position.y = 2.3;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    makeCelMaterial({ color: 0xfff3d0, emissive: 0xffe9a8, emissiveStrength: 0.9, rim: 0 }),
  );
  bulb.position.y = 4.8;
  g.add(pole, bulb);
  return g;
}

function buildLamps(parent: THREE.Group): void {
  // offset off both axes so no lamp ever sits on a catch-scene sightline
  for (const s of [-80, 0, 80]) {
    for (const t of [-80, 0, 80]) {
      const lamp = makeLamp();
      lamp.position.set(s + 6.5, 0, t - 6.5);
      parent.add(lamp);
    }
  }
}

/* --------------------------------------------------------- gym tower ---- */

export interface GymRig {
  group: THREE.Group;
  topY: number;
  mascot: THREE.Group;         // the spinning gold statue
  buddySlot: THREE.Group;      // where YOUR creature sits after the win
  setBuddy(id: SpeciesId): void;
  update(dt: number, time: number): void;
}

function buildGym(parent: THREE.Group): GymRig {
  const g = new THREE.Group();
  g.position.set(PLACES.gym.x, 0, PLACES.gym.z);
  const purple = makeCelMaterial({ color: PAL.extra.gymPurple, specBand: 0.5, specPow: 30, rim: 0.6 });
  const deep = makeCelMaterial({ color: PAL.extra.gymDeep, rim: 0.4 });
  const gold = makeCelMaterial({ color: PAL.extra.gold, specBand: 0.9, specPow: 50, rim: 0.5 });

  const tiers: [number, number, number][] = [  // r, h, y-base
    [7.0, 3.0, 0],
    [5.2, 5.0, 3.0],
    [3.6, 6.5, 8.0],
  ];
  for (const [r, h, y] of tiers) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, h, 8), purple);
    t.position.y = y + h / 2;
    g.add(t);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.22, 6, 8), gold);
    band.position.y = y + h - 0.2;
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 8), deep);
  platform.position.y = 14.8;
  g.add(platform);

  // the spinning gold mascot — the rumor every kid walks toward
  const mascotRig = buildCritter("gildquack");
  mascotRig.group.position.y = 15.1;
  mascotRig.group.scale.multiplyScalar(1.4);
  g.add(mascotRig.group);

  const buddySlot = new THREE.Group();
  buddySlot.position.set(2.2, 15.1, 0);
  g.add(buddySlot);

  addOutline(g, 2.4, col(PAL.ink.line));
  parent.add(g);

  let buddyRig: ReturnType<typeof buildCritter> | null = null;

  return {
    group: g,
    topY: 15.1,
    mascot: mascotRig.group,
    buddySlot,
    setBuddy(id: SpeciesId) {
      if (buddyRig) buddySlot.remove(buddyRig.group);
      buddyRig = buildCritter(id);
      buddySlot.add(buddyRig.group);
    },
    update(dt: number, time: number) {
      mascotRig.update(dt, time, "statue");
      buddyRig?.update(dt, time, "statue");
    },
  };
}

/* --------------------------------------------------- confetti-leaf wind -- */

const LEAF_COUNT = 130;
const LEAF_BOX = 70;

function buildLeaves(parent: THREE.Group): { update(dt: number, center: THREE.Vector3, time: number): void } {
  const geo = new THREE.PlaneGeometry(0.26, 0.16);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, LEAF_COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const colors = [PAL.extra.leafA, PAL.extra.leafB, PAL.extra.leafC, PAL.accents.primary];
  const color = new THREE.Color();
  for (let i = 0; i < LEAF_COUNT; i++) {
    mesh.setColorAt(i, color.set(colors[i % colors.length]));
  }
  parent.add(mesh);

  const pos = new Float32Array(LEAF_COUNT * 3);
  const ph = new Float32Array(LEAF_COUNT);
  for (let i = 0; i < LEAF_COUNT; i++) {
    pos[i * 3] = (hash1(i * 3.1) - 0.5) * LEAF_BOX;
    pos[i * 3 + 1] = 0.5 + hash1(i * 5.7) * 6;
    pos[i * 3 + 2] = (hash1(i * 7.3) - 0.5) * LEAF_BOX;
    ph[i] = hash1(i * 11.9) * Math.PI * 2;
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();

  return {
    update(dt, center, time) {
      for (let i = 0; i < LEAF_COUNT; i++) {
        let x = pos[i * 3] + dt * (1.6 + Math.sin(ph[i]) * 0.5);
        let y = pos[i * 3 + 1] + Math.sin(time * 1.7 + ph[i]) * dt * 0.6;
        let z = pos[i * 3 + 2] + dt * Math.cos(ph[i]) * 0.7;
        // wrap inside a box riding the camera
        if (x - center.x > LEAF_BOX / 2) x -= LEAF_BOX;
        if (x - center.x < -LEAF_BOX / 2) x += LEAF_BOX;
        if (z - center.z > LEAF_BOX / 2) z -= LEAF_BOX;
        if (z - center.z < -LEAF_BOX / 2) z += LEAF_BOX;
        // never let a leaf hug the lens — a near leaf reads as a giant slab
        const cdx = x - center.x;
        const cdz = z - center.z;
        if (cdx * cdx + cdz * cdz < 20) x += Math.sign(cdx || 1) * 14;
        if (y < 0.2) y = 6;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        e.set(time * 2 + ph[i], ph[i] + time * 1.3, time * 1.1 + ph[i]);
        q.setFromEuler(e);
        v.set(x, y, z);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ---------------------------------------------------------------- rig ---- */

export interface NeighborhoodRig {
  group: THREE.Group;
  gym: GymRig;
  update(dt: number, camPos: THREE.Vector3, time: number): void;
}

export function buildNeighborhood(world: THREE.Group): NeighborhoodRig {
  const group = new THREE.Group();
  group.add(makeGround());
  buildHouses(group);
  scatterTrees(group);
  buildLamps(group);
  const gym = buildGym(group);

  // pond shore rim — a sand ring so the water reads as a place
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.09, 6, 48),
    makeCelMaterial({ color: PAL.extra.sidewalk, rim: 0.25 }),
  );
  rim.scale.set(PLACES.pond.rx + 1.5, PLACES.pond.rz + 1.5, 4);
  rim.position.set(PLACES.pond.x, 0.06, PLACES.pond.z);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const leaves = buildLeaves(group);
  world.add(group);

  return {
    group,
    gym,
    update(dt, camPos, time) {
      leaves.update(dt, camPos, time);
    },
  };
}
