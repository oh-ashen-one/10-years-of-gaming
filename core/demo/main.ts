/**
 * main.ts — pipeline smoke demo (NOT a game, not part of package exports).
 *
 * Proves the studio core end-to-end in one frame: painted sky with a hero
 * light and silhouette rings, a kitbash cel-shaded shape with hull ink,
 * the interior-ink post pass, the frame loop (adaptive DPR, outline pixel
 * scale), and the __game harness contract the shoot tool drives.
 */
import * as THREE from "three";
import {
  extendPalette, configureCelEnv, celEnv,
  makeCelMaterial, makePaintedMatcap, addOutline,
  PostFX, buildSky,
  ChaseCamera,
  FrameLoop, installHarness,
} from "@tenyears/core";

/* ------------------------------------------------------------ palette -- */

const palette = extendPalette({}); // the studio default movie
const SUN_DIR = new THREE.Vector3(-0.72, 0.28, -0.5).normalize();
configureCelEnv(palette, {
  sunDir: SUN_DIR,
  sunTint: 0xffc27d,
  ambient: 0x5a4a86,
  hazeNear: 140,
  hazeFar: 700,
});

/* ------------------------------------------------------------ renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // graphic, not filmic
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.ink.deep);

const world = new THREE.Group();
scene.add(world);

/* ---------------------------------------------------------------- world -- */

const sky = buildSky(scene, {
  palette,
  sunDir: SUN_DIR,
  rays: { count: 7, speed: 0.05, amount: 0.3 },
  silhouettes: [
    { radius: 2900, baseY: -30, maxH: 120, color: palette.atmosphere.silhouetteFar, hazeMix: 0.55, seed: 11.3 },
    { radius: 2300, baseY: -30, maxH: 150, color: palette.atmosphere.silhouetteMid, hazeMix: 0.38, seed: 47.9 },
    { radius: 1800, baseY: -30, maxH: 180, color: palette.atmosphere.silhouetteNear, hazeMix: 0.24, seed: 92.4 },
  ],
});

// ground slab so haze + interior ink have something to bite on
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1600, 64).rotateX(-Math.PI / 2),
  makeCelMaterial({ color: palette.terrain.mid, rim: 0.15 }),
);
ground.position.y = -0.02;
world.add(ground);

// kitbash hero shape: spheres + boxes, three material treatments
const hero = new THREE.Group();
const matcapTex = makePaintedMatcap({
  stops: [
    [0.0, "#ffd9a0"],
    [0.45, "#e0567d"],
    [1.0, "#241433"],
  ],
  glint: { x: 0.32, y: 0.24, r: 0.18, color: "rgba(255,241,201,0.95)" },
});

const body = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 28, 20),
  makeCelMaterial({ color: palette.accents.primary, specBand: 0.7, specPow: 42, rim: 0.6 }),
);
body.position.y = 2.1;
hero.add(body);

const visor = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 24, 16, -Math.PI / 3, (Math.PI * 2) / 3, Math.PI / 3.2, Math.PI / 3),
  makeCelMaterial({ color: 0x181028, matcap: 0.9, matcapTex, rim: 0.35 }),
);
visor.position.set(0, 2.35, 0.9);
hero.add(visor);

const pack = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.9, 0.9),
  makeCelMaterial({ color: palette.accents.rimHot, specBand: 0.4, rim: 0.5 }),
);
pack.position.set(0, 2.2, -1.35);
hero.add(pack);

for (const sx of [-1, 1]) {
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 1.4, 10),
    makeCelMaterial({ color: palette.terrain.shadow, rim: 0.45 }),
  );
  leg.position.set(sx * 0.62, 0.7, 0);
  hero.add(leg);
}
world.add(hero);
addOutline(hero, 2.4);

/* --------------------------------------------------------- camera + fx -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 3400,
  heroLightDir: SUN_DIR,
  orbitRadius: 10.5,
  orbitHeight: 3.6,
});
chase.setMode("orbit");

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: palette.ink.deep },
);

/* ------------------------------------------------------------ loop ----- */

const target = {
  pos: new THREE.Vector3(0, 1.2, 0),
  heading: 0,
  speed: 0,
};

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (dt, time) => {
    hero.rotation.y = time * 0.25;
    body.position.y = 2.1 + Math.sin(time * 1.3) * 0.12;
    chase.update(dt, target, time);
    sky.update(time, chase.camera.position);
  },
});

/* ------------------------------------------------------------- harness -- */

installHarness({
  autostart() { /* the demo has no title — nothing to skip */ },
  cam(mode: string) { chase.setMode(mode as "chase" | "orbit" | "ceremony"); },
  get phase() { return "demo"; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { /* no results beat in the smoke demo */ },
  debug() {
    return {
      cam: chase.camera.position.toArray(),
      pixelScale: loop.pixelScale,
    };
  },
});

loop.start();
