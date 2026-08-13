/**
 * fog.ts — line-of-sight fog, the signature system.
 *
 * A 2D visibility polygon is raycast against the ship's wall segments
 * every frame (rays at every wall endpoint ±ε, clamped to the vision
 * radius), projected to screen space, and used to cut a soft-edged hole
 * in a full-screen darkness overlay (#fog canvas above WebGL, below HUD).
 * Walls genuinely occlude: you cannot see around corners.
 *
 * `isVisible(x, z)` is the matching logic test (beans, bodies, the
 * impostor's vent dive all respect it).
 */
import * as THREE from "three";
import { WALLS, hasLOS, type Seg } from "./ship";

interface Corner { a: number; x: number; z: number }

export class VisionFog {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private corners: Corner[] = [];

  constructor() {
    this.cv = document.getElementById("fog") as HTMLCanvasElement;
    this.ctx = this.cv.getContext("2d")!;
    // collect wall endpoints once
    for (const s of WALLS) {
      this.corners.push({ a: 0, x: s.x1, z: s.z1 });
      this.corners.push({ a: 0, x: s.x2, z: s.z2 });
    }
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  enabled = true;

  private resize(): void {
    this.cv.width = window.innerWidth;
    this.cv.height = window.innerHeight;
  }

  /** logic-side visibility: radius + wall occlusion */
  isVisible(px: number, pz: number, x: number, z: number, radius: number): boolean {
    if (Math.hypot(x - px, z - pz) > radius) return false;
    return hasLOS(px, pz, x, z);
  }

  /** ray/wall intersection distance (Infinity if clear) */
  private rayDist(px: number, pz: number, a: number, max: number): number {
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let best = max;
    for (const s of WALLS) {
      const t = this.raySeg(px, pz, dx, dz, s);
      if (t !== null && t < best) best = t;
    }
    return best;
  }

  private raySeg(px: number, pz: number, dx: number, dz: number, s: Seg): number | null {
    const sX = s.x2 - s.x1;
    const sZ = s.z2 - s.z1;
    const denom = dx * sZ - dz * sX;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((s.x1 - px) * sZ - (s.z1 - pz) * sX) / denom;
    const u = ((s.x1 - px) * dz - (s.z1 - pz) * dx) / denom;
    if (t > 0 && u >= 0 && u <= 1) return t;
    return null;
  }

  /** darkness draw — call every frame */
  update(
    px: number, pz: number, radius: number,
    camera: THREE.Camera, darkness: number,
  ): void {
    const ctx = this.ctx;
    const w = this.cv.width;
    const h = this.cv.height;
    ctx.clearRect(0, 0, w, h);
    if (!this.enabled) return;

    // polygon: rays at every wall corner ±ε + a uniform fill ring
    const pts: { x: number; z: number }[] = [];
    const angles: number[] = [];
    for (const c of this.corners) {
      const base = Math.atan2(c.z - pz, c.x - px);
      angles.push(base - 0.002, base, base + 0.002);
    }
    for (let i = 0; i < 48; i++) angles.push((i / 48) * Math.PI * 2);
    for (const a of angles) {
      const d = this.rayDist(px, pz, a, radius);
      pts.push({ x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d });
    }
    // sort by angle around the player
    pts.sort((a, b) => Math.atan2(a.z - pz, a.x - px) - Math.atan2(b.z - pz, b.x - px));

    // project to screen
    const v = new THREE.Vector3();
    const screen: [number, number][] = [];
    for (const p of pts) {
      v.set(p.x, 1.0, p.z).project(camera);
      screen.push([(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]);
    }

    // darkness with a soft-edged hole
    ctx.fillStyle = `rgba(4,5,12,${darkness})`;
    ctx.fillRect(0, 0, w, h);
    if (screen.length > 4) {
      ctx.save();
      ctx.beginPath();
      screen.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.clip();
      // radial gradient punch-out
      v.set(px, 1.0, pz).project(camera);
      const cx = (v.x * 0.5 + 0.5) * w;
      const cy = (-v.y * 0.5 + 0.5) * h;
      const vEdge = new THREE.Vector3(px + radius, 1.0, pz).project(camera);
      const rPx = Math.max(40, Math.abs((vEdge.x * 0.5 + 0.5) * w - cx));
      const grad = ctx.createRadialGradient(cx, cy, rPx * 0.55, cx, cy, rPx);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.8, "rgba(0,0,0,0.85)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
