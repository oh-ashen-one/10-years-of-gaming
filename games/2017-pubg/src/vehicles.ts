/**
 * vehicles.ts — the drop plane and the buggy. Kitbash, inked, generated.
 * The plane drones over the island on its line; the buggy is an arcade
 * toy: wheel spin, body roll under steering, squash on throttle.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

/* ----------------------------------------------------------------- plane -- */

export interface PlaneRig {
  group: THREE.Group;
  update(dt: number): void;
}

export function buildPlane(): PlaneRig {
  const g = new THREE.Group();
  const mBody = makeCelMaterial({ color: 0x8a94a8, specBand: 0.6, specPow: 40, rim: 0.55 });
  const mDark = makeCelMaterial({ color: 0x3a3a48, rim: 0.3 });

  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 14, 8, 12), mBody);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 3.2), mBody);
  wing.position.set(0, 1.3, 1.0);
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 1.8), mBody);
  tail.position.set(0, 0.8, -7.2);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 2.2), mBody);
  fin.position.set(0, 1.6, -7.2);
  g.add(fin);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.2), mDark);
  prop.position.set(0, 0, 8.2);
  g.add(prop);
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8), mDark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(s * 4.5, 1.0, 2.2);
    g.add(eng);
  }
  addOutline(g, 2.6, col(PAL.ink.line));

  return {
    group: g,
    update(dt) {
      prop.rotation.z += dt * 40;
    },
  };
}

/* ----------------------------------------------------------------- buggy -- */

export interface BuggyRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number): void;
}

export function buildBuggy(): BuggyRig {
  const g = new THREE.Group();
  const mBody = makeCelMaterial({ color: PAL.extra.buggy, specBand: 0.5, specPow: 36, rim: 0.55 });
  const mDark = makeCelMaterial({ color: 0x2e2e3a, rim: 0.3 });

  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 3.1), mBody);
  tub.position.y = 0.75;
  g.add(tub);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.9), mBody);
  nose.position.set(0, 0.85, 1.9);
  g.add(nose);
  // roll cage
  for (const [sx, sz] of [[-0.85, -0.9], [0.85, -0.9], [-0.85, 0.6], [0.85, 0.6]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), mDark);
    post.position.set(sx, 1.5, sz);
    g.add(post);
  }
  const cageTop = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 1.6), mDark);
  cageTop.position.set(0, 2.05, -0.15);
  g.add(cageTop);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.6), mDark);
  seat.position.set(0, 1.05, -0.3);
  g.add(seat);

  const wheels: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1.0, 1.15], [1.0, 1.15], [-1.0, -1.15], [1.0, -1.15]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mDark);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.5, sz);
    g.add(w);
    wheels.push(w);
  }
  addOutline(g, 2.4, col(PAL.ink.line));

  let spin = 0;
  return {
    group: g,
    update(dt, time, speed) {
      spin += speed * dt * 2;
      for (const w of wheels) w.rotation.x = spin % (Math.PI * 2);
      // arcade squash + roll
      const squash = Math.min(0.12, Math.abs(speed) * 0.004);
      g.scale.y = 1 - squash * (0.5 + Math.sin(time * 30) * 0.5);
      g.rotation.z = 0; // steering roll handled by caller via heading
    },
  };
}

/* ------------------------------------------------------------------ chute -- */

/** Paraglider canopy for the drop — big orange arc, swinging lines. */
export function buildChute(): THREE.Group {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
    makeCelMaterial({ color: PAL.accents.primary, rim: 0.4, doubleSided: true }),
  );
  canopy.scale.set(1.4, 0.5, 0.8);
  canopy.position.y = 5.2;
  g.add(canopy);
  const lineMat = makeCelMaterial({ color: PAL.ink.line, rim: 0.1 });
  for (const s of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 4), lineMat);
    line.position.set(s * 2.6, 2.8, 0);
    line.rotation.z = s * 0.5;
    g.add(line);
  }
  addOutline(canopy, 2.4, col(PAL.ink.line));
  return g;
}
