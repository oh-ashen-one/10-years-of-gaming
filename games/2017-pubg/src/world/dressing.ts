/**
 * dressing.ts — island set dressing: white cottage compounds with
 * terracotta roofs, silos, the chapel, barns, the beacon tower, pine
 * clusters, rock outcrops, and the wheat field (instanced crossed quads
 * that part around nothing but read as a golden sea). All kitbash, all
 * generated, inked with hull outlines.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1 } from "@tenyears/core";
import { PAL } from "../palette";
import { COMPOUNDS, WHEAT, CROSSROADS, heightAt } from "../island";

/* ------------------------------------------------------------- cottages -- */

function cottage(seed: number, w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const wall = makeCelMaterial({ color: PAL.extra.cottage, rim: 0.35 });
  const roofM = makeCelMaterial({
    color: hash1(seed) > 0.6 ? PAL.extra.roof : PAL.extra.barn,
    specBand: 0.3, rim: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.52, h * 0.6, 4), roofM);
  roof.position.y = h + h * 0.3;
  roof.rotation.y = Math.PI / 4;
  // door + window ink boxes
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.0, 0.15),
    makeCelMaterial({ color: PAL.ink.deep, rim: 0.1 }),
  );
  door.position.set(0, 1.0, d / 2 + 0.03);
  g.add(body, roof, door);
  addOutline(g, 2.4, col(PAL.ink.line));
  return g;
}

function silo(seed: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 9, 12),
    makeCelMaterial({ color: hash1(seed) > 0.5 ? 0xc8c0b0 : PAL.extra.armor, specBand: 0.5, rim: 0.45 }),
  );
  body.position.y = 4.5;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    makeCelMaterial({ color: PAL.extra.roof, rim: 0.4 }),
  );
  cap.position.y = 9;
  g.add(body, cap);
  addOutline(g, 2.2, col(PAL.ink.line));
  return g;
}

function barn(seed: number): THREE.Group {
  const g = new THREE.Group();
  const w = 14, d = 6, h = 4.2;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeCelMaterial({ color: hash1(seed) > 0.5 ? PAL.extra.barn : PAL.extra.roof, rim: 0.35 }),
  );
  body.position.y = h / 2;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.55, d * 0.55, w, 3, 1), makeCelMaterial({ color: 0x8a4a3a, rim: 0.35 }));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = Math.PI;
  roof.position.y = h + 0.4;
  roof.scale.y = 0.6;
  g.add(body, roof);
  addOutline(g, 2.4, col(PAL.ink.line));
  return g;
}

function chapel(): THREE.Group {
  const g = new THREE.Group();
  const wall = makeCelMaterial({ color: PAL.extra.cottage, rim: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 12), wall);
  body.position.y = 3;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 11, 3.4), wall);
  tower.position.set(0, 5.5, 5);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 4.5, 4),
    makeCelMaterial({ color: PAL.extra.roof, specBand: 0.3, rim: 0.4 }),
  );
  spire.position.set(0, 13.2, 5);
  spire.rotation.y = Math.PI / 4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 3, 4), makeCelMaterial({ color: PAL.extra.roof, rim: 0.4 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 1.9;
  roof.position.set(0, 7.4, -1.5);
  g.add(body, tower, spire, roof);
  addOutline(g, 2.6, col(PAL.ink.line));
  return g;
}

function beacon(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 13, 10),
    makeCelMaterial({ color: PAL.extra.cottage, specBand: 0.3, rim: 0.4 }),
  );
  body.position.y = 6.5;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.8, 8),
    makeCelMaterial({ color: PAL.accents.primary, emissive: PAL.accents.primary, emissiveStrength: 0.8, rim: 0.2 }),
  );
  lamp.position.y = 14;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 8), makeCelMaterial({ color: PAL.ink.line, rim: 0.3 }));
  cap.position.y = 15.6;
  g.add(body, lamp, cap);
  addOutline(g, 2.4, col(PAL.ink.line));
  return g;
}

/* ----------------------------------------------------------------- pines -- */

function pine(seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 2.2, 6),
    makeCelMaterial({ color: PAL.extra.trunk, rim: 0.3 }),
  );
  trunk.position.y = 1.1;
  g.add(trunk);
  const leaf = makeCelMaterial({
    color: hash1(seed) > 0.5 ? PAL.extra.pine : 0x4a6a42,
    rim: 0.45,
  });
  const tiers = 2 + Math.floor(hash1(seed * 3.1) * 2);
  for (let i = 0; i < tiers; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.5, 2.4, 7), leaf);
    cone.position.y = 2.4 + i * 1.6;
    g.add(cone);
  }
  addOutline(g, 2.0, col(PAL.ink.line));
  return g;
}

function rock(seed: number): THREE.Group {
  const s = 1.2 + hash1(seed) * 2.2;
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    makeCelMaterial({ color: 0x9a94a8, specBand: 0.3, rim: 0.5 }),
  );
  m.scale.y = 0.6 + hash1(seed * 7.7) * 0.3;
  m.rotation.set(hash1(seed * 3) * 0.4, hash1(seed * 5) * Math.PI, hash1(seed * 9) * 0.3);
  const g = new THREE.Group();
  g.add(m);
  addOutline(g, 2.2, col(PAL.ink.line));
  return g;
}

/* ----------------------------------------------------------------- wheat -- */

const WHEAT_COUNT = 2400;

function buildWheat(parent: THREE.Group): void {
  // crossed-quad blades, two tones, static — a golden sea you can hide in
  const blade = new THREE.PlaneGeometry(0.5, 0.85);
  blade.translate(0, 0.42, 0);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(blade, mat, WHEAT_COUNT * 2);
  const cA = col(PAL.extra.wheat);
  const cB = col(PAL.extra.wheatDark);
  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  let idx = 0;
  for (let i = 0; i < WHEAT_COUNT; i++) {
    const x = WHEAT.x + (hash1(i * 3.17) - 0.5) * 2 * WHEAT.hw * 0.95;
    const z = WHEAT.z + (hash1(i * 7.71) - 0.5) * 2 * WHEAT.hh * 0.95;
    const y = heightAt(x, z);
    const rot = hash1(i * 11.3) * Math.PI;
    const sc = 0.8 + hash1(i * 5.5) * 0.5;
    for (let k = 0; k < 2; k++) {
      e.set(0, rot + (k * Math.PI) / 2, (hash1(i * 13.9 + k) - 0.5) * 0.15);
      q.setFromEuler(e);
      v.set(x, y, z);
      s.set(sc, sc, sc);
      m.compose(v, q, s);
      mesh.setMatrixAt(idx, m);
      mesh.setColorAt(idx, c.copy(cA).lerp(cB, hash1(i * 17.3 + k) * 0.7));
      idx++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  parent.add(mesh);
}

/* ----------------------------------------------------------------- rig ---- */

export function buildIslandDressing(world: THREE.Group): void {
  const g = new THREE.Group();

  COMPOUNDS.forEach((c, ci) => {
    const base = heightAt(c.x, c.z);
    switch (ci) {
      case 0: { // MILLTOWN: three cottages + a silo
        const h1 = cottage(1.1, 7, 6, 4); h1.position.set(c.x - 10, base, c.z - 8);
        const h2 = cottage(2.3, 6, 7, 4.5); h2.position.set(c.x + 9, base, c.z + 4); h2.rotation.y = Math.PI / 2;
        const h3 = cottage(3.7, 6, 5, 3.8); h3.position.set(c.x - 2, base, c.z + 14); h3.rotation.y = -0.4;
        const s = silo(4.9); s.position.set(c.x + 16, base, c.z - 12);
        g.add(h1, h2, h3, s);
        break;
      }
      case 1: { // FORT RUST: walled yard + two cottages
        const wallM = makeCelMaterial({ color: PAL.extra.dirt, rim: 0.3 });
        for (const [wx, wz, len, rot] of [
          [0, -18, 36, 0], [0, 18, 36, 0], [-18, 0, 36, Math.PI / 2], [18, 0, 36, Math.PI / 2],
        ] as const) {
          const wSeg = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 1), wallM);
          wSeg.position.set(c.x + wx, heightAt(c.x + wx, c.z + wz) + 1.3, c.z + wz);
          wSeg.rotation.y = rot;
          g.add(wSeg);
          addOutline(wSeg, 2.0, col(PAL.ink.line));
        }
        const h1 = cottage(5.1, 7, 6, 4.2); h1.position.set(c.x - 8, base, c.z - 6);
        const h2 = cottage(6.7, 6, 6, 4); h2.position.set(c.x + 8, base, c.z + 7); h2.rotation.y = Math.PI;
        g.add(h1, h2);
        break;
      }
      case 2: { // CHAPEL HILL
        const ch = chapel(); ch.position.set(c.x, base, c.z);
        const h1 = cottage(7.3, 6, 5, 3.6); h1.position.set(c.x + 14, heightAt(c.x + 14, c.z - 10), c.z - 10);
        h1.rotation.y = 0.7;
        g.add(ch, h1);
        break;
      }
      case 3: { // DEPOT NINE: three long barns
        for (let k = 0; k < 3; k++) {
          const b = barn(8.1 + k);
          b.position.set(c.x - 4 + k * 2, heightAt(c.x, c.z - 14 + k * 13), c.z - 14 + k * 13);
          g.add(b);
        }
        break;
      }
      case 4: { // THE SILOS
        for (let k = 0; k < 3; k++) {
          const s = silo(9.7 + k);
          s.position.set(c.x - 8 + k * 8, heightAt(c.x - 8 + k * 8, c.z), c.z);
          g.add(s);
        }
        const h1 = cottage(11.1, 6, 6, 4); h1.position.set(c.x + 4, heightAt(c.x + 4, c.z + 14), c.z + 14);
        g.add(h1);
        break;
      }
      case 5: { // BEACON POINT
        const b = beacon(); b.position.set(c.x - 6, heightAt(c.x - 6, c.z - 6), c.z - 6);
        const h1 = cottage(12.9, 6, 5, 3.8); h1.position.set(c.x + 8, heightAt(c.x + 8, c.z + 6), c.z + 6);
        h1.rotation.y = -0.9;
        g.add(b, h1);
        break;
      }
    }
  });

  // pine clusters + rocks, deterministic scatter, clear of compounds/wheat
  for (let i = 0; i < 90; i++) {
    const a = hash1(i * 3.33) * Math.PI * 2;
    const r = 60 + hash1(i * 7.77) * 400;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z) > 480) continue;
    let clear = true;
    for (const c of COMPOUNDS) if (Math.hypot(x - c.x, z - c.z) < c.r + 8) clear = false;
    if (Math.abs(x - WHEAT.x) < WHEAT.hw + 10 && Math.abs(z - WHEAT.z) < WHEAT.hh + 10) clear = false;
    if (Math.hypot(x - CROSSROADS.x, z - CROSSROADS.z) < 20) clear = false;
    if (!clear) continue;
    const thing = hash1(i * 13.1) > 0.25 ? pine(i * 1.7) : rock(i * 2.3);
    thing.position.set(x, heightAt(x, z), z);
    thing.rotation.y = hash1(i * 19.9) * Math.PI;
    g.add(thing);
  }

  buildWheat(g);
  world.add(g);
}
