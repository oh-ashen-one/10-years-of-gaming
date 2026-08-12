/**
 * terrain.ts — the toy island ground. Heights baked from map.heightAt
 * (one spatial truth), vertex colors from map.surfaceAt (saturated grass,
 * dirt pads, town road cross, beach), cel-lit by the shared chunk.
 * The sea is a flat disc with banded cartoon glitter.
 */
import * as THREE from "three";
import { celEnvUniforms, CEL_LIGHT_GLSL, NOISE_GLSL, celEnv, col, fbm } from "@tenyears/core";
import { PAL } from "../palette";
import { heightAt, surfaceAt, WORLD_SIZE } from "../map";

const SEGS = 190;

export function buildTerrain(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cGrass = col(PAL.terrain.lit);
  const cGrass2 = col(PAL.terrain.mid);
  const cDirt = col(PAL.extra.dirt);
  const cRoad = col(PAL.extra.road);
  const cSand = col(0xf0e0b0);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const s = surfaceAt(x, z);
    let c: THREE.Color;
    if (s === "grass") {
      const n = fbm(x * 0.03, z * 0.03, 2);
      c = tmp.copy(cGrass).lerp(cGrass2, n > 0.5 ? 0.55 : 0).clone();
    } else if (s === "dirt") {
      c = cDirt;
    } else if (s === "road") {
      c = cRoad;
    } else {
      c = cSand;
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
        vec3 c = celLight(vC, N, V, 0.0, 42.0, 0.3);
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
  world.add(new THREE.Mesh(geo, mat));

  // cartoon sea
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(1800, 48).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: celEnv.uTime,
        ...celEnvUniforms(),
        uA: { value: col(0x4fc8e8).clone() },
        uB: { value: col(0x2a98d0).clone() },
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
          float n = g_fbm(vW.xz * 0.03 + vec2(uTime * 0.06, 0.0), 3);
          n = floor(n * 3.0 + 0.5) / 3.0;
          vec3 c = mix(uB, uA, n);
          c *= uAmbient * 0.5 + uSunTint * 0.65;
          c = applyHaze(c, logicalDist(vW));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  sea.position.y = -1.2;
  world.add(sea);
}
