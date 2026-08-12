/**
 * player.ts — the trainer rig. Kitbash capsule-and-sphere kid with a cap
 * and a phone hand; legs swing with speed, a little lean into turns. The
 * rig poses (pose-as-behavior): walk, idle bounce, throw wind-up, cheer.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

export type PlayerPose = "idle" | "walk" | "throw" | "cheer";

export interface PlayerRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number, pose: PlayerPose): void;
}

export function buildPlayer(): PlayerRig {
  const g = new THREE.Group();
  const mHoodie = makeCelMaterial({ color: 0x18b8a8, rim: 0.5 });
  const mSkin = makeCelMaterial({ color: 0xf0c8a0, rim: 0.4 });
  const mPants = makeCelMaterial({ color: 0x3a4a8e, rim: 0.4 });
  const mCap = makeCelMaterial({ color: PAL.extra.ballRed, specBand: 0.4, rim: 0.5 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 6, 12), mHoodie);
  body.position.y = 1.05;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), mSkin);
  head.position.y = 1.75;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mCap);
  cap.position.y = 1.82;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 10, 1, false, 0, Math.PI), mCap);
  brim.position.set(0, 1.82, 0.26);
  g.add(brim);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), mPants);
    leg.position.set(s * 0.16, 0.45, 0);
    g.add(leg);
    legs.push(leg);
  }
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), mHoodie);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  // phone hand — permanently out, it is 2016
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), mHoodie);
  armR.position.set(0.42, 1.2, 0.14);
  armR.rotation.x = -1.0;
  g.add(armR);
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.26, 0.04),
    makeCelMaterial({ color: PAL.ink.deep, emissive: PAL.accents.primary, emissiveStrength: 0.35, rim: 0.2 }),
  );
  phone.position.set(0.42, 1.38, 0.38);
  g.add(phone);

  addOutline(g, 2.2, col(PAL.ink.line));

  let stride = 0;
  return {
    group: g,
    update(dt, time, speed, pose) {
      stride += dt * speed * 3.4;
      if (pose === "walk" && speed > 0.1) {
        legs[0].rotation.x = Math.sin(stride) * 0.7;
        legs[1].rotation.x = -Math.sin(stride) * 0.7;
        g.position.y = Math.abs(Math.sin(stride)) * 0.06;
        body.rotation.z = Math.sin(stride) * 0.04;
      } else if (pose === "throw") {
        armR.rotation.x = -2.4; // wound up over the shoulder
        g.position.y = 0;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
      } else if (pose === "cheer") {
        armL.rotation.z = 2.6;
        armR.rotation.z = -2.6;
        g.position.y = Math.abs(Math.sin(time * 6)) * 0.15;
      } else {
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        armL.rotation.z = 0;
        armR.rotation.z = 0;
        armR.rotation.x = -1.0;
        g.position.y = Math.sin(time * 2) * 0.02;
      }
    },
  };
}
