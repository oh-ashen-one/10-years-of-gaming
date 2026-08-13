/**
 * temple.ts — the INKPEAK set: the stone spine path down the mountain, the
 * bamboo court (black stalks, gold-ring nodes), red lacquer gate frames,
 * two incense shrines (burner + smoke anchor), the fog curtain, and the
 * Abbot's court — a red-pillar ring before the great hall's stacked roofs.
 * Ground vertex colors come from the palette; the one light truth is
 * configureCelEnv's low gold sun.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1, celEnvUniforms, CEL_LIGHT_GLSL, fbm } from "@tenyears/core";
import { PAL } from "../palette";
import {
  WORLD, SHRINE_START, SHRINE_GATE, COURT, FOG_GATE, ARENA, HALL, heightAt,
} from "../mountain";

const INK = () => col(PAL.ink.line);

/* ---------------------------------------------------------------- ground -- */

export function buildGround(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(WORLD * 2.2, WORLD * 2.2, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = col(PAL.terrain.lit);
  const cB = col(PAL.terrain.mid);
  const cPath = col(0x6a6658);
  const cCourt = col(PAL.extra.stoneDark);
  const cArena = col(0x5a4a42);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    let c: THREE.Color;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 2) c = cArena;
    else if (Math.hypot(x - COURT.x, z - COURT.z) < COURT.r + 2) c = cCourt;
    else if (Math.abs(x) < 5 && z < 10 && z > -170) c = cPath; // the spine
    else c = tmp.copy(cA).lerp(cB, fbm(x * 0.03, z * 0.03, 2) > 0.5 ? 0.6 : 0.1).clone();
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...celEnvUniforms() },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vC;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vC = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vC;
      ${CEL_LIGHT_GLSL}
      void main() {
        vec3 c = celLight(vC, normalize(vN), normalize(cameraPosition - vW), 0.0, 42.0, 0.25);
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
  world.add(new THREE.Mesh(geo, mat));
}

/* ---------------------------------------------------------------- bamboo -- */

export function buildBamboo(world: THREE.Group): void {
  const mStalk = makeCelMaterial({ color: PAL.extra.bamboo, rim: 0.5 });
  const mNode = makeCelMaterial({ color: PAL.extra.bambooTip, rim: 0.4 });
  const mLeaf = makeCelMaterial({ color: 0x2a3a2e, rim: 0.55 });

  const clusters: { x: number; z: number; n: number }[] = [];
  // ring the bamboo court
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    clusters.push({
      x: COURT.x + Math.cos(a) * (COURT.r + 3 + hash1(i * 1.7) * 4),
      z: COURT.z + Math.sin(a) * (COURT.r + 3 + hash1(i * 2.3) * 4),
      n: 4 + Math.floor(hash1(i * 3.1) * 4),
    });
  }
  // flank the spine
  for (let i = 0; i < 10; i++) {
    const z = -8 - i * 10;
    clusters.push({ x: -18 - hash1(i * 4.7) * 8, z, n: 3 + Math.floor(hash1(i) * 3) });
    clusters.push({ x: 18 + hash1(i * 5.9) * 8, z: z - 5, n: 3 + Math.floor(hash1(i * 2) * 3) });
  }
  // behind the first shrine
  clusters.push({ x: -8, z: 6, n: 6 }, { x: 9, z: 5, n: 5 });

  for (const cl of clusters) {
    for (let i = 0; i < cl.n; i++) {
      const x = cl.x + (hash1(i * 7.1 + cl.z) - 0.5) * 4;
      const z = cl.z + (hash1(i * 9.3 + cl.x) - 0.5) * 4;
      const h = 6 + hash1(i * 3.7 + cl.x) * 4;
      const lean = (hash1(i * 5.1) - 0.5) * 0.14;
      const y0 = heightAt(x, z);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 5), mStalk);
      stalk.position.set(x, y0 + h / 2, z);
      stalk.rotation.z = lean;
      world.add(stalk);
      // gold-ring nodes
      for (let n = 1; n < 4; n++) {
        const node = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 5), mNode);
        node.position.set(x + lean * (h * n / 4) * 0.5, y0 + (h * n) / 4, z);
        world.add(node);
      }
      // leaf tufts
      for (let l = 0; l < 2; l++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), mLeaf);
        leaf.position.set(x + lean * h * 0.5, y0 + h - l * 0.8, z);
        leaf.rotation.set(-0.4, hash1(i * 11 + l) * Math.PI, 0.2);
        leaf.material.side = THREE.DoubleSide;
        world.add(leaf);
      }
    }
  }
}

/* ------------------------------------------------------------ gate frames -- */

function gateFrame(): THREE.Group {
  const g = new THREE.Group();
  const mLac = makeCelMaterial({ color: PAL.extra.lacquer, rim: 0.5 });
  const mGold = makeCelMaterial({ color: PAL.extra.gold, specBand: 0.7, rim: 0.3 });
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 6.4, 8), mLac);
    pillar.position.set(s * 4, 3.2, 0);
    g.add(pillar);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.5, 8), mGold);
    foot.position.set(s * 4, 0.25, 0);
    g.add(foot);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.5, 0.6), mLac);
  lintel.position.y = 6.4;
  g.add(lintel);
  const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.36, 0.5), mLac);
  lintel2.position.y = 5.4;
  g.add(lintel2);
  // flared tips
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.62), mGold);
    tip.position.set(s * 5.4, 6.55, 0);
    tip.rotation.z = s * 0.25;
    g.add(tip);
  }
  addOutline(g, 2.0, INK());
  return g;
}

export function buildGates(world: THREE.Group): void {
  for (const z of [-22, -68, FOG_GATE.z]) {
    const f = gateFrame();
    f.position.set(0, heightAt(0, z), z);
    world.add(f);
  }
}

/* ---------------------------------------------------------------- shrines -- */

export interface ShrineRig {
  group: THREE.Group;
  smokeAnchor: THREE.Vector3; // world-space burner top
  glow: THREE.Mesh;
}

export function buildShrine(world: THREE.Group, at: { x: number; z: number }): ShrineRig {
  const g = new THREE.Group();
  const mStone = makeCelMaterial({ color: PAL.extra.stone, rim: 0.4 });
  const mBronze = makeCelMaterial({ color: 0x6a5a34, specBand: 0.7, rim: 0.35 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.4, 8), mStone);
  base.position.y = 0.2;
  g.add(base);
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.6, 8), mBronze);
  burner.position.y = 0.75;
  g.add(burner);
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4),
      makeCelMaterial({ color: 0x4a2a1a, rim: 0.2 }),
    );
    stick.position.set((i - 1) * 0.12, 1.35, (i % 2) * 0.08 - 0.04);
    stick.rotation.z = (i - 1) * 0.12;
    g.add(stick);
  }
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: PAL.extra.goldHot, transparent: true, opacity: 0.85 }),
  );
  glow.position.y = 1.35;
  g.add(glow);
  // a little roofed stone lantern behind
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), mStone);
  post.position.set(-0.9, 0.8, -0.5);
  g.add(post);
  const lampRoof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 6), mStone);
  lampRoof.position.set(-0.9, 1.85, -0.5);
  g.add(lampRoof);

  addOutline(g, 1.8, INK());
  const y = heightAt(at.x, at.z);
  g.position.set(at.x, y, at.z);
  world.add(g);
  return { group: g, smokeAnchor: new THREE.Vector3(at.x, y + 1.4, at.z), glow };
}

/* ------------------------------------------------------------ fog curtain -- */

export function buildFogCurtain(world: THREE.Group): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(242,232,200,0.0)");
  grad.addColorStop(0.35, "rgba(242,232,200,0.75)");
  grad.addColorStop(1, "rgba(242,232,200,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FOG_GATE.w + 4, 7),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  mesh.position.set(FOG_GATE.x, heightAt(FOG_GATE.x, FOG_GATE.z) + 3.2, FOG_GATE.z);
  world.add(mesh);
  return mesh;
}

/* ------------------------------------------------------- the abbot's court -- */

export function buildArena(world: THREE.Group): void {
  const mLac = makeCelMaterial({ color: PAL.extra.lacquer, rim: 0.5 });
  const mGold = makeCelMaterial({ color: PAL.extra.gold, specBand: 0.7, rim: 0.3 });

  // red pillar ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = ARENA.x + Math.cos(a) * (ARENA.r + 1.5);
    const z = ARENA.z + Math.sin(a) * (ARENA.r + 1.5);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 7.4, 8), mLac);
    pillar.position.set(x, heightAt(x, z) + 3.7, z);
    world.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), mGold);
    cap.position.set(x, heightAt(x, z) + 7.5, z);
    world.add(cap);
  }
  // gold floor inlay ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.r - 2.2, ARENA.r - 1.7, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0.4 }),
  );
  ring.position.set(ARENA.x, heightAt(ARENA.x, ARENA.z) + 0.06, ARENA.z);
  world.add(ring);

  // THE HALL — stacked roofs behind the court
  const hall = new THREE.Group();
  const mWall = makeCelMaterial({ color: 0x6a5a48, rim: 0.35 });
  const mRoof = makeCelMaterial({ color: 0x2a2620, rim: 0.55 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 14), makeCelMaterial({ color: PAL.extra.stoneDark, rim: 0.3 }));
  platform.position.y = 0.6;
  hall.add(platform);
  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 10), mWall);
  body.position.y = 4.2;
  hall.add(body);
  // red columns across the face
  for (let i = -3; i <= 3; i++) {
    const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6), mLac);
    colMesh.position.set(i * 3, 4.2, 5.1);
    hall.add(colMesh);
  }
  const roof1 = new THREE.Mesh(new THREE.ConeGeometry(15, 3.4, 4), mRoof);
  roof1.position.y = 8.8;
  roof1.rotation.y = Math.PI / 4;
  roof1.scale.set(1.1, 1, 0.75);
  hall.add(roof1);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, 7), mWall);
  upper.position.y = 11.6;
  hall.add(upper);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(10, 3.0, 4), mRoof);
  roof2.position.y = 14.6;
  roof2.rotation.y = Math.PI / 4;
  roof2.scale.set(1.05, 1, 0.7);
  hall.add(roof2);
  // gold ridge ornaments
  const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mGold);
  ornament.position.y = 16.4;
  hall.add(ornament);
  addOutline(hall, 2.4, INK());
  hall.position.set(HALL.x, heightAt(HALL.x, HALL.z), HALL.z);
  world.add(hall);
}
