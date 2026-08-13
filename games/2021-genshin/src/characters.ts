/**
 * characters.ts — the chibi anime hero (twin-tone outfit, trailing
 * ribbon with lag physics), the mosslunk camp mobs, and the RUIN WARDEN:
 * a big stove-bodied automaton with shoulder cannons and a chest core
 * that opens when it's vulnerable. Poses are behavior: combo slashes,
 * glide spread, climb reach, spin, telegraphs.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

export type HeroPose = "idle" | "run" | "slash" | "skill" | "burst" | "glide" | "climb" | "dodge";

export interface HeroRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number, pose: HeroPose): void;
  setStanceColors(stance: 1 | 2): void;
}

export function buildHero(): HeroRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mA = makeCelMaterial({ color: e.heroA, rim: 0.5 });
  const mB = makeCelMaterial({ color: e.heroB, specBand: 0.3, rim: 0.45 });
  const mSkin = makeCelMaterial({ color: 0xf0d0b8, rim: 0.35 });

  // chibi: big head, small body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.4, 6, 12), mA);
  body.position.y = 0.85;
  g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mB);
  chest.position.set(0, 1.05, 0.05);
  chest.scale.set(1, 0.9, 0.8);
  g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), mSkin);
  head.position.y = 1.62;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.37, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
    makeCelMaterial({ color: 0x3a2f58, rim: 0.4 }),
  );
  hair.position.y = 1.7;
  g.add(hair);
  // ahoge
  const ahoge = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), makeCelMaterial({ color: 0x3a2f58, rim: 0.2 }));
  ahoge.position.set(0.08, 2.12, 0);
  ahoge.rotation.z = -0.3;
  g.add(ahoge);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), mA);
    leg.position.set(s * 0.14, 0.35, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.35, 4, 8), mB);
    arm.position.set(s * 0.38, 1.0, 0);
    g.add(arm);
    arms.push(arm);
  }

  // the blade — stance-tinted glow edge
  const blade = new THREE.Group();
  const bladeM = makeCelMaterial({ color: 0xd8e0e8, specBand: 0.8, specPow: 50, rim: 0.3 });
  const edgeM = makeCelMaterial({ color: PAL.extra.gale, emissive: PAL.extra.gale, emissiveStrength: 0.5, rim: 0.2 });
  const bMain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.16), bladeM);
  const bEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.05), edgeM);
  bEdge.position.z = 0.1;
  blade.add(bMain, bEdge);
  blade.position.set(0.45, 1.0, 0.2);
  blade.rotation.x = 0.4;
  g.add(blade);

  // the ribbon: 3 trailing segments with lag
  const ribbonMat = makeCelMaterial({ color: PAL.extra.ribbon, rim: 0.3 });
  const ribbonSegs: THREE.Mesh[] = [];
  let parent = g as THREE.Object3D;
  let py = 1.35;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.04), ribbonMat);
    seg.position.set(0, -0.28, -0.16);
    const pivot = new THREE.Group();
    pivot.position.set(0.1, py, -0.18);
    pivot.add(seg);
    parent.add(pivot);
    parent = pivot;
    py = -0.5;
    ribbonSegs.push(seg);
  }
  addOutline(g, 2.2, col(PAL.ink.line));

  let stride = 0;
  let slashT = 0;
  return {
    group: g,
    setStanceColors(stance) {
      edgeM.uniforms.uEmissive.value.set(stance === 1 ? PAL.extra.gale : PAL.extra.flame);
    },
    update(dt, time, speed, pose) {
      stride += dt * speed * 1.6;
      slashT = pose === "slash" ? slashT + dt : 0;
      g.rotation.x = 0;
      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      blade.rotation.x = 0.4;
      blade.rotation.z = 0;

      switch (pose) {
        case "run":
          g.position.y = Math.abs(Math.sin(stride)) * 0.09;
          legs[0].rotation.x = Math.sin(stride) * 0.85;
          legs[1].rotation.x = -Math.sin(stride) * 0.85;
          arms[0].rotation.x = -Math.sin(stride) * 0.6;
          arms[1].rotation.x = Math.sin(stride) * 0.6;
          g.rotation.x = 0.14;
          break;
        case "slash": {
          const k = Math.min(1, slashT / 0.22);
          blade.rotation.z = -1.6 + k * 2.8;
          blade.rotation.x = 0.2;
          arms[1].rotation.x = -1.2;
          g.rotation.y = -0.4 + k * 0.8;
          break;
        }
        case "skill":
          arms[0].rotation.z = 2.2;
          arms[1].rotation.z = -2.2;
          g.position.y = Math.abs(Math.sin(time * 4)) * 0.1;
          break;
        case "burst":
          arms[0].rotation.z = 2.8;
          arms[1].rotation.z = -2.8;
          g.position.y = 0.3 + Math.sin(time * 20) * 0.05;
          break;
        case "glide":
          g.rotation.x = 0.55;
          arms[0].rotation.z = 1.4;
          arms[1].rotation.z = -1.4;
          legs[0].rotation.x = 0.4;
          legs[1].rotation.x = 0.4;
          break;
        case "climb":
          arms[0].rotation.x = -2.4 + Math.sin(time * 6) * 0.5;
          arms[1].rotation.x = -2.4 - Math.sin(time * 6) * 0.5;
          legs[0].rotation.x = 0.5;
          legs[1].rotation.x = -0.3;
          break;
        case "dodge":
          g.rotation.x = 0.5;
          g.position.y = 0.1;
          break;
        default:
          g.position.y = Math.sin(time * 2) * 0.025;
          g.rotation.y = 0;
      }
      // ribbon lag: each segment trails the one above
      for (let i = 0; i < ribbonSegs.length; i++) {
        const pivot = ribbonSegs[i].parent!;
        const target = pose === "run" ? 0.7 : pose === "glide" ? 1.2 : 0.25;
        pivot.rotation.x += (target + Math.sin(time * 3 + i) * 0.15 - pivot.rotation.x) * Math.min(1, dt * (5 - i));
      }
    },
  };
}

/* -------------------------------------------------------------- mosslunk -- */

export interface MobRig {
  group: THREE.Group;
  update(dt: number, time: number, flash: number): void;
}

export function buildMosslunk(seed: number): MobRig {
  const g = new THREE.Group();
  const skin = makeCelMaterial({ color: 0x8aa86a, rim: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), skin);
  body.position.y = 0.75;
  body.scale.set(1.1, 1, 0.9);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), skin);
  head.position.set(0, 1.35, 0.15);
  g.add(head);
  // the mask — a little wooden face
  const mask = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.12),
    makeCelMaterial({ color: 0xc8a878, rim: 0.3 }),
  );
  mask.position.set(0, 1.38, 0.45);
  g.add(mask);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5), skin);
    ear.position.set(s * 0.3, 1.75, 0);
    ear.rotation.z = s * -0.5;
    g.add(ear);
  }
  const club = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), makeCelMaterial({ color: 0x6a4a2a, rim: 0.3 }));
  club.position.set(0.5, 0.9, 0.2);
  club.rotation.z = -0.4;
  g.add(club);
  addOutline(g, 2.2, col(PAL.ink.line));

  return {
    group: g,
    update(_dt, time, flash) {
      g.position.y = Math.abs(Math.sin(time * 4 + seed)) * 0.08;
      g.rotation.z = Math.sin(time * 2.2 + seed) * 0.06;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material instanceof THREE.ShaderMaterial && mesh.material.uniforms.uEmissiveStr) {
          mesh.material.uniforms.uEmissiveStr.value = flash > 0 ? 0.7 : 0;
          if (flash > 0) mesh.material.uniforms.uEmissive.value.set(0xffffff);
        }
      });
    },
  };
}

/* ----------------------------------------------------------- ruin warden -- */

export interface BossRig {
  group: THREE.Group;
  coreGlow: THREE.Mesh;
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildWarden(): BossRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const steel = makeCelMaterial({ color: e.bossSteel, specBand: 0.7, specPow: 40, rim: 0.55 });
  const dark = makeCelMaterial({ color: e.bossDark, rim: 0.35 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 3.2, 10), steel);
  body.position.y = 2.6;
  g.add(body);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 1.0, 8), dark);
  pelvis.position.y = 0.8;
  g.add(pelvis);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.6, 8), dark);
    leg.position.set(s * 0.9, 0.8, 0);
    g.add(leg);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.4, 8), steel);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(s * 1.9, 3.6, 0.4);
    g.add(cannon);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.4, 4, 8), steel);
    arm.position.set(s * 2.1, 2.4, 0);
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), dark);
  head.position.y = 4.6;
  g.add(head);
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.1),
    makeCelMaterial({ color: e.core, emissive: e.core, emissiveStrength: 1.0, rim: 0.1 }),
  );
  eye.position.set(0, 4.6, 0.46);
  g.add(eye);

  // the chest core hatch
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 8), dark);
  hatch.rotation.x = Math.PI / 2;
  hatch.position.set(0, 2.8, 1.85);
  g.add(hatch);
  const coreGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10),
    makeCelMaterial({ color: e.core, emissive: e.core, emissiveStrength: 1.4, specBand: 0.9, specPow: 60, rim: 0.3 }),
  );
  coreGlow.position.set(0, 2.8, 1.6);
  coreGlow.visible = false;
  g.add(coreGlow);

  addOutline(g, 2.8, col(PAL.ink.line));

  return {
    group: g,
    coreGlow,
    update(_dt, time, state, stateT) {
      // idle sway
      g.position.y = Math.sin(time * 1.4) * 0.08;
      switch (state) {
        case "teleSpin":
          g.rotation.y += Math.sin(stateT * 30) * 0.03; // wind-up shudder
          break;
        case "spin":
          g.rotation.y = time * 14; // the tornado
          break;
        case "teleVolley":
          g.rotation.x = -0.12; // cannons brace
          break;
        case "slam":
          g.rotation.x = 0.5; // overhead come-down
          break;
        case "core":
          g.rotation.x = -0.2; // slumped, hatch open
          break;
        default:
          g.rotation.x = 0;
      }
      if (state !== "spin") g.rotation.y = g.userData.heading ?? g.rotation.y;
      coreGlow.visible = state === "core";
      hatch.rotation.z = state === "core" ? 1.4 : 0;
      if (state === "core") coreGlow.scale.setScalar(1 + Math.sin(time * 6) * 0.1);
    },
  };
}
