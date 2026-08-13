/**
 * main.ts — boots GALE MEADOW and runs the frame loop.
 *
 * Wiring only: sky + meadow + grass assembly, the hero/mob/warden rigs,
 * chase camera with burst snap and perfect-dodge slow-mo, damage-number
 * projection, slash arcs and missile meshes, event plumbing
 * (game → audio/HUD/FX), and the __game harness API.
 * All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { CAMP, CLIFF, ARENA, RINGS, SPAWN, heightAt, WORLD } from "./meadow";
import { buildGrass } from "./grass";
import { buildDressing } from "./world/dressing";
import { Game, type Stance } from "./game";
import { buildHero, buildMosslunk, buildWarden, type HeroPose } from "./characters";
import { DamageNumbers } from "./numbers";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

const SUN_DIR = new THREE.Vector3(-0.55, 0.28, 0.62).normalize(); // low gold sun
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xffe8b8,
  ambient: 0x88a8d8,
  hazeNear: 140,
  hazeFar: 520,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = col(PAL.atmosphere.haze).clone();

const world = new THREE.Group();
scene.add(world);

/* --------------------------------------------------------------------- sky -- */

// silhouettes: the spired city far south-east, the windmill ridge west
function citySpires(a: number): number {
  const cell = Math.floor(a * 22);
  const local = a * 22 - cell;
  const h = fbm(cell * 0.7 + 3.1, 7.7, 2);
  if (h > 0.62) return local < 0.2 ? 1.0 : 0.25; // spire
  return 0.2 + Math.floor(h * 4) / 4 * 0.4;
}
function windmillRidge(a: number): number {
  const cell = Math.floor(a * 16);
  const local = a * 16 - cell;
  const h = 0.25 + Math.floor(fbm(cell * 1.3 + 9.2, 4.4, 2) * 3) / 3 * 0.5;
  if (cell % 5 === 2 && local > 0.4 && local < 0.55) return h + 0.5; // windmill mast
  return h;
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 1500,
  rays: { count: 9, speed: 0.05, amount: 0.18 },
  silhouettes: [
    { radius: 1400, baseY: -14, maxH: 110, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.55, shape: citySpires, segments: 300 },
    { radius: 1300, baseY: -8, maxH: 60, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.35, shape: windmillRidge, segments: 280 },
  ],
});

/* ------------------------------------------------------------------ ground -- */

{
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = col(PAL.terrain.lit);
  const cB = col(PAL.terrain.mid);
  const cDirt = col(0xb09a78);
  const cStone = col(PAL.extra.cliff);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    let c: THREE.Color;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r) {
      c = cDirt;
    } else if (Math.abs(x - CLIFF.x) < CLIFF.w / 2 + 3 && z > CLIFF.z - 6 && z < CLIFF.z + 28) {
      c = cStone;
    } else {
      c = tmp.copy(cA).lerp(cB, fbm(x * 0.03, z * 0.03, 2) > 0.4 ? 0.75 : 0.25).clone();
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...celEnvUniforms() },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vC;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vC = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vC;
      ${CEL_LIGHT_GLSL}
      void main() {
        vec3 c = celLight(vC, normalize(vN), normalize(cameraPosition - vW), 0.0, 42.0, 0.3);
        c = applyHaze(c, logicalDist(vW));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    vertexColors: true,
  });
  world.add(new THREE.Mesh(geo, mat));
}
import { celEnvUniforms, CEL_LIGHT_GLSL } from "@tenyears/core";

buildGrass(world);
const dressing = buildDressing(world);

/* ------------------------------------------------------------------- rigs -- */

const hero = buildHero();
world.add(hero.group);
const warden = buildWarden();
warden.group.position.set(ARENA.x, heightAt(ARENA.x, ARENA.z - 12), ARENA.z - 12);
world.add(warden.group);

const numbers = new DamageNumbers();

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const mobRigs = new Map<number, ReturnType<typeof buildMosslunk>>();
const missileMeshes = new Map<unknown, THREE.Mesh>();

let lobbyBuilt = false;
function buildLobbyVisuals(): void {
  if (lobbyBuilt) return;
  lobbyBuilt = true;
  for (const m of game.mobs) {
    const rig = buildMosslunk(m.id * 3.1);
    rig.group.position.set(m.x, m.y, m.z);
    world.add(rig.group);
    mobRigs.set(m.id, rig);
  }
}

// slash arc: a quick fan flash in front of the hero
const slashArc = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 2.2, 20, 1, -0.6, 1.9),
  new THREE.MeshBasicMaterial({ color: PAL.extra.gale, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
world.add(slashArc);
let slashShowT = 0;

// vortex swirl mesh
const vortex = new THREE.Mesh(
  new THREE.TorusGeometry(2.6, 0.4, 8, 24),
  new THREE.MeshBasicMaterial({ color: PAL.extra.gale, transparent: true, opacity: 0 }),
);
world.add(vortex);
let vortexT = 0;

/* ------------------------------------------------------------------ events -- */

let slowmoT = 0;
let burstSnapT = 0;
let burstPoseT = 0;
let slashPoseT = 0;
let skillPoseT = 0;
let dodgePoseT = 0;

game.events = {
  onHit(x, z, dmg, kind) {
    numbers.spawn(new THREE.Vector3(x, heightAt(x, z) + 1.6, z), dmg, kind);
    audio.hit(kind);
  },
  onSwirl(x, z, dmg) {
    numbers.spawn(new THREE.Vector3(x, heightAt(x, z) + 2.0, z), dmg, "swirl");
    audio.swirl();
  },
  onMobDie(m) {
    const rig = mobRigs.get(m.id);
    if (rig) rig.group.visible = false;
  },
  onSkill(stance) {
    skillPoseT = 0.5;
    audio.skill(stance);
    if (stance === 1) {
      vortexT = 0.9;
      vortex.position.set(
        game.player.x + Math.sin(game.player.heading) * 7,
        heightAt(game.player.x, game.player.z) + 0.6,
        game.player.z + Math.cos(game.player.heading) * 7,
      );
      vortex.rotation.x = Math.PI / 2;
    }
  },
  onBurst(stance) {
    burstSnapT = 0.7;
    burstPoseT = 1.2;
    audio.burst(stance);
    hud.banner(stance === 1 ? "GALE SEVER" : "EMBER SPIRAL", stance === 1 ? "#7ff0d0" : "#ffb05a");
  },
  onDodge() {
    dodgePoseT = 0.35;
    audio.dodge();
  },
  onPerfectDodge() {
    slowmoT = 0.9;
    audio.perfectDodge();
    hud.msg("PERFECT DODGE", 700);
  },
  onPlayerHit(dmg) {
    audio.playerHit();
    chase.addShake(0.5);
    hud.msg(`-${dmg}`, 500, true);
  },
  onBossTelegraph(kind) {
    audio.telegraph(kind);
    if (kind === "spin") hud.msg("IT WINDS UP…", 800, true);
    if (kind === "volley") hud.msg("VOLLEY — PILLARS OR DODGE!", 900, true);
  },
  onCore(exposed) {
    if (exposed) {
      audio.core();
      hud.msg("CORE EXPOSED — HIT IT!", 1400);
    }
  },
  onMissile() { audio.missile(); },
  onRing() { audio.ring(); },
  onGlide(open) { if (open) audio.glide(true); },
  onClimb(on) { if (on) audio.climb(); },
  onLand() { audio.land(); },
  onQuest(stage) {
    if (stage === 1) hud.msg("CAMP CLEARED!", 1600);
    if (stage === 4) audio.bossDown();
  },
  onChest() {
    dressing.chest.visible = true;
    audio.chest();
    hud.msg("A CHEST…", 1600);
  },
  onWin() {
    audio.chest();
    hud.results(game);
  },
  onRespawn() {
    hud.msg("DOWN… BACK ON YOUR FEET", 1600, true);
  },
  onStep() { audio.step(Math.random() < 0.5); },
};

/* ------------------------------------------------------------------- input -- */

const keys = new Set<string>();
let started = false;
let lmb = false;

function firstInput(): void {
  if (started) return;
  started = true;
  audio.init();
  audio.titleSting();
}

function startGame(): void {
  document.getElementById("title")!.classList.add("hidden");
  game.start();
  buildLobbyVisuals();
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  firstInput();
  if (e.code === "Enter") {
    if (game.phase === "title") startGame();
    else if (game.phase === "results") location.reload();
  }
  if (e.code === "Digit1") game.setStance(1);
  if (e.code === "Digit2") game.setStance(2);
  if (e.code === "KeyE") {
    if (!game.claimChest()) game.skill();
  }
  if (e.code === "KeyQ") game.burst();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") game.dodge();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (e.button === 0) lmb = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) lmb = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  startGame();
});

function moveVector(): { x: number; z: number } {
  const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  return { x, z };
}

/* ------------------------------------------------------------------ camera -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 1800,
  heroLightDir: SUN_DIR,
  baseDistance: 5.6,
  baseHeight: 2.4,
  baseFov: 62,
  speedFov: 0.4,
  punchFov: 10,
  orbitRadius: 60,
  orbitHeight: 30,
  ceremonyRadius: 8,
  ceremonyHeight: 3,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const titleTarget = { pos: new THREE.Vector3(10, 6, 40), heading: 0.5, speed: 0 };
const chaseTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0, punch: false, beauty: false };

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, titleTarget, time);
    return;
  }
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed = p.gliding ? 12 : Math.hypot(moveVector().x, moveVector().z) * 7;
  chaseTarget.punch = burstSnapT > 0;
  chaseTarget.beauty = game.phase === "results";
  chase.update(dt, chaseTarget, time);
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: PAL.ink.deep },
);

let hudTick = 0;

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (rawDt, time) => {
    // perfect-dodge slow-mo: scale the game's dt, not the render clock
    slowmoT = Math.max(0, slowmoT - rawDt);
    const dt = slowmoT > 0 ? rawDt * 0.3 : rawDt;

    game.update(dt, moveVector(), keys.has("Space"));

    // held LMB → combo swings
    if (lmb && (game.phase === "play" || game.phase === "boss")) {
      const before = game.player.comboT;
      game.attack();
      if (game.player.comboT > before) {
        slashPoseT = 0.22;
        slashShowT = 0.16;
        audio.slash(game.player.stance);
        (slashArc.material as THREE.MeshBasicMaterial).color.set(
          game.player.stance === 1 ? PAL.extra.gale : PAL.extra.flame,
        );
      }
    }

    updateCamera(rawDt, time);

    /* ---- hero ---- */
    const p = game.player;
    let pose: HeroPose = "idle";
    if (burstPoseT > 0) pose = "burst";
    else if (skillPoseT > 0) pose = "skill";
    else if (slashPoseT > 0) pose = "slash";
    else if (dodgePoseT > 0) pose = "dodge";
    else if (p.climbing) pose = "climb";
    else if (p.gliding) pose = "glide";
    else if (Math.hypot(moveVector().x, moveVector().z) > 0.05) pose = "run";
    hero.update(dt, time, 6, pose);
    hero.setStanceColors(p.stance);
    // place AFTER the pose update (poses write local y/rotation)
    hero.group.position.set(p.x, p.y, p.z);
    hero.group.rotation.y = p.heading;
    hero.group.visible = game.phase !== "title";
    burstPoseT = Math.max(0, burstPoseT - rawDt);
    skillPoseT = Math.max(0, skillPoseT - rawDt);
    slashPoseT = Math.max(0, slashPoseT - rawDt);
    dodgePoseT = Math.max(0, dodgePoseT - rawDt);
    burstSnapT = Math.max(0, burstSnapT - rawDt);

    // slash arc in front of the hero
    slashShowT = Math.max(0, slashShowT - rawDt);
    (slashArc.material as THREE.MeshBasicMaterial).opacity = slashShowT > 0 ? 0.7 : 0;
    if (slashShowT > 0) {
      slashArc.position.set(p.x + Math.sin(p.heading) * 1.6, p.y + 1.2, p.z + Math.cos(p.heading) * 1.6);
      slashArc.rotation.set(-Math.PI / 2, 0, -p.heading + 0.6 - (0.16 - slashShowT) * 6);
    }
    // vortex
    vortexT = Math.max(0, vortexT - rawDt);
    (vortex.material as THREE.MeshBasicMaterial).opacity = vortexT * 0.7;
    if (vortexT > 0) {
      vortex.rotation.z = time * 8;
      vortex.scale.setScalar(1 + Math.sin(time * 10) * 0.1);
    }

    /* ---- mobs ---- */
    for (const m of game.mobs) {
      const rig = mobRigs.get(m.id);
      if (!rig || m.dead) continue;
      rig.group.position.set(m.x, m.y, m.z);
      rig.group.rotation.y = Math.atan2(p.x - m.x, p.z - m.z);
      rig.update(dt, time, m.flash);
    }

    /* ---- the warden ---- */
    const b = game.boss;
    warden.group.userData.heading = b.heading;
    warden.update(dt, time, b.state, b.stateT);
    // place AFTER the update (its sway writes local y)
    warden.group.position.set(b.x, heightAt(b.x, b.z), b.z);
    if (b.state !== "spin") warden.group.rotation.y = b.heading;
    // missiles
    for (const m of b.missiles) {
      let mesh = missileMeshes.get(m);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshBasicMaterial({ color: PAL.extra.core }),
        );
        world.add(mesh);
        missileMeshes.set(m, mesh);
      }
      mesh.position.set(m.x, m.y, m.z);
    }
    for (const [m, mesh] of missileMeshes) {
      if (!(m as { dead: boolean }).dead && !b.missiles.includes(m as never)) {
        world.remove(mesh);
        missileMeshes.delete(m);
      }
    }

    numbers.update(rawDt, chase.camera);
    dressing.update(dt, time);
    sky.update(time, chase.camera.position);
    audio.update(dt, p.gliding);

    /* ---- HUD ---- */
    hudTick += rawDt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
    }
    hud.tick(rawDt * 1000);
  },
});

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    startGame();
  },
  cam(mode: string) {
    camOverride = mode === "auto" ? null : (mode as CamMode);
  },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { buildLobbyVisuals(); game.debugFinish(); },
  debug() {
    const p = game.player;
    return {
      cam: chase.camera.position.toArray(),
      player: [p.x, p.y, p.z],
      phase: game.phase,
      hp: p.hp,
      stamina: p.stamina,
      energy: p.energy,
      quest: game.quest,
      boss: { state: game.boss.state, hp: game.boss.hp },
      mobsAlive: game.mobs.filter((m) => !m.dead).length,
      biggestSwirl: game.biggestSwirl,
      pixelScale: loop.pixelScale,
    };
  },
  teleport(x: number, z: number) { game.teleport(x, z); },
  pullMob() { game.debugPullMob(); },
  toBoss() { game.debugToBoss(); },
  toCamp() { game.teleport(CAMP.x + 10, CAMP.z + 10); },
  toCliff() { game.teleport(CLIFF.x, CLIFF.z - 10); },
  toArena() { game.teleport(ARENA.x, ARENA.z + ARENA.r - 4); },
  glide() { game.debugGlide(); },
  setEnergy(n: number) { game.setEnergy(n); },
  stance(s: Stance) { game.setStance(s); },
  killCamp() { game.debugKillCamp(); },
  bossState(s: "spin" | "core" | "volley") { buildLobbyVisuals(); game.debugBossState(s); },
  skill() { game.skill(); },
  burst() { game.burst(); },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
