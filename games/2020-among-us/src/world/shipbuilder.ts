/**
 * shipbuilder.ts — turns ship.ts data into geometry. Per-room accent
 * floor plates, extruded wall runs (light caps, gray sides, thick ink),
 * window strips showing space, consoles at task stations, the cafeteria
 * table with the emergency button, floor vents, the airlock hatch.
 * Everything rounded-ish, chunky, outlined.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "../palette";
import { ROOMS, CORRIDORS, WALLS, STATIONS, BUTTON, AIRLOCK, VENTS } from "../ship";

const WALL_H = 2.6;
const WALL_T = 0.5;

export interface ShipRig {
  group: THREE.Group;
  buttonGlow: THREE.Mesh;
  ventMeshes: THREE.Mesh[];
}

export function buildShip(world: THREE.Group): ShipRig {
  const g = new THREE.Group();

  /* ---- floors ---- */
  const floorMat = new Map<number, THREE.ShaderMaterial>();
  const mat = (hex: number) => {
    let m = floorMat.get(hex);
    if (!m) {
      m = makeCelMaterial({ color: hex, rim: 0.18 });
      floorMat.set(hex, m);
    }
    return m;
  };
  for (const r of ROOMS) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.24, r.d), mat(r.floor));
    f.position.set(r.x, -0.12, r.z);
    g.add(f);
  }
  for (const c of CORRIDORS) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.22, c.d), mat(PAL.extra.corridor));
    f.position.set(c.x, -0.11, c.z);
    g.add(f);
  }

  /* ---- walls ---- */
  const sideM = makeCelMaterial({ color: PAL.extra.wallSide, rim: 0.25 });
  const capM = makeCelMaterial({ color: PAL.extra.wallTop, rim: 0.3 });
  for (const s of WALLS) {
    const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    if (len < 0.1) continue;
    const cx = (s.x1 + s.x2) / 2;
    const cz = (s.z1 + s.z2) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, WALL_T), sideM);
    wall.position.set(cx, WALL_H / 2, cz);
    wall.rotation.y = -Math.atan2(s.z2 - s.z1, s.x2 - s.x1);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, WALL_T + 0.14), capM);
    cap.position.y = WALL_H / 2 + 0.09;
    wall.add(cap);
    addOutline(wall, 2.4, col(PAL.ink.line));
    g.add(wall);
  }

  /* ---- windows: glass strips on the outer hull ---- */
  const glassM = makeCelMaterial({
    color: 0x9ae8f0, emissive: 0x4a90c8, emissiveStrength: 0.5, specBand: 0.8, specPow: 50, rim: 0.3,
  });
  const windowSpots: [number, number, number][] = [
    [-25, -23.5 - 1, 0],       // weapons north face
    [25, -26.5 + 0.4, 0],      // navigation north
    [0, -27.5, 0],             // cafeteria north (skylight room)
  ];
  for (const [x, z] of windowSpots) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.0, 0.2), glassM);
    win.position.set(x, 1.6, z);
    g.add(win);
  }

  /* ---- the skylight pool (cafeteria hero light) ---- */
  const skyPatch = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.sky.sunGlow, transparent: true, opacity: 0.35 }),
  );
  skyPatch.position.set(0, 0.05, -22);
  g.add(skyPatch);
  const skylight = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.2, 4.4),
    glassM,
  );
  skylight.position.set(0, WALL_H + 0.4, -22);
  g.add(skylight);

  /* ---- consoles at stations ---- */
  const consM = makeCelMaterial({ color: PAL.extra.console, rim: 0.3 });
  for (const st of STATIONS) {
    const cons = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.7), consM);
    cons.position.set(st.x, 0.6, st.z);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.6, 0.1),
      makeCelMaterial({ color: 0x1a2a3a, emissive: PAL.extra.consoleGlow, emissiveStrength: 0.6, rim: 0.1 }),
    );
    screen.position.set(0, 0.35, 0.36);
    cons.add(screen);
    addOutline(cons, 2.0, col(PAL.ink.line));
    g.add(cons);
  }

  /* ---- cafeteria table + emergency button ---- */
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.4, 0.8, 10),
    makeCelMaterial({ color: 0x9aa2b8, specBand: 0.4, rim: 0.35 }),
  );
  table.position.set(BUTTON.x, 0.4, BUTTON.z);
  addOutline(table, 2.2, col(PAL.ink.line));
  g.add(table);
  const buttonBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.25, 10),
    makeCelMaterial({ color: PAL.ink.line, rim: 0.2 }),
  );
  buttonBase.position.set(BUTTON.x, 0.92, BUTTON.z);
  g.add(buttonBase);
  const buttonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 8),
    makeCelMaterial({ color: PAL.extra.beanRed, emissive: PAL.extra.beanRed, emissiveStrength: 0.7, specBand: 0.7, rim: 0.3 }),
  );
  buttonGlow.position.set(BUTTON.x, 1.15, BUTTON.z);
  g.add(buttonGlow);

  /* ---- vents ---- */
  const ventMeshes: THREE.Mesh[] = [];
  for (const v of VENTS) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 1.2),
      makeCelMaterial({ color: PAL.extra.vent, rim: 0.3 }),
    );
    vent.position.set(v.x, 0.05, v.z);
    // grate slats
    for (let i = -1; i <= 1; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.12), makeCelMaterial({ color: 0x222840, rim: 0.1 }));
      slat.position.set(0, 0.12, i * 0.34);
      vent.add(slat);
    }
    addOutline(vent, 2.0, col(PAL.ink.line));
    ventMeshes.push(vent);
    g.add(vent);
  }

  /* ---- airlock hatch (storage south) ---- */
  const hatch = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.16, 8),
    makeCelMaterial({ color: 0x5a6478, specBand: 0.5, rim: 0.4 }),
  );
  hatch.position.set(AIRLOCK.x, 0.08, AIRLOCK.z);
  addOutline(hatch, 2.2, col(PAL.ink.line));
  g.add(hatch);

  /* ---- beds in medbay / crates in storage for flavor ---- */
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.0), makeCelMaterial({ color: 0xd8e0e8, rim: 0.3 }));
  bed.position.set(-27, 0.3, -5);
  g.add(bed);
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      makeCelMaterial({ color: 0x8a7a5a, rim: 0.3 }),
    );
    crate.position.set(-2 + (i % 2) * 2.4, 0.55, 20 + Math.floor(i / 2) * 2.2);
    addOutline(crate, 2.0, col(PAL.ink.line));
    g.add(crate);
  }

  world.add(g);
  return { group: g, buttonGlow, ventMeshes };
}
