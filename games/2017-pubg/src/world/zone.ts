/**
 * zone.ts — the blue zone. A glowing quantized grid wall (the current
 * danger edge, lerping toward each new circle) plus a flat white ring on
 * the ground marking the next safe zone. The wall is a cylinder shell
 * with a stepped scanline shader — energy, never fog.
 */
import * as THREE from "three";
import { celEnv, col } from "@tenyears/core";
import { PAL } from "../palette";

export class ZoneFX {
  wall: THREE.Mesh;
  nextRing: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(world: THREE.Group) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: celEnv.uTime,
        uBlue: { value: col(PAL.extra.zoneBlue).clone() },
        uDeep: { value: col(PAL.extra.zoneDeep).clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uBlue;
        uniform vec3 uDeep;
        void main() {
          // quantized grid: hard cells, scrolling upward, pulsing
          vec2 g = fract(vec2(vUv.x * 160.0, vUv.y * 26.0 - uTime * 0.35));
          float line = step(0.82, max(g.x, g.y));
          float cell = 0.22 + 0.18 * step(0.5, fract(g.x * 0.5 + g.y * 0.5));
          float pulse = 0.85 + 0.15 * sin(uTime * 2.2);
          float edgeFade = smoothstep(1.0, 0.55, vUv.y); // fade near the top
          vec3 c = mix(uDeep, uBlue, line) * pulse;
          float a = (line * 0.75 + cell) * edgeFade;
          gl_FragColor = vec4(c, a * 0.62);
        }
      `,
    });
    // unit cylinder, scaled per frame to the wall radius
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    this.wall = new THREE.Mesh(geo, this.mat);
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 10;
    world.add(this.wall);

    this.nextRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1.0, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.nextRing.renderOrder = 9;
    world.add(this.nextRing);
  }

  update(wall: { cx: number; cz: number; r: number }, target: { cx: number; cz: number; r: number }, stage: number): void {
    const H = 220;
    this.wall.visible = stage > 0;
    this.wall.position.set(wall.cx, H / 2 - 10, wall.cz);
    this.wall.scale.set(wall.r, H, wall.r);
    this.nextRing.visible = stage > 0;
    this.nextRing.position.set(target.cx, 0.4, target.cz);
    this.nextRing.scale.setScalar(target.r);
  }
}
