/**
 * loot.ts + fx.ts merged here as the small-mesh layer — floor loot with
 * glow rings (long gun boxes / vest / medkit with cross), blood puffs,
 * landing dust, tracers and muzzle flashes. All presentation; game.ts
 * decides what happens, this file shows it.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1 } from "@tenyears/core";
import { PAL } from "./palette";
import type { LootItem, WeaponId } from "./game";
import { heightAt } from "./island";

/* ------------------------------------------------------------------ loot -- */

const WEAPON_COLORS: Record<WeaponId, number> = {
  rifle: 0x4a4a55,
  smg: 0x6a5a3a,
  shotgun: 0x7a4a3a,
};

export function buildLootMesh(item: LootItem): THREE.Group {
  const g = new THREE.Group();
  let mesh: THREE.Mesh;
  if (item.type === "weapon") {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.3),
      makeCelMaterial({ color: WEAPON_COLORS[item.weapon!], specBand: 0.5, rim: 0.4 }),
    );
    mesh.position.y = 0.25;
    mesh.rotation.y = hash1(item.id * 3.3) * Math.PI;
  } else if (item.type === "armor") {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.35),
      makeCelMaterial({ color: PAL.extra.armor, specBand: 0.4, rim: 0.4 }),
    );
    mesh.position.y = 0.3;
  } else {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, 0.55),
      makeCelMaterial({ color: PAL.extra.medkit, rim: 0.3 }),
    );
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.1), makeCelMaterial({ color: PAL.extra.blood, rim: 0.2 }));
    cross1.position.y = 0.21;
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), cross1.material);
    cross2.position.y = 0.21;
    mesh.add(cross1, cross2);
    mesh.position.y = 0.24;
  }
  g.add(mesh);
  // glow ring so floor loot reads at distance
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.85, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.accents.primary, transparent: true, opacity: 0.55 }),
  );
  ring.position.y = 0.06;
  g.add(ring);
  addOutline(mesh, 2.0, col(PAL.ink.line));
  g.position.set(item.x, heightAt(item.x, item.z), item.z);
  return g;
}

/* ------------------------------------------------------------ particles -- */

const MAX_PUFFS = 90;

interface Puff {
  t: number;
  life: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number;
  r: number; g: number; b: number;
}

/** One instanced pool for blood puffs, dust kicks, muzzle smoke. */
export class PuffSystem {
  private mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private c = new THREE.Color();

  constructor(world: THREE.Group) {
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
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
        t: 0, life: 0.4 + Math.random() * 0.4,
        x, y, z,
        vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6),
        vy: speed * (0.5 + Math.random() * 0.8),
        vz: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
        size: size * (0.7 + Math.random() * 0.6),
        r: c.r, g: c.g, b: c.b,
      });
    }
  }

  update(dt: number, camQuat: THREE.Quaternion): void {
    let n = 0;
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = p.t / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 4 * dt;
      const s = p.size * (0.6 + k * 1.2);
      this.m4.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        camQuat, // billboard
        new THREE.Vector3(s, s, s),
      );
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

/* --------------------------------------------------------------- tracers -- */

const MAX_TRACERS = 24;

interface Tracer {
  t: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

/** Thin hot streaks from muzzle to target — hitscan made visible. */
export class TracerSystem {
  private mesh: THREE.InstancedMesh;
  private tracers: Tracer[] = [];
  private m4 = new THREE.Matrix4();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(world: THREE.Group) {
    const geo = new THREE.BoxGeometry(0.05, 0.05, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_TRACERS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    world.add(this.mesh);
  }

  fire(from: THREE.Vector3, dir: THREE.Vector3, range: number): void {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    this.tracers.push({
      t: 0,
      from: from.clone(),
      to: from.clone().add(dir.clone().multiplyScalar(range)),
    });
  }

  update(dt: number): void {
    let n = 0;
    const mid = new THREE.Vector3();
    const d = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    for (const tr of this.tracers) {
      tr.t += dt;
      if (tr.t > 0.09) continue;
      d.subVectors(tr.to, tr.from);
      const len = d.length();
      mid.addVectors(tr.from, tr.to).multiplyScalar(0.5);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
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
