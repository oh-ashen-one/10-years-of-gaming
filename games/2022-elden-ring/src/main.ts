/**
 * main.ts — boots GLOOMMOOR and runs the frame loop.
 *
 * Wiring only: moor + golden tree + mist assembly, tarnished/soldier/
 * warden rigs, the chase camera with soft lock-on orbit, beauty bias
 * toward the tree's glow, event plumbing (game → audio/HUD/FX), and the
 * __game harness API. All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import {
  GRACE_START, GRACE_GATE, FOG_GATE, BRIDGE, PACKS, TREE_POS,
  heightAt, pastGate,
} from "./moor";
import { buildMoorGround, buildGoldenTree, buildGrace, buildDressing } from "./world/dressing";
import { Game } from "./game";
import { buildTarnished, buildSoldier, buildScarab, buildWarden, type TarnPose } from "./characters";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

// the hero light IS the tree's glow, bleeding south over the moor
const TREE_DIR = new THREE.Vector3(TREE_POS.x, 60, TREE_POS.z).normalize();
configureCelEnv(PAL, {
  sunDir: TREE_DIR,
  sunTint: 0xe8c86a,
  ambient: 0x5a6880,
  hazeNear: 50,
  hazeFar: 320,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = col(0x1e242e).clone();

const world = new THREE.Group();
scene.add(world);

/* ------------------------------------------------------------------- world -- */

// ruined-arch silhouettes receding into the mist
function archSilhouette(seed: number): (a: number) => number {
  return (a: number) => {
    const cell = Math.floor(a * 16);
    const local = a * 16 - cell;
    const h = fbm(cell * 0.9 + seed, 3.3, 2);
    if (h > 0.6 && local > 0.3 && local < 0.42) return 0.9;  // pier
    if (h > 0.6 && local > 0.55 && local < 0.67) return 0.9; // pier
    if (h > 0.6 && local >= 0.42 && local <= 0.55) return 0.6; // lintel
    return 0.15 + Math.floor(h * 3) / 3 * 0.3;
  };
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: TREE_DIR,
  radius: 1500,
  rays: false,
  silhouettes: [
    { radius: 1400, baseY: -20, maxH: 130, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.6, shape: archSilhouette(7.7), segments: 300 },
    { radius: 1300, baseY: -12, maxH: 80, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.4, shape: archSilhouette(2.9), segments: 280 },
  ],
});

buildMoorGround(world);
buildGoldenTree(world);
buildDressing(world);
const graceA = buildGrace(world, GRACE_START);
const graceB = buildGrace(world, GRACE_GATE);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const tarn = buildTarnished();
world.add(tarn.group);
const warden = buildWarden();
world.add(warden.group);

const soldierRigs = new Map<number, ReturnType<typeof buildSoldier>>();
let scarabRig: THREE.Group | null = null;
let corpseGlow: THREE.Mesh | null = null;
let hammerMark: THREE.Mesh | null = null;

let visualsBuilt = false;
function buildVisuals(): void {
  if (visualsBuilt) return;
  visualsBuilt = true;
  for (const e of game.enemies) {
    if (e.kind === "soldier") {
      const rig = buildSoldier(e.id * 1.7);
      world.add(rig.group);
      soldierRigs.set(e.id, rig);
    } else if (e.kind === "scarab") {
      scarabRig = buildScarab();
      world.add(scarabRig);
    }
  }
  // hammer telegraph ring
  hammerMark = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.3, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0 }),
  );
  world.add(hammerMark);
  // corpse glow marker
  corpseGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshBasicMaterial({ color: PAL.extra.grace, transparent: true, opacity: 0.9 }),
  );
  corpseGlow.visible = false;
  world.add(corpseGlow);
}

/* ------------------------------------------------------------------ events -- */

let riposteSlowT = 0;
let goldBurstT = 0;
const goldPuffs: THREE.Mesh[] = [];

game.events = {
  onSwing(heavy) { audio.swing(heavy); },
  onHit(e, dmg, riposte) {
    audio.hit();
    if (riposte) audio.riposte();
    void dmg;
  },
  onEnemyDie(e) {
    if (e.kind === "soldier") {
      const rig = soldierRigs.get(e.id);
      if (rig) rig.group.visible = false;
    } else if (e.kind === "scarab" && scarabRig) {
      scarabRig.visible = false;
    }
  },
  onRoll() { audio.roll(); },
  onGuard() { audio.guard(); },
  onGuardBreak() {
    audio.guardBreak();
    hud.msg("GUARD BROKEN", 900, true);
  },
  onParry() {
    audio.parry();
    riposteSlowT = 0.5;
    hud.msg("RIPOSTE!", 900);
  },
  onRiposte() {
    riposteSlowT = 0.7;
    chase.addShake(0.5);
  },
  onPlayerHit(dmg) {
    audio.playerHit();
    chase.addShake(0.4);
    void dmg;
  },
  onFlask() { audio.flask(); },
  onGrace(which) {
    audio.grace();
    hud.msg(which === "gate" ? "GATEHOUSE GRACE — REST" : "SITE OF GRACE — REST", 2000);
  },
  onHint() {
    audio.hint();
    hud.msg("“the bridge guardian fears the riposte.”", 3200);
  },
  onScarab() {
    audio.scarab();
    hud.msg("+1 FLASK CHARGE", 1600);
  },
  onFogGate() {
    audio.fogGate();
    hud.msg("THE BRIDGE WARDEN", 2400);
  },
  onBossMove(move) {
    audio.bossMove(move);
    if (move === "hammer") audio.hammerSlam();
  },
  onBossPhase2() {
    audio.phase2();
    hud.msg("THE WARDEN CALLS THE GOLD HAMMER", 2400, true);
  },
  onYouDied() {
    audio.youDied();
    hud.youDied(true);
  },
  onRespawn() {
    hud.youDied(false);
    buildVisualsRespawn();
  },
  onCorpse(n) {
    audio.grace();
    hud.msg(`RECOVERED ${n} SHARDS`, 1600);
  },
  onFelled() {
    audio.felled();
    hud.felled(true);
    goldBurstT = 2.2;
    setTimeout(() => hud.results(game), 2800);
  },
  onLockOn(on) {
    audio.hit();
    void on;
  },
};

function buildVisualsRespawn(): void {
  // soldiers respawn: rebuild their rigs
  for (const [, rig] of soldierRigs) world.remove(rig.group);
  soldierRigs.clear();
  for (const e of game.enemies) {
    if (e.kind === "soldier") {
      const rig = buildSoldier(e.id * 1.7);
      world.add(rig.group);
      soldierRigs.set(e.id, rig);
    }
  }
  if (scarabRig && game.enemies.some((e) => e.kind === "scarab" && e.state !== "dead")) {
    scarabRig.visible = true;
  }
}

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
  if (e.code === "Space") game.roll();
  if (e.code === "KeyF") game.guard(true);
  if (e.code === "KeyQ") game.flask();
  if (e.code === "KeyE") game.interact();
  if (e.code === "Tab") game.lockOn();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyF") game.guard(false);
});
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (e.button === 0) game.lightAttack();
  if (e.button === 2) game.heavyDown();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 2) game.heavyUp();
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  startGame();
});

function moveVector(): { x: number; z: number } {
  const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const z = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  // camera-relative: forward = toward the camera's facing (yaw from heading)
  const camYaw = Math.atan2(
    chase.camera.getWorldDirection(_fwd).x,
    _fwd.z,
  );
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  return { x: x * cos + z * sin, z: z * cos - x * sin };
}
const _fwd = new THREE.Vector3();

/* ------------------------------------------------------------------ camera -- */

const chase = new ChaseCamera({
  aspect: window.innerWidth / window.innerHeight,
  far: 1800,
  heroLightDir: TREE_DIR,
  baseDistance: 5.2,
  baseHeight: 2.4,
  baseFov: 60,
  speedFov: 0.3,
  orbitRadius: 60,
  orbitHeight: 26,
  ceremonyRadius: 9,
  ceremonyHeight: 4,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const titleTarget = { pos: new THREE.Vector3(0, 4, -60), heading: Math.PI, speed: 0 };
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
    // soft lock-on: camera sits behind the player, biased to frame both
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    _lockPos.set(
      p.x - (dx / d) * 5.6 - (dz / d) * 1.1,
      p.y + 2.6,
      p.z - (dz / d) * 5.6 + (dx / d) * 1.1,
    );
    chase.camera.position.lerp(_lockPos, 1 - Math.exp(-dt * 5));
    _lockLook.set((p.x + t.x) / 2, p.y + 1.4, (p.z + t.z) / 2);
    chase.camera.lookAt(_lockLook);
    return;
  }
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed = keys.has("ShiftLeft") ? 7 : Math.hypot(moveVector().x, moveVector().z) * 5;
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

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (rawDt, time) => {
    riposteSlowT = Math.max(0, riposteSlowT - rawDt);
    const dt = riposteSlowT > 0 ? rawDt * 0.35 : rawDt;

    game.update(dt, moveVector(), keys.has("ShiftLeft") || keys.has("ShiftRight"));

    updateCamera(rawDt, time);

    /* ---- tarnished ---- */
    const p = game.player;
    let pose: TarnPose = "idle";
    if (p.dead) pose = "dead";
    else if (p.rollT > 0) pose = "roll";
    else if (p.parryT > 0) pose = "parry";
    else if (p.attackT > 0) pose = p.attackHeavy ? "heavy" : "light";
    else if (p.guarding) pose = "guard";
    else if (Math.hypot(moveVector().x, moveVector().z) > 0.05) {
      pose = keys.has("ShiftLeft") ? "sprint" : "walk";
    }
    tarn.update(dt, time, 5, pose);
    // place AFTER the pose update (poses write local y)
    tarn.group.position.set(p.x, p.y, p.z);
    tarn.group.rotation.y = p.heading;
    tarn.group.visible = game.phase !== "title";

    /* ---- enemies ---- */
    for (const e of game.enemies) {
      if (e.kind === "soldier") {
        const rig = soldierRigs.get(e.id);
        if (!rig) continue;
        rig.group.visible = e.state !== "dead";
        if (rig.group.visible) {
          rig.update(dt, time, e.state, e.stateT);
          rig.group.position.set(e.x, heightAt(e.x, e.z), e.z);
          rig.group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        }
      } else if (e.kind === "scarab" && scarabRig) {
        scarabRig.visible = e.state !== "dead";
        if (scarabRig.visible) {
          scarabRig.position.set(e.x, heightAt(e.x, e.z) + 0.1 + Math.sin(time * 20) * 0.03, e.z);
        }
      } else if (e.kind === "warden") {
        warden.update(dt, time, e.state, e.stateT, e.attackKind);
        warden.group.position.set(e.x, heightAt(e.x, e.z), e.z);
        warden.group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        warden.group.visible = e.state !== "dead" && game.fogGatePassed;
        // hammer telegraph ring
        if (hammerMark) {
          const marking = e.state === "windup" && e.attackKind === "hammer";
          (hammerMark.material as THREE.MeshBasicMaterial).opacity = marking ? 0.55 + Math.sin(time * 14) * 0.25 : 0;
          if (marking) hammerMark.position.set(e.hammerX, heightAt(e.hammerX, e.hammerZ) + 0.08, e.hammerZ);
        }
      }
    }

    // grace threads rise
    for (const gr of [graceA, graceB]) {
      for (const o of gr.children) {
        if (o.name === "thread") {
          o.position.y += dt * 0.4;
          if (o.position.y > 2.2) o.position.y = 0.8;
        }
      }
    }

    // corpse marker
    if (corpseGlow) {
      corpseGlow.visible = !!game.corpse;
      if (game.corpse) {
        corpseGlow.position.set(game.corpse.x, heightAt(game.corpse.x, game.corpse.z) + 0.5 + Math.sin(time * 3) * 0.15, game.corpse.z);
      }
    }

    // gold shower on the felling
    goldBurstT = Math.max(0, goldBurstT - rawDt);
    if (goldBurstT > 0 && Math.random() < 0.3) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.3),
        new THREE.MeshBasicMaterial({ color: PAL.extra.gold, side: THREE.DoubleSide, transparent: true }),
      );
      m.position.set(p.x + (Math.random() - 0.5) * 8, p.y + 5 + Math.random() * 3, p.z + (Math.random() - 0.5) * 8);
      m.userData.t = 1.5;
      world.add(m);
      goldPuffs.push(m);
    }
    for (let i = goldPuffs.length - 1; i >= 0; i--) {
      const m = goldPuffs[i];
      m.userData.t -= rawDt;
      m.position.y -= rawDt * 2;
      m.rotation.z += rawDt * 4;
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
    return {
      cam: chase.camera.position.toArray(),
      player: [p.x, p.y, p.z],
      phase: game.phase,
      hp: p.hp,
      stamina: p.stamina,
      flasks: p.flasks,
      shards: p.shards,
      deaths: game.deaths,
      boss: { hp: game.boss.hp, state: game.boss.state, phase: game.bossPhase },
      soldiersAlive: game.enemies.filter((e) => e.kind === "soldier" && e.state !== "dead").length,
      lockOn: !!game.lockTarget,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleportBeat(beat: "grace" | "pack" | "scarab" | "gate" | "boss") {
    game.teleportBeat(beat);
  },
  lockOn() { game.lockOn(); },
  setBossPhase(n: 1 | 2) { game.setBossPhase(n); },
  bossHp(n: number) { game.bossHp(n); },
  killPlayer() { game.killPlayer(); },
  giveShards(n: number) { game.giveShards(n); },
  riposteWindow() { game.debugRiposteWindow(); },
  killSoldiers(pack = 0) {
    for (const e of game.enemies) {
      if (e.kind === "soldier" && (pack < 0 || e.pack === pack) && e.state !== "dead") {
        e.hp = 0;
        e.state = "dead";
        game.events.onEnemyDie?.(e);
      }
    }
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
