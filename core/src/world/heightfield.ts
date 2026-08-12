/**
 * heightfield.ts — one spatial truth for ground height.
 *
 * A game owns exactly ONE height function; both the mesh baker and the
 * physics query it through this utility so wheels never float and landings
 * never clip. Two ways to consume the same truth:
 *
 *  - `HeightField` wraps the analytic function: exact `heightAt` plus a
 *    central-difference `normalAt` for physics.
 *  - `HeightField.bake()` samples the function into a regular grid and
 *    returns a `HeightGrid` with bilinear `sample()` — used to build chunk
 *    geometry, or as a cheaper query surface over an expensive function.
 *
 * Bake, never displace-in-shader: the GPU only ever sees geometry that came
 * out of the same samples the CPU physics used.
 */

export type HeightFn = (x: number, z: number) => number;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export class HeightField {
  constructor(public readonly fn: HeightFn) {}

  heightAt(x: number, z: number): number {
    return this.fn(x, z);
  }

  private readonly _n: Vec3Like = { x: 0, y: 1, z: 0 };

  /** Surface normal by central difference (cheap, stable). Reused object. */
  normalAt(x: number, z: number, eps = 0.55): Vec3Like {
    const hL = this.fn(x - eps, z);
    const hR = this.fn(x + eps, z);
    const hD = this.fn(x, z - eps);
    const hU = this.fn(x, z + eps);
    const nx = hL - hR;
    const ny = 2 * eps;
    const nz = hD - hU;
    const inv = 1 / Math.hypot(nx, ny, nz);
    this._n.x = nx * inv;
    this._n.y = ny * inv;
    this._n.z = nz * inv;
    return this._n;
  }

  /**
   * Bake the function into a (nx × nz) grid covering [x0, x0+nx*cell) ×
   * [z0, z0+nz*cell). The grid bilinearly interpolates — matching exactly
   * what a triangle mesh built from the same samples will render.
   */
  bake(x0: number, z0: number, cell: number, nx: number, nz: number): HeightGrid {
    const data = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        data[j * nx + i] = this.fn(x0 + i * cell, z0 + j * cell);
      }
    }
    return new HeightGrid(data, x0, z0, cell, nx, nz);
  }
}

export class HeightGrid {
  constructor(
    public readonly data: Float32Array,
    public readonly x0: number,
    public readonly z0: number,
    public readonly cell: number,
    public readonly nx: number,
    public readonly nz: number,
  ) {}

  /** Bilinear height sample; clamps at grid edges. */
  sample(x: number, z: number): number {
    const gx = Math.min(Math.max((x - this.x0) / this.cell, 0), this.nx - 1.001);
    const gz = Math.min(Math.max((z - this.z0) / this.cell, 0), this.nz - 1.001);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const d = this.data;
    const w = this.nx;
    const a = d[j * w + i];
    const b = d[j * w + i + 1];
    const c = d[(j + 1) * w + i];
    const e = d[(j + 1) * w + i + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + e) * fx * fz;
  }

  /** Grid-sampled normal (consistent with `sample`). Reused object. */
  private readonly _n: Vec3Like = { x: 0, y: 1, z: 0 };
  normalAt(x: number, z: number, eps?: number): Vec3Like {
    const e = eps ?? this.cell;
    const hL = this.sample(x - e, z);
    const hR = this.sample(x + e, z);
    const hD = this.sample(x, z - e);
    const hU = this.sample(x, z + e);
    const nx = hL - hR;
    const ny = 2 * e;
    const nz = hD - hU;
    const inv = 1 / Math.hypot(nx, ny, nz);
    this._n.x = nx * inv;
    this._n.y = ny * inv;
    this._n.z = nz * inv;
    return this._n;
  }
}
