/**
 * storm.ts + builds.ts — the purple storm wall and the player/bot build
 * pieces.
 *
 * The storm: a cylinder shell with a quantized diamond-grid shader, pink
 * glow, lerping toward each new circle; a white ground ring marks the
 * next safe zone.
 *
 * Builds: mesh factory for wall/ramp/floor/cone (+ door/window wall edit
 * variants) and a BuildVisuals store that mirrors game.builds via events.
 * Ghost blueprint previews tint green/red by validity.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, celEnv } from "@tenyears/core";
import { PAL } from "../palette";
import type { BuildPiece, BuildType } from "../game";
import { CELL, STORY } from "../map";

/* --------------------------------------------------------------- storm -- */

export class StormFX {
  wall: THREE.Mesh;
  nextRing: THREE.Mesh;

  constructor(world: THREE.Group) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: celEnv.uTime,
        uA: { value: col(PAL.extra.storm).clone() },
        uB: { value: col(PAL.extra.stormDeep).clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        void main() {
          // quantized diamond grid, scrolling, pulsing — purple energy
          vec2 g = fract(vec2(vUv.x * 120.0 + vUv.y * 18.0, vUv.y * 26.0 - uTime * 0.3));
          float line = step(0.78, max(g.x, g.y));
          float cell = 0.25 + 0.15 * step(0.5, fract(g.x + g.y));
          float pulse = 0.85 + 0.15 * sin(uTime * 1.8);
          float edgeFade = smoothstep(1.0, 0.5, vUv.y);
          vec3 c = mix(uB, uA, line) * pulse;
          gl_FragColor = vec4(c, (line * 0.7 + cell) * edgeFade * 0.6);
        }
      `,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), mat);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 10;
    world.add(this.wall);

    this.nextRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1.0, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.nextRing.renderOrder = 9;
    world.add(this.nextRing);
  }

  update(wall: { cx: number; cz: number; r: number }, target: { cx: number; cz: number; r: number }, stage: number): void {
    const H = 70;
    this.wall.visible = stage > 0;
    this.wall.position.set(wall.cx, H / 2 - 8, wall.cz);
    this.wall.scale.set(wall.r, H, wall.r);
    this.nextRing.visible = stage > 0;
    this.nextRing.position.set(target.cx, 0.5, target.cz);
    this.nextRing.scale.setScalar(target.r);
  }
}

/* --------------------------------------------------------------- builds -- */

function wallMeshes(edit: 0 | 1 | 2): THREE.Group {
  const g = new THREE.Group();
  const m = makeCelMaterial({ color: PAL.extra.wood, rim: 0.4 });
  const W = CELL, H = STORY, T = 0.3;
  if (edit === 0) {
    const full = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), m);
    full.position.y = H / 2;
    g.add(full);
  } else if (edit === 1) {
    // door: two jambs + lintel
    for (const s of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.3, H, T), m);
      jamb.position.set(s * W * 0.35, H / 2, 0);
      g.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, H * 0.25, T), m);
    lintel.position.set(0, H * 0.875, 0);
    g.add(lintel);
  } else {
    // window: sill + lintel + jambs
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.3, T), m);
    sill.position.y = H * 0.15;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.3, T), m);
    lintel.position.y = H * 0.85;
    g.add(sill, lintel);
    for (const s of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.25, H * 0.4, T), m);
      jamb.position.set(s * W * 0.375, H / 2, 0);
      g.add(jamb);
    }
  }
  return g;
}

function pieceGroup(piece: BuildPiece): THREE.Group {
  const g = new THREE.Group();
  if (piece.type === "wall") {
    g.add(wallMeshes(piece.edit));
  } else if (piece.type === "ramp") {
    // a chunky wedge ascending along +Z (rotated by face)
    const geo = new THREE.BufferGeometry();
    const W = CELL / 2, H = STORY;
    const verts = new Float32Array([
      -W, 0, -W,  W, 0, -W,  W, 0, W,   -W, 0, W,          // base
      -W, H, W,   W, H, W,                                   // top edge
    ]);
    const idx = [0, 1, 2, 0, 2, 3,  0, 4, 1, 1, 4, 5,  1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0];
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, makeCelMaterial({ color: PAL.extra.wood, rim: 0.4 }));
    g.add(m);
  } else if (piece.type === "floor") {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(CELL, 0.3, CELL),
      makeCelMaterial({ color: PAL.extra.wood, rim: 0.35 }),
    );
    f.position.y = STORY;
    g.add(f);
  } else {
    const c = new THREE.Mesh(
      new THREE.ConeGeometry(CELL * 0.62, STORY, 4),
      makeCelMaterial({ color: PAL.extra.wood, rim: 0.4 }),
    );
    c.position.y = STORY / 2;
    c.rotation.y = Math.PI / 4;
    g.add(c);
  }
  addOutline(g, 2.0, col(PAL.ink.line));
  g.position.set(piece.x, piece.y, piece.z);
  g.rotation.y = piece.face * (Math.PI / 2);
  return g;
}

/** Mirrors game.builds; events from game.ts drive add/edit/remove. */
export class BuildVisuals {
  private group = new THREE.Group();
  private meshes = new Map<string, { piece: BuildPiece; g: THREE.Group }>();
  ghost: THREE.Group | null = null;

  constructor(world: THREE.Group) {
    world.add(this.group);
  }

  add(piece: BuildPiece): void {
    const g = pieceGroup(piece);
    this.meshes.set(piece.key, { piece, g });
    this.group.add(g);
  }

  edit(piece: BuildPiece): void {
    const v = this.meshes.get(piece.key);
    if (!v) return;
    this.group.remove(v.g);
    const g = pieceGroup(piece);
    this.meshes.set(piece.key, { piece, g });
    this.group.add(g);
  }

  remove(piece: BuildPiece): void {
    const v = this.meshes.get(piece.key);
    if (v) {
      this.group.remove(v.g);
      this.meshes.delete(piece.key);
    }
  }

  /** Ghost blueprint: a translucent piece preview, tinted by validity. */
  updateGhost(type: BuildType | null, cell: { gx: number; gy: number; gz: number; face: number }, valid: boolean, baseY: number): void {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    if (!type) return;
    const fake: BuildPiece = {
      key: "ghost", type, gx: cell.gx, gy: cell.gy, gz: cell.gz, face: cell.face,
      x: cell.gx * CELL, y: baseY + cell.gy * STORY, z: cell.gz * CELL,
      hp: 1, owner: "ghost", edit: 0,
    };
    const g = pieceGroup(fake);
    // ghosts are pure hologram — strip the ink shells, tint everything
    const shells: THREE.Object3D[] = [];
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.Material).userData?.isOutline) shells.push(mesh);
    });
    for (const s of shells) s.parent?.remove(s);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshBasicMaterial({
          color: valid ? PAL.extra.ghostOk : PAL.extra.ghostBad,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        });
      }
    });
    this.ghost = g;
    this.group.add(g);
  }
}
