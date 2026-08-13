/**
 * main.ts — boots OVERPAINT and runs the frame loop.
 *
 * Wiring only: the rose-gold sky with the gold-leaf "34", the painted
 * valley assembly (shards, gilt frames, pictos, the flag, the arena),
 * expeditioner/brushling/mime/marionette rigs, the chase camera plus the
 * battle side-cinematic, petals + paint motes, brushstroke telegraph
 * smears, the cannon's jump marker, paint-splash bursts, the petal
 * dissolve, the overpaint face-flash, event plumbing, and the __game
 * harness API. All decisions live in game.ts.
 */
import * as THREE from "three";
import {
  configureCelEnv, buildSky, PostFX, ChaseCamera, FrameLoop, installHarness,
  col, fbm, type CamMode,
} from "@tenyears/core";
import { PAL } from "./palette";
import { START, ARENA, heightAt } from "./valley";
import {
  buildGround, buildShards, buildFrames, buildNumberSky, buildPictos, buildFlag, buildArena, makeSmear,
} from "./world/painted";
import { Game, type Enemy, type AttackKind, type Incoming } from "./game";
import {
  buildExpeditioner, buildBrushling, buildMime, buildMarionette, type ExpoPose,
} from "./characters";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

// rose-gold hero light, low from the north-east over the valley
const SUN_DIR = new THREE.Vector3(0.38, 0.22, -0.9).normalize();
configureCelEnv(PAL, {
  sunDir: SUN_DIR,
  sunTint: 0xf0c8a0,
  ambient: 0x5a5468,
  hazeNear: 50,
  hazeFar: 320,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = col(0x2c2438).clone();

const world = new THREE.Group();
scene.add(world);

/* --------------------------------------------------------------------- sky -- */

// Belle Époque rooflines receding
function roofSilhouette(seed: number): (a: number) => number {
  return (a: number) => {
    const cell = Math.floor(a * 14);
    const local = a * 14 - cell;
    const h = fbm(cell * 1.1 + seed, 4.2, 2);
    if (h > 0.58 && local > 0.4 && local < 0.6) return 0.9;  // a mansard peak
    return 0.18 + Math.floor(h * 4) / 4 * 0.42;
  };
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: SUN_DIR,
  radius: 1500,
  rays: { count: 9, speed: 0.05, amount: 0.3 },
  clouds: true,
  silhouettes: [
    { radius: 1400, baseY: -24, maxH: 120, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.6, shape: roofSilhouette(6.6), segments: 280 },
    { radius: 1250, baseY: -12, maxH: 70, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.38, shape: roofSilhouette(2.2), segments: 240 },
  ],
});

/* ------------------------------------------------------------------- world -- */

buildGround(world);
const shards = buildShards(world);
const frames = buildFrames(world);
buildNumberSky(world);
const pictoRigs = buildPictos(world);
buildFlag(world);
buildArena(world);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const expo = buildExpeditioner();
world.add(expo.group);
const marionette = buildMarionette();
world.add(marionette.group);

const foeRigs = new Map<number, { group: THREE.Group; update: (dt: number, time: number, state: string, stateT: number) => void }>();

let visualsBuilt = false;
function buildVisuals(): void {
  if (visualsBuilt) return;
  visualsBuilt = true;
  for (const e of game.enemies) {
    if (e.kind === "brushling") {
      const rig = buildBrushling(e.id * 1.7);
      world.add(rig.group);
      foeRigs.set(e.id, rig);
    } else if (e.kind === "mime") {
      const rig = buildMime();
      world.add(rig.group);
      foeRigs.set(e.id, rig);
    }
    // the marionette's rig is built once, above
  }
}

/* ------------------------------------------------------------------- VFX -- */

// smear per enemy (the telegraph brushstroke)
const smears = new Map<number, THREE.Mesh>();
const STROKE_COLORS: Record<AttackKind, number> = {
  stroke: PAL.extra.navy,
  sweep: PAL.extra.rose,
  blade: PAL.extra.mime,
  jab: PAL.extra.gold,
  cannon: 0x9a6ad8,
};

// the cannon's jump marker
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1.1, 28).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: PAL.extra.gold, transparent: true, opacity: 0, depthWrite: false }),
);
world.add(marker);

// paint splash bursts
const splashes: { m: THREE.Mesh; t: number; vx: number; vy: number; vz: number }[] = [];
function splash(x: number, y: number, z: number, color: number, n: number, big = false): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(big ? 0.4 : 0.2, big ? 0.3 : 0.14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2;
    splashes.push({
      m, t: 0.55 + Math.random() * 0.2,
      vx: Math.cos(a) * (2 + Math.random() * 3), vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * (2 + Math.random() * 3),
    });
    world.add(m);
  }
}

// petals (everywhere, always) + gold paint motes rising
const PETALS = 150;
const petalMeshes: THREE.Mesh[] = [];
for (let i = 0; i < PETALS; i++) {
  const mote = i >= 110;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(mote ? 0.09 : 0.17, mote ? 0.09 : 0.12),
    new THREE.MeshBasicMaterial({
      color: mote ? PAL.extra.gold : i % 3 ? PAL.extra.petal : PAL.extra.petalB,
      transparent: true, opacity: mote ? 0.8 : 0.9, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  m.userData.seed = i * 1.37;
  m.userData.mote = mote;
  m.position.set((Math.random() - 0.5) * 70, Math.random() * 15, (Math.random() - 0.5) * 70);
  world.add(m);
  petalMeshes.push(m);
}

// dissolve petals (a dying enemy sheds them upward)
const dissolvePetals: { m: THREE.Mesh; t: number; vx: number; vy: number; vz: number }[] = [];
function shedPetals(x: number, y: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.14),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? PAL.extra.petal : PAL.extra.petalB, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.position.set(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 1.2, z + (Math.random() - 0.5) * 0.8);
    dissolvePetals.push({
      m, t: 1.6 + Math.random(),
      vx: (Math.random() - 0.5) * 1.6, vy: 1.2 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.6,
    });
    world.add(m);
  }
}

// the overpaint face flash
let faceFlashT = 0;

/* ------------------------------------------------------------------ events -- */

game.events = {
  onBattleStart(fight) {
    audio.battleStart();
    hud.msg(fight === 1 ? "BRUSHLINGS — YOUR TURN" : fight === 2 ? "THE FENCED MIME — PARRY HIS BLADE" : "THE CURATOR'S MARIONETTE", 2400);
  },
  onTurn(turn) {
    if (turn === "player") hud.msg("YOUR TURN", 900);
    void turn;
  },
  onSwing() { /* per-kind audio in onHit */ },
  onHit(e, dmg, kind) {
    if (kind === "aim" || kind === "weak") audio.swing("aim");
    else if (kind === "lance") audio.swing("lance");
    else if (kind === "overpaint") audio.swing("overpaint");
    else audio.swing("strike");
    if (kind === "weak") audio.weak();
    else audio.hit();
    const col6 = kind === "counter" ? PAL.extra.rose : kind === "overpaint" ? PAL.extra.gold : PAL.extra.navy;
    splash(e.x, heightAt(e.x, e.z) + 1.2, e.z, col6, kind === "overpaint" ? 22 : 9, kind === "overpaint");
    if (kind === "overpaint") faceFlashT = 1.1;
    void dmg;
  },
  onAim(on) {
    if (on) hud.msg("THE RETICLE SWAYS — ENTER ON THE GOLD", 1600);
  },
  onAttackTelegraph(atk) {
    audio.telegraph(atk.kind);
  },
  onAttackBeat(atk) {
    audio.telegraph(atk.kind);
  },
  onDodge() {
    audio.dodge();
  },
  onParry(e) {
    audio.parry();
    hud.parryRing();
    splash(e.x, heightAt(e.x, e.z) + 1.2, e.z, PAL.extra.rose, 10);
  },
  onGradientBreak() {
    audio.gradientBreak();
    hud.msg("GRADIENT BREAK — UNLOAD!", 1600);
  },
  onPlayerHit() {
    audio.playerHit();
    chase.addShake(0.4);
  },
  onEnemyDying(e) {
    audio.dissolve();
    void e;
  },
  onBattleWon() {
    audio.battleWon();
    hud.msg("THE PATH OPENS", 1800);
  },
  onPicto(id) {
    audio.picto();
    hud.msg(id === "pictoHp" ? "PICTO — VITAL DAUB (+20 HP)" : "PICTO — HONED NIB (+3 DMG)", 2000);
  },
  onFlag() {
    audio.flag();
    hud.msg("EXPEDITION FLAG — CHECKPOINT · HEALED", 2200);
  },
  onOverpaint() {
    hud.msg("OVERPAINT", 1200);
  },
  onYouFell() {
    audio.youFell();
    hud.fell(true);
  },
  onRespawn() {
    hud.fell(false);
  },
  onCard() {
    audio.card();
    hud.card(true);
    setTimeout(() => {
      hud.card(false);
      game.showResults();
      hud.results(game);
    }, 6500);
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
    else if (game.phase === "card") {
      hud.card(false);
      game.showResults();
      hud.results(game);
    } else game.confirmOrEndTurn();
  }
  if (e.code === "Space") game.dodge();
  if (e.code === "KeyF") game.parry();
  if (e.code === "Tab") game.cycleTarget();
  if (e.code === "Digit1") game.strike();
  if (e.code === "Digit2") game.aimStart();
  if (e.code === "Digit3") game.lance();
  if (e.code === "KeyQ") game.overpaint();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
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
  baseDistance: 5.6,
  baseHeight: 2.6,
  baseFov: 58,
  speedFov: 0.3,
  orbitRadius: 42,
  orbitHeight: 16,
  ceremonyRadius: 9,
  ceremonyHeight: 4,
});
chase.setMode("orbit");
let camOverride: CamMode | null = null;

const titleTarget = { pos: new THREE.Vector3(START.x, 4, START.z - 30), heading: Math.PI, speed: 0 };
const chaseTarget = { pos: new THREE.Vector3(), heading: 0, speed: 0, beauty: false };
const _mid = new THREE.Vector3();
const _want = new THREE.Vector3();
const _look = new THREE.Vector3();

function updateCamera(dt: number, time: number): void {
  const p = game.player;
  if (game.phase === "title") {
    chase.setMode(camOverride ?? "orbit");
    chase.update(dt, titleTarget, time);
    return;
  }
  if (game.phase === "card" || game.phase === "results") {
    chase.setMode(camOverride ?? "ceremony");
    chaseTarget.pos.set(p.x, p.y, p.z);
    chase.update(dt, chaseTarget, time);
    return;
  }
  if (game.phase === "battle" && game.battle) {
    // the side cinematic — player left, the foe line right
    const foes = game.enemies.filter((e) => e.fight === game.battle!.fight && e.state !== "dead" && e.state !== "waiting");
    if (foes.length) {
      let mx = 0;
      let mz = 0;
      for (const f of foes) {
        mx += f.x;
        mz += f.z;
      }
      mx /= foes.length;
      mz /= foes.length;
      _mid.set((p.x + mx * 1.2) / 2.2, 0, (p.z + mz * 1.2) / 2.2);
      const dx = mx - p.x;
      const dz = mz - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const boss = game.battle.fight === 3;
      const dist = boss ? 13 : 10;
      _want.set(
        _mid.x - (dz / d) * dist,
        Math.max(p.y, heightAt(mx, mz)) + (boss ? 5.2 : 3.8),
        _mid.z + (dx / d) * dist,
      );
      chase.camera.position.lerp(_want, 1 - Math.exp(-dt * 3.2));
      _look.set(_mid.x, _mid.y + 1.4, _mid.z);
      chase.camera.lookAt(_look);
      return;
    }
  }
  chase.setMode(camOverride ?? "chase");
  chaseTarget.pos.set(p.x, p.y, p.z);
  chaseTarget.heading = p.heading;
  chaseTarget.speed = Math.hypot(moveVector().x, moveVector().z) * 5;
  chaseTarget.beauty = false;
  chase.update(dt, chaseTarget, time);
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  chase.camera,
  { ink: PAL.ink.deep, edgeStrength: 0.55, vignette: 0.4 },
);

let hudTick = 0;
let poseT = 0;
let lastPose: ExpoPose = "idle";
let stepAcc = 0;
let stepAlt = false;
// per-enemy pose overrides (the strike flash when an attack lands)
const poseOver = new Map<number, { state: string; move: string | null; beat: number; t: number }>();
let prevAtk: Incoming | null = null;

const loop = new FrameLoop({
  renderer,
  camera: chase.camera,
  scene,
  post,
  update: (dt, time) => {
    game.update(dt, moveVector());
    updateCamera(dt, time);

    /* ---- the expeditioner ---- */
    const p = game.player;
    let pose: ExpoPose = "idle";
    if (p.dead) pose = "dead";
    else if (game.phase === "results" || game.phase === "card") pose = "victory";
    else if (p.parryT > 0) pose = "parry";
    else if (p.dodgeT > 0) pose = "dodge";
    else if (game.aim) pose = "aim";
    else if (poseT < 0.4 && (lastPose === "strike" || lastPose === "lance" || lastPose === "overpaint")) pose = lastPose;
    else if (Math.hypot(moveVector().x, moveVector().z) > 0.05 && game.phase === "explore") pose = "walk";
    if (pose !== lastPose) {
      poseT = 0;
      lastPose = pose;
    }
    poseT += dt;
    expo.update(dt, time, 5, pose, poseT);
    expo.group.position.set(p.x, p.y + expo.group.position.y, p.z);
    expo.group.rotation.y = p.heading;
    expo.group.visible = game.phase !== "title";

    if (pose === "walk") {
      stepAcc += 5 * dt;
      if (stepAcc > 2.4) {
        stepAcc = 0;
        stepAlt = !stepAlt;
        audio.step(stepAlt);
      }
    }

    /* ---- enemies ---- */
    const b = game.battle;
    const atk = b?.incoming ?? null;
    // an attack ending = the strike pose flashes for a beat
    if (prevAtk && !atk) {
      poseOver.set(prevAtk.enemyId, { state: "strike", move: prevAtk.kind, beat: prevAtk.beat, t: 0.3 });
    }
    prevAtk = atk;
    for (const e of game.enemies) {
      const rig = e.kind === "marionette" ? marionette : foeRigs.get(e.id);
      if (!rig) continue;
      rig.group.visible = e.state !== "dead";
      if (!rig.group.visible) continue;
      // pose: the incoming attacker telegraphs/strikes; others idle-states
      let state = e.state === "stagger" ? "stagger" : e.state === "dying" ? "dying" : "idle";
      let move: string | null = null;
      let beat = 0;
      if (atk && atk.enemyId === e.id) {
        state = "telegraph";
        move = atk.kind;
        beat = atk.beat;
      }
      const over = poseOver.get(e.id);
      if (over && over.t > 0) {
        state = over.state;
        move = over.move;
        beat = over.beat;
      }
      if (rig === marionette) {
        marionette.update(dt, time, state, e.stateT, move, beat);
      } else {
        (rig as ReturnType<typeof buildBrushling>).update(dt, time, state, e.stateT);
      }
      let ey = heightAt(e.x, e.z);
      if (e.state === "dying") ey -= e.stateT * 0.35; // the dissolve sinks
      rig.group.position.set(e.x, ey, e.z);
      rig.group.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
      // hit flash
      const flashOn = e.flash > 0 && Math.floor(time * 18) % 2 === 0;
      rig.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material && "uniforms" in o.material) {
          const u = (o.material as THREE.ShaderMaterial).uniforms;
          if (u.uEmissiveStr) u.uEmissiveStr.value = flashOn ? 0.7 : 0;
        }
      });
      // dissolve sheds petals
      if (e.state === "dying" && Math.random() < 0.5) {
        shedPetals(e.x, ey + 0.5, e.z, e.kind === "marionette" ? 6 : 3);
      }
    }
    for (const [id, o] of poseOver) {
      o.t -= dt;
      if (o.t <= 0) poseOver.delete(id);
    }

    /* ---- telegraph smears + the jump marker ---- */
    for (const e of game.enemies) {
      let smear = smears.get(e.id);
      const isTelegraphing = atk && atk.enemyId === e.id;
      if (isTelegraphing && !smear) {
        smear = makeSmear(STROKE_COLORS[atk.kind]);
        world.add(smear);
        smears.set(e.id, smear);
      }
      if (smear) {
        if (isTelegraphing && atk) {
          const k = atk.t / atk.beats[atk.beat];
          smear.visible = true;
          smear.position.set((e.x + p.x) / 2, heightAt(e.x, e.z) + 1.3 + Math.sin(time * 3) * 0.1, (e.z + p.z) / 2);
          smear.lookAt(chase.camera.position);
          // quantized growth — paint lands in steps
          (smear.material as THREE.MeshBasicMaterial).opacity = Math.floor(k * 4) / 4 * 0.9 + 0.1;
          smear.scale.setScalar(0.6 + k * 0.7);
        } else {
          smear.visible = false;
        }
      }
    }
    if (atk && atk.kind === "cannon") {
      const k = atk.t / atk.beats[0];
      marker.visible = true;
      marker.position.set(p.x, p.y + 0.08, p.z);
      marker.scale.setScalar(Math.max(0.15, 2.2 * (1 - k)));
      marker.material.opacity = k > 0.85 ? 1 : 0.6; // the flash at the end
    } else {
      marker.visible = false;
    }

    /* ---- the overpaint face flash ---- */
    faceFlashT = Math.max(0, faceFlashT - dt);
    const faceMat = marionette.face.material as THREE.MeshBasicMaterial;
    faceMat.color.setHex(faceFlashT > 0 ? (Math.floor(time * 10) % 2 ? 0xffd98a : 0xe89aa8) : 0xe8c8d0);

    /* ---- splashes ---- */
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.t -= dt;
      s.m.position.x += s.vx * dt;
      s.m.position.y += s.vy * dt;
      s.m.position.z += s.vz * dt;
      s.vy -= 8 * dt;
      s.m.rotation.z += dt * 6;
      (s.m.material as THREE.MeshBasicMaterial).opacity = Math.min(0.95, s.t * 2);
      if (s.t <= 0) {
        world.remove(s.m);
        splashes.splice(i, 1);
      }
    }

    /* ---- dissolve petals ---- */
    for (let i = dissolvePetals.length - 1; i >= 0; i--) {
      const s = dissolvePetals[i];
      s.t -= dt;
      s.m.position.x += s.vx * dt;
      s.m.position.y += s.vy * dt;
      s.m.position.z += s.vz * dt;
      s.m.rotation.x += dt * 2;
      s.m.rotation.z += dt * 3;
      (s.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, s.t);
      if (s.t <= 0) {
        world.remove(s.m);
        dissolvePetals.splice(i, 1);
      }
    }

    /* ---- petals + motes around the player ---- */
    for (const m of petalMeshes) {
      const seed = m.userData.seed as number;
      if (m.userData.mote) {
        m.position.y += dt * (0.4 + (seed % 1) * 0.3); // motes rise
        m.rotation.z = time * 0.8 + seed;
        if (m.position.y > p.y + 15) m.position.y = p.y - 1;
      } else {
        m.position.y -= dt * (0.5 + (seed % 1) * 0.4);
        m.rotation.x = time * 1.3 + seed;
        m.rotation.z = seed;
        if (m.position.y < p.y - 1) m.position.y = p.y + 13 + (seed % 3);
      }
      m.position.x += Math.sin(time * 1.1 + seed) * dt * 0.7;
      if (Math.abs(m.position.x - p.x) > 36) m.position.x = p.x + (Math.random() - 0.5) * 60;
      if (Math.abs(m.position.z - p.z) > 36) m.position.z = p.z + (Math.random() - 0.5) * 60;
    }

    /* ---- shards + frames drift ---- */
    for (const shard of shards.children) {
      const s = shard.userData.seed as number;
      shard.position.y += Math.sin(time * 0.4 + s) * dt * 0.35;
      shard.rotation.y += dt * 0.05;
    }
    for (const frame of frames.children) {
      const s = frame.userData.seed as number;
      frame.position.y += Math.sin(time * 0.5 + s) * dt * 0.3;
      frame.rotation.y += dt * 0.08;
    }

    /* ---- pictos bob; collected ones vanish ---- */
    for (const pk of pictoRigs) {
      pk.group.visible = !game.pictos.has(pk.id);
      if (pk.group.visible) {
        pk.group.rotation.y = time * 1.2;
        pk.group.position.y += Math.sin(time * 2.2) * dt * 0.25;
      }
    }

    sky.update(time, chase.camera.position);

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
    }
    hud.tick(dt * 1000);
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
    const b = game.battle;
    return {
      cam: chase.camera.position.toArray(),
      player: [p.x, p.y, p.z],
      phase: game.phase,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      pictos: [...game.pictos],
      meter: game.meter,
      aim: !!game.aim,
      battle: b
        ? {
            fight: b.fight,
            turn: b.turn,
            ap: b.ap,
            incoming: b.incoming
              ? { kind: b.incoming.kind, defense: b.incoming.defense, beat: b.incoming.beat, t: +b.incoming.t.toFixed(2), beats: b.incoming.beats }
              : null,
            enemies: game.enemies
              .filter((e) => e.fight === b.fight)
              .map((e) => ({ kind: e.kind, hp: e.hp, shield: e.shield, state: e.state })),
          }
        : null,
      turns: game.turns,
      damageDealt: game.damageDealt,
      parryAttempts: game.parryAttempts,
      parriesLanded: game.parriesLanded,
      dodges: game.dodges,
      deaths: game.deaths,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleport(x: number, z: number) { game.teleport(x, z); },
  gotoBeat(beat: "fight1" | "fight2" | "flag" | "boss") { game.gotoBeat(beat); },
  heal() { game.heal(); },
  setMeter(n: number) { game.setMeter(n); },
  bossHp(n: number) { game.bossHp(n); },
  forceAttack(kind: AttackKind) { game.forceAttack(kind); },
  strike() { game.strike(); },
  aimStart() { game.aimStart(); },
  aimFire() { game.aimFire(); },
  lance() { game.lance(); },
  overpaint() { game.overpaint(); },
  dodge() { game.dodge(); },
  parry() { game.parry(); },
  cycleTarget() { game.cycleTarget(); },
  confirm() { game.confirmOrEndTurn(); },
  showResults() {
    hud.card(false);
    game.showResults();
    hud.results(game);
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
