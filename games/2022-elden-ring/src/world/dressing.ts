/**
 * dressing.ts — the moor set: the valley floor (moor greens/slate with
 * the path carved north), THE GOLDEN TREE (a vast emissive silhouette
 * dominating the northern sky — the world's hero light), ruined arches,
 * grace sites (rising gold threads), the fog gate, the warden's bridge,
 * and stacked quantized mist planes.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, hash1, celEnvUniforms, CEL_LIGHT_GLSL, fbm } from "@tenyears/core";
import { PAL } from "../palette";
import { GRACE_START, GRACE_GATE, FOG_GATE, BRIDGE, TREE_POS, heightAt, WORLD } from "../moor";

/* ---------------------------------------------------------------- ground -- */

export function buildMoorGround(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(WORLD * 2.4, WORLD * 2.4, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = col(PAL.terrain.lit);
  const cB = col(PAL.terrain.mid);
  const cPath = col(0x6a6255);
  const cStone = col(PAL.extra.stoneDark);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    let c: THREE.Color;
    if (Math.abs(x) < 6 && z < 8 && z > -165) c = cPath;                  // the path
    else if (Math.abs(x - BRIDGE.x) < BRIDGE.w && z < -160 && z > -210) c = cStone; // bridge deck area
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

/* --------------------------------------------------------- the gold tree -- */

export function buildGoldenTree(world: THREE.Group): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false });
  const hot = new THREE.MeshBasicMaterial({ color: 0xfff8dc, fog: false });
  // trunk + boughs as emissive gold — overexposed against the gloom
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(14, 26, 260, 10), gold);
  trunk.position.y = 130;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 7, 130, 6), i % 2 ? gold : hot);
    bough.position.set(Math.cos(a) * 55, 250 + hash1(i * 3.3) * 30, Math.sin(a) * 55);
    bough.rotation.z = Math.cos(a) * 0.9;
    bough.rotation.x = Math.sin(a) * 0.9;
    g.add(bough);
  }
  // the crown: a huge soft glow cluster
  for (let i = 0; i < 12; i++) {
    const a = hash1(i * 7.1) * Math.PI * 2;
    const r = 40 + hash1(i * 3.7) * 90;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(18 + hash1(i * 9.9) * 22, 10, 8), i % 3 ? gold : hot);
    puff.position.set(Math.cos(a) * r, 300 + hash1(i * 5.3) * 60, Math.sin(a) * r);
    g.add(puff);
  }
  g.position.set(TREE_POS.x, -20, TREE_POS.z);
  world.add(g);
  return g;
}

/* ------------------------------------------------- grace sites + props -- */

export function buildGrace(world: THREE.Group, at: { x: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  // a low broken slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.1), makeCelMaterial({ color: PAL.extra.stone, rim: 0.4 }));
  slab.position.y = 0.25;
  g.add(slab);
  // rising gold threads — the grace light
  const threadM = new THREE.MeshBasicMaterial({ color: PAL.extra.grace, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.6), threadM);
    t.position.set((hash1(i * 3.7) - 0.5) * 0.9, 1.2 + hash1(i * 7.1) * 0.5, (hash1(i * 5.3) - 0.5) * 0.9);
    t.rotation.y = hash1(i * 9.7) * Math.PI;
    t.name = "thread";
    g.add(t);
  }
  addOutline(slab, 1.8, col(PAL.ink.line));
  g.position.set(at.x, heightAt(at.x, at.z), at.z);
  world.add(g);
  return g;
}

export function buildDressing(world: THREE.Group): { update(dt: number, time: number): void } {
  const g = new THREE.Group();

  /* ---- ruined arches along the path ---- */
  const archM = makeCelMaterial({ color: PAL.extra.stone, rim: 0.4 });
  const archSpots: [number, number, number][] = [
    [-12, -30, 0.4], [10, -58, -0.3], [-16, -95, 0.9], [14, -128, 0.1], [-10, -150, -0.6],
  ];
  for (const [x, z, rot] of archSpots) {
    const y = heightAt(x, z);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), archM);
    p1.position.set(-2.6, 3.5, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.4, 1.4), archM); // broken
    p2.position.set(2.6, 2.7, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.1, 1.5), archM);
    lintel.position.set(-0.6, 7.1, 0);
    lintel.rotation.z = 0.1; // sagging
    const arch = new THREE.Group();
    arch.add(p1, p2, lintel);
    arch.position.set(x, y, z);
    arch.rotation.y = rot;
    addOutline(arch, 1.8, col(PAL.ink.line));
    g.add(arch);
  }

  /* ---- dead trees ---- */
  for (let i = 0; i < 12; i++) {
    const x = (hash1(i * 3.3) - 0.5) * 120;
    const z = -hash1(i * 7.9) * 200 + 10;
    if (Math.abs(x) < 8) continue;
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.35, 5 + hash1(i * 5.5) * 3, 5),
      makeCelMaterial({ color: 0x3a3630, rim: 0.3 }),
    );
    t.position.set(x, heightAt(x, z) + 2.5, z);
    t.rotation.z = (hash1(i * 9.1) - 0.5) * 0.3;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 4), t.material as THREE.ShaderMaterial);
    branch.position.y = 2.2;
    branch.rotation.z = 0.9;
    t.add(branch);
    addOutline(t, 1.6, col(PAL.ink.line));
    g.add(t);
  }

  /* ---- the fog gate: a pale shimmering wall ---- */
  const fogMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFog: { value: col(PAL.extra.fogGate).clone() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uFog;
      void main() {
        float bands = floor(fract(vUv.y * 8.0 + uTime * 0.12) * 4.0 + 0.5) / 4.0;
        float a = 0.55 + bands * 0.3;
        gl_FragColor = vec4(uFog, a * 0.75);
      }
    `,
  });
  const fogWall = new THREE.Mesh(new THREE.PlaneGeometry(FOG_GATE.w, 7), fogMat);
  fogWall.position.set(FOG_GATE.x, heightAt(FOG_GATE.x, FOG_GATE.z) + 3, FOG_GATE.z);
  g.add(fogWall);

  /* ---- the bridge ---- */
  const deckM = makeCelMaterial({ color: PAL.extra.stone, rim: 0.35 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.w, 1.2, BRIDGE.len), deckM);
  deck.position.set(BRIDGE.x, heightAt(BRIDGE.x, BRIDGE.z) - 0.4, BRIDGE.z);
  addOutline(deck, 2.0, col(PAL.ink.line));
  g.add(deck);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, BRIDGE.len), makeCelMaterial({ color: PAL.extra.stoneDark, rim: 0.3 }));
    rail.position.set(BRIDGE.x + s * (BRIDGE.w / 2 - 0.3), heightAt(BRIDGE.x, BRIDGE.z) + 0.7, BRIDGE.z);
    g.add(rail);
    addOutline(rail, 1.8, col(PAL.ink.line));
  }

  /* ---- quantized mist bands: stacked drifting planes ---- */
  const mistMat = new THREE.MeshBasicMaterial({
    color: PAL.atmosphere.haze, transparent: true, opacity: 0.16, depthWrite: false,
  });
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 26), mistMat);
    m.position.set(0, 2 + i * 2.2, -40 - i * 38);
    mists.push(m);
    g.add(m);
  }

  world.add(g);

  return {
    update(_dt, time) {
      fogMat.uniforms.uTime.value = time;
      mists.forEach((m, i) => {
        m.position.x = Math.sin(time * 0.06 + i * 2.2) * 14;
      });
    },
  };
}
