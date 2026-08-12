/**
 * terrain.ts — the island ground. Vertex heights are BAKED from
 * island.heightAt (one spatial truth: physics walks the same numbers),
 * vertex colors from island.surfaceAt (wheat / olive grass / compound
 * dirt / beach sand), lit by the shared cel chunk so the ground obeys the
 * same two-temperature bands and stepped haze as everything else.
 * The sea is a separate flat disc with quantized glitter bands.
 */
import * as THREE from "three";
import { celEnvUniforms, CEL_LIGHT_GLSL, NOISE_GLSL, celEnv, col, fbm } from "@tenyears/core";
import { PAL } from "../palette";
import { heightAt, surfaceAt, WORLD_SIZE } from "../island";

const SEGS = 200;

export function buildTerrain(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cWheat = col(PAL.extra.wheat);
  const cWheatDark = col(PAL.extra.wheatDark);
  const cGrass = col(PAL.terrain.mid);
  const cGrass2 = col(0x7a8a52);
  const cDirt = col(PAL.extra.dirt);
  const cSand = col(PAL.extra.sand);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const s = surfaceAt(x, z);
    let c: THREE.Color;
    if (s === "wheat") {
      c = tmp.copy(cWheat).lerp(cWheatDark, ((x * 7 + z * 13) % 10) / 10 > 0.5 ? 0.5 : 0).clone();
    } else if (s === "grass") {
      const n = fbm(x * 0.02, z * 0.02, 2);
      c = tmp.copy(cGrass).lerp(cGrass2, n > 0.5 ? 0.6 : 0.1).clone();
    } else if (s === "dirt") {
      c = cDirt;
    } else if (s === "sand") {
      c = cSand;
    } else {
      c = cSand; // seabed — underwater anyway
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...celEnvUniforms() },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vC;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vC = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vC;
      ${CEL_LIGHT_GLSL}
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 c = celLight(vC, N, V, 0.0, 42.0, 0.28);
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  world.add(mesh);

  // the sea — flat disc, quantized glitter bands drifting
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(2400, 48).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: celEnv.uTime,
        ...celEnvUniforms(),
        uA: { value: col(PAL.extra.water).clone() },
        uB: { value: col(PAL.extra.waterDeep).clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        ${CEL_LIGHT_GLSL}
        ${NOISE_GLSL}
        void main() {
          float n = g_fbm(vW.xz * 0.02 + vec2(uTime * 0.05, 0.0), 3);
          n = floor(n * 4.0 + 0.5) / 4.0;
          vec3 c = mix(uB, uA, n);
          c *= uAmbient * 0.5 + uSunTint * 0.62;
          c = applyHaze(c, logicalDist(vW));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  sea.position.y = -1.4;
  world.add(sea);
}
