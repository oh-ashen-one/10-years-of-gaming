/**
 * mesher.ts — voxel chunk meshing with face culling.
 *
 * 16×16-column chunks, full height. Every exposed face emits one quad
 * with: block color × per-direction shade (crisp voxel flats with OUR cel
 * read), and a baked torch-glow attribute. The shader quantizes the light
 * into hard bands — torch-warm pools vs indigo night, stepped, never
 * smooth. Dirty chunks rebuild a few per frame so edits never hitch.
 *
 * Also: the crack overlay (5 procedural crack stages on a canvas texture)
 * for block-break feedback.
 */
import * as THREE from "three";
import { celEnv, celEnvUniforms, CEL_LIGHT_GLSL, col } from "@tenyears/core";
import { PAL } from "../palette";
import { B, H, SIZE, getBlock, isSolid, torchGlow } from "../world";

/* --------------------------------------------------------- block colors -- */

function blockColor(id: number, face: number): THREE.Color {
  // face: 0 +y, 1 -y, 2 +x, 3 -x, 4 +z, 5 -z
  const e = PAL.extra;
  switch (id) {
    case B.GRASS: return col(face === 0 ? e.grassTop : face === 1 ? e.dirt : e.grassSide);
    case B.DIRT: return col(e.dirt);
    case B.STONE: return col(e.stone);
    case B.COBBLE: return col(e.cobble);
    case B.LOG: return col(face <= 1 ? e.logTop : e.log);
    case B.LEAVES: return col(e.leaves);
    case B.PLANKS: return col(e.planks);
    case B.COAL: return col(e.stone).clone().lerp(col(e.coal), 0.55);
    case B.IRON: return col(e.stone).clone().lerp(col(e.iron), 0.55);
    case B.TABLE: return col(e.table);
    case B.DOOR: return col(e.door);
    default: return col(0xff00ff);
  }
}

const FACE_SHADE = [1.0, 0.5, 0.8, 0.8, 0.66, 0.66];

// face vertex offsets: [axis normal][4 corners], CCW seen from OUTSIDE
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

/* --------------------------------------------------------------- shader -- */

function voxelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayF: { value: 1 },
      uTorch: { value: col(PAL.extra.torch).clone() },
      uNightTint: { value: new THREE.Color(0.62, 0.68, 1.0) },
      ...celEnvUniforms(),
    },
    vertexShader: /* glsl */ `
      attribute float aLight;
      varying vec3 vC;
      varying vec3 vW;
      varying float vL;
      void main() {
        vC = color;
        vL = aLight;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      varying vec3 vW;
      varying float vL;
      uniform float uDayF;
      uniform vec3 uTorch;
      uniform vec3 uNightTint;
      ${CEL_LIGHT_GLSL}
      void main() {
        // sky term floors to indigo at night; torch glow overrides locally
        float sky = mix(0.30, 1.0, uDayF);
        float l = max(sky, vL);
        l = floor(l * 4.0 + 0.5) / 4.0; // hard bands — crisp voxel flats
        vec3 tint = mix(uNightTint, vec3(1.0), uDayF);
        vec3 c = vC * l * tint;
        c += uTorch * vL * (1.0 - uDayF * 0.55) * 0.35; // torch-warm pools
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
}

/* --------------------------------------------------------------- chunks -- */

const CHUNKS = SIZE / 16;

export class VoxelMesher {
  group = new THREE.Group();
  private mat = voxelMaterial();
  private meshes: (THREE.Mesh | null)[][] = [];
  private dirty = new Set<string>();
  uDayF: THREE.IUniform<number>;

  constructor(parent: THREE.Group) {
    this.uDayF = this.mat.uniforms.uDayF as THREE.IUniform<number>;
    for (let cx = 0; cx < CHUNKS; cx++) {
      this.meshes[cx] = [];
      for (let cz = 0; cz < CHUNKS; cz++) {
        this.meshes[cx][cz] = null;
        this.dirty.add(`${cx},${cz}`);
      }
    }
    parent.add(this.group);
  }

  markDirty(cx: number, cz: number): void {
    if (cx >= 0 && cx < CHUNKS && cz >= 0 && cz < CHUNKS) this.dirty.add(`${cx},${cz}`);
  }

  /** Rebuild up to `budget` dirty chunks per frame. */
  update(budget = 6): void {
    let n = 0;
    for (const key of this.dirty) {
      if (n >= budget) break;
      const [cx, cz] = key.split(",").map(Number);
      this.dirty.delete(key);
      this.rebuildChunk(cx, cz);
      n++;
    }
  }

  pending(): number {
    return this.dirty.size;
  }

  private rebuildChunk(cx: number, cz: number): void {
    const old = this.meshes[cx][cz];
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    const pos: number[] = [];
    const nrm: number[] = [];
    const clr: number[] = [];
    const lit: number[] = [];
    const idx: number[] = [];
    let vi = 0;

    const x0 = cx * 16;
    const z0 = cz * 16;
    for (let x = x0; x < x0 + 16; x++) {
      for (let z = z0; z < z0 + 16; z++) {
        for (let y = 0; y < H; y++) {
          const id = getBlock(x, y, z);
          if (id === B.AIR) continue;
          if (id === B.TORCH) {
            vi = this.emitTorch(pos, nrm, clr, lit, idx, vi, x, y, z);
            continue;
          }
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const [nx, ny, nz] = face.n;
            if (isSolid(x + nx, y + ny, z + nz)) continue; // cull
            const c = blockColor(id, f);
            const shade = FACE_SHADE[f];
            for (const [ox, oy, oz] of face.c) {
              pos.push(x + ox, y + oy, z + oz);
              nrm.push(nx, ny, nz);
              clr.push(c.r * shade, c.g * shade, c.b * shade);
              lit.push(torchGlow(x + ox, y + oy, z + oz));
            }
            idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            vi += 4;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(clr, 3));
    geo.setAttribute("aLight", new THREE.Float32BufferAttribute(lit, 1));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = true;
    geo.computeBoundingSphere();
    this.meshes[cx][cz] = mesh;
    this.group.add(mesh);
  }

  /** torches render as small full-bright cubes on a stem */
  private emitTorch(
    pos: number[], nrm: number[], clr: number[], lit: number[], idx: number[],
    vi: number, x: number, y: number, z: number,
  ): number {
    const c = col(PAL.extra.torch);
    const s = 0.14;
    const cx = x + 0.5, cz = z + 0.5;
    const y0 = y, y1 = y + 0.55;
    const corners: [number, number, number][] = [
      [cx - s, y0, cz - s], [cx + s, y0, cz - s], [cx + s, y0, cz + s], [cx - s, y0, cz + s],
      [cx - s, y1, cz - s], [cx + s, y1, cz - s], [cx + s, y1, cz + s], [cx - s, y1, cz + s],
    ];
    const quads = [
      [0, 1, 2, 3, [0, -1, 0]], [4, 7, 6, 5, [0, 1, 0]],
      [0, 4, 5, 1, [0, 0, -1]], [1, 5, 6, 2, [1, 0, 0]],
      [2, 6, 7, 3, [0, 0, 1]], [3, 7, 4, 0, [-1, 0, 0]],
    ] as const;
    for (const [a, b, cc, d, n] of quads) {
      for (const viq of [a, b, cc, d]) {
        pos.push(...corners[viq]);
        nrm.push(...n);
        clr.push(c.r, c.g, c.b);
        lit.push(1);
      }
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
    return vi;
  }
}

/* --------------------------------------------------------- crack overlay -- */

const CRACK_STAGES = 5;

export class CrackOverlay {
  mesh: THREE.Mesh;
  private textures: THREE.CanvasTexture[] = [];
  private stage = -1;

  constructor(parent: THREE.Group) {
    for (let s = 0; s < CRACK_STAGES; s++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const g = cv.getContext("2d")!;
      g.clearRect(0, 0, 64, 64);
      g.strokeStyle = "rgba(16,20,42,0.85)";
      g.lineWidth = 2.5;
      // jagged crack lines radiating from center, more per stage
      const lines = 2 + s * 2;
      for (let i = 0; i < lines; i++) {
        const a = (i / lines) * Math.PI * 2 + s * 0.7;
        g.beginPath();
        g.moveTo(32, 32);
        let r = 8;
        let ca = a;
        while (r < 34 + s * 4) {
          ca += (Math.sin(i * 37.7 + r) * 0.5);
          g.lineTo(32 + Math.cos(ca) * r, 32 + Math.sin(ca) * r);
          r += 7;
        }
        g.stroke();
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      this.textures.push(tex);
    }
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), mat);
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** stage 0..4 shows cracks; -1 hides */
  set(stage: number, x?: number, y?: number, z?: number): void {
    if (stage < 0) {
      this.mesh.visible = false;
      this.stage = -1;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.set(x! + 0.5, y! + 0.5, z! + 0.5);
    if (stage !== this.stage) {
      this.stage = stage;
      (this.mesh.material as THREE.MeshBasicMaterial).map = this.textures[Math.min(CRACK_STAGES - 1, stage)];
      (this.mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }
}
