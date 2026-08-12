/**
 * main.ts — boots POCKET GO and runs the frame loop.
 *
 * Responsibilities: renderer + sky + neighborhood assembly, input, camera
 * direction per phase (title diorama orbit / walk chase / catch framing /
 * gym side view / results tower ceremony), event plumbing (game → audio /
 * HUD / FX, one direction only), and the __game screenshot-harness API.
 * All game decisions live in game.ts; this file only presents them.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { PLACES } from "./world/layout";
import { buildNeighborhood } from "./world/dressing";
import { buildCritter, SPECIES, type SpeciesId, type CritterRig } from "./creatures";
import { Game } from "./game";
import { buildPlayer, type PlayerPose } from "./player";
import { CatchFX, StarBurst, Confetti, makeRustleRing, updateRustleRing } from "./fx";
import { GymBattleFX, GYM_ARENA } from "./gym";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

const SUN_DIR = new THREE.Vector3(0.55, 0.30, 0.72).normalize(); // morning sun over the pond
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xffe0b0,
  ambient: 0x8fb8d8,
  hazeNear: 130,
  hazeFar: 620,
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

// city rooftop silhouettes: quantized steps + the odd water tower
function rooftops(a: number): number {
  const cell = Math.floor(a * 18);
  const local = hashCell(cell);
  let h = 0.25 + Math.floor(local * 3) * 0.14;
  if (local > 0.9) h += 0.35; // water tower / spire
  return h;
}
function hashCell(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 1100,
  rays: { count: 8, speed: 0.04, amount: 0.22 },
  silhouettes: [
    { radius: 1050, baseY: -12, maxH: 95, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.55, shape: rooftops, segments: 300 },
    { radius: 980, baseY: -10, maxH: 70, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.38, shape: (a) => rooftops(a + 2.7), segments: 280 },
    { radius: 920, baseY: -8, maxH: 46, color: PAL.atmosphere.silhouetteNear, hazeMix: 0.22, shape: (a) => rooftops(a + 5.1), segments: 260 },
  ],
});

const hood = buildNeighborhood(world);
const player = buildPlayer();
world.add(player.group);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

// encounter visuals, keyed by encounter id
const encVisuals = new Map<number, { ring: THREE.Mesh | null; critter: CritterRig | null }>();
const catchFX = new CatchFX(world);
const burst = new StarBurst(world);
const confetti = new Confetti(world);
const gymFX = new GymBattleFX(world);
let catchCritter: CritterRig | null = null; // the pal on the pad

/* ------------------------------------------------------------------ events -- */

game.events = {
  onStep() {
    stepAlt = !stepAlt;
    audio.footstep(stepAlt);
  },
  onSpawn(enc) {
    const ring = makeRustleRing();
    ring.position.set(enc.x, 0.05, enc.z);
    world.add(ring);
    encVisuals.set(enc.id, { ring, critter: null });
    audio.rustle();
  },
  onPop(enc) {
    const v = encVisuals.get(enc.id);
    if (v?.ring) world.remove(v.ring);
    const critter = buildCritter(enc.species);
    critter.group.position.set(enc.x, 0, enc.z);
    world.add(critter.group);
    encVisuals.set(enc.id, { ring: null, critter });
    audio.pop();
  },
  onDespawn(enc) {
    const v = encVisuals.get(enc.id);
    if (v?.critter) world.remove(v.critter.group);
    if (v?.ring) world.remove(v.ring);
    encVisuals.delete(enc.id);
  },
  onCatchStart(enc) {
    const v = encVisuals.get(enc.id);
    if (v?.ring) world.remove(v.ring);
    catchCritter = v?.critter ?? null;
    encVisuals.delete(enc.id);
    catchFX.begin(enc.x, enc.z);
    // the player squares up to the pad
    game.player.heading = Math.atan2(enc.x - game.player.x, enc.z - game.player.z);
    audio.encounterSting();
    hud.msg(`${SPECIES[enc.species].name} APPEARED!`, 1400);
  },
  onBerry() {
    audio.berry();
    hud.msg("BERRY TOSSED — IT'S CALMER", 1100);
  },
  onThrow() {
    audio.throwWhoosh();
  },
  onBallLand(hit) {
    if (hit) audio.ballHit();
    else {
      audio.miss();
      hud.msg("SO CLOSE…", 900, true);
    }
  },
  onThrowGrade(grade) {
    hud.grade(grade + "!");
  },
  onWobble(n) {
    audio.wobbleTick(n);
  },
  onGotcha(id) {
    if (catchCritter) {
      burst.fire(catchCritter.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
      catchCritter.group.visible = false;
    }
    audio.gotcha();
    hud.msg(`GOTCHA! ${SPECIES[id].name} WAS CAUGHT!`, 2200);
  },
  onBreakout() {
    if (catchCritter) {
      catchCritter.group.visible = true;
      catchCritter.group.position.y = 0;
    }
    audio.breakout();
    hud.msg("OH! IT BROKE FREE!", 1400, true);
  },
  onFlee() {
    if (catchCritter) {
      burst.fire(catchCritter.group.position.clone());
      world.remove(catchCritter.group);
      catchCritter = null;
    }
    audio.flee();
    hud.msg("IT FLED DOWN THE SHORE…!", 1800, true);
  },
  onGymPrompt(need) {
    hud.msg(`THE GYM WANTS ${need}+ PALS AT YOUR BACK`, 2200, true);
  },
  onGymStart() {
    gymFX.begin(game.buddy ?? "nibbit");
    audio.gymStart();
    hud.msg("GYMHORN HOLDS CROWN PLAZA!", 2200);
  },
  onGymAttack() {
    gymFX.attackLunge();
    audio.attack();
  },
  onGymTelegraph() {
    audio.telegraph();
  },
  onGymSlam(_lane, hit) {
    gymFX.slam();
    audio.slam(hit);
    if (hit) {
      chase.addShake(0.7);
      hud.msg("SLAMMED!", 700, true);
    }
  },
  onGymWin() {
    confetti.fire(new THREE.Vector3(PLACES.gym.x, 2, PLACES.gym.z));
    if (game.buddy) hood.gym.setBuddy(game.buddy);
    audio.gymFanfare();
    hud.msg("GYMHORN FELL — GYM LEADER!", 2600);
  },
  onGymLose() {
    audio.faint();
    hud.msg("YOUR PAL FAINTED — PATCHING UP…", 2000, true);
  },
  onResults() {
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
  audio.titleJingle();
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  firstInput();
  if (e.code === "Enter") {
    if (game.phase === "title") {
      document.getElementById("title")!.classList.add("hidden");
      game.start();
    } else if (game.phase === "results") {
      location.reload();
    }
  }
  if (e.code === "KeyE") game.pressInteract();
  if (e.code === "KeyB") game.pressBerry();
  if (e.code === "Space") {
    if (game.phase === "catch") game.startCharge();
    else if (game.phase === "gym") game.tapAttack();
  }
  if (game.phase === "gym") {
    if (e.code === "KeyA" || e.code === "ArrowLeft") { game.dodge(-1); audio.dodge(); }
    if (e.code === "KeyD" || e.code === "ArrowRight") { game.dodge(1); audio.dodge(); }
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Space" && game.phase === "catch") game.releaseThrow();
});
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  document.getElementById("title")!.classList.add("hidden");
  game.start();
});

function moveVector(): { x: number; z: number } {
  const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  return { x, z };
}

/* ------------------------------------------------------------------ camera -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 1400,
  heroLightDir: SUN_DIR,
  baseDistance: 6.4,
  baseHeight: 3.0,
  baseFov: 62,
  speedFov: 0.6,
  orbitRadius: 30,
  orbitHeight: 15,
  ceremonyRadius: 17,
  ceremonyHeight: 9,
});
chase.setMode("orbit");

// catch/gym framing is hand-driven (exp-lerp, same spring language)
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const _want = new THREE.Vector3();
const _look = new THREE.Vector3();
let camOverride: CamMode | null = null;

const walkTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0 };
const titleTarget = { pos: new THREE.Vector3(PLACES.plaza.x, 2, PLACES.plaza.z), heading: 0, speed: 0 };
const towerTarget = { pos: new THREE.Vector3(PLACES.gym.x, 10, PLACES.gym.z), heading: 0, speed: 0 };

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, titleTarget, time);
  } else if (game.phase === "walk") {
    chase.setMode(camOverride ?? "chase");
    walkTarget.pos.set(p.x, 0, p.z);
    walkTarget.heading = p.heading;
    walkTarget.speed = p.speed;
    chase.update(dt, walkTarget, time);
  } else if (game.phase === "catch" && game.catch) {
    const enc = game.catch.enc;
    const fx = enc.x - p.x;
    const fz = enc.z - p.z;
    const d = Math.hypot(fx, fz) || 1;
    // over the player's shoulder, framing the pad
    _want.set(p.x - (fx / d) * 3.4 - (fz / d) * 1.1, 2.4, p.z - (fz / d) * 3.4 + (fx / d) * 1.1);
    _look.set(enc.x, 0.9, enc.z);
    camPos.lerp(_want, 1 - Math.exp(-dt * 4));
    camLook.lerp(_look, 1 - Math.exp(-dt * 6));
    chase.camera.position.copy(camPos);
    chase.camera.lookAt(camLook);
  } else if (game.phase === "gym") {
    _want.set(GYM_ARENA.boss.x - 13, 5.5, (GYM_ARENA.boss.z + GYM_ARENA.buddy.z) / 2);
    _look.set(GYM_ARENA.boss.x + 2, 1.8, (GYM_ARENA.boss.z + GYM_ARENA.buddy.z) / 2);
    camPos.lerp(_want, 1 - Math.exp(-dt * 3.5));
    camLook.lerp(_look, 1 - Math.exp(-dt * 5));
    chase.camera.position.copy(camPos);
    chase.camera.lookAt(camLook);
  } else if (game.phase === "results") {
    chase.setMode(camOverride ?? "ceremony");
    chase.update(dt, towerTarget, time);
  }
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: PAL.ink.deep },
);

camPos.set(PLACES.plaza.x + 30, 15, PLACES.plaza.z);
camLook.set(PLACES.plaza.x, 2, PLACES.plaza.z);

let hudTick = 0;
let stepAlt = false;

function placeName(): string {
  const p = game.player;
  const near = (x: number, z: number, r: number) => Math.hypot(p.x - x, p.z - z) < r;
  if (near(PLACES.plaza.x, PLACES.plaza.z, PLACES.plaza.r + 10)) return "CROWN PLAZA";
  if (near(PLACES.parkEast.x, PLACES.parkEast.z, 44)) return "WHISTLE PARK";
  if (near(PLACES.parkWest.x, PLACES.parkWest.z, 44)) return "DANDELION GREEN";
  if (near(PLACES.pond.x, PLACES.pond.z, 46)) return "MIRROR POND";
  return "MAPLE WARD";
}

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (dt, time) => {
    game.update(dt, game.phase === "walk" ? moveVector() : { x: 0, z: 0 });

    // curve lean during a charged throw
    if (game.phase === "catch") {
      game.setCurve(
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
      );
    }

    // player rig
    const pose: PlayerPose =
      game.phase === "catch" && game.catch?.charging ? "throw"
      : game.phase === "gym" && game.gym?.sub === "won" ? "cheer"
      : game.player.speed > 0.1 ? "walk" : "idle";
    player.group.position.set(game.player.x, 0, game.player.z);
    player.group.rotation.y = game.player.heading;
    player.group.visible = game.phase !== "gym";
    player.update(dt, time, game.player.speed, pose);

    // encounter critters idle / rings pulse
    for (const v of encVisuals.values()) {
      if (v.ring) updateRustleRing(v.ring, time % 10);
      v.critter?.update(dt, time, "idle");
    }
    if (catchCritter && game.phase === "catch") {
      catchCritter.update(dt, time, game.catch?.sub === "breakout" ? "dizzy" : "idle");
    }

    // catch scene FX mirrors game state
    catchFX.update(game.catch, new THREE.Vector3(game.player.x, 0, game.player.z), time);
    if (game.phase !== "catch" && catchFX.group.visible) {
      catchFX.end();
      if (catchCritter) {
        world.remove(catchCritter.group);
        catchCritter = null;
      }
    }

    // gym + tower spinners
    gymFX.update(dt, time, game.gym);
    hood.gym.update(dt, time);

    burst.update(dt, time);
    confetti.update(dt, time);
    hood.update(dt, chase.camera.position, time);
    sky.update(time, chase.camera.position);
    updateCamera(dt, time);
    audio.update(dt);

    // HUD at ~30 Hz
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game, placeName());
      hud.prompt(currentPrompt());
    }
    hud.tick(dt * 1000);
  },
});

function currentPrompt(): string {
  if (game.phase === "walk") {
    const enc = game.nearestEncounter();
    if (enc) return `<b>E</b> — CATCH ${SPECIES[enc.species].name}`;
    if (!game.gymWon && game.catches < 2 &&
        Math.hypot(game.player.x - PLACES.plaza.x, game.player.z - PLACES.plaza.z) < PLACES.plaza.r + 14) {
      return `THE GYM WANTS <b>2+ PALS</b> — CATCH SOME FIRST`;
    }
    return "";
  }
  if (game.phase === "catch" && game.catch) {
    if (game.catch.sub === "aim") {
      return `HOLD <b>SPACE</b>, RELEASE ON A SMALL RING · <b>A/D</b> CURVE · <b>B</b> BERRY`;
    }
    return "";
  }
  if (game.phase === "gym" && game.gym?.sub === "fight") {
    return `<b>SPACE</b> ATTACK · <b>A/D</b> DODGE THE SLAM`;
  }
  return "";
}

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    document.getElementById("title")!.classList.add("hidden");
    game.autostart();
  },
  cam(mode: string) {
    camOverride = mode === "auto" ? null : (mode as CamMode);
  },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { game.debugFinish(); },
  debug() {
    return {
      cam: chase.camera.position.toArray(),
      player: [game.player.x, game.player.z],
      phase: game.phase,
      dex: game.dexCount(),
      catches: game.catches,
      steps: game.steps,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks for the shot list */
  teleport(place: "pond" | "plaza" | "parkEast" | "parkWest" | "home") {
    game.teleportTo(place);
  },
  forceEncounter(id: SpeciesId) {
    return game.forceEncounter(id).id;
  },
  enterCatch() { game.debugEnterCatch(); },
  catchBurst() { game.debugCatchBurst(); },
  startGym() {
    if (!game.buddy) game.debugFinishBuddy();
    game.startGym();
  },
  gymHp(boss: number, buddy: number) {
    if (game.gym) {
      game.gym.bossHP = boss;
      game.gym.buddyHP = buddy;
    }
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
