/**
 * beans.ts — the crewmates. Chunky capsule beans in candy colors with the
 * banded-spec visor shine, backpack, walk waddle. Dead bodies: the
 * top-half bean with the bone. The vent dive is a scale animation.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

export interface BeanRig {
  group: THREE.Group;
  update(dt: number, time: number, moving: boolean): void;
  ventDive(): void;   // impostor escape anim
  update2?(dt: number): void;
}

export function buildBean(color: number): BeanRig {
  const g = new THREE.Group();
  const mBody = makeCelMaterial({ color, specBand: 0.35, specPow: 34, rim: 0.55 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 8, 14), mBody);
  body.position.y = 0.72;
  g.add(body);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), makeCelMaterial({ color: 0x3a4058, rim: 0.3 }));
  pack.position.set(0, 0.85, -0.42);
  g.add(pack);
  // THE visor: pale glass with a hard banded glint
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    makeCelMaterial({ color: PAL.extra.visor, specBand: 1.0, specPow: 24, rim: 0.25 }),
  );
  visor.position.set(0, 1.05, 0.3);
  visor.scale.set(1.15, 0.7, 0.7);
  g.add(visor);
  // stubby legs
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.2, 4, 8), mBody);
    leg.position.set(s * 0.18, 0.16, 0);
    g.add(leg);
    legs.push(leg);
  }
  addOutline(g, 2.6, col(PAL.ink.line));

  let stride = 0;
  let diveT = -1;
  return {
    group: g,
    ventDive() {
      diveT = 0;
    },
    update(dt, time, moving) {
      if (diveT >= 0) {
        diveT += dt;
        const k = Math.min(1, diveT / 0.5);
        g.scale.setScalar(1 - k * 0.95);
        g.position.y = -k * 1.2;
        if (diveT > 0.6) diveT = -1;
        return;
      }
      if (moving) {
        stride += dt * 9;
        g.position.y = Math.abs(Math.sin(stride)) * 0.08;
        legs[0].rotation.x = Math.sin(stride) * 0.7;
        legs[1].rotation.x = -Math.sin(stride) * 0.7;
        g.rotation.z = Math.sin(stride) * 0.05;
      } else {
        g.position.y = Math.sin(time * 2.2) * 0.025;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        g.rotation.z = 0;
      }
    },
  };
}

/** the dead body: top half of the bean, bone out, blood pool under */
export function buildBody(color: number): THREE.Group {
  const g = new THREE.Group();
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.blood, transparent: true, opacity: 0.85 }),
  );
  pool.position.y = 0.02;
  g.add(pool);
  const mBody = makeCelMaterial({ color, rim: 0.5 });
  const half = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mBody,
  );
  half.position.y = 0.12;
  half.rotation.z = Math.PI / 2.3; // tipped over
  g.add(half);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    makeCelMaterial({ color: PAL.extra.visor, specBand: 1.0, specPow: 24, rim: 0.2 }),
  );
  visor.position.set(0.35, 0.35, 0.1);
  visor.scale.set(1.1, 0.6, 0.7);
  g.add(visor);
  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.5, 6),
    makeCelMaterial({ color: 0xf0f0e8, rim: 0.2 }),
  );
  bone.position.set(-0.3, 0.3, 0);
  bone.rotation.z = 0.9;
  g.add(bone);
  addOutline(g, 2.4, col(PAL.ink.line));
  return g;
}
