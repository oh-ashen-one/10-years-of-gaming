/**
 * painted.ts — the OVERPAINT set: the painted valley floor (rose strokes
 * on ink-navy), floating rock shards with gold veins, gilded frames
 * hanging in the air, the giant canvas-sky "34" in gold leaf, picto
 * stickers, the expedition flag, and the gilt-frame arena — the Great
 * Frame behind it that the Marionette's strings imply. "The most
 * beautiful game of the eleven" — the budget shows here.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1, celEnvUniforms, CEL_LIGHT_GLSL, fbm } from "@tenyears/core";
import { PAL } from "../palette";
import {
  WORLD, PICTO1, PICTO2, FIGHT1, FIGHT2, FLAG, ARENA, GREAT_FRAME, heightAt,
} from "../valley";

const INK = () => col(PAL.ink.line);

/* ---------------------------------------------------------------- ground -- */

export function buildGround(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(WORLD * 2.2, WORLD * 2.2, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = col(PAL.terrain.lit);
  const cB = col(PAL.terrain.mid);
  const cPath = col(0xd8b898);   // the brushed path
  const cFloor = col(PAL.extra.stoneDark);
  const cArena = col(0x5a3a4a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    let c: THREE.Color;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 2) c = cArena;
    else if (Math.hypot(x - FIGHT1.x, z - FIGHT1.z) < 12 || Math.hypot(x - FIGHT2.x, z - FIGHT2.z) < 12) c = cFloor;
    else if (Math.abs(x) < 4.5 && z < 10 && z > -175) c = cPath;
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

/* ------------------------------------------- floating shards + gilt frames -- */

/** rock shards with gold veins, adrift; returns the group for the drift update */
export function buildShards(world: THREE.Group): THREE.Group {
  const g = new THREE.Group();
  const mRock = makeCelMaterial({ color: 0x3a3040, rim: 0.6 });
  const mVein = makeCelMaterial({ color: PAL.extra.gold, emissive: PAL.extra.gold, emissiveStrength: 0.5, rim: 0.3 });
  for (let i = 0; i < 16; i++) {
    const shard = new THREE.Group();
    const s = 1.5 + hash1(i * 3.1) * 4;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mRock);
    rock.scale.y = 0.6 + hash1(i * 7.7) * 0.5;
    shard.add(rock);
    const vein = new THREE.Mesh(new THREE.BoxGeometry(s * 1.4, 0.08, 0.08), mVein);
    vein.rotation.set(hash1(i) * 2, hash1(i * 2) * 2, hash1(i * 3) * 2);
    shard.add(vein);
    shard.position.set(
      (hash1(i * 11.3) - 0.5) * 160,
      14 + hash1(i * 13.7) * 30,
      -30 - hash1(i * 17.1) * 160,
    );
    shard.rotation.set(hash1(i * 5) * 0.6, hash1(i * 9) * Math.PI, 0);
    shard.userData.seed = i * 1.31;
    g.add(shard);
  }
  addOutline(g, 1.8, INK());
  world.add(g);
  return g;
}

/** gilded frames adrift — the valley is a gallery */
export function buildFrames(world: THREE.Group): THREE.Group {
  const g = new THREE.Group();
  const mGold = makeCelMaterial({ color: PAL.extra.frame, specBand: 0.7, rim: 0.35 });
  for (let i = 0; i < 7; i++) {
    const frame = new THREE.Group();
    const w = 3 + hash1(i * 2.9) * 3.5;
    const h = w * (0.7 + hash1(i * 4.1) * 0.5);
    const t = 0.22;
    for (const [px, py, sx, sy] of [
      [0, h / 2, w + t, t], [0, -h / 2, w + t, t],
      [-w / 2, 0, t, h], [w / 2, 0, t, h],
    ] as const) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, t), mGold);
      bar.position.set(px, py, 0);
      frame.add(bar);
    }
    frame.position.set(
      (hash1(i * 7.3) - 0.5) * 130,
      8 + hash1(i * 9.7) * 22,
      -20 - hash1(i * 12.1) * 140,
    );
    frame.rotation.set((hash1(i * 3) - 0.5) * 0.5, hash1(i * 6) * Math.PI, (hash1(i * 8) - 0.5) * 0.3);
    frame.userData.seed = i * 2.17;
    g.add(frame);
  }
  addOutline(g, 2.0, INK());
  world.add(g);
  return g;
}

/* ------------------------------------------------------- the Number sky -- */

/** the giant canvas-sky "34" in gold leaf, hung north over the arena */
export function buildNumberSky(world: THREE.Group): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext("2d")!;
  // canvas weave
  ctx.fillStyle = "rgba(242,232,216,0.0)";
  ctx.fillRect(0, 0, 512, 256);
  ctx.font = "italic 900 190px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,217,138,0.8)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#ffd98a";
  ctx.fillText("34", 256, 140);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 45),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  mesh.position.set(0, 60, -260);
  mesh.rotation.x = 0.12;
  world.add(mesh);
  return mesh;
}

/* ----------------------------------------------------------------- pictos -- */

export interface PictoRig { group: THREE.Group; id: string; }

export function buildPictos(world: THREE.Group): PictoRig[] {
  const out: PictoRig[] = [];
  for (const pk of [PICTO1, PICTO2]) {
    const g = new THREE.Group();
    // a floating gold sticker-plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.08),
      makeCelMaterial({ color: PAL.extra.picto, specBand: 0.8, specPow: 40, rim: 0.4 }),
    );
    g.add(plate);
    const glyph = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: PAL.extra.navy }),
    );
    glyph.position.z = 0.06;
    g.add(glyph);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.72, 20),
      new THREE.MeshBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    g.add(halo);
    addOutline(g, 1.6, INK());
    g.position.set(pk.x, heightAt(pk.x, pk.z) + 1.2, pk.z);
    world.add(g);
    out.push({ group: g, id: pk.id });
  }
  return out;
}

/* ------------------------------------------------------------------- flag -- */

export function buildFlag(world: THREE.Group): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 3.4, 6),
    makeCelMaterial({ color: PAL.extra.frame, specBand: 0.6, rim: 0.3 }),
  );
  pole.position.y = 1.7;
  g.add(pole);
  // the expedition banner — navy field, a gold "34" plate on the front
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.4),
    makeCelMaterial({ color: PAL.extra.navy, rim: 0.4, doubleSided: true }),
  );
  banner.position.set(0.6, 2.6, 0);
  g.add(banner);
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.font = "italic 900 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255,217,138,0.8)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffd98a";
  ctx.fillText("34", 32, 46);
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide }),
  );
  mark.position.set(0.6, 2.6, 0.02);
  g.add(mark);
  // the base: a painted cairn
  const cairn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 0.4, 7),
    makeCelMaterial({ color: PAL.extra.stone, rim: 0.35 }),
  );
  cairn.position.y = 0.2;
  g.add(cairn);
  addOutline(g, 1.8, INK());
  g.position.set(FLAG.x, heightAt(FLAG.x, FLAG.z), FLAG.z);
  world.add(g);
  return g;
}

/* ------------------------------------------------------------------ arena -- */

export function buildArena(world: THREE.Group): void {
  // gilt floor inlay
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.r - 2.4, ARENA.r - 1.8, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0.45 }),
  );
  ring.position.set(ARENA.x, heightAt(ARENA.x, ARENA.z) + 0.06, ARENA.z);
  world.add(ring);

  // rose-quartz posts around the ring
  const mPost = makeCelMaterial({ color: PAL.extra.rose, rim: 0.5 });
  const mGold = makeCelMaterial({ color: PAL.extra.frame, specBand: 0.7, rim: 0.3 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = ARENA.x + Math.cos(a) * (ARENA.r + 1.5);
    const z = ARENA.z + Math.sin(a) * (ARENA.r + 1.5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 5.6, 6), mPost);
    post.position.set(x, heightAt(x, z) + 2.8, z);
    world.add(post);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), mGold);
    cap.position.set(x, heightAt(x, z) + 6, z);
    world.add(cap);
  }

  // THE GREAT FRAME — a vast gilt frame the Marionette hangs before
  const frame = new THREE.Group();
  const w = 30;
  const h = 20;
  const t = 1.1;
  for (const [px, py, sx, sy] of [
    [0, h / 2, w + t, t], [0, -h / 2, w + t, t],
    [-w / 2, 0, t, h], [w / 2, 0, t, h],
  ] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, t), mGold);
    bar.position.set(px, py, 0);
    frame.add(bar);
  }
  // ornate corner bosses
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), mGold);
      boss.position.set(sx * w / 2, sy * h / 2, 0);
      frame.add(boss);
    }
  }
  addOutline(frame, 2.6, INK());
  frame.position.set(GREAT_FRAME.x, heightAt(GREAT_FRAME.x, GREAT_FRAME.z) + 12, GREAT_FRAME.z);
  world.add(frame);
}

/* --------------------------------------------------- telegraph smears -- */

/** a brushstroke smear plane (quantized paint) for telegraphs */
export function makeSmear(color: number): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  const hex = "#" + color.toString(16).padStart(6, "0");
  // a rough brushed band — three overlapping strokes, stepped alpha
  ctx.translate(64, 32);
  ctx.rotate(-0.15);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.55 + i * 0.15;
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.ellipse(0, (i - 1) * 8, 56 - i * 10, 10 - i * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
}
