/**
 * characters.ts — the OVERPAINT cast. The expeditioner (ink-navy Belle
 * Époque coat, red scarf, ribbon hair, a painter's rapier), the brushlings
 * (paint blobs on brush legs, rose tips), the mime (porcelain white, the
 * invisible box, a striped blade), and the CURATOR'S MARIONETTE: a huge
 * painted puppet hung from gilt strings, a face that gets REPAINTED.
 * Poses are behavior: telegraphs READ — the rear-back before the sweep,
 * the three-beat jab chain, the cannon's charge glow.
 */
import * as THREE from "three";
import { makeCelMaterial, makePaintedMatcap, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";

const INK = () => col(PAL.ink.line);
const THIN = 1.6;

const matcap = { current: null as THREE.CanvasTexture | null };
function giltMatcap(): THREE.CanvasTexture {
  if (!matcap.current) {
    matcap.current = makePaintedMatcap({
      stops: [
        [0.0, "#f7e8c8"],
        [0.4, "#d8a84a"],
        [0.7, "#7a5a2a"],
        [1.0, "#241a10"],
      ],
      glint: { x: 0.3, y: 0.25, r: 0.16, color: "rgba(255,243,216,0.95)" },
    });
  }
  return matcap.current;
}

/* --------------------------------------------------------- expeditioner -- */

export type ExpoPose =
  | "idle" | "walk" | "strike" | "aim" | "lance" | "overpaint"
  | "dodge" | "parry" | "hit" | "dead" | "victory";

export interface ExpoRig {
  group: THREE.Group;
  update(dt: number, time: number, speed: number, pose: ExpoPose, poseT: number): void;
}

export function buildExpeditioner(): ExpoRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mCoat = makeCelMaterial({ color: e.coat, rim: 0.5 });
  const mSkin = makeCelMaterial({ color: 0xe8c8a8, rim: 0.4 });
  const mScarf = makeCelMaterial({ color: e.scarf, rim: 0.45 });
  const mHair = makeCelMaterial({ color: 0x2a2030, rim: 0.5 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 6, 12), mCoat);
  body.position.y = 1.05;
  g.add(body);
  // the coat's split tails
  const tails = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 8, 1, true), mCoat);
  tails.position.set(0, 0.62, -0.05);
  g.add(tails);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 10), mScarf);
  scarf.position.y = 1.42;
  scarf.rotation.x = Math.PI / 2.3;
  g.add(scarf);
  const scarfTail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), mScarf);
  scarfTail.position.set(-0.15, 1.2, -0.2);
  g.add(scarfTail);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), mSkin);
  head.position.y = 1.66;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), mHair);
  hair.position.set(0, 1.72, -0.05);
  hair.scale.set(1, 0.8, 1);
  g.add(hair);
  // the ribbon — long, reads in the wind
  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.7),
    new THREE.MeshBasicMaterial({ color: PAL.extra.scarf, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  );
  ribbon.position.set(0.1, 1.45, -0.28);
  g.add(ribbon);

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), mCoat);
    leg.position.set(s * 0.13, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), mCoat);
    arm.position.set(s * 0.36, 1.15, 0);
    g.add(arm);
    arms.push(arm);
  }
  // the painter's rapier — a long gilt nib
  const rapier = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 1.1, 6),
    makeCelMaterial({ color: e.gold, matcap: 0.65, matcapTex: giltMatcap(), specBand: 0.8, rim: 0.3 }),
  );
  blade.position.y = 0.6;
  const guard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), makeCelMaterial({ color: e.frame, rim: 0.3 }));
  rapier.add(blade, guard);
  rapier.position.set(0.42, 1.05, 0.12);
  rapier.rotation.x = 0.5;
  g.add(rapier);

  addOutline(g, THIN, INK());

  let stride = 0;
  return {
    group: g,
    update(dt, time, speed, pose, poseT) {
      stride += dt * speed * 2.1;
      g.rotation.set(0, g.rotation.y, 0);
      g.position.y = 0;
      legs[0].rotation.x = 0;
      legs[1].rotation.x = 0;
      arms[0].rotation.set(0, 0, 0);
      arms[1].rotation.set(0, 0, 0);
      rapier.rotation.set(0.5, 0, 0);
      rapier.position.set(0.42, 1.05, 0.12);
      ribbon.rotation.x = 0.3 + Math.sin(time * 2.2) * 0.25;
      scarfTail.rotation.x = Math.sin(time * 2.6) * 0.3;

      switch (pose) {
        case "walk":
          g.position.y = Math.abs(Math.sin(stride)) * 0.06;
          legs[0].rotation.x = Math.sin(stride) * 0.65;
          legs[1].rotation.x = -Math.sin(stride) * 0.65;
          arms[0].rotation.x = -Math.sin(stride) * 0.4;
          g.rotation.x = 0.07;
          break;
        case "strike": {
          const k = Math.min(1, poseT / 0.34);
          rapier.rotation.x = 0.5 - Math.sin(k * Math.PI) * 1.8; // the thrust
          arms[1].rotation.x = -1.5 + k * 0.6;
          g.rotation.x = 0.16;
          break;
        }
        case "aim":
          rapier.rotation.set(1.55, 0, 0); // leveled like a brush-sight
          arms[1].rotation.x = -1.55;
          arms[0].rotation.x = -0.6;
          break;
        case "lance": {
          const k = Math.min(1, poseT / 0.45);
          arms[0].rotation.x = -2.4 + k * 1.2; // the paint gathers overhead
          rapier.rotation.x = -1.2 + k * 2.2;
          g.position.y = Math.sin(k * Math.PI) * 0.2;
          break;
        }
        case "overpaint": {
          const k = Math.min(1, poseT / 0.7);
          arms[0].rotation.x = -2.8;
          arms[1].rotation.x = -2.8;
          g.rotation.x = -0.15 + k * 0.3;
          g.position.y = Math.sin(k * Math.PI) * 0.3;
          break;
        }
        case "dodge":
          g.rotation.z = Math.min(1, poseT / 0.32) * Math.PI * 2; // the pirouette
          g.position.y = Math.sin(Math.min(1, poseT / 0.32) * Math.PI) * 0.22;
          break;
        case "parry":
          rapier.rotation.set(1.2, 0, 1.8); // the gilt flick
          arms[1].rotation.x = -1.0;
          g.rotation.x = -0.08;
          break;
        case "hit":
          g.rotation.x = -0.25;
          break;
        case "dead":
          g.rotation.x = -Math.PI / 2.2;
          g.position.y = 0.2;
          break;
        case "victory":
          arms[1].rotation.x = -2.6;
          rapier.rotation.x = -2.6;
          break;
        default:
          g.position.y = Math.sin(time * 1.7) * 0.02;
      }
    },
  };
}

/* -------------------------------------------------------------- brushling -- */

export interface FoeRig {
  group: THREE.Group;
  update(dt: number, time: number, state: string, stateT: number): void;
}

export function buildBrushling(seed: number): FoeRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mBlob = makeCelMaterial({ color: e.brushling, rim: 0.55 });
  const mTip = makeCelMaterial({ color: e.brushTip, rim: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mBlob);
  body.position.y = 0.62;
  body.scale.set(1, 1.15, 1);
  g.add(body);
  // the brush tip of a head
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), mTip);
  tip.position.y = 1.25;
  g.add(tip);
  // ferrule
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8),
    makeCelMaterial({ color: e.frame, matcap: 0.5, matcapTex: giltMatcap(), rim: 0.3 }),
  );
  ferrule.position.y = 1.02;
  g.add(ferrule);
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color: PAL.extra.goldHot }),
    );
    eye.position.set(s * 0.14, 0.72, 0.38);
    g.add(eye);
    eyes.push(eye);
  }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5), mTip);
    leg.position.set(s * 0.2, 0.25, 0);
    g.add(leg);
    legs.push(leg);
  }
  addOutline(g, THIN, INK());

  return {
    group: g,
    update(_dt, time, state, stateT) {
      g.rotation.x = 0;
      g.scale.set(1, 1, 1);
      switch (state) {
        case "telegraph": // the rear-back before the stroke
          g.rotation.x = -0.3 - stateT * 0.3;
          g.scale.y = 0.9;
          break;
        case "strike":
          g.rotation.x = 0.45;
          g.scale.y = 1.15;
          break;
        case "stagger":
          g.rotation.z = Math.sin(time * 7 + seed) * 0.15;
          break;
        case "dying":
          break; // the dissolve is main.ts's business
        default: { // the gel bob
          const b = Math.sin(time * 3.2 + seed);
          g.scale.set(1 + b * 0.05, 1 - b * 0.06, 1 + b * 0.05);
          g.position.y = Math.abs(Math.sin(time * 2.1 + seed)) * 0.05;
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ mime -- */

export function buildMime(): FoeRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mWhite = makeCelMaterial({ color: e.mime, rim: 0.5 });
  const mDark = makeCelMaterial({ color: e.mimeDark, rim: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 6, 10), mWhite);
  body.position.y = 1.05;
  g.add(body);
  // stripes
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.5), mDark);
    stripe.position.y = 0.85 + i * 0.22;
    g.add(stripe);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), mWhite);
  head.position.y = 1.7;
  g.add(head);
  const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 8), mDark);
  beret.position.set(0.05, 1.92, 0);
  beret.rotation.z = 0.2;
  g.add(beret);
  // the invisible-box hands
  const hands: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mWhite);
    hand.position.set(s * 0.42, 1.2, 0.15);
    g.add(hand);
    hands.push(hand);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 4, 6), mWhite);
    arm.position.set(s * 0.38, 1.15, 0);
    g.add(arm);
  }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), mDark);
    leg.position.set(s * 0.13, 0.38, 0);
    g.add(leg);
    legs.push(leg);
  }
  // the striped blade (phase of the fight is parry-teaching)
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.0, 0.12),
    makeCelMaterial({ color: e.mime, specBand: 0.7, rim: 0.35 }),
  );
  blade.position.set(0.48, 1.5, 0.1);
  g.add(blade);
  addOutline(g, THIN, INK());

  return {
    group: g,
    update(_dt, time, state, stateT) {
      g.rotation.set(0, g.rotation.y, 0);
      g.position.y = 0;
      blade.rotation.set(0, 0, 0);
      blade.position.set(0.48, 1.5, 0.1);
      switch (state) {
        case "telegraph": // palms press the invisible wall, then the blade lifts
          blade.rotation.x = -1.6 - stateT * 0.5;
          hands[0].position.z = 0.3;
          hands[1].position.z = 0.3;
          break;
        case "strike":
          blade.rotation.x = 1.3;
          g.rotation.x = 0.2;
          break;
        case "stagger": // the shield shatters — he reels
          g.rotation.x = -0.3;
          g.rotation.z = Math.sin(time * 6) * 0.12;
          break;
        default:
          // the invisible box pantomime
          hands[0].position.set(0.42, 1.2 + Math.sin(time * 1.8) * 0.15, 0.15);
          hands[1].position.set(-0.42, 1.2 + Math.cos(time * 1.8) * 0.15, 0.15);
          g.position.y = Math.sin(time * 2.2) * 0.02;
      }
    },
  };
}

/* ------------------------------------------------------------- marionette -- */

export interface MarionetteRig {
  group: THREE.Group;
  face: THREE.Mesh;       // the painted face plate — overpaint targets it
  strings: THREE.LineSegments;
  update(dt: number, time: number, state: string, stateT: number, move: string | null, beat: number): void;
}

export function buildMarionette(): MarionetteRig {
  const g = new THREE.Group();
  const e = PAL.extra;
  const mPorc = makeCelMaterial({ color: e.marion, rim: 0.55 });
  const mDark = makeCelMaterial({ color: e.marionDark, rim: 0.4 });
  const mGilt = makeCelMaterial({ color: e.frame, matcap: 0.6, matcapTex: giltMatcap(), rim: 0.35 });

  // the hung body — jointed segments
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mDark);
  pelvis.position.y = 1.6;
  g.add(pelvis);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 6, 12), mPorc);
  torso.position.y = 2.7;
  g.add(torso);
  // the ruff collar
  const ruff = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 10, 1, true), mGilt);
  ruff.position.y = 3.35;
  g.add(ruff);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mPorc);
  head.position.y = 3.95;
  g.add(head);
  // THE FACE — a flat painted plate; the overpaint repaints it
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8c8d0 }),
  );
  face.position.set(0, 3.95, 0.4);
  g.add(face);
  // painted eyes + smile (dark inlays on the face)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0x2a1a24 }));
    eye.position.set(s * 0.13, 4.02, 0.41);
    g.add(eye);
  }
  // limbs — long jointed arms with brush claws
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.8, 4, 8), mPorc);
    upper.position.set(s * 0.85, 2.9, 0);
    g.add(upper);
    arms.push(upper);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), mGilt);
    claw.position.set(s * 1.05, 1.9, 0.1);
    claw.rotation.x = 0.4;
    g.add(claw);
  }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 4, 8), mDark);
    leg.position.set(s * 0.3, 0.8, 0);
    g.add(leg);
    legs.push(leg);
  }

  // the gilt strings to the sky
  const stringGeo = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (const [sx, sy, sz] of [[-0.85, 3.2, 0], [0.85, 3.2, 0], [0, 4.3, 0], [-0.3, 1.6, 0], [0.3, 1.6, 0]] as const) {
    pts.push(sx, sy, sz, sx * 1.6, 12, sz - 0.5);
  }
  stringGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const strings = new THREE.LineSegments(
    stringGeo,
    new THREE.LineBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0.5 }),
  );
  g.add(strings);

  addOutline(g, 2.2, INK());

  return {
    group: g,
    face,
    strings,
    update(_dt, time, state, stateT, move, beat) {
      g.rotation.set(0, g.rotation.y, 0);
      g.position.y = Math.sin(time * 1.1) * 0.08; // the hang-sway
      arms[0].rotation.set(0, 0, 0.15);
      arms[1].rotation.set(0, 0, -0.15);
      head.rotation.x = 0;
      g.scale.set(1, 1, 1);

      switch (state) {
        case "telegraph":
          if (move === "sweep") {
            arms[1].rotation.z = -1.8 - stateT * 0.4; // the long rear-back
            g.rotation.x = -0.1;
          } else if (move === "jab") {
            const arm = beat % 2 === 0 ? arms[1] : arms[0];
            arm.rotation.x = -1.9;
            g.rotation.x = -0.12;
          } else if (move === "cannon") {
            // the whole body draws back like a bow
            g.rotation.x = -0.35;
            g.scale.setScalar(1 + stateT * 0.1);
            arms[0].rotation.x = -2.4;
            arms[1].rotation.x = -2.4;
          }
          break;
        case "strike":
          if (move === "cannon") {
            g.rotation.x = 0.3;
          } else {
            arms[1].rotation.x = 1.1;
            g.rotation.x = 0.2;
          }
          break;
        case "stagger": // the overpaint reels him
          g.rotation.x = -0.4;
          g.rotation.z = Math.sin(time * 5) * 0.1;
          head.rotation.x = -0.3;
          break;
        case "dying":
          break;
        default:
          break;
      }
    },
  };
}
