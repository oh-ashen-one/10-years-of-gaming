/**
 * main.ts — boots DUSTFALL ISLAND and runs the frame loop.
 *
 * Wiring only: renderer + sky + island assembly, input, per-phase cameras
 * (title island orbit / plane chase / dive chase with FOV kick /
 * over-shoulder ground cam / ceremony), event plumbing (game → audio /
 * HUD / FX), the aim-ray feed for hitscan, and the __game harness API.
 * All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { COMPOUNDS, heightAt, WHEAT } from "./island";
import { buildTerrain } from "./world/terrain";
import { buildIslandDressing } from "./world/dressing";
import { ZoneFX } from "./world/zone";
import { Game, WEAPONS, type WeaponId } from "./game";
import { buildSurvivor, buildCrate, type SurvivorPose } from "./characters";
import { buildPlane, buildBuggy, buildChute } from "./vehicles";
import { buildLootMesh, PuffSystem, TracerSystem } from "./fx";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

const SUN_DIR = new THREE.Vector3(0.5, 0.62, 0.35).normalize(); // high late-afternoon sun
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xffe8c0,
  ambient: 0x8a9ac8,
  hazeNear: 260,
  hazeFar: 1100,
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

/* ------------------------------------------------------------------- world -- */

// silhouette rings: distant ridge, treeline blocks, the radar station
function ridge(seed: number, levels: number): (a: number) => number {
  return (a: number) => {
    const n = fbm(Math.cos(a) * 2.4 + seed, Math.sin(a) * 2.4 - seed, 4);
    return Math.floor(n * levels) / levels * 0.75 + 0.25;
  };
}
function radarStation(a: number): number {
  // one azimuth carries the radar station: a tower spike with a dish cap
  const cell = Math.floor(a * 14);
  const local = a * 14 - cell;
  if (cell % 14 !== 3) return 0;
  return local < 0.1 ? 1.7 : local < 0.22 ? 0.45 : 0;
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 2200,
  rays: false,
  silhouettes: [
    { radius: 2100, baseY: -20, maxH: 130, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.6, shape: ridge(47.9, 5), segments: 300 },
    { radius: 2000, baseY: -14, maxH: 70, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.4, shape: ridge(7.7, 3), segments: 280 },
    { radius: 1920, baseY: -10, maxH: 55, color: PAL.atmosphere.silhouetteNear, hazeMix: 0.25, shape: (a) => ridge(3.1, 3)(a) * 0.7 + radarStation(a), segments: 280 },
  ],
});

buildTerrain(world);
buildIslandDressing(world);
const zone = new ZoneFX(world);

const planeRig = buildPlane();
world.add(planeRig.group);
const buggyRig = buildBuggy();
world.add(buggyRig.group);
const chute = buildChute();
chute.visible = false;

const playerRig = buildSurvivor(1.7, true);
world.add(playerRig.group);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

interface BotVisual {
  rig: ReturnType<typeof buildSurvivor>;
  crate: THREE.Mesh | null;
  dead: boolean;
}
const botVisuals = new Map<number, BotVisual>();
const lootVisuals = new Map<number, THREE.Group>();

const puffs = new PuffSystem(world);
const tracers = new TracerSystem(world);

let lobbyBuilt = false;
function buildLobbyVisuals(): void {
  if (lobbyBuilt) return;
  lobbyBuilt = true;
  for (const b of game.bots) {
    const rig = buildSurvivor(b.id * 3.7 + 2.1, false);
    rig.group.position.set(b.x, heightAt(b.x, b.z), b.z);
    world.add(rig.group);
    botVisuals.set(b.id, { rig, crate: null, dead: false });
  }
  for (const item of game.loot) {
    const m = buildLootMesh(item);
    world.add(m);
    lootVisuals.set(item.id, m);
  }
}

/* ------------------------------------------------------------------ events -- */

let winT = -1;
let stepAlt = false;
const _v = new THREE.Vector3();

game.events = {
  onJump() {
    audio.jump();
    audio.stopPlane();
  },
  onChute() {
    chute.visible = true;
    if (!chute.parent) playerRig.group.add(chute);
    audio.chute();
  },
  onLand() {
    chute.visible = false;
    audio.land();
    audio.setDiveWind(0);
    puffs.burst(game.player.x, game.player.y + 0.4, game.player.z, 0xc8b898, 10, 3, 0.7);
    hud.msg("BOOTS DOWN — FIND A WEAPON", 2000);
  },
  onStep(surface) {
    stepAlt = !stepAlt;
    audio.footstep(surface, stepAlt);
  },
  onPickup(item) {
    audio.pickup();
    const m = lootVisuals.get(item.id);
    if (m) m.visible = false;
    hud.msg(
      item.type === "weapon" ? `${WEAPONS[item.weapon!].name}` : item.type === "armor" ? "ARMOR VEST" : `MEDKIT +40`,
      1100,
    );
  },
  onFire(w) {
    audio.gunshot(w);
    chase.addShake(w === "shotgun" ? 0.4 : w === "rifle" ? 0.18 : 0.1);
    // muzzle → along the aim ray
    const p = game.player;
    _v.set(p.x + Math.sin(p.heading) * 0.5, p.y + 1.35, p.z + Math.cos(p.heading) * 0.5);
    const dir = new THREE.Vector3(game.aim.dx, game.aim.dy, game.aim.dz);
    tracers.fire(_v, dir, WEAPONS[w].range * 0.6);
  },
  onReload() { audio.reload(); },
  onHitmark(kill) {
    hud.hitmark(kill);
    audio.hitmark(kill);
  },
  onBlood(x, z) {
    puffs.burst(x, heightAt(x, z) + 1.1, z, PAL.extra.blood, 7, 2.6, 0.45);
  },
  onPlayerHit(dmg) {
    audio.playerHit();
    chase.addShake(0.5);
    hud.msg(`-${dmg}`, 500, true);
  },
  onFeed(text, mine) {
    hud.killFeed(text, mine);
    // distant gunfire for flavor when bots trade offscreen
    if (!mine) audio.gunshot("rifle", true);
  },
  onSquash() {
    audio.squash();
    chase.addShake(0.8);
  },
  onCircleWarn(stage) {
    audio.circleWarn();
    hud.msg(`ZONE ${stage} SHRINKS SOON — CHECK MAP (TAB)`, 2600, true);
  },
  onCircleClose(stage) {
    audio.circleClose();
    hud.msg(`ZONE ${stage} CLOSING`, 1800, true);
  },
  onZoneTick(dps) {
    hud.msg(`ZONE -${dps}`, 450, true);
  },
  onBuggyEnter() {
    audio.pickup();
  },
  onBuggyExit() {
    audio.land();
  },
  onWin() {
    winT = 0;
    hud.banner(true);
    audio.dinner();
    chase.setMode("ceremony");
  },
  onLose() {
    audio.loseSting();
    hud.results(game);
  },
};

/* ------------------------------------------------------------------- input -- */

const keys = new Set<string>();
let started = false;
let rmb = false;
let lmb = false;
let bigMap = false;

function firstInput(): void {
  if (started) return;
  started = true;
  audio.init();
  audio.titleSting();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Tab") e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  firstInput();
  if (e.code === "Enter") {
    if (game.phase === "title") {
      document.getElementById("title")!.classList.add("hidden");
      game.start();
      buildLobbyVisuals();
      audio.startPlane();
    } else if (game.phase === "results") {
      location.reload();
    }
  }
  if (e.code === "Space") {
    if (game.phase === "plane") game.jump();
  }
  if (e.code === "KeyF") game.interact();
  if (e.code === "KeyR") game.reload();
  if (e.code === "KeyC") game.toggleProne();
  if (e.code === "Tab") bigMap = !bigMap;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (e.button === 2) rmb = true;
  if (e.button === 0) lmb = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 2) rmb = false;
  if (e.button === 0) lmb = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  document.getElementById("title")!.classList.add("hidden");
  game.start();
  buildLobbyVisuals();
  audio.startPlane();
});

function moveVector(): { x: number; z: number } {
  // arrows aim-nudge on the ground; they steer only in the drop
  const steer = game.phase !== "ground";
  const x =
    (keys.has("KeyD") || (steer && keys.has("ArrowRight")) ? 1 : 0) -
    (keys.has("KeyA") || (steer && keys.has("ArrowLeft")) ? 1 : 0);
  const z =
    (keys.has("KeyS") || (steer && keys.has("ArrowDown")) ? 1 : 0) -
    (keys.has("KeyW") || (steer && keys.has("ArrowUp")) ? 1 : 0);
  return { x, z };
}

// aim nudge (arrows during ground phase)
const nudge = { x: 0, y: 0 };

/* ------------------------------------------------------------------ camera -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 2600,
  heroLightDir: SUN_DIR,
  baseDistance: 5.2,
  speedDistance: 0.06,
  baseHeight: 2.2,
  lookAhead: 2.6,
  lookAheadSpeed: 0.05,
  baseFov: 68,
  speedFov: 0.35,
  orbitRadius: 420,
  orbitHeight: 200,
  ceremonyRadius: 15,
  ceremonyHeight: 7,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const islandTarget = { pos: new THREE.Vector3(0, 0, 0), heading: 0.6, speed: 0 };
const planeTarget = { pos: new THREE.Vector3(), heading: 0.42, speed: 55 };
const chaseTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0, fovBias: 0 };
const resultsTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0 };

const planePos = new THREE.Vector3(-750, 260, -350);
const PLANE_DIR = new THREE.Vector3(1500, 0, 700).normalize();

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  // the plane keeps flying after the jump until it leaves the island
  if ((game.phase === "plane" || game.phase === "drop") && planePos.length() < 1200) {
    planePos.add(PLANE_DIR.clone().multiplyScalar(55 * dt));
    planeRig.group.position.copy(planePos);
    planeRig.group.rotation.y = Math.atan2(PLANE_DIR.x, PLANE_DIR.z);
  }
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, islandTarget, time);
    return;
  }
  if (game.phase === "plane") {
    chase.setMode(camOverride ?? "chase");
    planeTarget.pos.copy(planePos);
    planeTarget.heading = Math.atan2(PLANE_DIR.x, PLANE_DIR.z);
    chase.update(dt, planeTarget, time);
    return;
  }
  if (game.phase === "results") {
    chase.setMode(camOverride ?? "ceremony");
    resultsTarget.pos.set(p.x, p.y + 1, p.z);
    chase.update(dt, resultsTarget, time);
    return;
  }
  // drop + ground: chase behind the player
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed =
    game.phase === "drop"
      ? game.chute ? 8 : 38
      : p.inBuggy
        ? Math.abs(game.buggy.speed) * 1.6
        : lastMoveMag * 6;
  chaseTarget.fovBias = rmb && game.phase === "ground" ? -13 : 0;
  chase.update(dt, chaseTarget, time);
}

let lastMoveMag = 0;

/* -------------------------------------------------------------- aim ray -- */

const _dir = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

function updateAim(): void {
  chase.camera.getWorldDirection(_dir);
  // apply arrow-key nudge in camera space
  _e.set(nudge.y, nudge.x, 0, "YXZ");
  _q.setFromEuler(_e);
  // rotate dir around camera-local axes: build in camera space
  const camQ = chase.camera.quaternion;
  const local = new THREE.Vector3(nudge.x, nudge.y, 1).normalize(); // slight yaw/pitch offsets
  _dir.copy(local.applyQuaternion(camQ)).normalize();
  const cp = chase.camera.position;
  game.aim.ox = cp.x;
  game.aim.oy = cp.y;
  game.aim.oz = cp.z;
  game.aim.dx = _dir.x;
  game.aim.dy = _dir.y;
  game.aim.dz = _dir.z;
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: PAL.ink.deep },
);

let hudTick = 0;
const camQuat = new THREE.Quaternion();

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (dt, time) => {
    const move = moveVector();
    lastMoveMag = Math.hypot(move.x, move.z);
    const aimScale = rmb ? 0.5 : 1;
    game.update(
      dt,
      game.phase === "ground" || game.phase === "drop"
        ? { x: move.x * aimScale, z: move.z * aimScale }
        : { x: 0, z: 0 },
      keys.has("ShiftLeft") || keys.has("ShiftRight"),
    );

    // aim nudge with arrows (ground phase)
    if (game.phase === "ground") {
      const nx = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      const ny = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
      nudge.x = THREE.MathUtils.clamp(nudge.x + nx * dt * 0.5, -0.35, 0.35);
      nudge.y = THREE.MathUtils.clamp(nudge.y + ny * dt * 0.35, -0.22, 0.22);
      if (nx === 0) nudge.x *= 1 - Math.min(1, dt * 0.7);
      if (ny === 0) nudge.y *= 1 - Math.min(1, dt * 0.7);
      hud.setCross(nudge.x, nudge.y);
    }

    // held fire
    if ((keys.has("Space") || lmb) && game.phase === "ground") game.tryFire();

    updateAim();
    updateCamera(dt, time);

    /* ---- player rig ---- */
    const p = game.player;
    playerRig.group.position.set(p.x, p.y, p.z);
    playerRig.group.rotation.y = p.heading;
    playerRig.group.visible = game.phase !== "plane" && game.phase !== "title";
    let pose: SurvivorPose = "idle";
    if (game.phase === "drop") pose = game.chute ? "aim" : "run";
    else if (p.inBuggy) pose = "drive";
    else if (p.prone) pose = "prone";
    else if (rmb) pose = "aim";
    else if (lastMoveMag > 0.05) pose = "run";
    playerRig.update(dt, time, game.phase === "drop" ? 30 : 6, pose);
    if (game.phase === "drop" && !game.chute) {
      playerRig.group.rotation.x = 0.9; // superman dive
    } else {
      playerRig.group.rotation.x = 0;
    }

    /* ---- bots ---- */
    for (const b of game.bots) {
      const v = botVisuals.get(b.id);
      if (!v) continue;
      if (b.state === "dead") {
        if (!v.dead) {
          v.dead = true;
          v.rig.group.visible = false;
          v.crate = buildCrate();
          v.crate.position.set(b.x, heightAt(b.x, b.z) + 0.25, b.z);
          world.add(v.crate);
        }
        continue;
      }
      v.rig.group.position.set(b.x, heightAt(b.x, b.z), b.z);
      const poseB: SurvivorPose = b.state === "fight" ? "aim" : b.state === "loot" ? "idle" : "run";
      v.rig.update(dt, time + b.id * 1.3, 4, poseB);
      if (b.state === "fight") {
        // face nearest threat (approx: face player if close, else circle)
        const pd = Math.hypot(p.x - b.x, p.z - b.z);
        const tx = pd < 80 ? p.x : game.target.cx;
        const tz = pd < 80 ? p.z : game.target.cz;
        v.rig.group.rotation.y = Math.atan2(tx - b.x, tz - b.z);
      } else {
        v.rig.group.rotation.y = Math.atan2(b.tx - b.x, b.tz - b.z);
      }
    }

    /* ---- vehicles / zone / fx ---- */
    buggyRig.group.position.set(game.buggy.x, heightAt(game.buggy.x, game.buggy.z), game.buggy.z);
    buggyRig.group.rotation.y = game.buggy.heading;
    buggyRig.update(dt, time, game.buggy.speed);
    planeRig.update(dt);
    zone.update(game.wall, game.target, game.stage);

    chase.camera.getWorldQuaternion(camQuat);
    puffs.update(dt, camQuat);
    tracers.update(dt);
    sky.update(time, chase.camera.position);

    // audio trackers
    if (audio.ready) {
      if (game.phase === "drop") audio.setDiveWind(game.chute ? 0.15 : 1);
      audio.setBuggy(p.inBuggy, Math.min(1, Math.abs(game.buggy.speed) / 23));
      const inZone = Math.hypot(p.x - game.wall.cx, p.z - game.wall.cz) <= game.wall.r;
      audio.zoneCrackle(game.stage > 0 && !inZone);
    }

    // win → banner holds, then results card
    if (game.phase === "results" && game.won && winT >= 0) {
      winT += dt;
      if (winT > 3.2) {
        hud.results(game);
        winT = -1;
      }
    }

    /* ---- HUD at ~30 Hz ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      const camYaw = Math.atan2(
        chase.camera.getWorldDirection(_v).x,
        _v.z,
      );
      hud.update(game, bigMap, camYaw);
      hud.prompt(currentPrompt());
    }
    hud.tick(dt * 1000);
  },
});

function currentPrompt(): string {
  const p = game.player;
  if (game.phase === "plane") return `<b>SPACE</b> — JUMP`;
  if (game.phase === "drop") return game.chute ? `STEER — <b>WASD</b>` : `<b>WASD</b> — STEER THE DIVE`;
  if (game.phase !== "ground") return "";
  if (p.inBuggy) return `<b>F</b> — GET OUT · <b>WASD</b> DRIVE`;
  const item = game.nearestLoot();
  if (item) {
    return item.type === "weapon"
      ? `<b>F</b> — TAKE ${WEAPONS[item.weapon!].name}`
      : item.type === "armor" ? `<b>F</b> — WEAR ARMOR VEST` : `<b>F</b> — USE MEDKIT (+40)`;
  }
  const bd = Math.hypot(p.x - game.buggy.x, p.z - game.buggy.z);
  if (bd < 3.2) return `<b>F</b> — DRIVE THE BUGGY`;
  if (!p.weapon) return `FIND A WEAPON — CHECK THE COMPOUNDS`;
  return "";
}

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    document.getElementById("title")!.classList.add("hidden");
    game.autostart();
    buildLobbyVisuals();
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
      heading: p.heading,
      phase: game.phase,
      hp: p.hp,
      alive: game.aliveCount(),
      kills: game.kills,
      stage: game.stage,
      wall: game.wall,
      chute: game.chute,
      weapon: p.weapon,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks for the shot list + e2e */
  jump() { game.jump(); },
  land(compound = 0) { buildLobbyVisuals(); game.debugLand(compound); },
  dropOver(compound = 0, alt = 70) {
    buildLobbyVisuals();
    if (game.phase === "title") game.start();
    audio.stopPlane();
    const c = COMPOUNDS[compound];
    game.player.x = c.x;
    game.player.z = c.z + 18;
    game.player.y = alt;
    game.chute = true;
    if (game.phase !== "drop") {
      game.phase = "drop";
    }
    chute.visible = true;
    playerRig.group.add(chute);
  },
  setCircle(stage: 1 | 2 | 3) { game.debugCircle(stage); },
  setAlive(n: number) { game.debugAlive(n); },
  buggy() { buildLobbyVisuals(); game.debugBuggy(); },
  exitBuggy() { if (game.player.inBuggy) game.interact(); },
  pullBot(dist = 14) { game.debugPullBot(dist); },
  killNearest() { game.debugKillNearestBot(); },
  prone() { if (!game.player.prone) game.toggleProne(); },
  giveWeapon(id: WeaponId) {
    game.player.weapon = id;
    game.player.mag = WEAPONS[id].mag;
  },
  teleport(x: number, z: number) {
    game.player.x = x;
    game.player.z = z;
    game.player.y = heightAt(x, z);
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
