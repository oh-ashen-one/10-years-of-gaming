/**
 * fx.ts — encounter and catch-scene presentation. Everything here reads
 * game state and draws: rustle rings over spawn points, the spotlit catch
 * pad, the shrinking AR ring (color = difficulty), the capsule-ball throw
 * arc, wobble anticipation, the GOTCHA star burst, breakout puffs, and the
 * gym-win confetti. Pure presentation — all decisions live in game.ts.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1 } from "@tenyears/core";
import { PAL } from "./palette";
import type { CatchState } from "./game";
import { SPECIES } from "./creatures";

const RING_COLORS = [PAL.extra.ringGreen, PAL.extra.ringYellow, PAL.extra.ringRed];

/* --------------------------------------------------------- rustle ring -- */

/** Pulsing ground ring over a spawning encounter ("something's rustling"). */
export function makeRustleRing(): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color: PAL.accents.primary,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32).rotateX(-Math.PI / 2), mat);
  m.position.y = 0.05;
  return m;
}

export function updateRustleRing(m: THREE.Mesh, t: number): void {
  const s = 1 + Math.sin(t * 9) * 0.18 + t * 0.25;
  m.scale.setScalar(s);
  (m.material as THREE.MeshBasicMaterial).opacity = 0.9 - Math.min(0.5, t * 0.2);
}

/* ------------------------------------------------------------ the ball -- */

export function makeBall(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    makeCelMaterial({ color: PAL.accents.primary, specBand: 0.7, specPow: 50, rim: 0.4 }),
  );
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    makeCelMaterial({ color: PAL.extra.ballWhite, rim: 0.3 }),
  );
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.03, 6, 16),
    makeCelMaterial({ color: PAL.ink.line, rim: 0.2 }),
  );
  band.rotation.x = Math.PI / 2;
  g.add(top, bottom, band);
  addOutline(g, 1.8, col(PAL.ink.line));
  return g;
}

/* ---------------------------------------------------------- star burst -- */

const BURST_COUNT = 26;

export class StarBurst {
  readonly mesh: THREE.InstancedMesh;
  private t = Infinity;
  private center = new THREE.Vector3();
  private dirs: THREE.Vector3[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  constructor(parent: THREE.Group, colorA = PAL.extra.gold, colorB = 0xffffff) {
    const geo = new THREE.PlaneGeometry(0.42, 0.42);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, BURST_COUNT);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < BURST_COUNT; i++) {
      this.mesh.setColorAt(i, c.set(i % 2 ? colorA : colorB));
      const a = hash1(i * 3.7) * Math.PI * 2;
      const up = hash1(i * 7.1) * 0.9 + 0.25;
      this.dirs.push(new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize());
    }
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  fire(at: THREE.Vector3): void {
    this.center.copy(at);
    this.t = 0;
    this.mesh.visible = true;
  }

  get active(): boolean {
    return this.t < 1.4;
  }

  /** debug/verification: current burst age (Infinity when idle) */
  get age(): number {
    return this.t;
  }

  /** debug: where the burst is centered and whether it renders */
  debugState(): { center: number[]; visible: boolean } {
    return { center: this.center.toArray(), visible: this.mesh.visible };
  }

  update(dt: number, time: number): void {
    if (!this.active) {
      this.mesh.visible = false;
      return;
    }
    this.t += dt;
    const k = this.t;
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < BURST_COUNT; i++) {
      v.copy(this.dirs[i]).multiplyScalar(k * 11).add(this.center);
      v.y -= k * k * 3.2; // gravity pulls the stars down
      const sc = Math.max(0.01, 1 - k * 0.55);
      s.setScalar(sc);
      this.e.set(time * 6 + i, i * 1.7, time * 4 + i);
      this.q.setFromEuler(this.e);
      this.m4.compose(v, this.q, s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------- confetti -- */

const CONFETTI_COUNT = 160;

/** Gym-win confetti: a slow celebratory rain over the plaza. */
export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private t = Infinity;
  private origin = new THREE.Vector3();
  private seeds: number[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3(1, 1, 1);

  constructor(parent: THREE.Group) {
    const geo = new THREE.PlaneGeometry(0.3, 0.18);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, CONFETTI_COUNT);
    this.mesh.frustumCulled = false;
    const palette = [PAL.extra.gold, PAL.accents.primary, PAL.extra.leafC, 0xffffff, PAL.extra.gymPurple];
    const c = new THREE.Color();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      this.mesh.setColorAt(i, c.set(palette[i % palette.length]));
      this.seeds.push(hash1(i * 13.7));
    }
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  fire(at: THREE.Vector3): void {
    this.origin.copy(at);
    this.t = 0;
    this.mesh.visible = true;
  }

  get active(): boolean {
    return this.t < 5;
  }

  update(dt: number, time: number): void {
    if (!this.active) {
      this.mesh.visible = false;
      return;
    }
    this.t += dt;
    const v = new THREE.Vector3();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const sd = this.seeds[i];
      const a = sd * Math.PI * 2;
      const r = 1 + hash1(i * 7.7) * 9;
      const fall = (this.t * (1.2 + sd)) % 14;
      v.set(
        this.origin.x + Math.cos(a + this.t * 0.3) * r,
        this.origin.y + 13 - fall,
        this.origin.z + Math.sin(a + this.t * 0.3) * r,
      );
      this.e.set(time * 3 + i, i, time * 2.2 + i * 0.7);
      this.q.setFromEuler(this.e);
      this.m4.compose(v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------------------------------------------------- catch scene -- */

/**
 * The catch-scene rig: spotlit pad under the creature, the shrinking
 * difficulty-colored ring, and the ball. `update` mirrors game.catch state
 * every frame — charge-up shake, flight arc, wobble anticipation.
 */
export class CatchFX {
  group = new THREE.Group();
  pad: THREE.Mesh;
  ring: THREE.Mesh;
  ball: THREE.Group;
  private ballFrom = new THREE.Vector3();
  private ballTo = new THREE.Vector3();

  constructor(parent: THREE.Group) {
    this.pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.accents.primary, transparent: true, opacity: 0.28 }),
    );
    this.pad.position.y = 0.04;
    const padEdge = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.56, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.accents.primary }),
    );
    padEdge.position.y = 0.05;
    this.pad.add(padEdge);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.07, 8, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.extra.ringGreen }),
    );
    this.ring.position.y = 0.08;

    this.ball = makeBall();
    this.ball.visible = false;

    this.group.add(this.pad, this.ring, this.ball);
    this.group.visible = false;
    parent.add(this.group);
  }

  /** Position the pad at the encounter; ball arcs from the player. */
  begin(encX: number, encZ: number): void {
    this.group.position.set(encX, 0, encZ);
    this.group.visible = true;
    this.ball.visible = false;
  }

  end(): void {
    this.group.visible = false;
  }

  update(c: CatchState | null, playerPos: THREE.Vector3, time: number): void {
    if (!c) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // ring: size + difficulty color; shivers while you hold the throw
    const r = c.sub === "aim" ? (0.7 + c.ringT * 1.5) : 0.7;
    const shiver = c.charging ? Math.sin(time * 40) * 0.03 : 0;
    this.ring.scale.setScalar(Math.max(0.2, r + shiver));
    (this.ring.material as THREE.MeshBasicMaterial).color.set(
      RING_COLORS[SPECIES[c.enc.species].difficulty],
    );
    this.ring.visible = c.sub === "aim";

    // ball: hidden until the throw, then a clean arc to the pad
    if (c.sub === "flying") {
      this.ball.visible = true;
      const t = Math.min(1, c.flightT / 0.75);
      this.ballFrom.set(playerPos.x, 1.3, playerPos.z);
      this.ballTo.set(this.group.position.x + c.throwX, 0.25, this.group.position.z + (c.throwDist - 5.2));
      this.ball.position.lerpVectors(this.ballFrom, this.ballTo, t);
      this.ball.position.y += Math.sin(t * Math.PI) * 2.2;
      this.ball.rotation.x = t * 12;
    } else if (c.sub === "wobble") {
      this.ball.visible = true;
      this.ball.position.set(this.group.position.x, 0.22, this.group.position.z);
      const w = Math.sin(c.wobbleT / 0.85 * Math.PI);
      this.ball.rotation.z = w * 0.9 * (c.wobbles % 2 ? 1 : -1);
    } else if (c.sub === "burst") {
      this.ball.visible = false; // the stars take over
    } else if (c.sub === "breakout") {
      this.ball.visible = true;
      this.ball.position.set(this.group.position.x, 0.22, this.group.position.z);
      this.ball.rotation.z = 0;
      this.ball.scale.setScalar(1 + c.subT * 0.8); // pops open
    } else {
      this.ball.visible = false;
      this.ball.scale.setScalar(1);
    }
  }
}
