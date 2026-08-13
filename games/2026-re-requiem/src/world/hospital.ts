/**
 * hospital.ts — St. Veronica's ward set. ONE custom ShaderMaterial carries
 * the horror: near-black cel base, the warm flashlight cone with QUANTIZED
 * falloff (uFlash*), the sickly tube-light pools (baked positions), animated
 * rain gobos in the lobby, cold moon shafts at the skylights. Walls from
 * the same numbers as ward.ts's walkable rects. Props: exam table, ward
 * beds, the morgue drawer wall, the director's desk + power panel, the
 * elevator doors, the rain-streaked FACADE for the title (one window lit).
 */
import * as THREE from "three";
import { celEnvUniforms, CEL_LIGHT_GLSL, col } from "@tenyears/core";
import { PAL } from "../palette";
import {
  LOBBY, CORRIDOR, EXAM, WARDA, MORGUE, DIRECTOR, LIFT,
  D_EXAM, D_WARDA, D_MORGUE, D_DIRECTOR,
  TUBES, SKYLIGHTS, WARDB_PLATE, ELEVATOR_AT,
} from "../ward";

/* ------------------------------------------------- the flashlight shader -- */

export interface WardUniforms {
  uFlashPos: THREE.IUniform<THREE.Vector3>;
  uFlashDir: THREE.IUniform<THREE.Vector3>;
  uFlashOn: THREE.IUniform<number>;
  uPower: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

export function makeWardMaterial(uniforms: WardUniforms): THREE.ShaderMaterial {
  // the tube pools, baked per tube (the office tube waits for uPower)
  const tubeGlsl = TUBES.map((t) => /* glsl */ `
    {
      vec3 td = vW - vec3(${t.x.toFixed(1)}, 2.9, ${t.z.toFixed(1)});
      float on = ${t.office ? "uPower" : "1.0"};
      float tdist = length(td.xz);
      float tg = on * (floor((1.0 / (1.0 + tdist * tdist * 0.22)) * 3.0) / 3.0);
      c += vec3(0.85, 0.95, 0.85) * tg * 0.55;
    }`).join("\n");

  return new THREE.ShaderMaterial({
    uniforms: {
      ...celEnvUniforms(),
      uFlashPos: uniforms.uFlashPos,
      uFlashDir: uniforms.uFlashDir,
      uFlashOn: uniforms.uFlashOn,
      uPower: uniforms.uPower,
      uTime: uniforms.uTime,
    },
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
      uniform vec3 uFlashPos;
      uniform vec3 uFlashDir;
      uniform float uFlashOn;
      uniform float uPower;
      uniform float uTime;
      ${CEL_LIGHT_GLSL}
      void main() {
        vec3 N = normalize(vN);
        // the moon base — barely there; the dark is the default
        vec3 c = celLight(vC, N, normalize(cameraPosition - vW), 0.0, 40.0, 0.15);

        // THE FLASHLIGHT — warm cone, quantized falloff
        vec3 toF = vW - uFlashPos;
        float fD = length(toF);
        float cone = dot(normalize(toF), uFlashDir);
        float mask = smoothstep(0.86, 0.93, cone);
        float fall = 1.0 / (1.0 + fD * fD * 0.055);
        float band = floor(mask * fall * 4.0) / 4.0 * 1.5;
        c += vec3(1.0, 0.85, 0.63) * band * uFlashOn;

        // tube pools — sickly green-white, stepped
        ${tubeGlsl}

        // rain gobos — blind-stripes crawling through the lobby
        float inLobby = smoothstep(6.0, 4.0, abs(vW.x)) * smoothstep(-6.5, -5.0, vW.z) * (1.0 - smoothstep(6.0, 7.0, vW.z));
        float gobo = step(0.55, fract(vW.x * 0.9 + vW.y * 0.4 + uTime * 0.3));
        c *= 1.0 - gobo * inLobby * 0.4;

        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
}

/* ------------------------------------------------------------- geometry -- */

function coloredGeo(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = col(hex);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function makeBox(
  mat: THREE.ShaderMaterial, hex: number,
  cx: number, cy: number, cz: number, sx: number, sy: number, sz: number,
): THREE.Mesh {
  const m = new THREE.Mesh(coloredGeo(new THREE.BoxGeometry(sx, sy, sz), hex), mat);
  m.position.set(cx, cy, cz);
  return m;
}

/** a wall segment between two points (thickness 0.3, height 3) */
function wall(mat: THREE.ShaderMaterial, hex: number, x1: number, z1: number, x2: number, z2: number, world: THREE.Group): void {
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.05) return;
  const m = makeBox(mat, hex, (x1 + x2) / 2, 1.5, (z1 + z2) / 2, len, 3, 0.3);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  world.add(m);
}

/** a wall run with door gaps (measured along the run axis) */
function wallWithGaps(
  mat: THREE.ShaderMaterial, hex: number,
  x1: number, z1: number, x2: number, z2: number,
  gaps: [number, number][], axis: "x" | "z", world: THREE.Group,
): void {
  const from = axis === "x" ? x1 : z1;
  const total = axis === "x" ? x2 : z2;
  const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
  let cur = from;
  const put = (a: number, b: number) => {
    if (axis === "x") wall(mat, hex, a, z1, b, z2, world);
    else wall(mat, hex, x1, a, x2, b, world);
  };
  for (const [g0, g1] of sorted) {
    put(cur, g0);
    cur = g1;
  }
  put(cur, total);
}

/* ----------------------------------------------------------------- build -- */

export interface WardSet {
  tubes: THREE.Mesh[];       // tubes[2] is the office tube (dark till power)
  directorDoor: THREE.Mesh;
  liftL: THREE.Mesh;
  liftR: THREE.Mesh;
}

export function buildHospital(world: THREE.Group, mat: THREE.ShaderMaterial): WardSet {
  const W = PAL.terrain.mid;   // wall plaster
  const F = PAL.terrain.lit;   // floor tile
  const CE = 0x23282c;         // ceiling
  const e = PAL.extra;

  /* floors + ceilings */
  for (const r of [LOBBY, CORRIDOR, EXAM, WARDA, MORGUE, DIRECTOR, LIFT]) {
    const fl = new THREE.Mesh(
      coloredGeo(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2), F),
      mat,
    );
    fl.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    world.add(fl);
    const ce = new THREE.Mesh(
      coloredGeo(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(Math.PI / 2), CE),
      mat,
    );
    ce.position.set((r.x0 + r.x1) / 2, 3, (r.z0 + r.z1) / 2);
    world.add(ce);
  }
  // the rain-soaked forecourt (title camera lives here)
  const fore = new THREE.Mesh(coloredGeo(new THREE.PlaneGeometry(44, 18).rotateX(-Math.PI / 2), 0x1a2026), mat);
  fore.position.set(0, -0.01, 15);
  world.add(fore);

  /* walls */
  wallWithGaps(mat, W, -2, -6, -2, -58, [[D_WARDA.z0, D_WARDA.z1], [D_MORGUE.z0, D_MORGUE.z1]], "z", world);
  wallWithGaps(mat, W, 2, -6, 2, -58, [[D_EXAM.z0, D_EXAM.z1], [D_DIRECTOR.z0, D_DIRECTOR.z1]], "z", world);
  wall(mat, W, -5, 6, 5, 6, world);          // lobby south (facade line)
  wall(mat, W, -5, -6, -5, 6, world);        // lobby west
  wall(mat, W, 5, -6, 5, 6, world);          // lobby east
  wallWithGaps(mat, W, -5, -6, 5, -6, [[-2, 2]], "x", world); // lobby north, corridor mouth
  wall(mat, W, 2, -10, 10, -10, world);      // exam N
  wall(mat, W, 2, -18, 10, -18, world);      // exam S
  wall(mat, W, 10, -18, 10, -10, world);     // exam E
  wall(mat, W, -10, -22, -2, -22, world);    // ward A N
  wall(mat, W, -10, -30, -2, -30, world);    // ward A S
  wall(mat, W, -10, -30, -10, -22, world);   // ward A W
  wall(mat, W, -11, -40, -2, -40, world);    // morgue N
  wall(mat, W, -11, -48, -2, -48, world);    // morgue S
  wall(mat, W, -11, -48, -11, -40, world);   // morgue W
  wall(mat, W, 2, -46, 10, -46, world);      // director N
  wall(mat, W, 2, -54, 10, -54, world);      // director S
  wall(mat, W, 10, -54, 10, -46, world);     // director E
  wallWithGaps(mat, e.doorMetal, -2, -58, 2, -58, [[-0.6, 0.6]], "x", world); // the elevator doorway
  wall(mat, W, LIFT.x0, LIFT.z0, LIFT.x1, LIFT.z0, world); // shaft shell
  wall(mat, W, LIFT.x0, LIFT.z0, LIFT.x0, LIFT.z1, world);
  wall(mat, W, LIFT.x1, LIFT.z0, LIFT.x1, LIFT.z1, world);

  /* doors */
  // ward B: sealed forever — the plate does the talking
  world.add(makeBox(mat, e.door, 2.05, 1.1, WARDB_PLATE.z, 0.12, 2.2, 1.6));
  // the director's door — slides when cranked
  const directorDoor = makeBox(mat, e.door, 2.05, 1.1, (D_DIRECTOR.z0 + D_DIRECTOR.z1) / 2, 0.12, 2.2, 1.6);
  world.add(directorDoor);
  // the elevator: frame + two sliding panels
  world.add(makeBox(mat, e.elevator, ELEVATOR_AT.x, 2.65, ELEVATOR_AT.z + 0.1, 3.4, 0.7, 0.2)); // header
  const liftL = makeBox(mat, e.doorMetal, -0.55, 1.25, ELEVATOR_AT.z, 1.1, 2.5, 0.1);
  const liftR = makeBox(mat, e.doorMetal, 0.55, 1.25, ELEVATOR_AT.z, 1.1, 2.5, 0.1);
  world.add(liftL, liftR);

  /* props */
  world.add(makeBox(mat, 0x6a6a62, 6, 0.45, -14, 2.2, 0.9, 0.9));   // exam table
  world.add(makeBox(mat, 0x8a8a80, 6, 0.82, -14, 2.0, 0.16, 0.7));  // its pad
  world.add(makeBox(mat, 0x4a4a44, 9.4, 0.9, -12, 0.8, 1.8, 2.0));  // the cabinet
  for (const z of [-24.5, -28]) {                                    // ward A beds
    world.add(makeBox(mat, 0x5a5a54, -7, 0.4, z, 2.2, 0.5, 1.0));
    world.add(makeBox(mat, 0x8a8a80, -7, 0.68, z, 2.0, 0.14, 0.85));
  }
  world.add(makeBox(mat, 0x4a5054, -10.6, 1.4, -44, 0.8, 2.8, 7.0)); // the morgue drawers
  world.add(makeBox(mat, 0x6a6a62, -6.5, 0.5, -44, 1.8, 0.7, 0.8));  // the gurney
  world.add(makeBox(mat, 0x4a3a2c, 7.4, 0.5, -52.4, 2.4, 1.0, 1.1)); // the director's desk
  world.add(makeBox(mat, e.doorMetal, 9.7, 1.5, -50, 0.5, 1.6, 1.2)); // the power panel
  world.add(makeBox(mat, 0x5a5a54, 1.2, 0.4, -36, 1.6, 0.6, 0.7));   // a corridor gurney
  for (const [bx, bz] of [[-0.6, -21], [0.8, -42.5]] as const) {     // banded blood
    const pool = new THREE.Mesh(coloredGeo(new THREE.CircleGeometry(0.9, 14).rotateX(-Math.PI / 2), e.blood), mat);
    pool.position.set(bx, 0.02, bz);
    world.add(pool);
    const hot = new THREE.Mesh(coloredGeo(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), e.bloodHot), mat);
    hot.position.set(bx + 0.2, 0.03, bz + 0.1);
    world.add(hot);
  }

  /* tube lights — emissive strips; the shader pools the light */
  const tubes: THREE.Mesh[] = [];
  for (const t of TUBES) {
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.08, 0.2),
      new THREE.MeshBasicMaterial({ color: e.tube }),
    );
    tube.position.set(t.x, 2.95, t.z);
    world.add(tube);
    tubes.push(tube);
  }
  // the office tube starts dark
  tubes[2].material = new THREE.MeshBasicMaterial({ color: 0x2a322e });

  /* skylight moon shafts */
  for (const sk of SKYLIGHTS) {
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry((sk.x1 - sk.x0) * 0.9, 4.4),
      new THREE.MeshBasicMaterial({
        color: e.moon, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    shaft.position.set((sk.x0 + sk.x1) / 2, 1.5, (sk.z0 + sk.z1) / 2);
    world.add(shaft);
  }

  return { tubes, directorDoor, liftL, liftR };
}

/* ------------------------------------------------------- the title facade -- */

export function buildFacade(world: THREE.Group, mat: THREE.ShaderMaterial): void {
  const e = PAL.extra;
  // the face reads as a FLAT silhouette — backlit faces get no cel light
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(24, 12, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x1c242e }),
  );
  face.position.set(0, 6, 7.4);
  world.add(face);
  for (let r = 0; r < 3; r++) {
    for (let ci = 0; ci < 6; ci++) {
      const lit = r === 2 && ci === 5; // ONE window lit — top right, clear
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.8),
        new THREE.MeshBasicMaterial({ color: lit ? e.cone : 0x0c1016 }),
      );
      win.position.set(-8.75 + ci * 3.5, 3.4 + r * 3.1, 7.66); // proud of the face
      world.add(win);
    }
  }
  world.add(makeBox(mat, 0x2c3238, 0, 3.2, 8.8, 8, 0.4, 2.6)); // the portico
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 48;
  const ctx = cv.getContext("2d")!;
  ctx.font = "28px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#7a8a80";
  ctx.fillText("ST. VERONICA'S", 128, 34);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 0.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }),
  );
  sign.position.set(0, 2.7, 10.2);
  world.add(sign);
}

/** rain streaks (the title camera lives in them) */
export function buildRain(world: THREE.Group): THREE.Mesh[] {
  const drops: THREE.Mesh[] = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x6a7a8a, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 160; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.5), mat);
    d.position.set((Math.random() - 0.5) * 30, Math.random() * 12, 8 + Math.random() * 16);
    d.userData.speed = 7 + Math.random() * 3;
    world.add(d);
    drops.push(d);
  }
  return drops;
}
