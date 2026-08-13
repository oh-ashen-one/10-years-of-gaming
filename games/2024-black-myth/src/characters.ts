/**
 * characters.ts — the INKPEAK cast. The Destined One (straw-hat staff monk,
 * red sash, ribboned staff), the lesser yaoguai (hunched wolf-imps whose
 * crouch→LEAP is the immobilize showcase), and the TIGER ABBOT: a tiger in
 * a monk's robe, claws in phase 1, a gold sword drawn for phase 2. Poses
 * are behavior: windups READ — the crouch before the leap, the double
 * raise before the blood-slam, the sword-spin before the whirlwind.
 */
import * as THREE from "three";
import { makeCelMaterial, makePaintedMatcap, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

const INK = () => col(PAL.ink.line);
const THIN = 1.6;

const matcap = { current: null as THREE.CanvasTexture | null };
function goldMatcap(): THREE.CanvasTexture {
  if (!matcap.current) {
    matcap.current = makePaintedMatcap({
      stops: [
        [0.0, "#f5e8c8"],
        [0.4, "#c8a86a"],
        [0.7, "#6a5a3a"],
        [1.0, "#241c10"],
      ],
      glint: { x: 0.3, y: 0.25, r: 0.16, color: "rgba(255,246,216,0.95)" },
    });
  }
  return matcap.current;
}

/* ----------------------------------------------------------------- monk -- */

export type MonkPose =
  | "idle" | "walk" | "dodge" | "light1" | "light2" | "light3"
  | "smash" | "poke" | "gourd" | "rest" | "hit" | "dead";

export interface MonkRig {
  group: THREE.Group;
  staff: THREE.Group;
  update(dt: number, time: number, speed: number, pose: MonkPose, poseT: number): void;
}

export function buildMonk(): MonkRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mRobe = makeCelMaterial({ color: e.robe, rim: 0.45 });
  const mSkin = makeCelMaterial({ color: 0xc8a88a, rim: 0.4 });
  const mSash = makeCelMaterial({ color: e.sash, rim: 0.35 });
  const mStraw = makeCelMaterial({ color: 0xa89468, rim: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), mRobe);
  body.position.y = 1.0;
  g.add(body);
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), mSash);
  sash.position.y = 0.95;
  g.add(sash);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mSkin);
  head.position.y = 1.62;
  g.add(head);
  // the straw hat
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.24, 10), mStraw);
  hat.position.y = 1.82;
  g.add(hat);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), mRobe);
    leg.position.set(s * 0.14, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), mRobe);
    arm.position.set(s * 0.38, 1.12, 0);
    g.add(arm);
    arms.push(arm);
  }

  // the ribboned staff, held in the right hand
  const staff = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6),
    makeCelMaterial({ color: 0x3a2c1c, rim: 0.3 }),
  );
  staff.add(pole);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.16, 6),
      makeCelMaterial({ color: e.gold, matcap: 0.6, matcapTex: goldMatcap(), specBand: 0.8, rim: 0.3 }),
    );
    cap.position.y = s * 1.05;
    staff.add(cap);
  }
  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.5),
    new THREE.MeshBasicMaterial({ color: PAL.extra.sash, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ribbon.position.set(0.05, 0.85, 0);
  staff.add(ribbon);
  staff.position.set(0.42, 1.1, 0.1);
  g.add(staff);

  addOutline(g, THIN, INK());

  let stride = 0;
  return {
    group: g,
    staff,
    update(dt, time, speed, pose, poseT) {
      stride += dt * speed * 2.1;
      // reset
      g.rotation.set(0, g.rotation.y, 0);
      g.position.y = 0;
      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      staff.rotation.set(0.5, 0, 0.12);
      staff.position.set(0.42, 1.1, 0.1);
      ribbon.rotation.x = Math.sin(time * 3) * 0.3;

      switch (pose) {
        case "walk":
          g.position.y = Math.abs(Math.sin(stride)) * 0.06;
          legs[0].rotation.x = Math.sin(stride) * 0.65;
          legs[1].rotation.x = -Math.sin(stride) * 0.65;
          arms[0].rotation.x = -Math.sin(stride) * 0.4;
          g.rotation.x = 0.07;
          break;
        case "dodge": {
          const k = Math.min(1, poseT / 0.4);
          g.rotation.z = k * Math.PI * 2; // the staff-monk spin
          g.position.y = Math.sin(k * Math.PI) * 0.25;
          break;
        }
        case "light1": { // horizontal cut
          const k = Math.min(1, poseT / 0.38);
          staff.rotation.set(1.5, 0, -1.5 + k * 2.8);
          arms[1].rotation.x = -1.2;
          g.rotation.x = 0.12;
          break;
        }
        case "light2": { // the backhand return
          const k = Math.min(1, poseT / 0.38);
          staff.rotation.set(1.5, 0, 1.3 - k * 2.8);
          arms[1].rotation.x = -1.0;
          g.rotation.x = 0.1;
          break;
        }
        case "light3": { // the finisher: overhead twirl down
          const k = Math.min(1, poseT / 0.38);
          staff.rotation.set(0.5 - Math.sin(k * Math.PI) * 2.4, 0, 0.12);
          arms[1].rotation.x = -2.1 + k * 1.8;
          g.rotation.x = -0.1 + k * 0.34;
          break;
        }
        case "smash": { // the focus slam
          const k = Math.min(1, poseT / 0.72);
          const lift = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45;
          staff.rotation.set(0.5 - lift * 2.6, 0, 0.12);
          arms[1].rotation.x = -lift * 2.4;
          g.position.y = k < 0.55 ? lift * 0.35 : 0.35 - (k - 0.55) * 1.4;
          g.rotation.x = -0.14 + (k > 0.55 ? (k - 0.55) * 0.9 : 0);
          break;
        }
        case "poke": { // the thrust
          const k = Math.min(1, poseT / 0.38);
          const out = Math.sin(Math.min(1, k * 1.4) * Math.PI);
          staff.rotation.set(1.62, 0, 0);
          staff.position.set(0.42, 1.15, 0.1 + out * 0.9);
          arms[1].rotation.x = -1.5;
          g.rotation.x = 0.18;
          break;
        }
        case "gourd":
          arms[0].rotation.x = -2.2; // raise the gourd
          g.position.y = -0.12;
          break;
        case "rest":
          g.position.y = -0.5; // kneel at the shrine
          legs[0].rotation.x = 1.5;
          legs[1].rotation.x = 1.5;
          staff.rotation.set(0.2, 0, 1.2);
          break;
        case "hit":
          g.rotation.x = -0.22;
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

/* -------------------------------------------------------------- yaoguai -- */

export interface FoeRig {
  group: THREE.Group;
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildYaoguai(seed: number): FoeRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mFur = makeCelMaterial({ color: e.yaoguai, rim: 0.5 });
  const mDark = makeCelMaterial({ color: e.yaoguaiDark, rim: 0.35 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 10), mFur);
  body.position.set(0, 0.62, -0.1);
  body.rotation.x = 1.1; // hunched forward
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mFur);
  head.position.set(0, 0.95, 0.35);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.24), mDark);
  snout.position.set(0, 0.88, 0.56);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), mDark);
    ear.position.set(s * 0.16, 1.18, 0.3);
    g.add(ear);
    // glowing eyes
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 5),
      new THREE.MeshBasicMaterial({ color: PAL.extra.goldHot }),
    );
    eye.position.set(s * 0.1, 0.98, 0.55);
    g.add(eye);
  }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    for (const f of [0.3, -0.35]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 6), mDark);
      leg.position.set(s * 0.24, 0.3, f);
      g.add(leg);
      legs.push(leg);
    }
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 5), mFur);
  tail.position.set(0, 0.65, -0.65);
  tail.rotation.x = -1.2;
  g.add(tail);

  addOutline(g, THIN, INK());

  return {
    group: g,
    update(_dt, time, state, stateT) {
      g.rotation.x = 0;
      g.scale.set(1, 1, 1);
      head.position.y = 0.95;
      switch (state) {
        case "engage": { // the hop-walk
          const hop = Math.abs(Math.sin(time * 7 + seed));
          g.position.y = hop * 0.14;
          legs.forEach((l, i) => (l.rotation.x = Math.sin(time * 7 + seed + i) * 0.5));
          break;
        }
        case "windup": // THE crouch — the leap reads a mile away
          g.scale.y = 0.72;
          head.position.y = 0.7;
          g.rotation.x = -0.12;
          break;
        case "leap": // airborne, stretched
          g.rotation.x = 0.5;
          legs.forEach((l) => (l.rotation.x = 0.9));
          break;
        case "attack":
          g.rotation.x = 0.3;
          legs[0].rotation.x = -1.2;
          legs[1].rotation.x = -1.2;
          break;
        case "stagger":
          g.rotation.x = -0.25;
          g.rotation.z = Math.sin(time * 8) * 0.08;
          break;
        case "frozen": // held mid-pose by the seal (main tints gold)
          break;
        default:
          g.position.y = Math.sin(time * 2 + seed) * 0.02;
      }
      void stateT;
    },
  };
}

/* ----------------------------------------------------------------- abbot -- */

export interface AbbotRig {
  group: THREE.Group;
  sword: THREE.Group;
  update(dt: number, time: number, state: string, stateT: number, move: string | null, phase: number): void;
}

export function buildAbbot(): AbbotRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mRobe = makeCelMaterial({ color: 0x3a3228, rim: 0.5 });
  const mFur = makeCelMaterial({ color: e.tiger, rim: 0.5 });
  const mStripe = makeCelMaterial({ color: e.tigerDark, rim: 0.3 });

  // the robe — a big seated-mountain cone
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 8), mRobe);
  robe.position.y = 1.2;
  g.add(robe);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 6, 10), mFur);
  chest.position.y = 2.5;
  g.add(chest);
  // prayer beads
  const beads = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.07, 6, 12),
    makeCelMaterial({ color: e.gold, matcap: 0.5, matcapTex: goldMatcap(), rim: 0.3 }),
  );
  beads.position.y = 2.6;
  beads.rotation.x = 0.4;
  g.add(beads);

  // the tiger head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mFur);
  head.position.y = 3.4;
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), mFur);
  snout.position.set(0, 3.28, 0.38);
  g.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.26), mStripe);
  jaw.position.set(0, 3.14, 0.38);
  g.add(jaw);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 5), mFur);
    ear.position.set(s * 0.28, 3.72, 0);
    g.add(ear);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 5),
      new THREE.MeshBasicMaterial({ color: PAL.extra.goldHot }),
    );
    eye.position.set(s * 0.17, 3.42, 0.38);
    g.add(eye);
    // forehead stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.05), mStripe);
    stripe.position.set(s * 0.12, 3.62, 0.3);
    stripe.rotation.x = -0.4;
    g.add(stripe);
  }
  const stripeMid = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.05), mStripe);
  stripeMid.position.set(0, 3.64, 0.3);
  stripeMid.rotation.x = -0.4;
  g.add(stripeMid);

  // arms with claws
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.9, 4, 8), mFur);
    arm.position.set(s * 0.75, 2.4, 0.1);
    g.add(arm);
    arms.push(arm);
    for (let i = 0; i < 3; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), mStripe);
      claw.position.set(s * 0.75 + (i - 1) * 0.09, 1.82, 0.16);
      claw.rotation.x = 0.5;
      g.add(claw);
    }
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 6), mFur);
  tail.position.set(0, 0.9, -1.1);
  tail.rotation.x = 1.8;
  g.add(tail);

  // the phase-2 sword (drawn from nowhere, held reverse grip)
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 1.6, 0.16),
    makeCelMaterial({ color: e.gold, matcap: 0.7, matcapTex: goldMatcap(), specBand: 0.85, specPow: 50, rim: 0.3 }),
  );
  blade.position.y = 0.9;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.1), mStripe);
  sword.add(blade, guard);
  sword.position.set(0.85, 1.9, 0.2);
  sword.rotation.x = Math.PI; // reverse grip, blade down
  sword.visible = false;
  g.add(sword);

  addOutline(g, 2.2, INK());

  return {
    group: g,
    sword,
    update(_dt, time, state, stateT, move, phase) {
      g.rotation.x = 0;
      g.rotation.z = 0;
      g.position.y = Math.sin(time * 1.2) * 0.04;
      g.scale.set(1, 1, 1);
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      head.position.y = 3.4;
      sword.visible = phase === 2;

      switch (state) {
        case "engage":
          arms[0].rotation.x = Math.sin(time * 2) * 0.1 - 0.15;
          arms[1].rotation.x = -Math.sin(time * 2) * 0.1 - 0.15;
          break;
        case "windup":
          if (move === "claw") {
            // alternating raises — count the string
            const arm = stateT % 0.9 < 0.45 ? arms[1] : arms[0];
            arm.rotation.x = -2.2;
            g.rotation.x = -0.1;
          } else if (move === "pounce") {
            g.scale.y = 0.78; // the crouch
            head.position.y = 2.9;
          } else if (move === "bloodslam") {
            arms[0].rotation.x = -2.6; // both arms to the sky
            arms[1].rotation.x = -2.6;
            g.rotation.x = -0.18;
          } else if (move === "whirlwind") {
            sword.rotation.z = stateT * 14; // the spin-up
            g.rotation.x = -0.12;
          } else if (move === "roar") {
            head.position.y = 3.55; // head back
            g.scale.setScalar(1 + Math.min(0.18, stateT * 0.2)); // the inflate
            g.rotation.x = -0.22;
          }
          break;
        case "attack":
          if (move === "roar") {
            g.scale.setScalar(1.15);
            g.rotation.x = 0.15;
          } else {
            arms[1].rotation.x = 0.9;
            arms[0].rotation.x = 0.7;
            g.rotation.x = 0.24;
          }
          break;
        case "leap":
          g.rotation.x = 0.45;
          break;
        case "dash":
          g.rotation.x = 0.55;
          sword.rotation.z = time * 30; // a blur of gold
          break;
        case "recover":
          g.rotation.x = 0.28; // the breath — PUNISH HERE
          head.position.y = 3.2;
          break;
        case "frozen":
          break;
        default:
          break;
      }
    },
  };
}
