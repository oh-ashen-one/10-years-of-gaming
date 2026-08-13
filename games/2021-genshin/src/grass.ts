/**
 * grass.ts — the luminous wind-waved meadow. Thousands of instanced
 * blades with a QUANTIZED vertex-shader sway (stepped, never smooth),
 * two-tone so the waves read as light rolling through the field.
 * Blades part around nothing — this is the signature surface, kept cheap.
 */
import * as THREE from "three";
import { celEnv, col, hash1 } from "@tenyears/core";
import { PAL } from "./palette";
import { heightAt, WORLD, CAMP, CLIFF, ARENA } from "./meadow";

const BLADES = 9000;

export function buildGrass(world: THREE.Group): void {
  const geo = new THREE.PlaneGeometry(0.7, 1.5, 1, 2);
  geo.translate(0, 0.75, 0);

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: celEnv.uTime,
      uA: { value: col(PAL.terrain.lit).clone() },
      uB: { value: col(PAL.terrain.litHot).clone() },
      uC: { value: col(PAL.terrain.mid).clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vBand;
      varying float vShade;
      void main() {
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        // quantized wind: the wave steps through the field in bands
        float wave = sin(wp.x * 0.08 + wp.z * 0.05 + uTime * 1.6);
        wave = floor(wave * 3.0 + 0.5) / 3.0;
        float bend = wave * 0.55 * position.y; // tips move, roots stay
        wp.x += bend;
        wp.z += bend * 0.4;
        vBand = wave * 0.5 + 0.5;
        vShade = position.y / 1.5;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vBand;
      varying float vShade;
      uniform vec3 uA;
      uniform vec3 uB;
      uniform vec3 uC;
      void main() {
        // two-tone wave bands, darker roots
        vec3 c = mix(uA, uB, step(0.5, vBand));
        c = mix(uC, c, 0.35 + vShade * 0.65);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, BLADES);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < BLADES; i++) {
    const x = (hash1(i * 3.17) - 0.5) * WORLD * 0.92;
    const z = (hash1(i * 7.71) - 0.5) * WORLD * 0.92;
    // keep blades out of the camp floor, cliff top, and arena
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r) continue;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r) continue;
    if (Math.abs(x - CLIFF.x) < CLIFF.w / 2 + 4 && z > CLIFF.z - 6 && z < CLIFF.z + 28) continue;
    const y = heightAt(x, z);
    const sc = 0.75 + hash1(i * 11.3) * 0.6;
    e.set(0, hash1(i * 13.7) * Math.PI, 0);
    q.setFromEuler(e);
    v.set(x, y, z);
    s.set(sc, sc, sc);
    m.compose(v, q, s);
    mesh.setMatrixAt(n, m);
    n++;
  }
  mesh.count = n;
  mesh.frustumCulled = false;
  world.add(mesh);
}
