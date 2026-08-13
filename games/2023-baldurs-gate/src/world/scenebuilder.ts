/**
 * scenebuilder.ts — the tollhouse bridge set, from scene.ts data:
 * banded river water, plank bridge, cobble tollhouse yard + cottage,
 * flickering candles, the toll chest, gallows and roofline props, and
 * the candle-lit TAVERN CORNER diorama for the title (table, candles,
 * a resting d20).
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col, celEnv, NOISE_GLSL } from "@tenyears/core";
import { PAL } from "../palette";
import { RIVER, BRIDGE, TOLLHOUSE, CHEST, CANDLES, TAVERN } from "../scene";

export interface SceneRig {
  group: THREE.Group;
  chest: THREE.Group;
  update(dt: number, time: number): void;
}

function candle(x: number, z: number, y = 0): THREE.Group {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 0.7, 6),
    makeCelMaterial({ color: 0xf0e8d0, rim: 0.2 }),
  );
  stick.position.y = 0.35;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.32, 6),
    makeCelMaterial({ color: PAL.extra.candle, emissive: PAL.extra.candle, emissiveStrength: 1.3, rim: 0.1 }),
  );
  flame.name = "flame";
  flame.position.y = 0.85;
  g.add(stick, flame);
  g.position.set(x, y, z);
  return g;
}

export function buildScene(world: THREE.Group): SceneRig {
  const g = new THREE.Group();

  /* ---- ground: two banks ---- */
  const groundM = makeCelMaterial({ color: PAL.terrain.lit, rim: 0.2 });
  for (const [zc, d] of [[-17, 26], [17, 26]] as const) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, d), groundM);
    bank.position.set(0, -0.2, zc);
    g.add(bank);
  }
  // cobble yard around the tollhouse
  const yard = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.44, 16),
    makeCelMaterial({ color: PAL.extra.cobble, rim: 0.2 }),
  );
  yard.position.set(10, -0.19, 13);
  g.add(yard);

  /* ---- the river: banded flowing water ---- */
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(80, RIVER.z1 - RIVER.z0, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: celEnv.uTime,
        uA: { value: col(PAL.extra.riverA).clone() },
        uB: { value: col(PAL.extra.riverB).clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        ${NOISE_GLSL}
        void main() {
          float n = g_fbm(vec2(vUv.x * 30.0 - uTime * 0.5, vUv.y * 6.0), 3);
          n = floor(n * 4.0 + 0.5) / 4.0;
          gl_FragColor = vec4(mix(uB, uA, n), 1.0);
        }
      `,
    }),
  );
  river.position.set(0, -0.55, (RIVER.z0 + RIVER.z1) / 2);
  g.add(river);

  /* ---- the bridge: planks + side beams (no rails — the river is hungry) ---- */
  const plankM = makeCelMaterial({ color: PAL.extra.bridge, rim: 0.3 });
  const beamM = makeCelMaterial({ color: PAL.extra.bridgeDark, rim: 0.25 });
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0, 0.3, BRIDGE.z1 - BRIDGE.z0),
    beamM,
  );
  deck.position.set(0, -0.1, 0);
  g.add(deck);
  for (let i = 0; i < 12; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0 - 0.4, 0.12, 1.1), plankM);
    plank.position.set(0, 0.08, BRIDGE.z0 + 0.8 + i * 1.45);
    g.add(plank);
    addOutline(plank, 1.8, col(PAL.ink.line));
  }
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), beamM);
    post.position.set(s * (BRIDGE.x1 - 0.3), 0.5, RIVER.z0 - 0.4);
    const post2 = post.clone();
    post2.position.z = RIVER.z1 + 0.4;
    g.add(post, post2);
  }

  /* ---- the tollhouse ---- */
  const house = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 4.4, 6), makeCelMaterial({ color: PAL.extra.tollWall, rim: 0.35 }));
  walls.position.y = 2.2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3, 4), makeCelMaterial({ color: PAL.extra.tollRoof, rim: 0.4 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.75;
  roof.position.y = 5.8;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), makeCelMaterial({ color: PAL.ink.deep, rim: 0.1 }));
  door.position.set(-1.4, 1.2, -3.05);
  house.add(walls, roof, door);
  addOutline(house, 2.2, col(PAL.ink.line));
  house.position.set(TOLLHOUSE.x, 0, TOLLHOUSE.z + 3);
  g.add(house);

  /* ---- the toll chest ---- */
  const chest = new THREE.Group();
  const cbase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), makeCelMaterial({ color: PAL.extra.chest, specBand: 0.6, rim: 0.4 }));
  cbase.position.y = 0.35;
  const clid = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.4, 0.95), makeCelMaterial({ color: 0xe0b060, specBand: 0.8, specPow: 50, rim: 0.4 }));
  clid.position.y = 0.85;
  clid.name = "lid";
  chest.add(cbase, clid);
  const cglow = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.15, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.chest, transparent: true, opacity: 0.55 }),
  );
  cglow.position.y = 0.06;
  chest.add(cglow);
  addOutline(chest, 2.0, col(PAL.ink.line));
  chest.position.set(CHEST.x, 0, CHEST.z);
  g.add(chest);

  /* ---- candles (dip-the-blade spots) ---- */
  for (const c of CANDLES) g.add(candle(c.x, c.z));

  /* ---- the gallows on the south ridge + rooflines ---- */
  const gal = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 0.4), beamM);
  post.position.y = 2.75;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.35), beamM);
  arm.position.set(1.1, 5.3, 0);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4), makeCelMaterial({ color: 0x8a7a5a, rim: 0.1 }));
  rope.position.set(2.2, 4.6, 0);
  gal.add(post, arm, rope);
  addOutline(gal, 1.8, col(PAL.ink.line));
  gal.position.set(-14, 0, 18);
  g.add(gal);

  /* ---- the TAVERN CORNER (title diorama): table, candles, a resting d20 ---- */
  const tav = new THREE.Group();
  const table = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.3, 10), makeCelMaterial({ color: PAL.extra.bridgeDark, rim: 0.3 }));
  table.position.y = 1.1;
  const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.1, 8), makeCelMaterial({ color: PAL.extra.bridgeDark, rim: 0.2 }));
  tleg.position.y = 0.55;
  tav.add(table, tleg);
  const dieM = makeCelMaterial({ color: 0x2a1a30, specBand: 0.5, rim: 0.5 });
  const die = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), dieM);
  die.position.set(0.5, 1.8, 0.3);
  die.rotation.set(0.4, 0.7, 0.2);
  die.name = "die";
  addOutline(die, 2.0, col(PAL.accents.primary));
  tav.add(die);
  tav.add(candle(-0.9, 0.4, 1.25));
  tav.add(candle(1.1, -0.6, 1.25));
  // chairs
  for (const a of [0.6, 2.4, 4.2]) {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), makeCelMaterial({ color: 0x5a4632, rim: 0.25 }));
    chair.position.set(Math.cos(a) * 3.6, 0.6, Math.sin(a) * 3.6);
    tav.add(chair);
  }
  addOutline(tav, 2.0, col(PAL.ink.line));
  tav.position.set(TAVERN.x, 0, TAVERN.z);
  g.add(tav);

  world.add(g);

  return {
    group: g,
    chest,
    update(_dt, time) {
      // candle flicker
      g.traverse((o) => {
        if (o.name === "flame") {
          o.scale.set(1 + Math.sin(time * 11 + o.id) * 0.15, 1 + Math.sin(time * 14 + o.id) * 0.2, 1);
        }
      });
      const die = tav.getObjectByName("die");
      if (die) die.rotation.y = time * 0.4; // the dice rolls slowly, forever
    },
  };
}
