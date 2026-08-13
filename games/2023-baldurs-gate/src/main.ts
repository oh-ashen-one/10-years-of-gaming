/**
 * main.ts — boots TOLLHOUSE and runs the frame loop.
 *
 * Wiring only: the bridge scene + tavern diorama, tabletop figures, the
 * isometric camera (QE-rotatable 45° steps), the d20 dice stage, move
 * ring + target marker, event plumbing (game → audio/HUD/FX), and the
 * __game harness API. All decisions live in game.ts.
 */
import * as THREE from "three";
import { configureCelEnv, buildSky, PostFX, FrameLoop, installHarness, col, fbm } from "@tenyears/core";
import { PAL } from "./palette";
import { css } from "@tenyears/core";
import { PARTY_START, TOLLKEEPER_AT, GUARDS_AT, TAVERN, CHEST } from "./scene";
import { buildScene } from "./world/scenebuilder";
import { Game, type Combatant, type Kind } from "./game";
import { buildFigure, type FigRig } from "./characters";
import { DiceStage } from "./dice";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

configureCelEnv(PAL, {
  sunDir: new THREE.Vector3(0.3, 0.55, 0.45), // candle-warm key, cool floor
  sunTint: 0xffd9a0,
  ambient: 0x5a6a94,
  hazeNear: 40,
  hazeFar: 200,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const GOLD = css(PAL.accents.primary);
const scene = new THREE.Scene();
scene.background = col(0x161a2a).clone();

const world = new THREE.Group();
scene.add(world);

// rooflines + gallows silhouettes around the dusk
function rooflines(seed: number): (a: number) => number {
  return (a: number) => {
    const cell = Math.floor(a * 20);
    const local = a * 20 - cell;
    const h = fbm(cell * 0.8 + seed, 5.5, 2);
    if (h > 0.66 && local > 0.4 && local < 0.5) return 0.95; // gallows arm
    return 0.2 + Math.floor(h * 3) / 3 * 0.45;               // roofline steps
  };
}

const sky = buildSky(scene, {
  palette: PAL,
  sunDir: new THREE.Vector3(0.3, 0.55, 0.45),
  radius: 900,
  rays: false,
  clouds: true,
  silhouettes: [
    { radius: 820, baseY: -14, maxH: 60, color: PAL.atmosphere.silhouetteFar, hazeMix: 0.55, shape: rooflines(3.3), segments: 240 },
    { radius: 740, baseY: -8, maxH: 44, color: PAL.atmosphere.silhouetteMid, hazeMix: 0.35, shape: rooflines(8.8), segments: 220 },
  ],
});

const set = buildScene(world);
const dice = new DiceStage();

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

// figure rigs, one per combat-capable character
const rigs = new Map<number, FigRig>();
let figsBuilt = false;
function buildFigs(): void {
  if (figsBuilt) return;
  figsBuilt = true;
  const mk = (id: number, kind: Kind, x: number, z: number) => {
    const rig = buildFigure(kind, id * 1.3);
    rig.group.position.set(x, 0, z);
    world.add(rig.group);
    rigs.set(id, rig);
  };
  mk(1, "player", PARTY_START.x, PARTY_START.z);
  mk(2, "mage", PARTY_START.x + 2.4, PARTY_START.z + 1.6);
  mk(3, "tollkeeper", TOLLKEEPER_AT.x, TOLLKEEPER_AT.z);
  GUARDS_AT.forEach((g, i) => mk(4 + i, "guard", g.x, g.z));
}

// move ring + target marker
const moveRing = new THREE.Mesh(
  new THREE.RingGeometry(7.7, 8.0, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: PAL.accents.primary, transparent: true, opacity: 0.7 }),
);
moveRing.visible = false;
world.add(moveRing);
const targetMark = new THREE.Mesh(
  new THREE.RingGeometry(0.7, 0.9, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: PAL.extra.danger, transparent: true, opacity: 0.9 }),
);
targetMark.visible = false;
world.add(targetMark);
const greaseMesh = new THREE.Mesh(
  new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: PAL.extra.grease, transparent: true, opacity: 0.85 }),
);
greaseMesh.visible = false;
world.add(greaseMesh);
const fireMesh = new THREE.Mesh(
  new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: PAL.extra.fire, transparent: true, opacity: 0.75 }),
);
fireMesh.visible = false;
world.add(fireMesh);

/* ------------------------------------------------------------------ events -- */

let diceForced: number | null = null;

game.events = {
  onPhase(p) {
    if (p === "dialogue") hud.dialogueShow();
    if (p === "explore" || p === "combat") hud.dialogueHide();
  },
  onLine(who, text) {
    hud.dialogueLine(who, text);
  },
  onChoices(choices) {
    hud.dialogueChoices(choices);
  },
  onRollStart(label, dc, mod) {
    audio.diceClatter();
    dice.roll({ label, dc, mod, forced: diceForced }, (v) => {
      diceForced = null;
      audio.diceSettle();
      game.resolveRoll(v);
    });
  },
  onRollResult(rec) {
    audio.verdict(rec.crit === "crit" ? "crit" : rec.success ? "success" : "fail");
  },
  onOutcome(o) {
    if (o === "robbed") audio.verdict("fail");
    else if (o === "free" || o === "cowed") audio.verdict("success");
  },
  onCombatStart() {
    audio.turnChime();
  },
  onTurn() {
    audio.turnChime();
  },
  onDamage(x, z, amount, label) {
    const p = worldToScreen(x, 1.6, z);
    const color = label === "MISS" || label === "TOO FAR" || label === "RESISTED" ? "#9a94a8"
      : label === "FIRE" ? "#ff8a3a"
      : label === "SPARK" ? "#b88aff"
      : amount === 0 ? GOLD : "#ffffff";
    hud.spawnNum(p.x, p.y, amount > 0 ? String(amount) : label, color);
    if (label === "SPARK") audio.bolt();
    else if (label === "FIRE") audio.ignite();
    else if (label === "GREASE") audio.grease();
    else if (label === "MISS") audio.swing();
    else if (amount > 0) audio.hurt();
  },
  onPush(c, intoRiver) {
    audio.shove();
    const rig = rigs.get(c.id);
    if (rig && intoRiver) {
      rig.flail();
      audio.splash();
      hud.msg(`${c.name} — INTO THE RIVER!`, 1600);
    }
  },
  onSlip(c) {
    audio.slip();
    hud.msg(`${c.name} SLIPPED!`, 900);
  },
  onIgnite() {
    audio.ignite();
    hud.msg("THE GREASE CATCHES!", 1200);
  },
  onDeath(c, inRiver) {
    const rig = rigs.get(c.id);
    if (rig && !inRiver) {
      rig.group.rotation.z = Math.PI / 2;
      rig.group.position.y = 0.3;
    }
  },
  onCombatWin() {
    audio.loot();
    hud.msg("THE BRIDGE IS YOURS — THE CHEST WAITS", 2200);
  },
  onLoot() {
    audio.loot();
    hud.msg("500 GOLD + A FINE CLOAK", 1800);
  },
  onBark(text) {
    hud.msg(text, 3000);
  },
  onResults() {
    audio.results();
    hud.results(game);
  },
  onDip() {
    audio.dip();
    hud.msg("BLADE DIPPED — IT BURNS", 1100);
  },
};

function worldToScreen(x: number, y: number, z: number): { x: number; y: number } {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
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
  buildFigs();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Tab") e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  firstInput();
  if (e.code === "Enter") {
    if (game.phase === "title") startGame();
    else if (game.phase === "results") location.reload();
    else if (game.phase === "combat") game.endTurn();
  }
  if (game.phase === "dialogue" && e.code.startsWith("Digit")) {
    game.choose(Number(e.code.slice(5)) - 1);
  }
  if (game.phase === "combat") {
    if (e.code === "Tab") game.cycleTarget();
    if (e.code === "Digit1") { game.strike(); audio.swing(); }
    if (e.code === "Digit2") game.shove();
    if (e.code === "Digit3") game.dipBlade();
    if (e.code === "Digit4") { game.throwBarrel(); audio.barrel(); }
  }
  if (game.phase === "explore" && e.code === "KeyE") game.interact();
  if (e.code === "KeyQ") azimStep--;
  if (e.code === "KeyE" && game.phase !== "explore") azimStep++;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
document.getElementById("title")!.addEventListener("click", () => {
  firstInput();
  startGame();
});

/* ------------------------------------------------------------------ camera -- */

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 2000);
let azimStep = 0;
const camPos = new THREE.Vector3(TAVERN.x + 10, 6, TAVERN.z + 10);
const camLook = new THREE.Vector3(TAVERN.x, 1, TAVERN.z);
const _want = new THREE.Vector3();
const _look = new THREE.Vector3();

function updateCamera(dt: number): void {
  if (game.phase === "title") {
    // slow drift around the tavern table, dice rolling
    const a = performance.now() / 1000 * 0.14;
    _want.set(TAVERN.x + Math.cos(a) * 9, 4.2, TAVERN.z + Math.sin(a) * 9);
    _look.set(TAVERN.x, 1.2, TAVERN.z);
  } else {
    // isometric: fixed pitch, QE-stepped azimuth, follows the action
    const az = azimStep * (Math.PI / 4) + Math.PI / 4;
    const follow = game.phase === "combat" && game.active()
      ? game.active()!
      : game.player;
    const R = 24;
    _want.set(follow.x + Math.cos(az) * R, 19, follow.z + Math.sin(az) * R);
    _look.set(follow.x, 0.5, follow.z);
  }
  camPos.lerp(_want, 1 - Math.exp(-dt * 3.2));
  camLook.lerp(_look, 1 - Math.exp(-dt * 4));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  camera,
  { ink: PAL.ink.deep, vignette: 0.4 },
);

let hudTick = 0;
let stepAcc = 0;
let stepAlt = false;

const loop = new FrameLoop({
  renderer,
  camera,
  scene,
  post,
  update: (dt, time) => {
    // explore moves the player; combat moves the ACTIVE unit (budget ring)
    if (game.phase === "combat") {
      const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const z = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
      // camera-relative
      const az = azimStep * (Math.PI / 4) + Math.PI / 4;
      const fwd = { x: -Math.cos(az), z: -Math.sin(az) };
      const right = { x: -fwd.z, z: fwd.x };
      game.moveActive(
        (right.x * x + fwd.x * -z),
        (right.z * x + fwd.z * -z),
        dt,
      );
      game.update(dt, { x: 0, z: 0 });
    } else {
      const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const z = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
      const az = azimStep * (Math.PI / 4) + Math.PI / 4;
      const fwd = { x: -Math.cos(az), z: -Math.sin(az) };
      const right = { x: -fwd.z, z: fwd.x };
      game.update(dt, { x: right.x * x + fwd.x * -z, z: right.z * x + fwd.z * -z });
    }

    dice.update(dt);
    updateCamera(dt);

    /* ---- figures ---- */
    if (game.combat) {
      for (const c of game.combat.order) {
        const rig = rigs.get(c.id);
        if (!rig) continue;
        if (c.alive || !rig.group.visible) {
          rig.group.position.set(c.x, rig.group.position.y, c.z);
          rig.update(dt, time + c.id, false);
        }
        if (!c.alive && !rig.group.visible) { /* river */ }
        else if (!c.alive) {
          rig.group.rotation.z = Math.PI / 2;
          rig.group.position.y = 0.3;
        }
      }
      const p1 = game.combat.order.find((o) => o.kind === "player")!;
      game.player.x = p1.x;
      game.player.z = p1.z;
      const mg = game.combat.order.find((o) => o.kind === "mage")!;
      game.mage.x = mg.x;
      game.mage.z = mg.z;
    } else if (game.phase !== "title") {
      const p = game.player;
      const rigP = rigs.get(1);
      if (rigP) {
        const moving = Math.hypot(
          (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
          (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
        ) > 0.1 && game.phase === "explore";
        rigP.group.position.set(p.x, rigP.group.position.y, p.z);
        rigP.group.rotation.y = p.heading;
        rigP.update(dt, time, moving);
        if (moving) {
          stepAcc += 6 * dt;
          if (stepAcc > 2) {
            stepAcc = 0;
            stepAlt = !stepAlt;
            audio.step(stepAlt);
          }
        }
      }
      const rigM = rigs.get(2);
      if (rigM) {
        rigM.group.position.set(game.mage.x, rigM.group.position.y, game.mage.z);
        rigM.update(dt, time + 1.3, false);
      }
    }

    /* ---- combat markers ---- */
    const active = game.phase === "combat" ? game.active() : null;
    if (active && active.kind === "player") {
      moveRing.visible = true;
      moveRing.position.set(active.moveFromX, 0.1, active.moveFromZ);
      const t = game.target();
      if (t) {
        targetMark.visible = true;
        targetMark.position.set(t.x, 0.12, t.z);
        targetMark.rotation.z = time * 2;
      } else {
        targetMark.visible = false;
      }
    } else {
      moveRing.visible = false;
      targetMark.visible = false;
    }
    // grease/fire pools
    const g0 = game.combat?.grease[0];
    greaseMesh.visible = !!g0 && g0.igniteT <= 0;
    fireMesh.visible = !!g0 && g0.igniteT > 0;
    if (g0) {
      greaseMesh.position.set(g0.x, 0.09, g0.z);
      greaseMesh.scale.setScalar(g0.r);
      fireMesh.position.set(g0.x, 0.1, g0.z);
      fireMesh.scale.setScalar(g0.r * (0.9 + Math.sin(time * 9) * 0.1));
    }

    set.update(dt, time);
    sky.update(time, camera.position);
    audio.update(dt);

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
      hud.updateCombat(game);
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
  cam(_mode: string) { /* fixed isometric rig; QE rotates */ },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { buildFigs(); game.debugFinish(); },
  debug() {
    return {
      cam: camera.position.toArray(),
      player: [game.player.x, game.player.z],
      phase: game.phase,
      gold: game.gold,
      path: game.path,
      combat: game.combat
        ? { round: game.combat.round, active: game.active()?.name, foes: game.combat.order.filter((o) => o.side === "enemy" && o.alive).length }
        : null,
      rolls: game.rolls.length,
      bodiesInRiver: game.bodiesInRiver,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleport(x: number, z: number) { game.teleport(x, z); },
  gotoDialogue() { game.gotoDialogue(); },
  choose(i: number) { game.choose(i); },
  forceRoll(v: number) { diceForced = v; },
  reroll() { game.debugReroll(); },
  startFight(surprised = true) { buildFigs(); game.startFight(surprised); },
  forceShoveKill() { game.forceShoveKill(); },
  forceGreaseFire() { game.forceGreaseFire(); },
  winFight() { game.forceWinCombat(); },
  shove() { game.shove(); },
  strike() { game.strike(); },
  endTurn() { game.endTurn(); },
  loot() { game.teleport(CHEST.x, CHEST.z - 2); game.interact(); },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
