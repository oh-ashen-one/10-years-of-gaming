/**
 * main.ts — boots REQUIEM WARD and runs the frame loop.
 *
 * Wiring only: the first-person camera (Q/E lean-turn, head bob, aim FOV),
 * the flashlight uniforms + flicker-when-they're-near, the gun viewmodel,
 * rain on the title facade, item meshes, the inventory cursor, the
 * examine-in-the-light beat, the elevator finale staging (doors, the ARM),
 * enemy rigs (emissive bump inside the beam), event plumbing, and the
 * __game harness API. All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, FrameLoop, installHarness, fbm,
} from "@tenyears/core";
import { PAL } from "./palette";
import {
  FUSE_AT, AMMO1_AT, AMMO2_AT, HERB1_AT, HERB2_AT, CRANK_AT, DESK_KEY_AT,
} from "./ward";
import {
  makeWardMaterial, buildHospital, buildFacade, buildRain, type WardUniforms,
} from "./world/hospital";
import { Game, type ItemKind } from "./game";
import { buildShambler, buildPursuer } from "./characters";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

// cold moon through the skylights; the ward itself stays near-black
const MOON_DIR = new THREE.Vector3(0.2, 0.9, -0.35).normalize();
configureCelEnv(PAL, {
  sunDir: MOON_DIR,
  sunTint: 0x4a5a70,
  ambient: 0x11141c,
  hazeNear: 14,
  hazeFar: 80,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const world = new THREE.Group();
scene.add(world);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 400);
camera.rotation.order = "YXZ";

/* --------------------------------------------------------------------- sky -- */

function stormSilhouette(seed: number): (a: number) => number {
  return (a: number) => {
    const cell = Math.floor(a * 9);
    const h = fbm(cell * 1.2 + seed, 6.6, 2);
    return 0.15 + Math.floor(h * 3) / 3 * 0.35; // low city rooftops
  };
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: MOON_DIR,
  radius: 900,
  rays: false,
  clouds: true,
  silhouettes: [
    { radius: 800, baseY: -10, maxH: 60, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.5, shape: stormSilhouette(4.4), segments: 200 },
  ],
});

/* ------------------------------------------------------------------- world -- */

const wardUniforms: WardUniforms = {
  uFlashPos: { value: new THREE.Vector3() },
  uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
  uFlashOn: { value: 1 },
  uPower: { value: 0 },
  uTime: { value: 0 },
};
const wardMat = makeWardMaterial(wardUniforms);
const wardSet = buildHospital(world, wardMat);
buildFacade(world, wardMat);
const rain = buildRain(world);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const shamblerRigs = new Map<number, ReturnType<typeof buildShambler>>();
const pursuer = buildPursuer();
world.add(pursuer.group);

let visualsBuilt = false;
function buildVisuals(): void {
  if (visualsBuilt) return;
  visualsBuilt = true;
  for (const s of game.shamblers) {
    const rig = buildShambler(s.id * 1.7);
    world.add(rig.group);
    shamblerRigs.set(s.id, rig);
  }
}

/* -------------------------------------------------------------- item meshes -- */

function itemMesh(kind: ItemKind | "ammo"): THREE.Mesh | THREE.Group {
  const e = PAL.extra;
  const basic = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  switch (kind) {
    case "fuse":
      return new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), basic(e.fuse));
    case "ammo":
      return new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.18), basic(e.ammo));
    case "herb": {
      const g = new THREE.Group();
      for (const r of [0, Math.PI / 2]) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ color: e.herb, side: THREE.DoubleSide }));
        leaf.rotation.y = r;
        g.add(leaf);
      }
      return g;
    }
    case "crank": {
      const g = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), basic(e.crank));
      g.add(rod);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), basic(e.crank));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0.1, 0.25, 0);
      g.add(handle);
      return g;
    }
    case "liftkey": {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), basic(e.key));
      g.add(ring);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), basic(e.key));
      stem.position.y = -0.18;
      g.add(stem);
      return g;
    }
    default:
      return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), basic(0xffffff));
  }
}

const pickupMeshes: { id: string; mesh: THREE.Object3D }[] = [];
function buildPickupMeshes(): void {
  const spots: [string, ItemKind | "ammo", number, number][] = [
    ["fuse", "fuse", FUSE_AT.x, FUSE_AT.z],
    ["ammo1", "ammo", AMMO1_AT.x, AMMO1_AT.z],
    ["herb1", "herb", HERB1_AT.x, HERB1_AT.z],
    ["ammo2", "ammo", AMMO2_AT.x, AMMO2_AT.z],
    ["crank", "crank", CRANK_AT.x, CRANK_AT.z],
    ["herb2", "herb", HERB2_AT.x, HERB2_AT.z],
    ["liftkey", "liftkey", DESK_KEY_AT.x, DESK_KEY_AT.z],
  ];
  for (const [id, kind, x, z] of spots) {
    const m = itemMesh(kind);
    m.position.set(x, 1.0, z);
    world.add(m);
    pickupMeshes.push({ id, mesh: m });
  }
}

/* -------------------------------------------------------------- viewmodel -- */

const view = new THREE.Group();
const mGun = new THREE.MeshBasicMaterial({ color: 0x1c2026 });
const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.3), mGun);
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), mGun);
grip.position.set(0, -0.1, 0.1);
grip.rotation.x = 0.25;
view.add(slide, grip);
const muzzle = new THREE.Mesh(
  new THREE.PlaneGeometry(0.16, 0.16),
  new THREE.MeshBasicMaterial({ color: PAL.extra.cone, transparent: true, opacity: 0, depthWrite: false }),
);
muzzle.position.set(0, 0.01, -0.22);
view.add(muzzle);
view.position.set(0.22, -0.22, -0.45);
view.visible = false;
camera.add(view);
scene.add(camera);

// the faint volumetric cone
const coneMesh = new THREE.Mesh(
  new THREE.ConeGeometry(1.6, 7, 12, 1, true),
  new THREE.MeshBasicMaterial({
    color: PAL.extra.cone, transparent: true, opacity: 0.05, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }),
);
coneMesh.rotation.x = -Math.PI / 2;
coneMesh.position.set(0, -0.1, -3.8);
camera.add(coneMesh);

/* --------------------------------------------------------------- UI state -- */

let invOpen = false;
let cursor = 0;
let examineKind: ItemKind | null = null;
let examineMesh: THREE.Object3D | null = null;
let finaleClock = -1;

/* ------------------------------------------------------------------ events -- */

game.events = {
  onFire(head, hit) {
    audio.fire(head, hit);
    muzzle.material.opacity = 0.9;
    view.position.z = -0.38; // the recoil
  },
  onShamblerHit(s, head) {
    void s;
    if (head) hud.msg("HEADSHOT", 700);
  },
  onShamblerDie() {
    audio.moan();
  },
  onPursuerStagger() {
    audio.stagger();
    hud.msg("IT BARELY SLOWED", 900, true);
  },
  onPursuerWake() {
    audio.wake();
    hud.msg("SOMETHING JUST WOKE UP", 2400, true);
  },
  onPursuerChase() {
    audio.chase();
    hud.msg("IT SEES YOU", 1200, true);
  },
  onPlayerHit() {
    audio.playerHit();
  },
  onFlatline() {
    audio.flatline();
    hud.fell(true);
  },
  onRespawn() {
    hud.fell(false);
    audio.setRainInside(true);
  },
  onItem(kind, label) {
    audio.pickup();
    hud.card(label, kind === "ammo" ? "rounds, at last" : "added to the inventory", 2000);
  },
  onCombine() {
    audio.combine();
  },
  onExamine(kind) {
    audio.examine();
    examineKind = kind;
    examineMesh = itemMesh(kind);
    examineMesh.scale.setScalar(2.2);
    world.add(examineMesh);
    hud.examine(kind);
  },
  onDoorPlate(text) {
    audio.plate();
    hud.card(text, "the keyhole plate", 1800);
  },
  onDoorOpen() {
    audio.doorOpen();
    hud.msg("THE CRANK TURNS — THE DOOR GIVES", 1800);
  },
  onPowerOn() {
    audio.powerOn();
    wardUniforms.uPower.value = 1;
    wardSet.tubes[2].material = new THREE.MeshBasicMaterial({ color: PAL.extra.tube });
    hud.card("POWER RESTORED", "the ward hums — the director's desk is lit", 2400);
  },
  onStep(fast) {
    audio.step(fast);
  },
  onFlash() {
    audio.examine();
  },
  onAim() {
    audio.examine();
  },
  onFinale() {
    finaleClock = 0;
    audio.doorOpen();
  },
  onDoorArm() {
    audio.doorArm();
  },
  onSurvived() {
    audio.survived();
    hud.results(game);
  },
};

/* ------------------------------------------------------------------- input -- */

const keys = new Set<string>();
let started = false;

function firstInput(): void {
  if (started) return;
  started = true;
  audio.init();
  audio.titleSting();
}

function startGame(): void {
  document.getElementById("title")!.classList.add("hidden");
  game.start();
  buildVisuals();
  buildPickupMeshes();
  audio.setRainInside(true);
}

function closeOverlays(): void {
  if (examineKind) {
    examineKind = null;
    if (examineMesh) {
      world.remove(examineMesh);
      examineMesh = null;
    }
    hud.examine(null);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Tab") e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  firstInput();
  if (e.code === "Enter") {
    if (game.phase === "title") startGame();
    else if (game.phase === "results") location.reload();
  }
  if (e.code === "Tab" && game.phase === "play") {
    closeOverlays();
    invOpen = !invOpen;
  }
  if (invOpen) {
    if (e.code === "ArrowLeft") cursor = Math.max(0, cursor - 1);
    if (e.code === "ArrowRight") cursor = Math.min(5, cursor + 1);
    if (e.code === "ArrowUp") cursor = Math.max(0, cursor - 3);
    if (e.code === "ArrowDown") cursor = Math.min(5, cursor + 3);
    if (e.code === "KeyF" || e.code === "Enter") game.pressSlot(cursor);
    return; // the inventory eats the rest
  }
  if (examineKind && (e.code === "KeyF" || e.code === "Tab" || e.code === "Enter")) {
    closeOverlays();
    return;
  }
  if (e.code === "Space" || e.code === "KeyF") game.interact();
  if (e.code === "KeyG") game.toggleFlash();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (invOpen || examineKind) return;
  if (e.button === 2) game.aim(true);
  if (e.button === 0) game.fire();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 2) game.aim(false);
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  startGame();
});

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  camera,
  { ink: PAL.ink.deep, edgeStrength: 0.75, vignette: 0.6 },
);

let hudTick = 0;
let bobT = 0;
let flickerT = 0;
let flickerLevel = 1;
let pursuerStepAcc = 0;

const loop = new FrameLoop({
  renderer,
  camera,
  scene,
  post,
  update: (dt, time) => {
    /* input → game */
    const turn =
      (keys.has("KeyE") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyQ") || keys.has("ArrowLeft") ? 1 : 0);
    let move = { x: 0, z: 0 };
    if (!invOpen && !examineKind) {
      move = {
        x: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        z: (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + (keys.has("ArrowDown") ? 1 : 0),
      };
    }
    // note: turning sign — Q/Left turns left
    game.update(dt, move, keys.has("ShiftLeft") || keys.has("ShiftRight"), -turn);

    /* ---- camera ---- */
    const p = game.player;
    if (game.phase === "title") {
      // the rain-streaked facade, one window lit
      camera.position.set(Math.sin(time * 0.08) * 2.5, 3.0 + Math.sin(time * 0.11) * 0.3, 20);
      camera.lookAt(0, 5.4, 7.4);
      camera.fov = 50;
      camera.updateProjectionMatrix();
    } else {
      bobT += dt * (Math.hypot(move.x, move.z) > 0.05 ? (keys.has("ShiftLeft") ? 11 : 8) : 0);
      const aimK = p.aiming ? 1 : 0;
      camera.position.set(p.x, 1.62 + Math.sin(bobT) * 0.035 * (1 - aimK * 0.6), p.z);
      camera.rotation.set(0, p.heading + Math.PI, 0);
      const targetFov = p.aiming ? 44 : 62;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }
    view.visible = game.phase === "play" || game.phase === "finale";
    view.position.z += ((p.aiming ? -0.34 : -0.45) - view.position.z) * Math.min(1, dt * 10);
    view.position.y += ((p.aiming ? -0.14 : -0.22) - view.position.y) * Math.min(1, dt * 10);
    muzzle.material.opacity = Math.max(0, muzzle.material.opacity - dt * 8);

    /* ---- flashlight ---- */
    const fwd = new THREE.Vector3(Math.sin(p.heading), -0.06, Math.cos(p.heading)).normalize();
    wardUniforms.uFlashPos.value.set(p.x, 1.55, p.z);
    wardUniforms.uFlashDir.value.copy(fwd);
    // it flickers when THEY are near
    const nearestFoe = Math.min(
      ...game.shamblers.filter((s) => s.state !== "dead").map((s) => Math.hypot(s.x - p.x, s.z - p.z)),
      game.pursuer.state === "asleep" ? 999 : Math.hypot(game.pursuer.x - p.x, game.pursuer.z - p.z),
    );
    flickerT -= dt;
    if (flickerT <= 0) {
      flickerT = 0.06 + Math.random() * 0.12;
      const danger = nearestFoe < 13;
      flickerLevel = danger && Math.random() < 0.3 ? 0.15 + Math.random() * 0.4 : 1;
    }
    wardUniforms.uFlashOn.value = p.flashOn ? flickerLevel : 0;
    coneMesh.visible = p.flashOn && (game.phase === "play" || game.phase === "finale");
    (coneMesh.material as THREE.MeshBasicMaterial).opacity = 0.045 * flickerLevel;
    wardUniforms.uTime.value = time;

    /* ---- rain (title) ---- */
    if (game.phase === "title") {
      for (const d of rain) {
        d.position.y -= (d.userData.speed as number) * dt;
        if (d.position.y < 0) d.position.y = 12;
      }
    }

    /* ---- enemies ---- */
    for (const s of game.shamblers) {
      const rig = shamblerRigs.get(s.id);
      if (!rig) continue;
      rig.group.visible = true;
      rig.update(dt, time, s.state, s.stateT);
      rig.group.position.set(s.x, 0, s.z);
      rig.group.rotation.y = Math.atan2(p.x - s.x, p.z - s.z);
      // the beam warms them
      bumpEmissive(rig.group, litByBeam(s.x, s.z, 1.2) || s.flash > 0 ? 0.55 : 0);
    }
    const q = game.pursuer;
    pursuer.group.visible = q.state !== "asleep";
    if (pursuer.group.visible) {
      pursuer.update(dt, time, q.state, q.stateT);
      pursuer.group.position.set(q.x, 0, q.z);
      pursuer.group.rotation.y = Math.atan2(p.x - q.x, p.z - q.z);
      bumpEmissive(pursuer.group, litByBeam(q.x, q.z, 1.8) ? 0.5 : 0);
      // its steps are felt
      if (q.state === "chase" || q.state === "patrol") {
        pursuerStepAcc += dt * (q.state === "chase" ? 2.4 : 1.1);
        if (pursuerStepAcc > 1) {
          pursuerStepAcc = 0;
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < 22) audio.pursuerStep();
        }
      }
    }

    /* ---- pickups bob; taken ones vanish ---- */
    for (const pm of pickupMeshes) {
      const pk = game.pickups.find((k) => k.id === pm.id)!;
      pm.mesh.visible = !pk.taken && (!pk.needsPower || game.powerOn);
      if (pm.mesh.visible) {
        pm.mesh.rotation.y = time * 1.4;
        pm.mesh.position.y = 1.0 + Math.sin(time * 2 + pm.mesh.position.x) * 0.06;
      }
    }

    /* ---- the examine beat: the item rotates in the light ---- */
    if (examineMesh && examineKind) {
      const cam = camera.position;
      const f = new THREE.Vector3();
      camera.getWorldDirection(f);
      examineMesh.position.set(cam.x + f.x * 0.9, cam.y + f.y * 0.9 - 0.1, cam.z + f.z * 0.9);
      examineMesh.rotation.y += dt * 1.2;
      examineMesh.rotation.x = Math.sin(time * 0.7) * 0.3;
    }

    /* ---- doors + the finale ---- */
    const dd = wardSet.directorDoor;
    const targetX = game.directorOpen ? 3.6 : 2.05;
    dd.position.x += (targetX - dd.position.x) * Math.min(1, dt * 2.5);
    if (game.phase === "finale") {
      finaleClock += dt;
      const t = finaleClock;
      // doors open, hold, then shut ON THE ARM
      const open = t < 1.2 ? t / 1.2 : t < 2.3 ? 1 : Math.max(0.18, 1 - (t - 2.3) / 0.5);
      wardSet.liftL.position.x = -0.55 - open * 0.55;
      wardSet.liftR.position.x = 0.55 + open * 0.55;
      // it reaches through as they close
      if (t > 2.3) pursuer.armR.rotation.x = -1.6;
    }

    sky.update(time, camera.position);

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game, invOpen, cursor);
    }
    hud.tick(dt * 1000);
  },
});

/** is a point inside the flashlight beam? (for the emissive bump) */
function litByBeam(x: number, z: number, pad: number): boolean {
  const p = game.player;
  if (!p.flashOn) return false;
  const dx = x - p.x;
  const dz = z - p.z;
  const d = Math.hypot(dx, dz);
  if (d > 12 + pad) return false;
  const dot = (dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / (d || 1);
  return dot > 0.75;
}

function bumpEmissive(group: THREE.Group, strength: number): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && "uniforms" in (o.material as THREE.ShaderMaterial)) {
      const u = (o.material as THREE.ShaderMaterial).uniforms;
      if (u.uEmissiveStr) {
        u.uEmissive.value.setHex(PAL.extra.cone);
        u.uEmissiveStr.value += (strength - u.uEmissiveStr.value) * 0.4;
      }
    }
  });
}

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    startGame();
  },
  cam(_mode: string) { /* first-person; the title has its own framing */ },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { buildVisuals(); game.debugFinish(); },
  debug() {
    const p = game.player;
    const q = game.pursuer;
    return {
      cam: camera.position.toArray(),
      player: [p.x, p.z, p.heading],
      phase: game.phase,
      hp: Math.round(p.hp),
      ammo: p.ammo,
      slots: game.slots.slice(),
      prompt: game.prompt,
      flashOn: p.flashOn,
      directorOpen: game.directorOpen,
      powerOn: game.powerOn,
      pursuer: { state: q.state, x: +q.x.toFixed(1), z: +q.z.toFixed(1), d: +Math.hypot(q.x - p.x, q.z - p.z).toFixed(1) },
      shamblers: game.shamblers.map((s) => ({ state: s.state, hp: s.hp, d: +Math.hypot(s.x - p.x, s.z - p.z).toFixed(1) })),
      shotsFired: game.shotsFired,
      hits: game.hits,
      deaths: game.deaths,
      invOpen,
      finaleT: +game.finaleT.toFixed(2),
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleport(x: number, z: number) { game.teleport(x, z); },
  face(x: number, z: number) { game.face(x, z); },
  giveItem(kind: ItemKind) { game.giveItem(kind); },
  heal() { game.heal(); },
  giveAmmo(n: number) { game.giveAmmo(n); },
  forcePowerOn() { game.forcePowerOn(); },
  wakePursuer(state?: "patrol" | "investigate" | "chase") { game.wakePursuer(state); },
  movePursuer(x: number, z: number) { game.pursuer.x = x; game.pursuer.z = z; },
  killShamblers() { game.killShamblers(); },
  aim(on: boolean) { game.aim(on); },
  fire() { game.fire(); },
  interact() { game.interact(); },
  toggleFlash() { game.toggleFlash(); },
  openInv(open: boolean) {
    invOpen = open;
    if (!open) closeOverlays();
  },
  setCursor(i: number) { cursor = i; },
  pressSlot(i: number) { game.pressSlot(i); },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
