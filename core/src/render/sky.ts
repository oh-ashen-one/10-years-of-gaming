/**
 * sky.ts — the sky is a painting, never a clear color.
 *
 * A BackSide dome pinned to the far plane that follows the camera XZ:
 *  - Hard cel band ladder by elevation — colors come from the game's
 *    palette (`palette.sky.ladder`), never hardcoded here.
 *  - One graphic hero light: hard disc + stepped glow rings + optional
 *    chunky rotating rays. Per game this is a sun, a moon, an Erdtree
 *    glow, a spaceship streak — same machine, different movie.
 *  - Flat cel clouds: azimuth folded through cos/sin so the fbm field is
 *    periodic (no seam at the atan wrap), stepped bodies, hot underlit
 *    rims weighted toward the hero light.
 *  - 2–3 silhouette depth rings around the horizon (mesas, city blocks,
 *    ship ribs, castle spires): quantized-fbm by default, with an
 *    injectable `shape(angle)` so each game draws its own skyline; colors
 *    lerped toward the haze by depth.
 */
import * as THREE from "three";
import { fbm, NOISE_GLSL as NOISE_GLSL_LOCAL } from "../world/noise";
import { col, type Palette } from "../world/palette";

/* ------------------------------------------------------------ parameters -- */

export interface HeroRays {
  /** number of ray spokes around the disc */
  count?: number;
  /** rotation speed (rad/s, slow) */
  speed?: number;
  /** intensity 0..1 */
  amount?: number;
}

export interface SilhouetteRingParams {
  radius: number;
  /** ground line of the ring (world y at the horizon) */
  baseY: number;
  maxH: number;
  color: number;
  /** 0..1 lerp of `color` toward the haze color */
  hazeMix: number;
  seed?: number;
  segments?: number;
  /** how far the ring skirt hangs below baseY */
  skirt?: number;
  /**
   * Injectable skyline shape: azimuth (radians) -> 0..1 height factor.
   * Default: quantized fbm mesas. Per game, never reused shapes.
   */
  shape?: (angle: number) => number;
}

export interface SkyParams {
  palette: Palette;
  /** direction TOWARD the hero light (matches celEnv.uSunDir) */
  sunDir: THREE.Vector3;
  /** dome radius — keep near the camera far plane */
  radius?: number;
  /** hero-light rays; omit/false for a clean disc + glow */
  rays?: HeroRays | false;
  /** cel clouds; pass false for a cloudless sky */
  clouds?: boolean;
  /** silhouette depth rings, far -> near */
  silhouettes?: SilhouetteRingParams[];
}

export interface SkyRig {
  group: THREE.Group;
  /** direction toward the hero light (normalized, shared with celEnv) */
  sunDir: THREE.Vector3;
  update(time: number, camPos: THREE.Vector3): void;
}

/* ------------------------------------------------------------- dome ---- */

function domeMaterial(p: SkyParams): THREE.ShaderMaterial {
  const pal = p.palette.sky;
  const ladder = pal.ladder;
  const rays = p.rays === false || p.rays === undefined ? null : p.rays;
  const clouds = p.clouds !== false;

  // The band ladder is generated from the palette stops: colors ride in a
  // uniform array, thresholds are baked into the source as literals.
  const ladderGLSL = [
    `vec3 c = uLadder[0];`,
    ...ladder
      .slice(1)
      .map((s, i) => `c = mix(c, uLadder[${i + 1}], step(${s.at.toFixed(4)}, y));`),
  ].join("\n        ");

  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uSunDir: { value: p.sunDir.clone().normalize() },
      uTime: { value: 0 },
      uLadder: { value: ladder.map((s) => col(s.color).clone()) },
      uAbyss: { value: col(pal.abyss).clone() },
      uSunCore: { value: col(pal.sunCore).clone() },
      uSunDisc: { value: col(pal.sunDisc).clone() },
      uSunGlow: { value: col(pal.sunGlow).clone() },
      uCloudTop: { value: col(pal.cloudTop).clone() },
      uCloudRim: { value: col(pal.cloudRim).clone() },
      uRayCount: { value: rays?.count ?? 7 },
      uRaySpeed: { value: rays?.speed ?? 0.05 },
      uRayAmount: { value: rays?.amount ?? 0.3 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999; // pin to the far plane
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform vec3 uLadder[${ladder.length}];
      uniform vec3 uAbyss, uSunCore, uSunDisc, uSunGlow, uCloudTop, uCloudRim;
      uniform float uRayCount, uRaySpeed, uRayAmount;
      ${NOISE_GLSL_LOCAL}

      // hard cel band ladder by elevation
      vec3 skyLadder(float y) {
        ${ladderGLSL}
        return c;
      }

      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = skyLadder(y);

        // --- hero light: stepped glow hugging the disc
        float cosA = dot(d, uSunDir);
        c += uSunGlow * step(0.945, cosA) * 0.10;   // outer glow
        c += uSunGlow * step(0.975, cosA) * 0.16;   // inner glow
        ${rays ? /* glsl */ `
        // chunky rays — short spokes just outside the disc, slowly rotating
        vec3 t1 = normalize(cross(uSunDir, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(uSunDir, t1);
        float ang = atan(dot(d, t2), dot(d, t1));
        float ray = step(0.55, sin(ang * uRayCount + uTime * uRaySpeed));
        float rayMask = smoothstep(0.962, 0.975, cosA) * (1.0 - smoothstep(0.981, 0.9855, cosA));
        c += uSunDisc * ray * rayMask * uRayAmount;
        ` : ""}
        // the light itself: hard disc + hot core
        float disc = step(0.9855, cosA);
        float core = step(0.9925, cosA);
        c = mix(c, uSunDisc, disc);
        c = mix(c, uSunCore, core);

        ${clouds ? /* glsl */ `
        // --- flat cel clouds: periodic-azimuth fbm, stepped bodies,
        //     hot underlit rims weighted toward the hero light
        if (y > 0.02) {
          float az0 = atan(d.z, d.x);
          for (int i = 0; i < 2; i++) {
            float fi = float(i);
            float speed = 0.006 + fi * 0.004;
            float az = az0 + uTime * speed * (1.0 + fi);
            float r = 2.0 + fi * 1.5;
            vec2 pp = vec2(cos(az), sin(az)) * r
                    + vec2(y * (7.0 - fi * 2.5), y * 3.0);
            float n = g_fbm(pp + fi * 17.3, 4);
            // squash into elevation bands so clouds sit as flat shelves
            float band = smoothstep(0.05 + fi * 0.08, 0.12 + fi * 0.08, y)
                       * (1.0 - smoothstep(0.30 + fi * 0.06, 0.40 + fi * 0.06, y));
            n = n * (0.55 + 0.45 * band);
            float body = step(0.585, n) * band;
            // hot rim ONLY along the underside edge (body above this pixel)
            vec2 pUp = vec2(cos(az), sin(az)) * r
                     + vec2((y + 0.035) * (7.0 - fi * 2.5), (y + 0.035) * 3.0);
            float nUp = g_fbm(pUp + fi * 17.3, 4) * (0.55 + 0.45 * band);
            float rim = step(0.545, n) * (1.0 - step(0.585, n))
                      * step(0.585, nUp) * band;
            float sunSide = clamp(dot(normalize(vec3(d.x, 0.0, d.z)),
                                      normalize(vec3(uSunDir.x, 0.0, uSunDir.z))) * 0.5 + 0.5, 0.0, 1.0);
            c = mix(c, uCloudRim, rim * (0.30 + 0.55 * sunSide));
            c = mix(c, uCloudTop, body * 0.88);
          }
        }
        ` : ""}

        // below-horizon: fall into the abyss band
        c = mix(c, uAbyss, step(y, -0.06) * 0.85);

        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/* ---------------------------------------------------- silhouette rings -- */

function silhouetteRing(params: SilhouetteRingParams, haze: THREE.Color): THREE.Mesh {
  const {
    radius, baseY, maxH, color, hazeMix,
    seed = 11.3, segments = 260, skirt = 60, shape,
  } = params;
  // default skyline: quantized fbm mesas — graphic, not smooth hills
  const shapeFn =
    shape ??
    ((a: number) => {
      const n = fbm(Math.cos(a) * 2.4 + seed, Math.sin(a) * 2.4 - seed, 4);
      return Math.floor(n * 6) / 6 * 0.78 + 0.22;
    });

  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const h = baseY + shapeFn(a) * maxH;
    pos.push(x, baseY - skirt, z, x, h, z);
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ringColor = col(color).clone().lerp(haze, hazeMix);
  const mat = new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* -------------------------------------------------------------- rig ---- */

export function buildSky(scene: THREE.Scene, params: SkyParams): SkyRig {
  const radius = params.radius ?? 3200;
  const sunDir = params.sunDir.clone().normalize();
  const group = new THREE.Group();
  group.renderOrder = -100;

  const domeMat = domeMaterial(params);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  group.add(dome);

  // silhouette depth planes, far -> near, hazed toward the horizon
  const haze = col(params.palette.atmosphere.haze);
  for (const ring of params.silhouettes ?? []) {
    group.add(silhouetteRing(ring, haze));
  }

  scene.add(group);

  return {
    group,
    sunDir,
    update(time, camPos) {
      domeMat.uniforms.uTime.value = time;
      group.position.set(camPos.x, 0, camPos.z); // the sky rides the camera XZ
    },
  };
}
