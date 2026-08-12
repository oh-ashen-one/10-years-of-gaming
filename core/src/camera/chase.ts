/**
 * chase.ts — the spring chase camera, fixed by the franchise (§2.5).
 *
 *  - Exponential lerp `1 - exp(-dt*k)` everywhere — frame-rate independent.
 *  - Speed-scaled stiffness, distance and look-ahead: heavy when slow,
 *    snappy at speed; FOV kick with speed (plus a boost bonus).
 *  - Mode machine: chase | orbit | ceremony (slow cinematic sweeps for
 *    countdowns, results, beauty beats).
 *  - Beauty-shot bias: when the target raises `beauty` (big air, a fell, a
 *    win), the camera slides around so the hero light sits BEHIND the
 *    subject — the rim-lit silhouette shot.
 *  - Decaying multi-sine shake for impacts.
 *
 * The camera never asks WHY a moment is big; the game sets `target.beauty`.
 */
import * as THREE from "three";

export type CamMode = "chase" | "orbit" | "ceremony";

export interface ChaseTarget {
  pos: THREE.Vector3;
  /** yaw, radians (0 = +Z, matching sin/cos forward convention) */
  heading: number;
  speed: number;
  airborne?: boolean;
  /** raise during big moments to hunt the hero-light silhouette */
  beauty?: boolean;
  /** extra FOV punch (boost, burst) */
  punch?: boolean;
}

export interface ChaseCameraOptions {
  fov?: number;
  aspect: number;
  near?: number;
  far?: number;
  /** direction TOWARD the hero light (used for the beauty-shot bias) */
  heroLightDir?: THREE.Vector3;
  /** chase tuning */
  baseDistance?: number;
  speedDistance?: number;
  baseHeight?: number;
  lookAhead?: number;
  lookAheadSpeed?: number;
  baseFov?: number;
  speedFov?: number;
  punchFov?: number;
  /** orbit / ceremony radii + heights */
  orbitRadius?: number;
  orbitHeight?: number;
  ceremonyRadius?: number;
  ceremonyHeight?: number;
}

const _fwd = new THREE.Vector3();
const _want = new THREE.Vector3();
const _look = new THREE.Vector3();
const _heroXZ = new THREE.Vector3(1, 0, 0);

export class ChaseCamera {
  camera: THREE.PerspectiveCamera;
  mode: CamMode = "chase";
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private fov: number;
  private shake = 0;
  private orbitA = 0;
  private init = false;
  private beautyBias = 0;
  private o: Required<Omit<ChaseCameraOptions, "heroLightDir" | "aspect">>;

  constructor(opts: ChaseCameraOptions) {
    this.o = {
      fov: opts.fov ?? 68,
      near: opts.near ?? 0.3,
      far: opts.far ?? 3400,
      baseDistance: opts.baseDistance ?? 6.4,
      speedDistance: opts.speedDistance ?? 0.075,
      baseHeight: opts.baseHeight ?? 2.7,
      lookAhead: opts.lookAhead ?? 3.5,
      lookAheadSpeed: opts.lookAheadSpeed ?? 0.16,
      baseFov: opts.baseFov ?? 66,
      speedFov: opts.speedFov ?? 0.52,
      punchFov: opts.punchFov ?? 6,
      orbitRadius: opts.orbitRadius ?? 7.0,
      orbitHeight: opts.orbitHeight ?? 2.8,
      ceremonyRadius: opts.ceremonyRadius ?? 8.5,
      ceremonyHeight: opts.ceremonyHeight ?? 2.2,
    };
    this.fov = this.o.fov;
    this.camera = new THREE.PerspectiveCamera(this.o.fov, opts.aspect, this.o.near, this.o.far);
    if (opts.heroLightDir) {
      _heroXZ.set(opts.heroLightDir.x, 0, opts.heroLightDir.z).normalize();
    }
  }

  setMode(m: CamMode): void {
    this.mode = m;
  }

  /** Impact shake, 0..~1.4. Decays on its own. */
  addShake(amount: number): void {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt: number, t: ChaseTarget, time: number): void {
    _fwd.set(Math.sin(t.heading), 0, Math.cos(t.heading));
    const o = this.o;

    if (this.mode === "orbit" || this.mode === "ceremony") {
      // cinematic sweep around the subject
      const ceremony = this.mode === "ceremony";
      this.orbitA += dt * (ceremony ? 0.22 : 0.3);
      const r = ceremony ? o.ceremonyRadius : o.orbitRadius;
      const h = ceremony ? o.ceremonyHeight : o.orbitHeight;
      _want.set(
        t.pos.x + Math.sin(this.orbitA) * r,
        t.pos.y + h,
        t.pos.z + Math.cos(this.orbitA) * r,
      );
      this.pos.lerp(_want, 1 - Math.exp(-dt * 3.2));
      this.look.lerp(_look.set(t.pos.x, t.pos.y + 1.1, t.pos.z), 1 - Math.exp(-dt * 5));
      this.fov += (o.baseFov - 4 - this.fov) * Math.min(1, dt * 2);
    } else {
      /* -------- chase: spring-damped, speed pulls the cam back -------- */
      // beauty bias: slide so the hero light sits behind the subject
      this.beautyBias += ((t.beauty ? 1 : 0) - this.beautyBias) * Math.min(1, dt * 2.2);

      let backX = -_fwd.x;
      let backZ = -_fwd.z;
      if (this.beautyBias > 0.02) {
        const bx = -_heroXZ.x;
        const bz = -_heroXZ.z;
        backX = THREE.MathUtils.lerp(backX, bx, this.beautyBias * 0.85);
        backZ = THREE.MathUtils.lerp(backZ, bz, this.beautyBias * 0.85);
      }

      const dist = o.baseDistance + t.speed * o.speedDistance;
      _want.set(
        t.pos.x + backX * dist,
        t.pos.y + o.baseHeight + this.beautyBias * 0.6,
        t.pos.z + backZ * dist,
      );
      // spring-damper: heavy when slow, snappy at speed
      const k = 1 - Math.exp(-dt * (5.2 + t.speed * 0.12));
      this.pos.lerp(_want, k);

      // look target leads the subject slightly
      const lead = o.lookAhead + t.speed * o.lookAheadSpeed;
      _look.set(
        t.pos.x + _fwd.x * lead,
        t.pos.y + 1.15 + (t.airborne ? 0.7 : 0),
        t.pos.z + _fwd.z * lead,
      );
      this.look.lerp(_look, 1 - Math.exp(-dt * 7.5));

      // FOV kick with speed + punch
      const fovT = o.baseFov + t.speed * o.speedFov + (t.punch ? o.punchFov : 0);
      this.fov += (fovT - this.fov) * Math.min(1, dt * 3.5);
    }

    /* ------------------------------------------------------------ shake */
    this.shake = Math.max(0, this.shake - dt * 2.6);
    const sh = this.shake * this.shake;
    const jx = Math.sin(time * 61.3) * sh * 0.22 + Math.sin(time * 23.7) * sh * 0.12;
    const jy = Math.sin(time * 47.1) * sh * 0.18;
    const jz = Math.sin(time * 55.9) * sh * 0.22;

    if (!this.init) {
      this.pos.copy(_want);
      this.look.copy(_look);
      this.init = true;
    }

    this.camera.position.set(
      this.pos.x + jx,
      Math.max(this.pos.y + jy, this.pos.y - 1),
      this.pos.z + jz,
    );
    this.camera.lookAt(this.look.x, this.look.y, this.look.z);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
