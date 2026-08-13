/**
 * mobs.ts — the night shift, kitbash voxel-style: the zombie (arms out,
 * green), the skeleton (pale, bow stick, kites you), ONE creeper (four
 * feet, tall, hisses). Pose updates are behavior: shamble arms, kite
 * strafes, hiss swell, dawn burn. Death/burn FX are main's job (puffs).
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";
import type { Mob } from "./game";

export interface MobRig {
  group: THREE.Group;
  update(dt: number, time: number, m: Mob): void;
}

export function buildMob(m: Mob): MobRig {
  const g = new THREE.Group();
  const e = PAL.extra;

  if (m.type === "zombie") {
    const skin = makeCelMaterial({ color: e.zombie, rim: 0.45 });
    const shirt = makeCelMaterial({ color: 0x3a6a8a, rim: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), shirt);
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 1.95;
    g.add(body, head);
    const arms: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.7), skin);
      arm.position.set(s * 0.42, 1.45, 0.35); // arms straight out
      g.add(arm);
      arms.push(arm);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), makeCelMaterial({ color: 0x3a3a5a, rim: 0.3 }));
      leg.position.set(s * 0.16, 0.35, 0);
      g.add(leg);
    }
    g.userData.arms = arms;
  } else if (m.type === "skeleton") {
    const bone = makeCelMaterial({ color: e.skeleton, rim: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.3), bone);
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), bone);
    head.position.y = 1.9;
    g.add(body, head);
    // ribs
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.34), makeCelMaterial({ color: 0x8a8a80, rim: 0.2 }));
      rib.position.y = 0.95 + i * 0.22;
      g.add(rib);
    }
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), bone);
      arm.position.set(s * 0.35, 1.15, 0);
      g.add(arm);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), bone);
      leg.position.set(s * 0.14, 0.35, 0);
      g.add(leg);
    }
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), makeCelMaterial({ color: 0x6a4a2a, rim: 0.3 }));
    bow.position.set(-0.45, 1.3, 0.2);
    bow.rotation.z = 0.3;
    g.add(bow);
  } else {
    // creeper: tall green column, four feet, sad face
    const skin = makeCelMaterial({ color: e.creeper, rim: 0.45 });
    const dark = makeCelMaterial({ color: 0x2a5a2a, rim: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.4), skin);
    body.position.y = 1.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
    head.position.y = 2.2;
    g.add(body, head);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), dark);
    mouth.position.set(0, 2.05, 0.29);
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.05), dark);
    eyes.position.set(0, 2.3, 0.29);
    g.add(mouth, eyes);
    for (const [sx, sz] of [[-0.18, 0.15], [0.18, 0.15], [-0.18, -0.15], [0.18, -0.15]] as const) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), skin);
      foot.position.set(sx, 0.27, sz);
      g.add(foot);
    }
    g.userData.body = body;
    g.userData.head = head;
  }

  addOutline(g, 2.2, col(PAL.ink.line));

  return {
    group: g,
    update(_dt, time, mob) {
      // shamble / kite bob
      g.position.y = mob.y + Math.abs(Math.sin(time * 5 + mob.id)) * 0.05;
      // hit flash
      const flash = mob.flash > 0;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material instanceof THREE.ShaderMaterial) {
          mesh.material.uniforms.uEmissive?.value.set(flash ? 0xffffff : 0x000000);
          if (mesh.material.uniforms.uEmissiveStr) {
            mesh.material.uniforms.uEmissiveStr.value = flash ? 0.7 : mob.burnT > 0 ? 0.4 : 0;
            if (mob.burnT > 0) mesh.material.uniforms.uEmissive.value.set(0xff8a2a);
          }
        }
      });
      if (mob.type === "zombie" && g.userData.arms) {
        for (const arm of g.userData.arms as THREE.Mesh[]) {
          arm.rotation.x = Math.sin(time * 5 + mob.id) * 0.12;
        }
      }
      if (mob.type === "creeper" && mob.hissT > 0) {
        const k = 1 + Math.sin(time * 30) * 0.12 + (1.3 - mob.hissT) * 0.18;
        g.userData.body.scale.setScalar(k);
        g.userData.head.scale.setScalar(k);
      } else if (mob.type === "creeper") {
        g.userData.body.scale.setScalar(1);
        g.userData.head.scale.setScalar(1);
      }
    },
  };
}

/** Skeleton arrows — thin dark streaks with a pale tip. */
export function buildArrowMesh(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.6),
    makeCelMaterial({ color: 0x4a3a2a, rim: 0.1 }),
  );
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.12),
    makeCelMaterial({ color: 0xd8d8d0, rim: 0.2 }),
  );
  tip.position.z = 0.32;
  g.add(shaft, tip);
  return g;
}
