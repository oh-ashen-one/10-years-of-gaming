/**
 * cel.ts — the NPR lighting pipeline shared by every surface in every game.
 *
 * The recipe (fixed by the franchise, see MASTER.md §2.2):
 *  - 4-band quantized diffuse ramp (NearestFilter DataTexture — hard bands,
 *    sampled at ndl*0.5+0.5). Never smooth Lambert.
 *  - Two-temperature lighting: warm key tint × ramp over a cool ambient
 *    floor. Every scene has a warm side and a cool side.
 *  - Two-tone fresnel rim: hot on the key side, cool on the shadow side,
 *    switched by a step on ndl.
 *  - Banded specular: step(0.5, pow(N·H, k)) — hard-edged highlight shapes.
 *  - Optional painted matcap for "metal" — a canvas-painted gradient sphere
 *    with a glint, mixed by a banded factor. Never a real env probe.
 *  - Quantized distance haze: smoothstep then floor(f*5+0.5)/5 into the
 *    horizon color. Stepped bands, never fog soup.
 *
 * One `celEnv` object holds the shared environment uniforms (sun direction,
 * tints, haze, time, origin shift); every cel material references it, so
 * recoloring/retiming the world is a single mutation.
 *
 * Ink silhouettes live here too: `addOutline` hangs back-face-extrusion ink
 * shells on a rig with constant SCREEN-SPACE width via `outlinePixScale`,
 * refreshed once per frame by the frame loop (`harness/frame.ts`).
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { basePalette, col, type Palette } from "../world/palette";

/* -------------------------------------------------- shared environment -- */

export interface CelEnv {
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uSunTint: THREE.IUniform<THREE.Color>;
  uAmbient: THREE.IUniform<THREE.Color>;
  uRimHot: THREE.IUniform<THREE.Color>;
  uRimCool: THREE.IUniform<THREE.Color>;
  uHazeColor: THREE.IUniform<THREE.Color>;
  uHazeNear: THREE.IUniform<number>;
  uHazeFar: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  /** origin-recentering shift: logical coords = rendered coords + uShift */
  uShift: THREE.IUniform<THREE.Vector3>;
}

/** The one shared environment — every cel material references these. */
export const celEnv: CelEnv = {
  uSunDir: { value: new THREE.Vector3(-0.8, 0.35, -0.45).normalize() },
  uSunTint: { value: new THREE.Color(0xffc27d) },
  uAmbient: { value: new THREE.Color(0x5a4a86) },
  uRimHot: { value: col(basePalette.accents.rimHot).clone() },
  uRimCool: { value: col(basePalette.accents.rimCool).clone() },
  uHazeColor: { value: col(basePalette.atmosphere.haze).clone() },
  uHazeNear: { value: 260 },
  uHazeFar: { value: 620 },
  uTime: { value: 0 },
  uShift: { value: new THREE.Vector3() },
};

export interface CelEnvConfig {
  sunDir: THREE.Vector3;
  /** warm key color × ramp */
  sunTint: number;
  /** cool ambient floor */
  ambient: number;
  hazeNear?: number;
  hazeFar?: number;
}

/**
 * Point the whole world at a game's hero light + palette. Reads rim/haze
 * colors from the palette so the two-tone rim always matches the movie.
 */
export function configureCelEnv(palette: Palette, cfg: CelEnvConfig): void {
  celEnv.uSunDir.value.copy(cfg.sunDir).normalize();
  celEnv.uSunTint.value.set(cfg.sunTint);
  celEnv.uAmbient.value.set(cfg.ambient);
  celEnv.uRimHot.value.set(palette.accents.rimHot);
  celEnv.uRimCool.value.set(palette.accents.rimCool);
  celEnv.uHazeColor.value.set(palette.atmosphere.haze);
  if (cfg.hazeNear !== undefined) celEnv.uHazeNear.value = cfg.hazeNear;
  if (cfg.hazeFar !== undefined) celEnv.uHazeFar.value = cfg.hazeFar;
}

/* ------------------------------------------------------------ ramp tex -- */

/**
 * 4-band quantized diffuse ramp. Bands tuned by eye: deep cool trough /
 * shadow band / lit band / hot crest. NearestFilter = zero interpolation.
 */
export function makeCelRamp(bands: number[] = [0.3, 0.52, 0.76, 1.0]): THREE.DataTexture {
  const data = new Uint8Array(bands.length * 4);
  bands.forEach((b, i) => {
    const v = Math.round(b * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, bands.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The default studio ramp, shared by all cel materials. */
export const RAMP_TEX = makeCelRamp();

/* ------------------------------------------------------- painted matcap -- */

export interface MatcapParams {
  /** vertical gradient stops, top -> bottom (CSS colors) */
  stops: [offset: number, color: string][];
  /** hard glint spot; omit for a soft sheen ball */
  glint?: { x: number; y: number; r: number; color: string };
  size?: number;
}

/**
 * Paint a fake environment sphere on a small canvas: gradient + optional
 * glint, NearestFilter to keep it graphic. Never a real env probe.
 */
export function makePaintedMatcap(params: MatcapParams): THREE.CanvasTexture {
  const s = params.size ?? 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, s);
  for (const [off, color] of params.stops) grad.addColorStop(off, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  if (params.glint) {
    const gl = params.glint;
    const gx = gl.x * s;
    const gy = gl.y * s;
    const gr = gl.r * s;
    const spot = g.createRadialGradient(gx, gy, 2, gx, gy, gr);
    spot.addColorStop(0, gl.color);
    spot.addColorStop(0.55, gl.color.replace(/[\d.]+\)$/, "0.35)"));
    spot.addColorStop(1, gl.color.replace(/[\d.]+\)$/, "0)"));
    g.fillStyle = spot;
    g.fillRect(0, 0, s, s);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/* ---------------------------------------------------------- GLSL chunk -- */

/**
 * The cel lighting chunk — also exported so bespoke game shaders (terrain,
 * water, FX) can light themselves with the exact same recipe.
 */
export const CEL_LIGHT_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunTint;
uniform vec3 uAmbient;
uniform vec3 uRimHot;
uniform vec3 uRimCool;
uniform sampler2D uRamp;
uniform vec3 uHazeColor;
uniform float uHazeNear;
uniform float uHazeFar;
uniform vec3 uShift;

// quantized diffuse — THE core of the look. Nearest sampling = hard bands.
float celRamp(float ndl) {
  return texture2D(uRamp, vec2(clamp(ndl * 0.5 + 0.5, 0.0, 1.0), 0.5)).r;
}

vec3 celLight(vec3 base, vec3 N, vec3 V, float specBand, float specPow, float rimAmt) {
  float ndl = dot(N, uSunDir);
  float ramp = celRamp(ndl);

  // warm key quantized + cool ambient floor -> banded two-temperature read
  vec3 light = uAmbient + uSunTint * ramp;
  vec3 c = base * light;

  // banded specular: hard-edged graphic highlight shapes
  if (specBand > 0.0) {
    vec3 H = normalize(uSunDir + V);
    float s = pow(clamp(dot(N, H), 0.0, 1.0), specPow);
    c += uSunTint * step(0.5, s) * specBand;
  }

  // two-tone fresnel rim: hot on the key side, cool in shadow
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  vec3 rimCol = mix(uRimCool, uRimHot, step(-0.15, ndl));
  c += rimCol * fres * rimAmt;

  return c;
}

// quantized haze into the horizon — stepped bands, never fog soup
vec3 applyHaze(vec3 c, float viewDist) {
  float f = smoothstep(uHazeNear, uHazeFar, viewDist);
  f = floor(f * 5.0 + 0.5) / 5.0;
  return mix(c, uHazeColor, f * 0.8);
}

// view distance in LOGICAL coords (origin recentering safe)
float logicalDist(vec3 worldPos) {
  return distance(cameraPosition + uShift, worldPos);
}
`;

/** Uniforms wiring a material into the shared environment. */
export function celEnvUniforms(): Record<string, THREE.IUniform> {
  return {
    uSunDir: celEnv.uSunDir,
    uSunTint: celEnv.uSunTint,
    uAmbient: celEnv.uAmbient,
    uRimHot: celEnv.uRimHot,
    uRimCool: celEnv.uRimCool,
    uRamp: { value: RAMP_TEX },
    uHazeColor: celEnv.uHazeColor,
    uHazeNear: celEnv.uHazeNear,
    uHazeFar: celEnv.uHazeFar,
    uShift: celEnv.uShift,
  };
}

/* --------------------------------------------------- cel ShaderMaterial -- */

export interface CelOptions {
  color: number;
  /** flat self-glow (gates, racing bits, UI-ish props) */
  emissive?: number;
  emissiveStrength?: number;
  /** 0 = matte plastic, ~1 = glossy graphic highlight shapes */
  specBand?: number;
  specPow?: number;
  /** fresnel rim amount */
  rim?: number;
  /** 0..1 painted-matcap mix for fake metal */
  matcap?: number;
  matcapTex?: THREE.Texture;
  doubleSided?: boolean;
}

export function makeCelMaterial(o: CelOptions): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    uColor: { value: col(o.color).clone() },
    uEmissive: { value: col(o.emissive ?? 0x000000).clone() },
    uEmissiveStr: { value: o.emissiveStrength ?? 0 },
    uSpecBand: { value: o.specBand ?? 0 },
    uSpecPow: { value: o.specPow ?? 42 },
    uRim: { value: o.rim ?? 0.55 },
    uMatcap: { value: o.matcap ?? 0 },
    uMatcapTex: { value: o.matcapTex ?? null },
    ...celEnvUniforms(),
  };

  return new THREE.ShaderMaterial({
    uniforms,
    side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      uniform vec3 uColor;
      uniform vec3 uEmissive;
      uniform float uEmissiveStr;
      uniform float uSpecBand;
      uniform float uSpecPow;
      uniform float uRim;
      uniform float uMatcap;
      uniform sampler2D uMatcapTex;
      ${CEL_LIGHT_GLSL}
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 c = celLight(uColor, N, V, uSpecBand, uSpecPow, uRim);

        // painted reflection for metal/plastic sheen — never a probe
        if (uMatcap > 0.0) {
          vec3 nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
          vec2 muv = nv.xy * 0.49 + 0.5;
          vec3 mc = texture2D(uMatcapTex, muv).rgb;
          float mband = step(0.55, dot(N, uSunDir)) * 0.5 + 0.25;
          c = mix(c, c * mc * 1.6, uMatcap * mband);
        }

        c += uEmissive * uEmissiveStr;
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------- outlines -- */

export const DEFAULT_OUTLINE_WIDTH_PX = 2.4;

const outlineVert = /* glsl */ `
  uniform float uWidthPx;
  uniform float uPixScale;   // world units per pixel at unit view distance
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    // constant SCREEN-SPACE width: push scales linearly with view distance
    mv.xyz += n * (uWidthPx * uPixScale * max(0.5, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const outlineFrag = /* glsl */ `
  uniform vec3 uInk;
  void main() { gl_FragColor = vec4(uInk, 1.0); }
`;

/**
 * Global pixel-scale uniform shared by all outline materials. The frame
 * loop refreshes it once per frame via `updateOutlinePixScale`.
 */
export const outlinePixScale = { value: 0.0016 };

/** World-units-per-pixel at unit distance, for the current camera + buffer. */
export function updateOutlinePixScale(
  camera: THREE.PerspectiveCamera,
  bufferHeightPx: number,
): void {
  outlinePixScale.value =
    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) / bufferHeightPx;
}

// smoothed-geometry cache: hard-edged geometry (boxes) needs merged verts
// so the extruded shell doesn't split apart at the faces
const smoothCache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
function smoothed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = smoothCache.get(geo);
  if (g) return g;
  g = mergeVertices(geo, 1e-4);
  g.computeVertexNormals();
  smoothCache.set(geo, g);
  return g;
}

const matCache = new Map<string, THREE.ShaderMaterial>();
function outlineMaterial(widthPx: number, ink: THREE.Color): THREE.ShaderMaterial {
  const key = `${widthPx}_${ink.getHexString()}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: {
        uWidthPx: { value: widthPx },
        uPixScale: outlinePixScale,
        uInk: { value: ink.clone() },
      },
      vertexShader: outlineVert,
      fragmentShader: outlineFrag,
      side: THREE.BackSide,
    });
    matCache.set(key, m);
  }
  return m;
}

/**
 * Back-face-extrusion ink. Adds an ink shell as a child of every mesh under
 * `root`, so shells inherit rig animation for free. Thin and selective —
 * interior lines are the post pass's job, so keep widths small.
 */
export function addOutline(
  root: THREE.Object3D,
  widthPx = DEFAULT_OUTLINE_WIDTH_PX,
  ink: THREE.Color = col(basePalette.ink.line),
): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    if ((mesh.material as THREE.ShaderMaterial)?.userData?.isOutline) continue;
    const mat = outlineMaterial(widthPx, ink);
    mat.userData.isOutline = true;
    const shell = new THREE.Mesh(smoothed(mesh.geometry), mat);
    shell.frustumCulled = mesh.frustumCulled;
    mesh.add(shell); // identity transform — rides the mesh exactly
  }
}
