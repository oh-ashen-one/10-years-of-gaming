/**
 * characters.ts — the souls cast. The tarnished (hammered-metal painted
 * matcap armor, cloth cloak), moor soldiers (rusted, hunched), the scarab
 * (gold-shelled skitterer), and the BRIDGE WARDEN: robed, a great staff,
 * and in phase 2 a summoned golden hammer overhead. Poses are behavior:
 * windups READ — slow raises, sideways holds, the slam brace.
 */
import * as THREE from "three";
import { makeCelMaterial, makePaintedMatcap, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

const INK = () => col(PAL.ink.line);
const THIN = 1.6; // thin grim ink

/** hammered-metal matcap for armor (never a real probe) */
const matcap = { current: null as THREE.CanvasTexture | null };
function armorMatcap(): THREE.CanvasTexture {
  if (!matcap.current) {
    matcap.current = makePaintedMatcap({
      stops: [
        [0.0, "#d8d8e8"],
        [0.4, "#8a94a8"],
        [0.7, "#4a5468"],
        [1.0, "#1a2028"],
      ],
      glint: { x: 0.3, y: 0.25, r: 0.16, color: "rgba(255,240,200,0.95)" },
    });
  }
  return matcap.current;
}

export type TarnPose = "idle" | "walk" | "sprint" | "roll" | "light" | "heavy" | "guard" | "parry" | "flask" | "dead" | "rest";

export interface TarnRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number, pose: TarnPose): void;
}

export function buildTarnished(): TarnRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mArmor = makeCelMaterial({ color: e.armor, matcap: 0.55, matcapTex: armorMatcap(), rim: 0.5 });
  const mCloak = makeCelMaterial({ color: e.tarnish, rim: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), mArmor);
  body.position.y = 1.0;
  g.add(body);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8, 1, true), mCloak);
  cloak.position.set(0, 0.75, -0.08);
  g.add(cloak);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mArmor);
  head.position.y = 1.62;
  g.add(head);
  // hood point
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 6), mCloak);
  hood.position.y = 1.82;
  g.add(hood);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), mCloak);
    leg.position.set(s * 0.14, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), mArmor);
    arm.position.set(s * 0.38, 1.1, 0);
    g.add(arm);
    arms.push(arm);
  }
  // the straight sword
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.12), makeCelMaterial({ color: 0xc8ccd8, specBand: 0.8, specPow: 60, rim: 0.3 }));
  blade.position.y = 0.5;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.08), makeCelMaterial({ color: 0x8a6a2a, rim: 0.3 }));
  sword.add(blade, guard);
  sword.position.set(0.45, 1.0, 0.15);
  sword.rotation.x = 0.5;
  g.add(sword);

  addOutline(g, THIN, INK());

  let stride = 0;
  let actT = 0;
  let lastPose: TarnPose = "idle";
  return {
    group: g,
    update(dt, time, speed, pose) {
      if (pose !== lastPose) {
        actT = 0;
        lastPose = pose;
      }
      actT += dt;
      stride += dt * speed * 2.0;
      g.rotation.x = 0;
      g.rotation.z = 0;
      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      sword.rotation.x = 0.5;
      sword.rotation.z = 0;
      g.position.y = 0;

      switch (pose) {
        case "walk":
        case "sprint":
          g.position.y = Math.abs(Math.sin(stride)) * 0.06;
          legs[0].rotation.x = Math.sin(stride) * (pose === "sprint" ? 0.9 : 0.6);
          legs[1].rotation.x = -Math.sin(stride) * (pose === "sprint" ? 0.9 : 0.6);
          arms[0].rotation.x = -Math.sin(stride) * 0.5;
          g.rotation.x = pose === "sprint" ? 0.16 : 0.06;
          break;
        case "roll":
          g.rotation.x = (actT / 0.4) * Math.PI * 2; // the somersault
          g.position.y = Math.sin(Math.min(1, actT / 0.4) * Math.PI) * 0.3;
          break;
        case "light": {
          const k = Math.min(1, actT / 0.42);
          sword.rotation.z = -1.4 + k * 2.6;
          arms[1].rotation.x = -1.1;
          break;
        }
        case "heavy": {
          const k = Math.min(1, actT / 0.7);
          sword.rotation.x = 0.5 - Math.sin(k * Math.PI) * 2.2; // big overhead
          arms[1].rotation.x = -2.0 + k * 1.6;
          break;
        }
        case "guard":
          arms[0].rotation.x = -1.2;
          sword.rotation.x = 1.4;
          break;
        case "parry":
          sword.rotation.z = 2.4; // the flick
          arms[1].rotation.x = -0.8;
          break;
        case "flask":
          arms[0].rotation.x = -2.2; // raise the flask
          g.position.y = -0.15;
          break;
        case "rest":
          g.position.y = -0.5; // kneel
          legs[0].rotation.x = 1.5;
          legs[1].rotation.x = 1.5;
          break;
        case "dead":
          g.rotation.x = -Math.PI / 2.2;
          g.position.y = 0.2;
          break;
        default:
          g.position.y = Math.sin(time * 1.7) * 0.02;
      }
    },
  };
}

/* -------------------------------------------------------------- soldier -- */

export interface FoeRig {
  group: THREE.Group;
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildSoldier(seed: number): FoeRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mRust = makeCelMaterial({ color: e.soldier, rim: 0.45 });
  const mMetal = makeCelMaterial({ color: 0x6a7078, matcap: 0.4, matcapTex: armorMatcap(), rim: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 10), mRust);
  body.position.y = 0.95;
  g.add(body);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mMetal);
  helm.position.y = 1.6;
  g.add(helm);
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), mMetal);
    leg.position.set(s * 0.13, 0.35, 0);
    g.add(leg);
    legs.push(leg);
  }
  const swordArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), mRust);
  swordArm.position.set(0.38, 1.1, 0);
  g.add(swordArm);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.1), makeCelMaterial({ color: 0x9aa0a8, specBand: 0.6, rim: 0.3 }));
  sword.position.set(0.45, 1.3, 0.1);
  g.add(sword);
  addOutline(g, THIN, INK());

  return {
    group: g,
    update(_dt, time, state, stateT) {
      g.position.y = Math.sin(time * 1.9 + seed) * 0.02;
      g.rotation.x = 0;
      sword.rotation.x = 0;
      if (state === "engage") {
        const st = Math.sin(time * 6 + seed) * 0.5;
        legs[0].rotation.x = st;
        legs[1].rotation.x = -st;
        g.rotation.x = 0.1;
      } else if (state === "windup") {
        // the READABLE raise
        sword.rotation.x = -1.8 - stateT * 0.6;
        swordArm.rotation.x = -1.6;
        g.rotation.x = -0.12;
      } else if (state === "attack") {
        sword.rotation.x = 1.2;
        swordArm.rotation.x = 0.8;
        g.rotation.x = 0.25;
      } else if (state === "stagger") {
        g.rotation.x = -0.3;
        g.rotation.z = Math.sin(time * 8) * 0.1;
      } else {
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        swordArm.rotation.x = 0;
        g.rotation.z = 0;
      }
    },
  };
}

/* --------------------------------------------------------------- scarab -- */

export function buildScarab(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 8),
    makeCelMaterial({ color: PAL.extra.scarab, specBand: 0.9, specPow: 50, rim: 0.5 }),
  );
  shell.position.y = 0.25;
  shell.scale.set(1, 0.7, 1.2);
  g.add(shell);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), makeCelMaterial({ color: 0x4a3a2a, rim: 0.1 }));
      leg.position.set(s * 0.3, 0.15, -0.25 + i * 0.25);
      leg.rotation.z = s * 0.7;
      g.add(leg);
    }
  }
  addOutline(g, 1.6, INK());
  return g;
}

/* --------------------------------------------------------------- warden -- */

export interface WardenRig {
  group: THREE.Group;
  hammer: THREE.Group;      // the summoned gold hammer (phase 2)
  update(dt: number, time: number, state: string, stateT: number, move: string | null): void;
}

export function buildWarden(): WardenRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const robe = makeCelMaterial({ color: e.warden, rim: 0.5 });
  const metal = makeCelMaterial({ color: e.armor, matcap: 0.5, matcapTex: armorMatcap(), rim: 0.5 });

  // tall robed figure
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.6, 8), robe);
  body.position.y = 1.3;
  g.add(body);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.7, 6, 10), metal);
  chest.position.y = 2.6;
  g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), metal);
  head.position.y = 3.5;
  g.add(head);
  // the crown of the bridge-king's man
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 6), makeCelMaterial({ color: e.gold, emissive: e.gold, emissiveStrength: 0.4, rim: 0.3 }));
  crown.position.y = 3.85;
  g.add(crown);

  const staffArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.7, 4, 8), robe);
  staffArm.position.set(0.7, 2.6, 0);
  g.add(staffArm);
  const staff = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), makeCelMaterial({ color: 0x4a3a2a, rim: 0.3 }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), makeCelMaterial({ color: e.gold, emissive: e.gold, emissiveStrength: 0.7, rim: 0.3 }));
  orb.position.y = 1.8;
  staff.add(pole, orb);
  staff.position.set(0.85, 2.2, 0.2);
  g.add(staff);

  // the tail (phase 2 reads it)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.8, 6), robe);
  tail.position.set(0, 0.7, -1.2);
  tail.rotation.x = 1.9;
  g.add(tail);

  // the summoned hammer (hidden until phase 2 calls it)
  const hammer = new THREE.Group();
  const hHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), makeCelMaterial({ color: e.goldHot, emissive: e.gold, emissiveStrength: 0.9, rim: 0.2 }));
  const hPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), makeCelMaterial({ color: e.gold, emissive: e.gold, emissiveStrength: 0.4, rim: 0.2 }));
  hPole.position.y = -1.4;
  hammer.add(hHead, hPole);
  hammer.visible = false;
  g.add(hammer);

  addOutline(g, 2.2, INK());

  return {
    group: g,
    hammer,
    update(_dt, time, state, stateT, move) {
      g.position.y = Math.sin(time * 1.2) * 0.05;
      g.rotation.x = 0;
      staff.rotation.x = 0;
      staff.rotation.z = 0;
      hammer.visible = false;
      switch (state) {
        case "windup":
          if (move === "overhead") {
            staff.rotation.x = -2.2 - stateT * 0.4; // the slow, slow raise
          } else if (move === "sweep") {
            staff.rotation.z = -1.6; // held sideways
          } else if (move === "daggers") {
            staff.rotation.x = -0.9;
          }
          g.rotation.x = -0.08;
          break;
        case "attack":
          if (move === "overhead") staff.rotation.x = 1.6;
          else if (move === "sweep") staff.rotation.z = 1.8;
          else staff.rotation.x = 0.6;
          g.rotation.x = 0.18;
          break;
        case "stagger":
          g.rotation.x = -0.35;
          g.rotation.z = Math.sin(time * 6) * 0.06;
          break;
        default:
          g.rotation.z = 0;
      }
      if (move === "hammer" && (state === "windup" || state === "attack")) {
        hammer.visible = true;
        hammer.position.set(0, 8 - stateT * 6, 0); // descends on the mark
        hammer.rotation.z = 0.4;
      }
    },
  };
}
