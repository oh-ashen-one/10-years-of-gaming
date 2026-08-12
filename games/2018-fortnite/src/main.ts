/**
 * main.ts — boots BUILD ROYALE and runs the frame loop.
 *
 * Wiring only: renderer + sky + island assembly, input (move / jump-glide
 * / swing-fire / build mode Q + place + G edit / E chests / Tab... map is
 * the always-on minimap), per-phase cameras (title diorama / bus chase /
 * dive & glide / over-shoulder ground / victory ceremony), event plumbing
 * (game → audio/HUD/FX), and the __game harness API.
 * All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { TILTED, HILL, heightAt, CELL, STORY } from "./map";
import { buildTerrain } from "./world/terrain";
import { buildDressing } from "./world/dressing";
import { StormFX, BuildVisuals } from "./world/builds";
import { Game, WEAPONS, type WeaponId } from "./game";
import { buildSurvivor, buildCrate, type Pose } from "./characters";
import { buildBus, buildGlider, PuffSystem, TracerSystem } from "./rigs";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

const SUN_DIR = new THREE.Vector3(0.45, 0.55, 0.4).normalize();
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xfff0c8,
  ambient: 0x9aa8d8,
  hazeNear: 200,
  hazeFar: 800,
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

// silhouette rings: rolling hills + the leaning water tower, twice told
function hills(seed: number): (a: number) => number {
  return (a: number) => {
    const n = fbm(Math.cos(a) * 1.8 + seed, Math.sin(a) * 1.8 - seed, 3);
    return Math.floor(n * 4) / 4 * 0.7 + 0.3;
  };
}
function towerSpike(a: number): number {
  const cell = Math.floor(a * 10);
  const local = a * 10 - cell;
  if (cell % 10 !== 5) return 0;
  if (local < 0.06) return 1.5;         // the tower
  if (local > 0.08 && local < 0.16) return 1.1; // the tank cap (leaning)
  return 0;
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 1700,
  rays: { count: 10, speed: 0.03, amount: 0.16 },
  silhouettes: [
    { radius: 1600, baseY: -16, maxH: 90, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.6, shape: hills(9.3), segments: 280 },
    { radius: 1500, baseY: -10, maxH: 60, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.4, shape: hills(4.1), segments: 260 },
    { radius: 1420, baseY: -8, maxH: 42, color: PAL.atmosphere.silhouetteNear, hazeMix: 0.25, shape: (a) => hills(1.7)(a) * 0.6 + towerSpike(a), segments: 260 },
  ],
});

buildTerrain(world);
const dressing = buildDressing(world);
const storm = new StormFX(world);
const buildsViz = new BuildVisuals(world);

const busRig = buildBus();
world.add(busRig.group);
const glider = buildGlider();
glider.visible = false;

const playerRig = buildSurvivor(1.3, true);
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
const puffs = new PuffSystem(world);
const tracers = new TracerSystem(world);

let lobbyBuilt = false;
function buildLobbyVisuals(): void {
  if (lobbyBuilt) return;
  lobbyBuilt = true;
  for (const b of game.bots) {
    const rig = buildSurvivor(b.id * 7.7 + 3.1, false);
    rig.group.position.set(b.x, heightAt(b.x, b.z), b.z);
    world.add(rig.group);
    botVisuals.set(b.id, { rig, crate: null, dead: false });
  }
}

/* ------------------------------------------------------------------ events -- */

let winT = -1;
let stepAlt = false;
let jingleT = 0;
const _v = new THREE.Vector3();

game.events = {
  onJump() {
    audio.jump();
    audio.stopBus();
  },
  onGlider(open) {
    glider.visible = open;
    if (open && !glider.parent) playerRig.group.add(glider);
    audio.glider(open);
  },
  onLand() {
    glider.visible = false;
    audio.land();
    audio.setDiveWind(0);
    puffs.burst(game.player.x, game.player.y + 0.4, game.player.z, 0xd8c8a8, 9, 3, 0.6);
    hud.msg("LOOT UP — WATCH THE SKIES", 2000);
  },
  onStep() {
    stepAlt = !stepAlt;
    audio.footstep(stepAlt);
  },
  onSwing() {
    audio.swing();
  },
  onHarvestChip(kind, x, z) {
    audio.whack(kind);
    const color = kind === "tree" ? PAL.extra.wood : kind === "car" ? PAL.extra.metal : PAL.extra.brick;
    puffs.burst(x, heightAt(x, z) + 1.2, z, color, 6, 3, 0.4);
    // shake the mesh
    const t = game.harvestTarget();
    if (t) dressing.chip(t.kind === "brick" ? "brick" : t.kind, t.id);
  },
  onTreeFall(id) {
    dressing.treeFall(id);
    audio.treeFall();
  },
  onCarCrush(id) {
    dressing.carCrush(id);
    audio.carCrush();
  },
  onChestOpen(id, what) {
    dressing.chestOpen(id);
    audio.chestOpen();
    hud.msg(what, 1400);
    const c = game.chests.find((v) => v.id === id);
    if (c) puffs.burst(c.x, heightAt(c.x, c.z) + 1, c.z, PAL.extra.chest, 12, 3.5, 0.5);
  },
  onFire(w) {
    audio.gunshot(w);
    chase.addShake(w === "pump" ? 0.4 : 0.15);
    const p = game.player;
    _v.set(p.x + Math.sin(p.heading) * 0.5, p.y + 1.35, p.z + Math.cos(p.heading) * 0.5);
    tracers.fire(_v, new THREE.Vector3(game.aim.dx, game.aim.dy, game.aim.dz), WEAPONS[w].range * 0.6);
  },
  onReload() { audio.reload(); },
  onHitmark(kill) {
    hud.hitmark(kill);
    audio.hitmark(kill);
  },
  onBlood(x, z) {
    puffs.burst(x, game.groundAt(x, z) + 1.1, z, 0xe04a5a, 7, 2.6, 0.4);
  },
  onPlayerHit(dmg) {
    audio.playerHit();
    chase.addShake(0.5);
    hud.msg(`-${dmg}`, 500, true);
  },
  onFeed(text, mine) {
    hud.killFeed(text, mine);
    if (!mine) audio.gunshot("ar", true);
  },
  onBuild(piece) {
    buildsViz.add(piece);
    audio.build();
  },
  onBuildEdit(piece) {
    buildsViz.edit(piece);
    audio.edit();
  },
  onBuildBreak(piece) {
    buildsViz.remove(piece);
    audio.buildBreak();
    puffs.burst(piece.x, piece.y + 1.5, piece.z, PAL.extra.wood, 10, 3.5, 0.5);
  },
  onBotFall(b) {
    audio.botFall();
    hud.msg(`${b.name} FELL!`, 900);
  },
  onStormWarn(stage) {
    audio.stormWarn();
    hud.msg(`STORM ${stage} SHRINKS SOON — EYE MARKED`, 2600, true);
  },
  onStormClose(stage) {
    audio.stormClose();
    hud.msg(`STORM ${stage} CLOSING`, 1800, true);
  },
  onZoneTick(dps) {
    hud.msg(`STORM -${dps}`, 450, true);
  },
  onWin() {
    winT = 0;
    hud.banner(true);
    audio.victory();
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
let lmb = false;
let rmb = false;

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
  audio.startBus();
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
  if (e.code === "Space") game.space();
  if (e.code === "KeyQ") game.cycleBuild();
  if (e.code === "KeyG") game.editNearest();
  if (e.code === "KeyE") game.interact();
  if (e.code === "KeyR") game.reload();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (e.button === 0) lmb = true;
  if (e.button === 2) rmb = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) lmb = false;
  if (e.button === 2) rmb = false;
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
  far: 2000,
  heroLightDir: SUN_DIR,
  baseDistance: 5.4,
  speedDistance: 0.05,
  baseHeight: 2.3,
  lookAhead: 2.4,
  lookAheadSpeed: 0.05,
  baseFov: 68,
  speedFov: 0.3,
  orbitRadius: 150,
  orbitHeight: 70,
  ceremonyRadius: 10,
  ceremonyHeight: 3.5,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const titleTarget = { pos: new THREE.Vector3(TILTED.x, 8, TILTED.z), heading: 0.7, speed: 0 };
const busTarget = { pos: new THREE.Vector3(), heading: 0.68, speed: 30 };
const chaseTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0, fovBias: 0 };
const resultsTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0 };

const BUS_DIR = new THREE.Vector3(860, 0, 560).normalize();
const busPos = new THREE.Vector3(-430, 120, -280);
let lastMoveMag = 0;

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  if (game.phase === "bus" || game.phase === "drop" || game.phase === "title") {
    if (busPos.length() < 900) busPos.add(BUS_DIR.clone().multiplyScalar(30 * dt));
    busRig.group.position.x = busPos.x;
    busRig.group.position.z = busPos.z;
    busRig.group.position.y = busPos.y;
    busRig.group.rotation.y = Math.atan2(BUS_DIR.x, BUS_DIR.z);
  }
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, titleTarget, time);
    return;
  }
  if (game.phase === "bus") {
    chase.setMode(camOverride ?? "chase");
    busTarget.pos.copy(busPos);
    busTarget.heading = Math.atan2(BUS_DIR.x, BUS_DIR.z);
    chase.update(dt, busTarget, time);
    return;
  }
  if (game.phase === "results") {
    chase.setMode(camOverride ?? "ceremony");
    resultsTarget.pos.set(p.x, p.y + 0.8, p.z);
    chase.update(dt, resultsTarget, time);
    return;
  }
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed =
    game.phase === "drop" ? (p.glider ? 12 : 30) : lastMoveMag * 6;
  chaseTarget.fovBias = rmb && game.phase === "ground" ? -12 : 0;
  chase.update(dt, chaseTarget, time);
}

/* -------------------------------------------------------------- aim ray -- */

const _dir = new THREE.Vector3();

function updateAim(): void {
  chase.camera.getWorldDirection(_dir);
  const yaw = Math.atan2(_dir.x, _dir.z);
  const p = game.player;
  game.aim.ox = p.x;
  game.aim.oy = p.y + 1.35;
  game.aim.oz = p.z;
  game.aim.dx = Math.sin(yaw);
  game.aim.dy = -0.02;
  game.aim.dz = Math.cos(yaw);
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
let swingPoseT = 0;

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (dt, time) => {
    const move = moveVector();
    lastMoveMag = Math.hypot(move.x, move.z);
    game.update(
      dt,
      game.phase === "ground" || game.phase === "drop"
        ? { x: move.x * (rmb ? 0.55 : 1), z: move.z * (rmb ? 0.55 : 1) }
        : { x: 0, z: 0 },
      keys.has("ShiftLeft") || keys.has("ShiftRight"),
    );

    // held LMB: place in build mode, swing/fire otherwise
    if (lmb && game.phase === "ground") {
      if (game.buildMode) {
        const piece = game.tryPlace();
        if (piece) lmb = false; // one piece per click... allow hold-to-place? keep click
      } else {
        if (game.harvestTarget()) swingPoseT = 0.45;
        game.primaryAction();
      }
    }
    swingPoseT = Math.max(0, swingPoseT - dt);

    updateAim();
    updateCamera(dt, time);

    /* ---- player rig ---- */
    const p = game.player;
    playerRig.group.position.set(p.x, p.y, p.z);
    playerRig.group.rotation.y = p.heading;
    playerRig.group.visible = game.phase === "ground" || game.phase === "drop" || game.phase === "results";
    let pose: Pose = "idle";
    if (game.phase === "drop") pose = p.glider ? "glide" : "dive";
    else if (game.phase === "results" && game.won) pose = "dance";
    else if (swingPoseT > 0) pose = "swing";
    else if (rmb) pose = "aim";
    else if (lastMoveMag > 0.05) pose = "run";
    playerRig.update(dt, time, 6, pose);

    /* ---- bots ---- */
    for (const b of game.bots) {
      const v = botVisuals.get(b.id);
      if (!v) continue;
      if (b.state === "dead") {
        if (!v.dead) {
          v.dead = true;
          v.rig.group.visible = false;
          v.crate = buildCrate();
          v.crate.position.set(b.x, game.groundAt(b.x, b.z) + 0.25, b.z);
          world.add(v.crate);
        }
        continue;
      }
      v.rig.group.position.set(b.x, game.groundAt(b.x, b.z), b.z);
      const poseB: Pose = b.state === "fight" ? "aim" : b.state === "stunned" ? "idle" : b.state === "loot" ? "idle" : "run";
      v.rig.update(dt, time + b.id * 1.7, 4, poseB);
      v.rig.group.rotation.y =
        b.state === "fight"
          ? Math.atan2(p.x - b.x, p.z - b.z)
          : Math.atan2(b.tx - b.x, b.tz - b.z);
    }

    /* ---- build ghost ---- */
    if (game.buildMode && game.phase === "ground") {
      const cell = game.ghostCell();
      buildsViz.updateGhost(
        game.buildMode, cell,
        game.canPlace(game.buildMode, cell.gx, cell.gy, cell.gz, cell.face),
        heightAt(cell.gx * CELL, cell.gz * CELL),
      );
    } else {
      buildsViz.updateGhost(null, { gx: 0, gy: 0, gz: 0, face: 0 }, false, 0);
    }

    /* ---- world systems ---- */
    dressing.update(dt, time);
    storm.update(game.wall, game.target, game.stage);
    busRig.update(dt, time);
    chase.camera.getWorldQuaternion(camQuat);
    puffs.update(dt, camQuat);
    tracers.update(dt);
    sky.update(time, chase.camera.position);

    // chest jingle when near an unopened chest
    jingleT -= dt;
    if (jingleT <= 0 && game.phase === "ground") {
      const d = dressing.nearestChestDist(p.x, p.z);
      if (d < 14) {
        audio.chestJingle();
        jingleT = 1.2 + d * 0.15;
      } else {
        jingleT = 0.5;
      }
    }

    if (audio.ready) {
      if (game.phase === "drop") audio.setDiveWind(p.glider ? 0.15 : 1);
      const inZone = Math.hypot(p.x - game.wall.cx, p.z - game.wall.cz) <= game.wall.r;
      audio.stormCrackle(game.stage > 0 && !inZone);
    }

    // victory: banner + dance beat, then the card
    if (game.phase === "results" && game.won && winT >= 0) {
      winT += dt;
      if (winT > 3.4) {
        hud.results(game);
        winT = -1;
      }
    }

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
      hud.prompt(currentPrompt());
    }
    hud.tick(dt * 1000);
  },
});

function currentPrompt(): string {
  const p = game.player;
  if (game.phase === "bus") return `<b>SPACE</b> — JUMP`;
  if (game.phase === "drop") return p.glider ? `<b>SPACE</b> CUT AWAY · <b>WASD</b> STEER` : `<b>SPACE</b> — GLIDER (LOW) · <b>WASD</b> STEER`;
  if (game.phase !== "ground") return "";
  if (game.buildMode) return `<b>LMB</b> PLACE · <b>Q</b> NEXT PIECE · <b>G</b> EDIT · <b>Q×</b> EXIT`;
  const chest = game.nearestChest();
  if (chest) return `<b>E</b> — OPEN CHEST`;
  const t = game.harvestTarget();
  if (t) return `<b>LMB</b> — HARVEST ${t.kind === "tree" ? "WOOD" : t.kind === "car" ? "METAL" : "BRICK"}`;
  if (!p.weapon) return `FIND A CHEST — LISTEN FOR THE JINGLE`;
  return "";
}

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
      heading: p.heading,
      phase: game.phase,
      hp: p.hp,
      alive: game.aliveCount(),
      kills: game.kills,
      stage: game.stage,
      wall: game.wall,
      glider: p.glider,
      weapon: p.weapon,
      mats: { ...p.mats },
      builds: game.builds.size,
      buildMode: game.buildMode,
      pixelScale: loop.pixelScale,
    };
  },
  jump() { game.space(); },
  land(place: "tilted" | "farm" | "hill" = "tilted") { buildLobbyVisuals(); game.debugLand(place); },
  glideOver(place: "tilted" | "farm" | "hill", alt = 55) { buildLobbyVisuals(); audio.stopBus(); game.debugGlideOver(place, alt); },
  setCircle(stage: 1 | 2 | 3) { game.debugCircle(stage); },
  setAlive(n: number) { game.debugAlive(n); },
  buildDemo() { game.debugBuildDemo(); },
  buildRush() { game.debugBuildRush(); },
  pullBot(dist = 12) { game.debugPullBot(dist); },
  killNearest() { game.debugKillNearestBot(); },
  giveWeapon(id: WeaponId) {
    game.player.weapon = id;
    game.player.mag = WEAPONS[id].mag;
  },
  giveMats(n = 100) {
    game.player.mats.wood += n;
    game.player.mats.brick += n;
    game.player.mats.metal += n;
  },
  teleport(x: number, z: number) {
    game.player.x = x;
    game.player.z = z;
    game.player.y = game.groundAt(x, z);
  },
  q() { game.cycleBuild(); },
  place() { return game.tryPlace() !== null; },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
