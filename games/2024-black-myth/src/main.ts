/**
 * main.ts — boots INKPEAK and runs the frame loop.
 *
 * Wiring only: the ink-wash sky + cloud sea, mountain/temple assembly,
 * monk/yaoguai/abbot rigs, the chase camera with soft lock-on orbit, the
 * petal drift, the perfect-dodge slow-mo + afterimage ghosts, the gold
 * seal VFX (immobilize / the felling burst), the quantized staff-trail
 * arc, event plumbing (game → audio/HUD/FX), and the __game harness API.
 * All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { SHRINE_START, SHRINE_GATE, ARENA, heightAt, pastGate } from "./mountain";
import {
  buildGround, buildBamboo, buildGates, buildShrine, buildFogCurtain, buildArena,
} from "./world/temple";
import { Game, type Enemy, type BossMove } from "./game";
import { buildMonk, buildYaoguai, buildAbbot, type MonkPose } from "./characters";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

// the low gold sun hangs over the cloud sea, north-east
const SUN_DIR = new THREE.Vector3(0.42, 0.2, -0.88).normalize();
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xf0d898,
  ambient: 0x6a6a60,
  hazeNear: 46,
  hazeFar: 300,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = col(0x2a2822).clone();

const world = new THREE.Group();
scene.add(world);

/* --------------------------------------------------------------------- sky -- */

// receding ink ridges with temple-roof ticks
function ridgeSilhouette(seed: number): (a: number) => number {
  return (a: number) => {
    const cell = Math.floor(a * 10);
    const local = a * 10 - cell;
    const h = fbm(cell * 1.3 + seed, 5.1, 2);
    if (h > 0.62 && local > 0.42 && local < 0.58) return 0.95; // a roof peak
    return 0.2 + Math.floor(h * 4) / 4 * 0.5;
  };
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 1500,
  rays: { count: 8, speed: 0.04, amount: 0.32 },
  clouds: true,
  silhouettes: [
    { radius: 1400, baseY: -26, maxH: 150, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.62, shape: ridgeSilhouette(3.3), segments: 260 },
    { radius: 1250, baseY: -14, maxH: 90, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.4, shape: ridgeSilhouette(8.8), segments: 240 },
  ],
});

/* ------------------------------------------------------------------- world -- */

buildGround(world);
buildBamboo(world);
buildGates(world);
buildArena(world);
const shrineA = buildShrine(world, SHRINE_START);
const shrineB = buildShrine(world, SHRINE_GATE);
const fogCurtain = buildFogCurtain(world);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const monk = buildMonk();
world.add(monk.group);
const abbot = buildAbbot();
world.add(abbot.group);

const lesserRigs = new Map<number, ReturnType<typeof buildYaoguai>>();

let visualsBuilt = false;
function buildVisuals(): void {
  if (visualsBuilt) return;
  visualsBuilt = true;
  for (const e of game.enemies) {
    if (e.kind === "lesser") {
      const rig = buildYaoguai(e.id * 1.7);
      world.add(rig.group);
      lesserRigs.set(e.id, rig);
    }
  }
}

function rebuildLessers(): void {
  for (const [, rig] of lesserRigs) world.remove(rig.group);
  lesserRigs.clear();
  for (const e of game.enemies) {
    if (e.kind === "lesser") {
      const rig = buildYaoguai(e.id * 1.7);
      world.add(rig.group);
      lesserRigs.set(e.id, rig);
    }
  }
}

/* ------------------------------------------------------------------- VFX -- */

// gold seal texture (封) for immobilize + the felling burst
function sealTexture(char: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  ctx.font = "92px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,217,138,0.9)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffd98a";
  ctx.fillText(char, 64, 70);
  return new THREE.CanvasTexture(cv);
}
const SEAL_TEX = sealTexture("封");

interface SealFx { g: THREE.Group; t: number; total: number; }
const seals: SealFx[] = [];

function bloomSeals(x: number, y: number, z: number, dur: number, big: boolean): void {
  const g = new THREE.Group();
  const n = big ? 6 : 3;
  for (let i = 0; i < n; i++) {
    const s = big ? 1.6 : 0.8;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({
        map: SEAL_TEX, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    const a = (i / n) * Math.PI * 2;
    m.position.set(Math.cos(a) * (big ? 1.6 : 0.7), 1.0 + i * (big ? 0.7 : 0.55), Math.sin(a) * (big ? 1.6 : 0.7));
    m.userData.spin = (i % 2 ? 1 : -1) * 0.8;
    g.add(m);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(big ? 1.6 : 0.8, big ? 1.85 : 0.95, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.seal, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.position.y = 0.1;
  g.add(ring);
  g.position.set(x, y, z);
  world.add(g);
  seals.push({ g, t: dur, total: dur });
}

// perfect-dodge afterimage ghosts
const ghosts: { rig: ReturnType<typeof buildMonk>; t: number }[] = [];
function stampGhost(): void {
  const rig = buildMonk();
  rig.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = new THREE.MeshBasicMaterial({
        color: PAL.extra.goldHot, transparent: true, opacity: 0.5, depthWrite: false,
      });
    }
  });
  rig.group.position.copy(monk.group.position);
  rig.group.rotation.copy(monk.group.rotation);
  rig.update(0, 0, 0, "dodge", 0.15);
  rig.group.position.copy(monk.group.position); // the pose writes local y
  world.add(rig.group);
  ghosts.push({ rig, t: 0.8 });
  if (ghosts.length > 3) {
    const old = ghosts.shift()!;
    world.remove(old.rig.group);
  }
}

// quantized staff-trail arc
const trail = new THREE.Mesh(
  new THREE.RingGeometry(1.0, 1.9, 10, 1, 0, 2.0),
  new THREE.MeshBasicMaterial({
    color: PAL.extra.gold, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  }),
);
world.add(trail);

// drifting petals
const PETALS = 130;
const petalMeshes: THREE.Mesh[] = [];
for (let i = 0; i < PETALS; i++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.11),
    new THREE.MeshBasicMaterial({
      color: i % 3 ? PAL.extra.petal : PAL.extra.petalB,
      transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  m.userData.seed = i * 1.37;
  m.position.set((Math.random() - 0.5) * 70, Math.random() * 16, (Math.random() - 0.5) * 70);
  world.add(m);
  petalMeshes.push(m);
}

// blood pool meshes, keyed by the pool object
const poolMeshes = new Map<object, THREE.Mesh>();

// felling burst
let goldBurstT = 0;
const goldPuffs: THREE.Mesh[] = [];

/* ------------------------------------------------------------------ events -- */

let perfectSlowT = 0;

game.events = {
  onSwing(kind) { audio.swing(kind === "heavy"); },
  onHit(e, dmg, kind) {
    audio.knock();
    if (kind === "smash" || kind === "poke") {
      audio.heavySlam();
      chase.addShake(0.45);
    }
    if (kind === "poke" && e.kind === "abbot" && e.whirlRecover) hud.msg("POKE PUNISH", 900);
    void dmg;
  },
  onEnemyDie(e) {
    if (e.kind === "lesser") {
      const rig = lesserRigs.get(e.id);
      if (rig) rig.group.visible = false;
      bloomSeals(e.x, heightAt(e.x, e.z), e.z, 0.9, false);
    }
  },
  onDodge() { audio.dodge(); },
  onPerfectDodge() {
    audio.perfectDodge();
    perfectSlowT = 0.75;
    stampGhost();
    hud.msg("PERFECT DODGE", 800);
  },
  onImmobilize(e) {
    audio.immobilize();
    const y = e.kind === "abbot" ? heightAt(e.x, e.z) : heightAt(e.x, e.z);
    bloomSeals(e.x, y, e.z, e.frozenT, e.kind === "abbot");
    hud.msg("封 — IMMOBILIZED", 1000);
  },
  onStance(s) {
    audio.stance();
    hud.msg(s === "smash" ? "崩 — SMASH STANCE" : "戳 — POKE STANCE", 900);
  },
  onGourd() { audio.gourd(); },
  onGourdEmpty() {
    audio.gourdEmpty();
    hud.msg("THE GOURD IS EMPTY", 1100, true);
  },
  onShrine(which) {
    audio.shrine();
    hud.msg(which === "gate" ? "GATE SHRINE — REST · GOURD REFILLED" : "INCENSE SHRINE — REST · GOURD REFILLED", 2200);
  },
  onFogGate() {
    audio.fogGate();
    hud.msg("虎僧 — THE TIGER ABBOT", 2600);
  },
  onBossMove(move) { audio.bossMove(move); },
  onBossPhase2() {
    audio.phase2();
    hud.msg("THE ABBOT DRAWS HIS SWORD", 2200, true);
  },
  onPlayerHit(dmg) {
    audio.playerHit();
    chase.addShake(0.4);
    void dmg;
  },
  onYouDied() {
    audio.youDied();
    hud.youDied(true);
  },
  onRespawn() {
    hud.youDied(false);
    rebuildLessers();
  },
  onFelled() {
    audio.felled();
    hud.felled(true);
    goldBurstT = 2.4;
    bloomSeals(game.boss.x, heightAt(game.boss.x, game.boss.z), game.boss.z, 2.2, true);
    setTimeout(() => hud.results(game), 2900);
  },
  onLockOn(on) {
    audio.knock();
    void on;
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
  if (e.code === "Space") game.dodge(moveVector().x, moveVector().z);
  if (e.code === "KeyC") game.swapStance();
  if (e.code === "KeyQ") game.immobilize();
  if (e.code === "KeyF") game.drinkGourd();
  if (e.code === "KeyE") game.rest();
  if (e.code === "Tab") game.lockOn();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (e.button === 0) game.lightAttack();
  if (e.button === 2) game.heavyAttack();
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  startGame();
});

const _fwd = new THREE.Vector3();
function moveVector(): { x: number; z: number } {
  const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const z = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const camYaw = Math.atan2(chase.camera.getWorldDirection(_fwd).x, _fwd.z);
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  return { x: x * cos + z * sin, z: z * cos - x * sin };
}

/* ------------------------------------------------------------------ camera -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 1800,
  heroLightDir: SUN_DIR,
  baseDistance: 5.4,
  baseHeight: 2.5,
  baseFov: 58,
  speedFov: 0.3,
  orbitRadius: 46,
  orbitHeight: 18,
  ceremonyRadius: 9,
  ceremonyHeight: 4,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const titleTarget = { pos: new THREE.Vector3(0, 5, -45), heading: Math.PI, speed: 0 };
const chaseTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0, beauty: false };
const _lockPos = new THREE.Vector3();
const _lockLook = new THREE.Vector3();

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, titleTarget, time);
    return;
  }
  if (game.phase === "results") {
    chase.setMode(camOverride ?? "ceremony");
    chaseTarget.pos.set(p.x, p.y, p.z);
    chase.update(dt, chaseTarget, time);
    return;
  }
  const t = game.lockTarget;
  if (t && t.state !== "dead" && !p.dead) {
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    _lockPos.set(
      p.x - (dx / d) * 5.8 - (dz / d) * 1.2,
      p.y + 2.7,
      p.z - (dz / d) * 5.8 + (dx / d) * 1.2,
    );
    chase.camera.position.lerp(_lockPos, 1 - Math.exp(-dt * 5));
    _lockLook.set((p.x + t.x) / 2, p.y + 1.5, (p.z + t.z) / 2);
    chase.camera.lookAt(_lockLook);
    return;
  }
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed = Math.hypot(moveVector().x, moveVector().z) * 5;
  chaseTarget.beauty = pastGate(p.z) || game.phase === "boss";
  chase.update(dt, chaseTarget, time);
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: PAL.ink.deep, edgeStrength: 0.6, vignette: 0.42 },
);

let hudTick = 0;
let poseT = 0;
let lastPose: MonkPose = "idle";
let stepAcc = 0;
let stepAlt = false;

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (rawDt, time) => {
    perfectSlowT = Math.max(0, perfectSlowT - rawDt);
    const dt = perfectSlowT > 0 ? rawDt * 0.32 : rawDt; // the perfect-dodge slow-mo

    game.update(dt, moveVector());

    updateCamera(rawDt, time);

    /* ---- the monk ---- */
    const p = game.player;
    let pose: MonkPose = "idle";
    if (p.dead) pose = "dead";
    else if (p.dodgeT > 0) pose = "dodge";
    else if (p.attackT > 0) pose = p.attackHeavy ? p.stance : (`light${p.attackStage || 1}` as MonkPose);
    else if (p.gourdT > 0) pose = "gourd";
    else if (p.staggerT > 0) pose = "hit";
    else if (Math.hypot(moveVector().x, moveVector().z) > 0.05) pose = "walk";
    if (pose !== lastPose) {
      poseT = 0;
      lastPose = pose;
    }
    poseT += dt;
    monk.update(dt, time, 5, pose, poseT);
    // place AFTER the pose update (poses write local y)
    monk.group.position.set(p.x, p.y + monk.group.position.y, p.z);
    monk.group.rotation.y = p.heading;
    monk.group.visible = game.phase !== "title";

    if (pose === "walk") {
      stepAcc += 5 * dt;
      if (stepAcc > 2.4) {
        stepAcc = 0;
        stepAlt = !stepAlt;
        audio.step(stepAlt);
      }
    }

    /* ---- enemies ---- */
    for (const e of game.enemies) {
      if (e.kind === "lesser") {
        const rig = lesserRigs.get(e.id);
        if (!rig) continue;
        rig.group.visible = e.state !== "dead";
        if (!rig.group.visible) continue;
        if (e.frozenT > 0) {
          rig.update(0, time, "frozen", 0); // held mid-pose
        } else {
          rig.update(dt, time, e.state, e.stateT);
        }
        let ey = heightAt(e.x, e.z);
        if (e.state === "leap") {
          ey += Math.sin(Math.min(1, e.stateT / e.leapDur) * Math.PI) * 1.7;
        }
        rig.group.position.set(e.x, ey, e.z);
        rig.group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
      } else {
        const frozen = e.frozenT > 0;
        abbot.update(frozen ? 0 : dt, time, frozen ? "frozen" : e.state, e.stateT, e.move, game.bossPhase);
        let by = heightAt(e.x, e.z);
        if (e.state === "leap") by += Math.sin(Math.min(1, e.stateT / e.leapDur) * Math.PI) * 2.4;
        if (e.state === "dash") by += 0.4;
        abbot.group.position.set(e.x, by, e.z);
        abbot.group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        abbot.group.visible = e.state !== "dead" && game.fogGatePassed;
      }
    }

    /* ---- the staff trail (quantized arcs) ---- */
    if (p.attackT > 0) {
      const k = 1 - p.attackT / p.attackDur;
      trail.visible = true;
      trail.position.set(p.x, p.y + 1.3, p.z);
      trail.rotation.set(-Math.PI / 2 + 0.3, 0, p.heading + (p.attackHeavy ? 0.6 : k * 2.2) - 1.4);
      trail.material.opacity = Math.floor((1 - k) * 4) / 4 * (perfectSlowT > 0 ? 0.85 : 0.55);
      trail.scale.setScalar(p.attackHeavy ? 1.5 : 1);
    } else {
      trail.visible = false;
    }

    /* ---- seal VFX ---- */
    for (let i = seals.length - 1; i >= 0; i--) {
      const s = seals[i];
      s.t -= rawDt;
      const age = s.total - s.t;
      const bloom = Math.min(1, age / 0.4);
      const fade = Math.min(1, s.t / 0.6);
      s.g.scale.setScalar(0.3 + bloom * 0.85);
      s.g.children.forEach((m) => {
        if (m.userData.spin) m.rotation.y += rawDt * m.userData.spin;
        ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = fade;
      });
      if (s.t <= 0) {
        world.remove(s.g);
        seals.splice(i, 1);
      }
    }

    /* ---- ghosts fade ---- */
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const gh = ghosts[i];
      gh.t -= rawDt;
      gh.rig.group.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).opacity = Math.max(0, gh.t / 0.8) * 0.5;
      });
      if (gh.t <= 0) {
        world.remove(gh.rig.group);
        ghosts.splice(i, 1);
      }
    }

    /* ---- blood pools ---- */
    const seen = new Set<object>();
    for (const pool of game.pools) {
      seen.add(pool);
      let m = poolMeshes.get(pool);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.CircleGeometry(pool.r, 24).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: PAL.extra.blood, transparent: true, opacity: 0.6, depthWrite: false }),
        );
        world.add(m);
        poolMeshes.set(pool, m);
      }
      m.position.set(pool.x, heightAt(pool.x, pool.z) + 0.06, pool.z);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 6) * 0.12 + Math.min(0.25, pool.t * 0.1);
    }
    for (const [pool, m] of poolMeshes) {
      if (!seen.has(pool)) {
        world.remove(m);
        poolMeshes.delete(pool);
      }
    }

    /* ---- petals drift around the player ---- */
    for (const m of petalMeshes) {
      const seed = m.userData.seed as number;
      m.position.y -= rawDt * (0.5 + (seed % 1) * 0.4);
      m.position.x += Math.sin(time * 1.2 + seed) * rawDt * 0.8;
      m.position.z += Math.cos(time * 0.9 + seed) * rawDt * 0.6;
      m.rotation.x = time * 1.4 + seed;
      m.rotation.z = seed;
      // wrap in a box around the player
      if (m.position.y < p.y - 1) m.position.y = p.y + 14 + (seed % 3);
      if (Math.abs(m.position.x - p.x) > 36) m.position.x = p.x + (Math.random() - 0.5) * 60;
      if (Math.abs(m.position.z - p.z) > 36) m.position.z = p.z + (Math.random() - 0.5) * 60;
    }

    /* ---- fog curtain dissolves once passed ---- */
    fogCurtain.visible = !game.fogGatePassed;

    /* ---- shrine glows breathe ---- */
    for (const s of [shrineA, shrineB]) {
      s.glow.scale.setScalar(1 + Math.sin(time * 2.4) * 0.2);
    }

    /* ---- the felling burst: a shower of gold seals ---- */
    goldBurstT = Math.max(0, goldBurstT - rawDt);
    if (goldBurstT > 0 && Math.random() < 0.4) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ map: SEAL_TEX, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.position.set(p.x + (Math.random() - 0.5) * 9, p.y + 5 + Math.random() * 4, p.z + (Math.random() - 0.5) * 9);
      m.userData.t = 1.6;
      world.add(m);
      goldPuffs.push(m);
    }
    for (let i = goldPuffs.length - 1; i >= 0; i--) {
      const m = goldPuffs[i];
      m.userData.t -= rawDt;
      m.position.y -= rawDt * 2.2;
      m.rotation.z += rawDt * 3;
      (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, m.userData.t);
      if (m.userData.t <= 0) {
        world.remove(m);
        goldPuffs.splice(i, 1);
      }
    }

    sky.update(time, chase.camera.position);

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
  debugFinish() { buildVisuals(); game.debugFinish(); },
  debug() {
    const p = game.player;
    const near = game.enemies
      .filter((e) => e.state !== "dead")
      .map((e) => ({
        kind: e.kind, state: e.state, stateT: +e.stateT.toFixed(2),
        frozen: +e.frozenT.toFixed(2), hp: e.hp,
        d: +game.distToPlayer(e).toFixed(1),
      }));
    return {
      cam: chase.camera.position.toArray(),
      player: [p.x, p.y, p.z],
      phase: game.phase,
      hp: p.hp,
      gourd: p.gourd,
      focus: +p.focus.toFixed(2),
      stance: p.stance,
      combo: game.combo,
      immobilizeCD: +game.immobilizeCD.toFixed(1),
      deaths: game.deaths,
      perfectDodges: game.perfectDodges,
      longestCombo: game.longestCombo,
      boss: { hp: game.boss.hp, state: game.boss.state, phase: game.bossPhase, move: game.boss.move },
      lessersAlive: game.enemies.filter((e) => e.kind === "lesser" && e.state !== "dead").length,
      enemies: near,
      lockOn: !!game.lockTarget,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleport(x: number, z: number) { game.teleport(x, z); },
  teleportBeat(beat: "shrine" | "court" | "gate" | "boss") { game.teleportBeat(beat); },
  lockOn() { game.lockOn(); },
  setBossPhase(n: 1 | 2) { game.setBossPhase(n); },
  bossHp(n: number) { game.bossHp(n); },
  killPlayer() { game.killPlayer(); },
  giveFocus(n = 3) { game.giveFocus(n); },
  stance(s: "smash" | "poke") {
    if (game.player.stance !== s) game.swapStance();
  },
  lesserLeap() { game.debugLesserLeap(); },
  lesserSwipe() { game.debugLesserSwipe(); },
  bossMove(move: BossMove) { game.debugBossMove(move); },
  immobilize() { game.immobilize(); },
  dodge() { game.dodge(0, 0); },
  light() { game.lightAttack(); },
  heavy() { game.heavyAttack(); },
  gourd() { game.drinkGourd(); },
  rest() { game.rest(); },
  killLessers() {
    for (const e of game.enemies) {
      if (e.kind === "lesser" && e.state !== "dead") {
        e.hp = 0;
        e.state = "dead";
        game.events.onEnemyDie?.(e);
      }
    }
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
