/**
 * frame.ts — the frame-loop invariants, fixed by the franchise (§2.2/§4).
 *
 *  - dt clamped to 1/20 so physics never explodes on a hiccup.
 *  - `celEnv.uTime` advanced from the clamped clock — every shader ticks
 *    off the same time.
 *  - Adaptive pixel ratio: frame-time EMA, step down toward 0.72 when hot,
 *    back up toward min(devicePixelRatio, 2) when cool, with cooldowns so
 *    it never oscillates. Resize keeps renderer AND post target in sync.
 *  - `outlinePixScale` refreshed every frame (constant screen-space ink).
 *  - `OriginRecenter`: when the player strays too far from the render
 *    origin, the world group shifts back in 64-unit snaps and
 *    `celEnv.uShift` tracks the logical offset — float precision stays
 *    tight no matter how big the world gets.
 */
import * as THREE from "three";
import { celEnv, outlinePixScale, updateOutlinePixScale } from "../render/cel";
import type { PostFX } from "../render/post";

const DT_CLAMP = 1 / 20;
const MIN_PIXEL_SCALE = 0.72;
const MAX_PIXEL_SCALE_CAP = 2;
const DPR_STEP = 0.14;
const EMA_HOT_MS = 18.2;
const EMA_COOL_MS = 14.8;
const COOLDOWN_DOWN_MS = 1200;
const COOLDOWN_UP_MS = 1800;

export interface FrameLoopOptions {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  /** interior-ink pass; resized in lockstep with the renderer */
  post?: PostFX;
  /** game body: fixed dt + the shared clamped clock */
  update: (dt: number, time: number) => void;
  /** presented-frame counter hook (feeds __game.frames) */
  onFrame?: (frames: number) => void;
}

export class FrameLoop {
  time = 0;
  frames = 0;
  pixelScale: number;

  private last = 0;
  private frameEMA = 16.6;
  private dprCooldown = 0;
  private running = false;

  constructor(private o: FrameLoopOptions) {
    this.pixelScale = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_SCALE_CAP);
    o.renderer.setPixelRatio(this.pixelScale);
    o.renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", () => this.applyResolution());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);
    this.frames++;
    const rawDt = now - this.last;
    this.last = now;
    const dt = Math.min(rawDt / 1000, DT_CLAMP);
    this.time += dt;
    celEnv.uTime.value = this.time;

    this.o.update(dt, this.time);

    // constant screen-space ink + camera-dependent post uniforms
    updateOutlinePixScale(this.o.camera, window.innerHeight * this.pixelScale);
    this.o.post?.syncCamera(this.o.camera);

    if (this.o.post) this.o.post.render(this.o.renderer, this.o.scene, this.o.camera);
    else this.o.renderer.render(this.o.scene, this.o.camera);
    this.o.onFrame?.(this.frames);

    this.adaptResolution(rawDt);
  };

  stop(): void {
    this.running = false;
  }

  /** Step the pixel ratio toward the load; cooldowns prevent oscillation. */
  private adaptResolution(rawDt: number): void {
    this.frameEMA = this.frameEMA * 0.95 + Math.min(rawDt, 50) * 0.05;
    this.dprCooldown -= rawDt;
    if (this.dprCooldown > 0) return;
    const cap = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_SCALE_CAP);
    if (this.frameEMA > EMA_HOT_MS && this.pixelScale > MIN_PIXEL_SCALE) {
      this.pixelScale = Math.max(MIN_PIXEL_SCALE, this.pixelScale - DPR_STEP);
      this.applyResolution();
      this.dprCooldown = COOLDOWN_DOWN_MS;
    } else if (this.frameEMA < EMA_COOL_MS && this.pixelScale < cap) {
      this.pixelScale = Math.min(cap, this.pixelScale + DPR_STEP);
      this.applyResolution();
      this.dprCooldown = COOLDOWN_UP_MS;
    }
  }

  /** Keep renderer, camera aspect and post target in lockstep. */
  applyResolution(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.o.camera.aspect = w / h;
    this.o.camera.updateProjectionMatrix();
    this.o.renderer.setPixelRatio(this.pixelScale);
    this.o.renderer.setSize(w, h);
    this.o.post?.resize(
      Math.floor(w * this.pixelScale),
      Math.floor(h * this.pixelScale),
      this.o.camera,
    );
  }
}

/* ---------------------------------------------------- origin recentering -- */

export class OriginRecenter {
  /** logical offset of the rendered origin; logical = rendered + shift */
  readonly shift = new THREE.Vector3();

  constructor(
    private worldGroup: THREE.Group,
    private threshold = 600,
    private snap = 64,
  ) {}

  /**
   * Call once per frame with the player's LOGICAL position. When it strays
   * past `threshold` from the rendered origin, snap the world back and
   * record the shift so shaders (`celEnv.uShift`) keep logical distances.
   * Returns true when a recenter happened (games re-bake what they must).
   */
  maybeRecenter(logicalPos: THREE.Vector3): boolean {
    const dx = logicalPos.x - this.shift.x;
    const dz = logicalPos.z - this.shift.z;
    if (dx * dx + dz * dz <= this.threshold * this.threshold) return false;
    this.shift.set(
      Math.round(logicalPos.x / this.snap) * this.snap,
      0,
      Math.round(logicalPos.z / this.snap) * this.snap,
    );
    this.worldGroup.position.set(-this.shift.x, 0, -this.shift.z);
    celEnv.uShift.value.copy(this.shift);
    return true;
  }
}

/** Re-exported so games can read the raw uniform if they bypass FrameLoop. */
export { outlinePixScale };
