/**
 * dressing.ts — the toy-island set: TILTED's five chunky towers, the
 * leaning water tower, the farm (barn/silo/crop rows), lollipop trees and
 * chunky cars (both harvestable — their meshes key off map.ts truth),
 * glossy chests with glow, bushes. All generated, all inked.
 *
 * Returns a rig: harvest/chest events drive the animations (tree shake &
 * fall, car crush, chest lid flip), queried by id from main.ts.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1 } from "@tenyears/core";
import { PAL } from "../palette";
import {
  TILTED, FARM, TOWER, TILTED_BUILDINGS, TREES, CARS, CHESTS, CROP_ROWS, heightAt,
} from "../map";

export interface DressingRig {
  treeFall(id: number): void;
  carCrush(id: number): void;
  chestOpen(id: number): void;
  /** per-frame: tree shake decay, chest glow pulse */
  update(dt: number, time: number): void;
  /** shake a harvestable when whacked */
  chip(kind: string, id: number): void;
  /** nearest unopened chest within range of (x,z), for the jingle loop */
  nearestChestDist(x: number, z: number): number;
}

function tower(b: { x: number; z: number; w: number; d: number; h: number; c: number }): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(b.w, b.h, b.d),
    makeCelMaterial({ color: b.c, rim: 0.4 }),
  );
  body.position.y = b.h / 2;
  g.add(body);
  // chunky window bands
  const winM = makeCelMaterial({ color: PAL.ink.deep, emissive: 0xfff0b8, emissiveStrength: 0.25, rim: 0.1 });
  for (let f = 1; f < b.h / 3; f++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.8, 0.9, 0.1), winM);
    band.position.set(0, f * 3, b.d / 2 + 0.06);
    g.add(band);
  }
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(b.w * 0.6, 1.2, b.d * 0.6),
    makeCelMaterial({ color: PAL.ink.line, rim: 0.3 }),
  );
  cap.position.y = b.h + 0.6;
  g.add(cap);
  addOutline(g, 2.6, col(PAL.ink.line));
  g.position.set(b.x, heightAt(b.x, b.z), b.z);
  return g;
}

function waterTower(): THREE.Group {
  const g = new THREE.Group();
  const mLeg = makeCelMaterial({ color: 0x8a7a6a, rim: 0.3 });
  for (const [sx, sz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 11, 6), mLeg);
    leg.position.set(sx, 5.5, sz);
    leg.rotation.z = -sx * 0.02;
    g.add(leg);
  }
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.8, 5, 12),
    makeCelMaterial({ color: 0xd8d0c0, specBand: 0.4, rim: 0.5 }),
  );
  tank.position.y = 13;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.2, 12), makeCelMaterial({ color: PAL.extra.barnRed, rim: 0.4 }));
  roof.position.y = 16.6;
  g.add(tank, roof);
  addOutline(g, 2.4, col(PAL.ink.line));
  g.position.set(TOWER.x, heightAt(TOWER.x, TOWER.z), TOWER.z);
  g.rotation.z = 0.06; // the lean
  return g;
}

function barn(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 9),
    makeCelMaterial({ color: PAL.extra.barnRed, rim: 0.4 }),
  );
  body.position.y = 3;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 14.5, 3, 1), makeCelMaterial({ color: 0x9a3a2a, rim: 0.35 }));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = Math.PI;
  roof.scale.y = 0.55;
  roof.position.y = 6.4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), makeCelMaterial({ color: PAL.ink.deep, rim: 0.1 }));
  door.position.set(0, 2, 4.55);
  g.add(body, roof, door);
  addOutline(g, 2.6, col(PAL.ink.line));
  g.position.set(FARM.x + 8, heightAt(FARM.x + 8, FARM.z - 8), FARM.z - 8);
  return g;
}

function silo(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 10, 12),
    makeCelMaterial({ color: PAL.extra.silo, specBand: 0.5, rim: 0.45 }),
  );
  body.position.y = 5;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    makeCelMaterial({ color: PAL.extra.barnRed, rim: 0.4 }),
  );
  cap.position.y = 10;
  g.add(body, cap);
  addOutline(g, 2.4, col(PAL.ink.line));
  g.position.set(FARM.x - 12, heightAt(FARM.x - 12, FARM.z - 12), FARM.z - 12);
  return g;
}

function treeMesh(s: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 2.4, 7),
    makeCelMaterial({ color: 0x8a5a3a, rim: 0.3 }),
  );
  trunk.position.y = 1.2;
  g.add(trunk);
  const leaf = makeCelMaterial({ color: hash1(s * 91) > 0.5 ? PAL.extra.leafA : PAL.extra.leafB, rim: 0.5 });
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 10), leaf);
  b1.position.y = 3.4;
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), leaf);
  b2.position.set(0.7, 4.4, 0.3);
  g.add(b1, b2);
  addOutline(g, 2.2, col(PAL.ink.line));
  g.scale.setScalar(s);
  return g;
}

function carMesh(c: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.8, 4.2),
    makeCelMaterial({ color: c, specBand: 0.7, specPow: 40, rim: 0.5 }),
  );
  body.position.y = 0.75;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.7, 2.0),
    makeCelMaterial({ color: 0x2a2a3a, specBand: 0.6, rim: 0.4 }),
  );
  cabin.position.set(0, 1.4, -0.3);
  g.add(body, cabin);
  const wheelM = makeCelMaterial({ color: 0x2a2a3a, rim: 0.3 });
  for (const [sx, sz] of [[-1.1, 1.4], [1.1, 1.4], [-1.1, -1.4], [1.1, -1.4]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10), wheelM);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.45, sz);
    g.add(w);
  }
  addOutline(g, 2.3, col(PAL.ink.line));
  return g;
}

function chestMesh(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.6, 0.8),
    makeCelMaterial({ color: PAL.extra.chestDeep, specBand: 0.5, rim: 0.4 }),
  );
  base.position.y = 0.3;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.34, 0.84),
    makeCelMaterial({ color: PAL.extra.chest, specBand: 0.8, specPow: 50, rim: 0.5 }),
  );
  lid.position.set(0, 0.72, 0);
  lid.name = "lid";
  g.add(base, lid);
  addOutline(g, 2.2, col(PAL.ink.line));
  return g;
}

/* ------------------------------------------------------------------ rig -- */

export function buildDressing(world: THREE.Group): DressingRig {
  const g = new THREE.Group();

  // TILTED's five towers + the leaning water tower
  for (const b of TILTED_BUILDINGS) g.add(tower(b));
  g.add(waterTower());

  // the farm
  g.add(barn());
  g.add(silo());
  // crop rows: toy corn stripes
  const cropM = makeCelMaterial({ color: PAL.extra.wheat, rim: 0.35 });
  for (let r = 0; r < CROP_ROWS.rows; r++) {
    const row = new THREE.Mesh(new THREE.BoxGeometry(CROP_ROWS.len, 0.8, 1.6), cropM);
    const x = CROP_ROWS.x;
    const z = CROP_ROWS.z + r * 4;
    row.position.set(x, heightAt(x, z) + 0.4, z);
    g.add(row);
  }

  // harvestables, indexed to match game.harvestables ids
  const treeMeshes = new Map<number, THREE.Group>();
  TREES.forEach((t, i) => {
    const m = treeMesh(t.s);
    m.position.set(t.x, heightAt(t.x, t.z), t.z);
    m.rotation.y = t.rot;
    treeMeshes.set(i, m);
    g.add(m);
  });
  const carMeshes = new Map<number, THREE.Group>();
  CARS.forEach((c, i) => {
    const m = carMesh(c.c);
    m.position.set(c.x, heightAt(c.x, c.z), c.z);
    m.rotation.y = c.rot;
    carMeshes.set(100 + i, m);
    g.add(m);
  });

  // chests with glow discs
  const chestMeshes = new Map<number, { group: THREE.Group; glow: THREE.Mesh; lid: THREE.Object3D }>();
  CHESTS.forEach((c, i) => {
    const m = chestMesh();
    m.position.set(c.x, heightAt(c.x, c.z), c.z);
    m.rotation.y = c.rot;
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.35, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.extra.chest, transparent: true, opacity: 0.6 }),
    );
    glow.position.y = 0.08;
    m.add(glow);
    chestMeshes.set(i, { group: m, glow, lid: m.getObjectByName("lid")! });
    g.add(m);
  });

  // bushes for flavor
  for (let i = 0; i < 24; i++) {
    const a = hash1(i * 7.7) * Math.PI * 2;
    const r = 40 + hash1(i * 3.1) * 230;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z) > 275) continue;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 8, 6),
      makeCelMaterial({ color: PAL.extra.leafB, rim: 0.4 }),
    );
    bush.scale.y = 0.6;
    bush.position.set(x, heightAt(x, z) + 0.3, z);
    g.add(bush);
  }

  world.add(g);

  // animation state
  const shakes = new Map<THREE.Object3D, number>();
  const falls: { m: THREE.Group; t: number }[] = [];

  return {
    chip(kind, id) {
      const m = kind === "tree" ? treeMeshes.get(id) : kind === "car" ? carMeshes.get(id) : null;
      if (m) shakes.set(m, 0.3);
    },
    treeFall(id) {
      const m = treeMeshes.get(id);
      if (m) falls.push({ m, t: 0 });
    },
    carCrush(id) {
      const m = carMeshes.get(id);
      if (m) {
        m.scale.y = 0.45; // pancaked
        shakes.set(m, 0.5);
      }
    },
    chestOpen(id) {
      const c = chestMeshes.get(id);
      if (c) {
        c.lid.rotation.x = -1.1;
        c.glow.visible = false;
      }
    },
    nearestChestDist(x, z) {
      let bd = Infinity;
      for (const [id, c] of chestMeshes) {
        void id;
        const d = Math.hypot(c.group.position.x - x, c.group.position.z - z);
        if (c.glow.visible && d < bd) bd = d;
      }
      return bd;
    },
    update(dt, time) {
      for (const [m, t] of shakes) {
        const nt = t - dt;
        m.rotation.z = Math.sin(time * 40) * t * 0.4;
        if (nt <= 0) {
          m.rotation.z = 0;
          shakes.delete(m);
        } else shakes.set(m, nt);
      }
      for (const f of falls) {
        f.t += dt;
        f.m.rotation.x = Math.min(Math.PI / 2.1, f.t * 2.2);
        if (f.t > 1.6) f.m.visible = false;
      }
      // chest glow pulse
      for (const c of chestMeshes.values()) {
        if (c.glow.visible) {
          (c.glow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 3) * 0.2;
        }
      }
    },
  };
}
