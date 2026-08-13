/**
 * dressing.ts — the valley set: the mosslunk camp (fire + tents + skull
 * totems), the marked cliff face (gold stripes), the ruin arena (pillar
 * ring + broken arches), the updraft rings, the victory chest, scattered
 * flowers and windmill-less ridges (those live in the sky rings).
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1 } from "@tenyears/core";
import { PAL } from "../palette";
import { CAMP, CLIFF, ARENA, RINGS, heightAt } from "../meadow";

export interface DressingRig {
  group: THREE.Group;
  chest: THREE.Group;
  fire: THREE.Group;
  update(dt: number, time: number): void;
}

export function buildDressing(world: THREE.Group): DressingRig {
  const g = new THREE.Group();

  /* ---- mosslunk camp ---- */
  const tentM = makeCelMaterial({ color: 0xb08858, rim: 0.4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.8, 6), tentM);
    tent.position.set(CAMP.x + Math.cos(a) * 10, heightAt(CAMP.x + Math.cos(a) * 10, CAMP.z + Math.sin(a) * 10) + 1.4, CAMP.z + Math.sin(a) * 10);
    addOutline(tent, 2.2, col(PAL.ink.line));
    g.add(tent);
  }
  // campfire
  const fire = new THREE.Group();
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8), makeCelMaterial({ color: 0x4a3020, rim: 0.2 }));
  logs.position.y = 0.2;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.2, 6),
    makeCelMaterial({ color: PAL.extra.flame, emissive: PAL.extra.flame, emissiveStrength: 1.0, rim: 0.1 }),
  );
  flame.name = "flame";
  flame.position.y = 0.9;
  fire.add(logs, flame);
  fire.position.set(CAMP.x, heightAt(CAMP.x, CAMP.z), CAMP.z);
  g.add(fire);
  // skull totem
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), makeCelMaterial({ color: 0x6a4a2a, rim: 0.3 }));
  pole.position.set(CAMP.x + 4, heightAt(CAMP.x + 4, CAMP.z + 3) + 1.7, CAMP.z + 3);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), makeCelMaterial({ color: 0xe8e0d0, rim: 0.4 }));
  skull.position.y = 1.9;
  pole.add(skull);
  addOutline(pole, 2.0, col(PAL.ink.line));
  g.add(pole);

  /* ---- the marked cliff: gold-striped climb bands ---- */
  const markM = makeCelMaterial({ color: PAL.extra.cliffMark, emissive: PAL.extra.cliffMark, emissiveStrength: 0.35, rim: 0.3 });
  for (let i = 0; i < 3; i++) {
    const x = CLIFF.x - CLIFF.w / 4 + i * (CLIFF.w / 4);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.2, CLIFF.h, 0.3), markM);
    band.position.set(x, heightAt(x, CLIFF.z - 4) + CLIFF.h / 2, CLIFF.z - 3.6);
    g.add(band);
  }

  /* ---- ruin arena: pillar ring + broken arches ---- */
  const pillarM = makeCelMaterial({ color: PAL.extra.pillar, rim: 0.4 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = ARENA.x + Math.cos(a) * (ARENA.r - 4);
    const z = ARENA.z + Math.sin(a) * (ARENA.r - 4);
    const h = 6 + hash1(i * 7.7) * 4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, h, 8), pillarM);
    pillar.position.set(x, heightAt(x, z) + h / 2, z);
    const capBlock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 3), makeCelMaterial({ color: PAL.extra.ruinStone, rim: 0.3 }));
    capBlock.position.y = h / 2 + 0.4;
    pillar.add(capBlock);
    addOutline(pillar, 2.4, col(PAL.ink.line));
    g.add(pillar);
  }
  // arena center seal
  const seal = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.core, transparent: true, opacity: 0.4 }),
  );
  seal.position.set(ARENA.x, heightAt(ARENA.x, ARENA.z) + 0.06, ARENA.z);
  g.add(seal);

  /* ---- updraft rings ---- */
  for (const r of RINGS) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r.r, 0.28, 8, 28),
      makeCelMaterial({ color: PAL.extra.gale, emissive: PAL.extra.gale, emissiveStrength: 0.5, rim: 0.2 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(r.x, r.y, r.z);
    ring.name = "ring";
    g.add(ring);
  }

  /* ---- the victory chest (hidden until the Warden falls) ---- */
  const chest = new THREE.Group();
  const cbase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), makeCelMaterial({ color: PAL.extra.chestDeep, specBand: 0.5, rim: 0.4 }));
  cbase.position.y = 0.45;
  const clid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.2), makeCelMaterial({ color: PAL.extra.chest, specBand: 0.8, specPow: 50, rim: 0.5 }));
  clid.position.y = 1.1;
  clid.name = "lid";
  chest.add(cbase, clid);
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.6, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.chest, transparent: true, opacity: 0.6 }),
  );
  glow.position.y = 0.08;
  glow.name = "glow";
  chest.add(glow);
  addOutline(chest, 2.2, col(PAL.ink.line));
  chest.position.set(ARENA.x, heightAt(ARENA.x, ARENA.z), ARENA.z);
  chest.visible = false;
  g.add(chest);

  /* ---- flowers + rocks ---- */
  for (let i = 0; i < 60; i++) {
    const x = (hash1(i * 5.3) - 0.5) * 440;
    const z = (hash1(i * 9.7) - 0.5) * 440;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 6) continue;
    const y = heightAt(x, z);
    if (hash1(i * 3.1) > 0.4) {
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        makeCelMaterial({ color: hash1(i * 7.7) > 0.5 ? PAL.extra.flower : PAL.extra.energy, rim: 0.3 }),
      );
      fl.position.set(x, y + 0.35, z);
      g.add(fl);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + hash1(i * 3.7) * 0.8, 0), makeCelMaterial({ color: PAL.extra.pillar, rim: 0.4 }));
      rock.position.set(x, y + 0.2, z);
      addOutline(rock, 1.8, col(PAL.ink.line));
      g.add(rock);
    }
  }

  world.add(g);

  return {
    group: g,
    chest,
    fire,
    update(_dt, time) {
      const flame = fire.getObjectByName("flame")!;
      flame.scale.set(1 + Math.sin(time * 9) * 0.15, 1 + Math.sin(time * 12) * 0.2, 1);
      for (const o of g.children) {
        if (o.name === "ring") o.rotation.z = time * 0.6;
      }
      if (chest.visible) {
        const gl = chest.getObjectByName("glow") as THREE.Mesh;
        (gl.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 3) * 0.2;
      }
    },
  };
}
