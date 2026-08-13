/**
 * characters.ts — the tabletop cast, 3/4-chibi with dramatic rim: the
 * sell-sword (you), the spark mage (companion), the gaunt tollkeeper,
 * two guard types. Poses are behavior: idle sway, walk bob, attack
 * lunge, shove stagger, and THE FLAIL — the ragdoll tumble into the
 * river.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";
import type { Kind } from "./game";

export interface FigRig {
  group: THREE.Group;
  update(dt: number, time: number, moving: boolean): void;
  flail(): void; // knocked into the river
}

export function buildFigure(kind: Kind, seed = 1): FigRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const main = {
    player: e.swordC,
    mage: e.mageC,
    tollkeeper: e.tollC,
    guard: e.guardC,
  }[kind];
  const mBody = makeCelMaterial({ color: main, rim: 0.75 }); // dramatic rim — tabletop pop
  const mSkin = makeCelMaterial({ color: 0xe8c8a0, rim: 0.4 });

  const tall = kind === "tollkeeper" ? 1.25 : kind === "guard" ? 1.05 : 1.0;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5 * tall, 6, 12), mBody);
  body.position.y = 0.95 * tall;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mSkin);
  head.position.y = 1.55 * tall;
  g.add(head);

  if (kind === "tollkeeper") {
    // gaunt: tall hat, long coat
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8), mBody);
    hat.position.y = 2.15;
    g.add(hat);
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), mBody);
    coat.position.y = 0.7;
    g.add(coat);
  } else if (kind === "mage") {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 8), mBody);
    hat.position.y = 1.95;
    g.add(hat);
    // the spark orb on a short staff
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      makeCelMaterial({ color: 0xb88aff, emissive: 0x9a5ae0, emissiveStrength: 1.0, rim: 0.2 }),
    );
    orb.position.set(0.45, 1.5, 0.15);
    orb.name = "orb";
    g.add(orb);
  } else if (kind === "player") {
    // the sell-sword: big shoulder + the sword
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), makeCelMaterial({ color: 0x8a94a8, specBand: 0.7, rim: 0.4 }));
    pauldron.position.set(-0.3, 1.35, 0);
    g.add(pauldron);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.14), makeCelMaterial({ color: 0xd8dce8, specBand: 0.8, specPow: 60, rim: 0.3 }));
    sword.position.set(0.45, 1.1, 0.1);
    sword.rotation.z = -0.5;
    sword.name = "sword";
    g.add(sword);
  } else {
    // guard: kettle helm + pike
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.24, 10), makeCelMaterial({ color: 0x6a7078, specBand: 0.5, rim: 0.4 }));
    helm.position.y = 1.72;
    g.add(helm);
    const pike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), makeCelMaterial({ color: 0x4a3a2a, rim: 0.2 }));
    pike.position.set(0.4, 1.2, 0);
    pike.rotation.z = -0.25;
    g.add(pike);
  }

  addOutline(g, 2.2, col(PAL.ink.line));

  let stride = 0;
  let flailT = -1;
  return {
    group: g,
    flail() {
      flailT = 0;
    },
    update(dt, time, moving) {
      if (flailT >= 0) {
        // the ragdoll tumble, arcing into the drink
        flailT += dt;
        g.rotation.x = -flailT * 9;
        g.rotation.z = flailT * 5;
        g.position.y = Math.max(-2.2, Math.sin(flailT * 2.4) * 1.4 - flailT * 2.4);
        if (flailT > 1.1) g.visible = false; // under the waterline, gone
        return;
      }
      if (moving) {
        stride += dt * 8;
        g.position.y = Math.abs(Math.sin(stride)) * 0.07;
        g.rotation.z = Math.sin(stride) * 0.05;
      } else {
        g.position.y = Math.sin(time * 1.8 + seed) * 0.02;
        g.rotation.z = 0;
      }
      const orb = g.getObjectByName("orb");
      if (orb) orb.position.y = 1.5 + Math.sin(time * 3.2) * 0.08;
    },
  };
}
