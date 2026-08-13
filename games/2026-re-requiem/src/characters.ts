/**
 * characters.ts — the ward's residents. The shamblers: patient-gown grey,
 * arms dangling, the drag-step shamble, the wind-up lunge, the headshot
 * stagger. THE PURSUER: 2.8m of long dark coat and a pale face — it does
 * not run, it ARRIVES; the bullet stagger; the arm that ends in the
 * elevator doors. Horror poses read as silhouettes first (art lock).
 */
import * as THREE from "three";
import { makeCelMaterial, makePaintedMatcap, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

const INK = () => col(PAL.ink.line);

const matcap = { current: null as THREE.CanvasTexture | null };
function paleMatcap(): THREE.CanvasTexture {
  if (!matcap.current) {
    matcap.current = makePaintedMatcap({
      stops: [
        [0.0, "#d8d8d0"],
        [0.4, "#8a8a80"],
        [0.7, "#3a3a38"],
        [1.0, "#101012"],
      ],
      glint: { x: 0.3, y: 0.25, r: 0.14, color: "rgba(216,232,216,0.9)" },
    });
  }
  return matcap.current;
}

/* -------------------------------------------------------------- shambler -- */

export interface FoeRig {
  group: THREE.Group;
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildShambler(seed: number): FoeRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mGown = makeCelMaterial({ color: e.gown, rim: 0.55 });
  const mSkin = makeCelMaterial({ color: e.skin, matcap: 0.35, matcapTex: paleMatcap(), rim: 0.45 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 6, 10), mGown);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mSkin);
  head.position.set(0, 1.72, 0.06);
  head.rotation.x = 0.4; // the sag
  g.add(head);
  // gown stains (banded ink-red)
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), new THREE.MeshBasicMaterial({ color: PAL.extra.blood }));
  stain.position.set(0.1, 1.0, 0.31);
  g.add(stain);

  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.55, 4, 8), mSkin);
    arm.position.set(s * 0.38, 1.05, 0.08);
    arm.rotation.x = 0.5; // the dangle-forward
    g.add(arm);
    arms.push(arm);
  }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), mGown);
    leg.position.set(s * 0.14, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  addOutline(g, 1.7, INK());

  return {
    group: g,
    update(_dt, time, state, stateT) {
      g.rotation.x = 0.12; // the permanent hunch
      g.rotation.z = 0;
      g.position.y = 0;
      arms[0].rotation.x = 0.5;
      arms[1].rotation.x = 0.55;
      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      switch (state) {
        case "shamble": {
          // the drag-step: one leg works, one is dragged
          const st = Math.sin(time * 3.4 + seed);
          legs[0].rotation.x = st * 0.6;
          g.position.y = Math.abs(st) * 0.04;
          g.rotation.z = st * 0.08;
          arms[0].rotation.x = 0.5 + st * 0.15;
          break;
        }
        case "windup": // the rear-back before the lunge
          g.rotation.x = -0.3 - stateT * 0.4;
          arms[0].rotation.x = -1.6;
          arms[1].rotation.x = -1.6;
          break;
        case "lunge":
          g.rotation.x = 0.55;
          arms[0].rotation.x = -1.9;
          arms[1].rotation.x = -1.7;
          break;
        case "stagger": // the headshot rock-back
          g.rotation.x = -0.45;
          g.rotation.z = Math.sin(time * 9) * 0.1;
          break;
        case "dead":
          g.rotation.x = Math.PI / 2.05; // face-down
          g.position.y = -0.55;
          break;
        default:
          g.position.y = Math.sin(time * 1.3 + seed) * 0.015;
      }
    },
  };
}

/* --------------------------------------------------------------- pursuer -- */

export interface PursuerRig {
  group: THREE.Group;
  armR: THREE.Group; // the long right arm — the door finale's star
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildPursuer(): PursuerRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mCoat = makeCelMaterial({ color: e.pursuer, rim: 0.6 });
  const mPale = makeCelMaterial({ color: e.pursuerSkin, matcap: 0.4, matcapTex: paleMatcap(), rim: 0.5 });

  // the column of the coat
  const coat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 8), mCoat);
  coat.position.y = 1.3;
  g.add(coat);
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 6, 10), mCoat);
  shoulders.position.y = 2.5;
  g.add(shoulders);
  // the pale face — no features but the ink slash eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mPale);
  head.position.y = 3.1;
  g.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0x0a0a0c }));
    eye.position.set(s * 0.09, 3.12, 0.24);
    g.add(eye);
  }
  // long arms
  const armL = new THREE.Group();
  const upperL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.8, 4, 8), mCoat);
  upperL.position.y = -0.45;
  armL.add(upperL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mPale);
  handL.position.y = -1.0;
  armL.add(handL);
  armL.position.set(-0.62, 2.6, 0);
  g.add(armL);

  const armR = new THREE.Group();
  const upperR = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.8, 4, 8), mCoat);
  upperR.position.y = -0.45;
  armR.add(upperR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mPale);
  handR.position.y = -1.05;
  armR.add(handR);
  for (let i = 0; i < 3; i++) {
    const finger = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), mPale);
    finger.position.set((i - 1) * 0.08, -1.25, 0.02);
    finger.rotation.x = Math.PI;
    armR.add(finger);
  }
  armR.position.set(0.62, 2.6, 0);
  g.add(armR);

  addOutline(g, 2.4, INK());

  return {
    group: g,
    armR,
    update(_dt, time, state, stateT) {
      g.rotation.x = 0;
      g.position.y = 0;
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      head.position.y = 3.1;
      switch (state) {
        case "patrol": { // the slow inevitable stride
          const st = Math.sin(time * 2.2);
          g.position.y = Math.abs(st) * 0.05;
          armL.rotation.x = st * 0.2;
          armR.rotation.x = -st * 0.2;
          break;
        }
        case "investigate": // head tilted, listening
          head.rotation.z = 0.3;
          g.position.y = Math.abs(Math.sin(time * 3.4)) * 0.06;
          break;
        case "chase": // it does not run — it leans and ARRIVES
          g.rotation.x = 0.22;
          g.position.y = Math.abs(Math.sin(time * 5.2)) * 0.09;
          armL.rotation.x = -0.6;
          armR.rotation.x = -0.9;
          break;
        case "stagger": // the bullet pause — rocked, not beaten
          g.rotation.x = -0.3;
          head.position.y = 3.2;
          break;
        default: // asleep: a coat statue in the dark
          head.position.y = 2.95;
          head.rotation.x = 0.3;
      }
      void stateT;
    },
  };
}
