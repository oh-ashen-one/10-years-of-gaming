/**
 * characters.ts — the chunky 2018 survivor. Toy proportions (big head,
 * bigger pickaxe), palette variants for bots. Poses are behavior: run,
 * aim, swing (pickaxe), glide (spread-eagle + glider), build, and the
 * VICTORY DANCE. Death → crate handled by main.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

export type Pose = "idle" | "run" | "aim" | "swing" | "glide" | "dive" | "dance";

export interface SurvivorRig {
  group: THREE.Group;
  pickaxe: THREE.Group;
  update(dt: number, time: number, speed: number, pose: Pose): void;
}

const BOT_COLORS = [0x68d0f0, 0xff8ac8, 0x68d0b8, 0xffb85a, 0x9a8ae0];

export function buildSurvivor(seed: number, isPlayer: boolean): SurvivorRig {
  const g = new THREE.Group();
  const outfit = isPlayer ? 0xffd23f : BOT_COLORS[Math.floor(hash(seed) * BOT_COLORS.length)];
  const mBody = makeCelMaterial({ color: outfit, rim: 0.5 });
  const mSkin = makeCelMaterial({ color: 0xf0c8a0, rim: 0.35 });
  const mDark = makeCelMaterial({ color: 0x3a2f4a, rim: 0.35 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 6, 12), mBody);
  body.position.y = 1.1;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mSkin);
  head.position.y = 1.9;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
    makeCelMaterial({ color: isPlayer ? 0x402a58 : 0x5a4a3a, rim: 0.4 }),
  );
  hair.position.y = 1.98;
  g.add(hair);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), mDark);
    leg.position.set(s * 0.18, 0.45, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), mBody);
    arm.position.set(s * 0.48, 1.25, 0);
    g.add(arm);
    arms.push(arm);
  }

  // the oversized pickaxe — signature toy silhouette
  const pickaxe = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 6), makeCelMaterial({ color: 0x8a6a4a, rim: 0.3 }));
  const headP = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.12), makeCelMaterial({ color: 0xb8c8d8, specBand: 0.7, specPow: 50, rim: 0.4 }));
  headP.position.y = 0.55;
  pickaxe.add(handle, headP);
  pickaxe.position.set(0.5, 1.35, 0.25);
  pickaxe.rotation.z = -0.4;
  addOutline(pickaxe, 1.8, col(PAL.ink.line));
  g.add(pickaxe);

  // the held gun (hidden unless armed + aiming)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.9), mDark);
  gun.position.set(0.2, 1.3, 0.4);
  gun.visible = false;
  g.add(gun);

  addOutline(g, 2.4, col(PAL.ink.line));

  let stride = 0;
  let swingT = 0;

  return {
    group: g,
    pickaxe,
    update(dt, time, speed, pose) {
      stride += dt * speed * 2.6;
      swingT = pose === "swing" ? swingT + dt : 0;
      gun.visible = pose === "aim";
      pickaxe.visible = pose !== "aim" && pose !== "glide" && pose !== "dive";

      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      g.rotation.x = 0;
      g.rotation.z = 0;

      switch (pose) {
        case "run":
          g.position.y = Math.abs(Math.sin(stride)) * 0.08;
          legs[0].rotation.x = Math.sin(stride) * 0.8;
          legs[1].rotation.x = -Math.sin(stride) * 0.8;
          arms[0].rotation.x = -Math.sin(stride) * 0.5;
          arms[1].rotation.x = Math.sin(stride) * 0.5;
          g.rotation.x = 0.1;
          break;
        case "swing": {
          const k = Math.min(1, swingT / 0.45);
          pickaxe.rotation.x = -2.2 + k * 2.6; // overhead chop
          arms[1].rotation.x = -2.0 + k * 2.2;
          g.position.y = 0;
          break;
        }
        case "aim":
          arms[0].rotation.x = -1.3;
          arms[1].rotation.x = -1.3;
          g.position.y = 0;
          break;
        case "glide":
          g.rotation.x = 0.5;
          arms[0].rotation.z = 1.2;
          arms[1].rotation.z = -1.2;
          legs[0].rotation.x = 0.3;
          legs[1].rotation.x = 0.3;
          break;
        case "dive":
          g.rotation.x = 1.2;
          arms[0].rotation.z = 0.5;
          arms[1].rotation.z = -0.5;
          break;
        case "dance": {
          // the emote beat: bounce + alternating arms + lean
          g.position.y = Math.abs(Math.sin(time * 5.2)) * 0.22;
          g.rotation.z = Math.sin(time * 2.6) * 0.12;
          arms[0].rotation.z = 2.4 + Math.sin(time * 5.2) * 0.5;
          arms[1].rotation.z = -2.4 + Math.sin(time * 5.2 + Math.PI) * 0.5;
          legs[0].rotation.x = Math.sin(time * 5.2) * 0.4;
          legs[1].rotation.x = -Math.sin(time * 5.2) * 0.4;
          break;
        }
        default:
          g.position.y = Math.sin(time * 1.8) * 0.02;
      }
    },
  };
}

/** Death crate. */
export function buildCrate(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.6),
    makeCelMaterial({ color: 0x9a7a5a, rim: 0.4 }),
  );
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.64), makeCelMaterial({ color: 0x6a5a4a, rim: 0.3 }));
  lid.position.y = 0.28;
  m.add(lid);
  addOutline(m, 2.2, col(PAL.ink.line));
  return m;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
