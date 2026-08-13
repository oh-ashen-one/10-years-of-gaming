/**
 * sky.ts — the blocky sky. The studio sky recipe, voxel-flavored: band
 * ladder by elevation, a SQUARE sun by day and a square moon by night
 * (the hero light), blocky cloud slabs drifting, block-step mountain
 * silhouette rings. Day/night is one uniform, uDayF, lerping the whole
 * painting between the noon and indigo palettes.
 */
import * as THREE from "three";
import { col, fbm, hash1 } from "@tenyears/core";
import { PAL } from "./palette";

const SUN_DIR = new THREE.Vector3(0.5, 0.62, 0.35).normalize();
const MOON_DIR = SUN_DIR.clone().negate();

function domeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uDayF: { value: 1 },
      uSunDir: { value: SUN_DIR },
      uMoonDir: { value: MOON_DIR },
      uSun: { value: col(PAL.sky.sunCore).clone() },
      uMoon: { value: col(PAL.extra.moon).clone() },
      // day ladder, low → high
      uDayA: { value: col(0xffe0a8).clone() },
      uDayB: { value: col(0x87ceeb).clone() },
      uDayC: { value: col(0x4a90d8).clone() },
      // night ladder
      uNightA: { value: col(0x2a3468).clone() },
      uNightB: { value: col(PAL.extra.night0).clone() },
      uNightC: { value: col(0x0e1230).clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uDayF;
      uniform vec3 uSunDir, uMoonDir;
      uniform vec3 uSun, uMoon;
      uniform vec3 uDayA, uDayB, uDayC, uNightA, uNightB, uNightC;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        return fract(sin(dot(p, vec2(1.0, 1.0))) * 43758.5453);
      }

      // square hero light: step on the CHEBYSHEV distance in tangent space
      float squareLight(vec3 d, vec3 dir, float size) {
        vec3 t1 = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(dir, t1);
        float cosA = dot(d, dir);
        if (cosA < 0.9) return 0.0;
        float s = sqrt(1.0 - cosA * cosA) / max(0.0001, cosA); // tan of angle
        vec2 uv = vec2(dot(d, t1), dot(d, t2)) / max(0.0001, cosA);
        uv /= size;
        return step(max(abs(uv.x), abs(uv.y)), 1.0) * step(0.9, cosA);
      }

      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;

        // band ladders, day and night
        vec3 day = uDayA;
        day = mix(day, uDayB, step(0.02, y));
        day = mix(day, uDayC, step(0.3, y));
        vec3 night = uNightA;
        night = mix(night, uNightB, step(0.02, y));
        night = mix(night, uNightC, step(0.3, y));
        vec3 c = mix(night, day, uDayF);

        // stars at night: hard sparkle grid
        if (uDayF < 0.5 && y > 0.05) {
          vec2 sp = floor(d.xz / max(0.08, d.y) * 24.0);
          float star = step(0.985, hash21(sp));
          c += vec3(0.9, 0.95, 1.0) * star * (0.5 - uDayF) * 1.6;
        }

        // square sun / square moon
        float sun = squareLight(d, uSunDir, 0.055);
        float moon = squareLight(d, uMoonDir, 0.04);
        c = mix(c, uSun, sun * smoothstep(0.05, 0.5, uDayF));
        c = mix(c, uMoon, moon * smoothstep(0.5, 0.05, uDayF));

        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/* ------------------------------------------- blocky mountain silhouettes -- */

function mountainRing(radius: number, maxH: number, color: THREE.Color, seed: number, segments: number): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const n = fbm(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2 - seed, 4);
    const h = Math.floor(n * 5) / 5 * maxH + maxH * 0.25; // block-step tops
    pos.push(x, -30, z, x, h, z);
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ rig -- */

export interface VoxelSkyRig {
  group: THREE.Group;
  sunDir: THREE.Vector3;
  update(time: number, camPos: THREE.Vector3, dayF: number): void;
}

export function buildVoxelSky(scene: THREE.Scene): VoxelSkyRig {
  const group = new THREE.Group();
  group.renderOrder = -100;

  const domeMat = domeMaterial();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 40, 24), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  group.add(dome);

  // blocky mountain rings, tinted per frame by the day factor
  const ringDay = [
    col(PAL.atmosphere.silhouetteFar).clone(),
    col(PAL.atmosphere.silhouetteMid).clone(),
    col(PAL.atmosphere.silhouetteNear).clone(),
  ];
  const ringNight = [
    new THREE.Color(0x1a2044),
    new THREE.Color(0x161a3a),
    new THREE.Color(0x121630),
  ];
  const rings = [
    mountainRing(1450, 120, ringDay[0], 11.3, 260),
    mountainRing(1360, 80, ringDay[1], 47.9, 240),
    mountainRing(1280, 50, ringDay[2], 92.4, 220),
  ];
  for (const r of rings) group.add(r);

  // blocky cloud slabs
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cloudMat, 40);
  clouds.frustumCulled = false;
  const cloudData: { x: number; y: number; z: number; w: number; d: number; spd: number }[] = [];
  for (let i = 0; i < 40; i++) {
    cloudData.push({
      x: (hash1(i * 3.3) - 0.5) * 900,
      y: 85 + hash1(i * 5.7) * 30,
      z: (hash1(i * 7.1) - 0.5) * 900,
      w: 20 + hash1(i * 11.3) * 45,
      d: 14 + hash1(i * 13.7) * 30,
      spd: 1.2 + hash1(i * 17.9) * 1.4,
    });
  }
  group.add(clouds);
  const m4 = new THREE.Matrix4();

  scene.add(group);
  const cloudDay = new THREE.Color(0xffffff);
  const cloudNight = new THREE.Color(0x2a3468);

  return {
    group,
    sunDir: SUN_DIR,
    update(time, camPos, dayF) {
      domeMat.uniforms.uDayF.value = dayF;
      group.position.set(camPos.x, 0, camPos.z);
      rings.forEach((r, i) => {
        (r.material as THREE.MeshBasicMaterial).color
          .copy(ringNight[i])
          .lerp(ringDay[i], dayF);
      });
      cloudMat.color.copy(cloudNight).lerp(cloudDay, dayF);
      for (let i = 0; i < cloudData.length; i++) {
        const c = cloudData[i];
        let x = c.x + time * c.spd;
        x = ((x + 450) % 900) - 450;
        m4.makeScale(c.w, 3.2, c.d);
        m4.setPosition(x, c.y, c.z);
        clouds.setMatrixAt(i, m4);
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
  };
}
