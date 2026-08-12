/**
 * rigs.ts — the battle bus and the glider, plus the particle/tracer kit.
 * The bus is the sky-whale itself: a chunky blue bus held aloft by a
 * balloon, drifting over the island. The glider is a pink ram-air wing.
 * Puffs + tracers mirror game events (harvest chips, hits, breaks).
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

/* ------------------------------------------------------------------- bus -- */

export interface BusRig {
  group: THREE.Group;
  update(dt: number, time: number): void;
}

export function buildBus(): BusRig {
  const g = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 16, 12),
    makeCelMaterial({ color: PAL.extra.busBlue, specBand: 0.4, rim: 0.5 }),
  );
  balloon.scale.y = 1.25;
  balloon.position.y = 9;
  g.add(balloon);
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(4.25, 0.35, 8, 20),
    makeCelMaterial({ color: 0xffd23f, rim: 0.3 }),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 9.4;
  g.add(stripe);

  const bus = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.6, 7.5),
    makeCelMaterial({ color: PAL.extra.busBlue, rim: 0.45 }),
  );
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.0, 0.2),
    makeCelMaterial({ color: 0x2a2a3a, specBand: 0.6, rim: 0.3 }),
  );
  windshield.position.set(0, 0.5, 3.8);
  bus.add(windshield);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 7.6), makeCelMaterial({ color: 0x2a2a3a, rim: 0.3 }));
  skirt.position.y = -1.4;
  bus.add(skirt);
  g.add(bus);
  // suspension lines
  const lineM = makeCelMaterial({ color: PAL.ink.line, rim: 0.1 });
  for (const [sx, sz] of [[-1.4, -2.6], [1.4, -2.6], [-1.4, 2.6], [1.4, 2.6]] as const) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.4, 4), lineM);
    line.position.set(sx, 4.4, sz);
    line.rotation.z = sx * 0.06;
    g.add(line);
  }
  addOutline(g, 2.6, col(PAL.ink.line));

  return {
    group: g,
    update(_dt, time) {
      g.position.y += Math.sin(time * 0.8) * 0.008; // gentle bob
      balloon.rotation.y = time * 0.1;
    },
  };
}

/* ---------------------------------------------------------------- glider -- */

export function buildGlider(): THREE.Group {
  const g = new THREE.Group();
  const wing = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3.4),
    makeCelMaterial({ color: PAL.accents.primary, rim: 0.4, doubleSided: true }),
  );
  wing.scale.set(1.5, 0.55, 0.75);
  wing.position.y = 3.6;
  g.add(wing);
  const lineM = makeCelMaterial({ color: PAL.ink.line, rim: 0.1 });
  for (const s of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 4), lineM);
    line.position.set(s * 2.0, 1.9, 0);
    line.rotation.z = s * 0.55;
    g.add(line);
  }
  addOutline(wing, 2.2, col(PAL.ink.line));
  return g;
}

/* ------------------------------------------------------------- particles -- */

const MAX_PUFFS = 90;

interface Puff {
  t: number; life: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number; r: number; g: number; b: number;
}

export class PuffSystem {
  private mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private m4 = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor(world: THREE.Group) {
    const geo = new THREE.PlaneGeometry(0.45, 0.45);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PUFFS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    world.add(this.mesh);
  }

  burst(x: number, y: number, z: number, color: number, count = 8, speed = 3, size = 0.5): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.puffs.length >= MAX_PUFFS) this.puffs.shift();
      const a = Math.random() * Math.PI * 2;
      this.puffs.push({
        t: 0, life: 0.35 + Math.random() * 0.4,
        x, y, z,
        vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6),
        vy: speed * (0.6 + Math.random() * 0.8),
        vz: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
        size: size * (0.7 + Math.random() * 0.6),
        r: c.r, g: c.g, b: c.b,
      });
    }
  }

  update(dt: number, camQuat: THREE.Quaternion): void {
    let n = 0;
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = p.t / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 5 * dt;
      const sc = p.size * (0.6 + k * 1.2);
      v.set(p.x, p.y, p.z);
      s.set(sc, sc, sc);
      this.m4.compose(v, camQuat, s);
      this.mesh.setMatrixAt(n, this.m4);
      this.mesh.setColorAt(n, this.c.setRGB(p.r, p.g, p.b));
      n++;
    }
    this.puffs = this.puffs.filter((p) => p.t < p.life);
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

const MAX_TRACERS = 24;

export class TracerSystem {
  private mesh: THREE.InstancedMesh;
  private tracers: { t: number; from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  private m4 = new THREE.Matrix4();

  constructor(world: THREE.Group) {
    const geo = new THREE.BoxGeometry(0.05, 0.05, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.9 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_TRACERS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    world.add(this.mesh);
  }

  fire(from: THREE.Vector3, dir: THREE.Vector3, range: number): void {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    this.tracers.push({ t: 0, from: from.clone(), to: from.clone().add(dir.clone().multiplyScalar(range)) });
  }

  update(dt: number): void {
    let n = 0;
    const mid = new THREE.Vector3();
    const d = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const fwd = new THREE.Vector3(0, 0, 1);
    for (const tr of this.tracers) {
      tr.t += dt;
      if (tr.t > 0.09) continue;
      d.subVectors(tr.to, tr.from);
      const len = d.length();
      mid.addVectors(tr.from, tr.to).multiplyScalar(0.5);
      q.setFromUnitVectors(fwd, d.normalize());
      scl.set(1, 1, len);
      this.m4.compose(mid, q, scl);
      this.mesh.setMatrixAt(n, this.m4);
      n++;
    }
    this.tracers = this.tracers.filter((t) => t.t <= 0.09);
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
