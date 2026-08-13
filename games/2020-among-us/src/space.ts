/**
 * space.ts — outside the hull: a near-black dome, drifting stars, one
 * big banded planet. The title camera floats out here; windows and the
 * eject beat peek at it. Also the eject drift: the ejected bean tumbling
 * away into the black.
 */
import * as THREE from "three";
import { makeCelMaterial, col, hash1 } from "@tenyears/core";
import { PAL, CREW_COLORS } from "./palette";
import { buildBean } from "./beans";

export interface SpaceRig {
  group: THREE.Group;
  update(time: number, camPos: THREE.Vector3): void;
}

export function buildSpace(scene: THREE.Scene): SpaceRig {
  const group = new THREE.Group();
  group.renderOrder = -100;

  // the void dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x05060e, side: THREE.BackSide, fog: false }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  group.add(dome);

  // stars: two depths of hard square points
  for (const [count, size, bright] of [[700, 1.6, 0.9], [300, 2.6, 1.0]] as const) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = hash1(i * 3.17) * Math.PI * 2;
      const b = Math.acos(hash1(i * 7.71) * 2 - 1);
      const r = 800;
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: new THREE.Color(bright, bright, bright), size, sizeAttenuation: false, fog: false }),
    );
    pts.frustumCulled = false;
    group.add(pts);
  }

  // the banded planet, lower-east
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 20),
    makeCelMaterial({ color: 0x3a68c8, specBand: 0.3, rim: 0.6 }),
  );
  planet.position.set(300, -160, 420);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(170, 14, 8, 40),
    makeCelMaterial({ color: 0x8a94c8, rim: 0.3 }),
  );
  ring.rotation.x = Math.PI / 2.4;
  ring.position.copy(planet.position);
  group.add(planet, ring);

  scene.add(group);
  return {
    group,
    update(time, camPos) {
      group.position.set(camPos.x, 0, camPos.z);
      group.rotation.y = time * 0.002; // the stars barely wheel
    },
  };
}

/** the eject drift: a bean tumbling into the void (airlock shot) */
export class EjectDrift {
  group = new THREE.Group();
  private t = -1;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  fire(colorIdx: number, from: THREE.Vector3): void {
    this.group.clear();
    const rig = buildBean(CREW_COLORS[colorIdx % CREW_COLORS.length].hex);
    rig.group.rotation.z = 0.6;
    this.group.add(rig.group);
    this.group.position.copy(from);
    this.t = 0;
    this.group.visible = true;
  }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    this.group.position.y += dt * (1.5 + this.t * 0.8);
    this.group.position.z += dt * 2.2;
    this.group.rotation.z += dt * 0.7;
    this.group.rotation.x += dt * 0.3;
    if (this.t > 5) {
      this.t = -1;
      this.group.visible = false;
    }
  }
}

// crew colors come from the palette (CREW_COLORS)
