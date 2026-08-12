/**
 * characters.ts — the survivors. One kitbash soldier plan (poster
 * proportions: big helmet, backpack, held weapon) with palette variants
 * for the player and the 15 bots. Poses are behavior: run/idle/aim/
 * prone/drive. Death swaps to a loot crate (handled by the caller).
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

export type SurvivorPose = "idle" | "run" | "aim" | "prone" | "drive";

export interface SurvivorRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number, pose: SurvivorPose): void;
}

const BOT_OUTFITS = [0x6a7a5a, 0x7a6a4a, 0x5a6a7a, 0x8a7a5a, 0x4a5a4a];

export function buildSurvivor(seed: number, isPlayer: boolean): SurvivorRig {
  const g = new THREE.Group();
  const outfit = isPlayer ? 0xf2952a : BOT_OUTFITS[Math.floor(hash(seed) * BOT_OUTFITS.length)];
  const mBody = makeCelMaterial({ color: outfit, rim: 0.5 });
  const mSkin = makeCelMaterial({ color: 0xe8b890, rim: 0.35 });
  const mDark = makeCelMaterial({ color: 0x3a3a48, rim: 0.35 });
  const mHelm = makeCelMaterial({ color: isPlayer ? 0xf0ece0 : 0x5a5a4a, specBand: 0.6, specPow: 40, rim: 0.5 });

  const inner = new THREE.Group(); // pitch/roll for prone etc.
  g.add(inner);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 12), mBody);
  body.position.y = 1.1;
  inner.add(body);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), mDark);
  pack.position.set(0, 1.15, -0.38);
  inner.add(pack);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mSkin);
  head.position.y = 1.85;
  inner.add(head);
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.9),
    mHelm,
  );
  helm.position.y = 1.9;
  inner.add(helm);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), mDark);
    leg.position.set(s * 0.17, 0.45, 0);
    inner.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), mBody);
    arm.position.set(s * 0.44, 1.2, 0.1);
    inner.add(arm);
    arms.push(arm);
  }
  // the held weapon — a chunky inked bar, always two hands' worth
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.85), mDark);
  gun.position.set(0.2, 1.25, 0.45);
  inner.add(gun);

  addOutline(g, 2.4, col(PAL.ink.line));

  let stride = 0;
  return {
    group: g,
    update(dt, time, speed, pose) {
      stride += dt * speed * 2.6;
      if (pose === "prone") {
        inner.rotation.x = -Math.PI / 2 + 0.12;
        inner.position.y = -0.55;
        legs[0].rotation.x = 0.3;
        legs[1].rotation.x = -0.2;
        arms[0].rotation.x = -0.8 + Math.sin(time * 1.4) * 0.05;
        arms[1].rotation.x = -0.8;
        return;
      }
      inner.rotation.x = 0;
      if (pose === "drive") {
        inner.position.y = -0.45;
        legs[0].rotation.x = -1.4;
        legs[1].rotation.x = -1.4;
        arms[0].rotation.x = -0.9;
        arms[1].rotation.x = -0.9;
        return;
      }
      if (pose === "run" && speed > 0.1) {
        inner.position.y = Math.abs(Math.sin(stride)) * 0.07;
        legs[0].rotation.x = Math.sin(stride) * 0.75;
        legs[1].rotation.x = -Math.sin(stride) * 0.75;
        arms[0].rotation.x = -Math.sin(stride) * 0.4 - 0.4;
        arms[1].rotation.x = Math.sin(stride) * 0.4 - 0.4;
        inner.rotation.x = 0.12; // lean into the run
      } else if (pose === "aim") {
        inner.position.y = 0;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        arms[0].rotation.x = -1.25;
        arms[1].rotation.x = -1.25;
        gun.position.z = 0.55;
      } else {
        inner.position.y = Math.sin(time * 1.8) * 0.02;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        arms[0].rotation.x = -0.35;
        arms[1].rotation.x = -0.35;
      }
      if (pose !== "aim") gun.position.z = 0.45;
    },
  };
}

/** Death crate — PUBG's little box of someone's story. */
export function buildCrate(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.6),
    makeCelMaterial({ color: 0x7a6a4a, rim: 0.4 }),
  );
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.1, 0.64),
    makeCelMaterial({ color: 0x5a4a3a, rim: 0.3 }),
  );
  lid.position.y = 0.28;
  m.add(lid);
  addOutline(m, 2.2, col(PAL.ink.line));
  return m;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
