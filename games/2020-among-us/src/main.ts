/**
 * main.ts — boots SUSPECTED and runs the frame loop.
 *
 * Wiring only: the ship build, beans, LOS fog overlay, space backdrop,
 * top-down tilt camera (title drift / play follow / airlock for ejects /
 * ghost cam on a loss), event plumbing (game → audio/HUD/FX), minigame
 * routing, and the __game harness API. All decisions live in game.ts.
 */
import * as THREE from "three";
import { configureCelEnv, PostFX, FrameLoop, installHarness, col } from "@tenyears/core";
import { PAL, CREW_COLORS } from "./palette";
import { STATIONS, BUTTON, AIRLOCK, roomAt, PLAYER_SPAWN } from "./ship";
import { buildShip } from "./world/shipbuilder";
import { buildBean, buildBody, type BeanRig } from "./beans";
import { VisionFog } from "./fog";
import { buildSpace, EjectDrift } from "./space";
import { Game } from "./game";
import { Minigames } from "./minigames";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

configureCelEnv(PAL, {
  sunDir: new THREE.Vector3(0.2, 0.9, 0.3), // the skylight: nearly overhead
  sunTint: 0xfff2d8,
  ambient: 0xa8b4d8,
  hazeNear: 40,
  hazeFar: 150,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = col(0x05060e).clone();

const world = new THREE.Group();
scene.add(world);

const space = buildSpace(scene);
const ship = buildShip(world);
const fog = new VisionFog();

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();
const mg = new Minigames();

let playerBean: BeanRig;
const beanRigs = new Map<number, BeanRig>();
const bodyMeshes = new Map<number, THREE.Group>();
const ejectDrift = new EjectDrift(scene);

let visualsBuilt = false;
function buildVisuals(): void {
  if (visualsBuilt) return;
  visualsBuilt = true;
  playerBean = buildBean(PAL.extra.beanRed);
  world.add(playerBean.group);
  for (const c of game.crew) {
    const rig = buildBean(CREW_COLORS[c.colorIdx].hex);
    rig.group.position.set(c.x, 0, c.z);
    world.add(rig.group);
    beanRigs.set(c.id, rig);
  }
}

/* ------------------------------------------------------------------ events -- */

let stepAcc = 0;
let stepAlt = false;
let meetLineIdx = 0;
let resultsT = -1;
let lastLossKind = "killed";

game.events = {
  onKill(victim, witnessed) {
    audio.killSting();
    if (victim) {
      const rig = beanRigs.get(victim.id);
      if (rig) rig.group.visible = false;
      if (witnessed) hud.msg(`YOU SAW ${victim.name} GET KILLED!`, 2400, true);
    }
  },
  onKillAttemptNear() {
    audio.nearKill();
  },
  onVent(_x, _z, seen) {
    audio.vent();
    if (seen) hud.msg("DID IT JUST… VENT?!", 2200, true);
  },
  onMeeting(reason) {
    meetLineIdx = 0;
    hud.showMeeting(reason === "body" ? "DEAD BODY REPORTED" : "EMERGENCY MEETING");
    audio.reportSiren();
    setTimeout(() => audio.meetingSting(), 700);
  },
  onVoteTime() {
    hud.showVote(game);
    audio.voteTick();
  },
  onEject(name, wasImpostor, lines) {
    hud.hideMeeting();
    audio.eject();
    // the drift: out of the storage airlock into the black
    const victim = game.crew.find((c) => c.name === name);
    ejectDrift.fire(
      victim?.colorIdx ?? 0,
      new THREE.Vector3(AIRLOCK.x, 1, AIRLOCK.z),
    );
    if (victim) {
      const rig = beanRigs.get(victim.id);
      if (rig) rig.group.visible = false;
    }
    hud.msg(lines.join(" "), 3200, !wasImpostor);
  },
  onNoEject() {
    hud.hideMeeting();
    hud.msg("NO ONE WAS EJECTED", 1800);
  },
  onLightsOut() {
    audio.lightsOut();
    hud.msg("LIGHTS SABOTAGED — FIX AT ELECTRICAL", 2800, true);
  },
  onLightsFixed() {
    audio.lightsFixed();
    hud.msg("LIGHTS RESTORED", 1400);
  },
  onTaskDone(task, remaining) {
    audio.taskDone();
    hud.msg(`${task.toUpperCase()} COMPLETE — ${remaining} LEFT`, 1600);
  },
  onWin() {
    audio.win();
    resultsT = 0;
  },
  onLose(kind) {
    audio.lose();
    lastLossKind = kind;
    resultsT = 0;
  },
};

mg.onComplete = (task) => game.completeTask(task);
mg.onClose = () => { game.inTask = false; };

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

  // minigame input has priority
  if (mg.active) {
    if (e.code === "Space") mg.key("SpaceDown");
    else mg.key(e.code);
    if (e.code === "Escape") mg.close();
    return;
  }

  // meeting votes
  if (game.phase === "meeting" && game.meeting?.voting) {
    if (e.code === "ArrowLeft" || e.code === "ArrowUp") { hud.voteMove(-1); audio.voteTick(); }
    if (e.code === "ArrowRight" || e.code === "ArrowDown") { hud.voteMove(1); audio.voteTick(); }
    if (e.code === "Space" || e.code === "Enter") game.castVote(hud.voteChoice());
    return;
  }

  if (e.code === "Enter") {
    if (game.phase === "title") startGame();
    else if (game.phase === "results") location.reload();
  }
  if (game.phase !== "play") return;
  if (e.code === "KeyE") {
    const s = game.nearestStation();
    if (s) {
      game.inTask = true;
      mg.open(s.task);
      audio.taskStart();
    }
  }
  if (e.code === "KeyR") game.report();
  if (e.code === "KeyF") game.emergency();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (mg.active && e.code === "Space") mg.key("SpaceUp");
});
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

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 2400);
let titleA = 0.6;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);

function updateCamera(dt: number): void {
  const p = game.player;
  if (game.phase === "title") {
    // drift past the ship from the void
    titleA += dt * 0.05;
    camPos.set(Math.sin(titleA) * 52, 26, Math.cos(titleA) * 52);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 2));
    camera.lookAt(0, 0, 0);
    return;
  }
  if (game.phase === "eject") {
    // fixed on the airlock for the drift
    camPos.lerp(new THREE.Vector3(AIRLOCK.x - 2, 14, AIRLOCK.z - 9), 1 - Math.exp(-dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(AIRLOCK.x, 0.5, AIRLOCK.z + 2);
    return;
  }
  if (game.phase === "results") {
    // ghost cam on a loss: watch the impostor; on a win, the player
    const t = game.player.alive ? game.player : game.impostor;
    titleA += dt * 0.3;
    camPos.lerp(new THREE.Vector3(t.x + Math.sin(titleA) * 9, 12, t.z + Math.cos(titleA) * 9), 1 - Math.exp(-dt * 2));
    camera.position.copy(camPos);
    camera.lookAt(t.x, 0.5, t.z);
    return;
  }
  // play/meeting: high tilt follow
  camPos.lerp(_v1.set(p.x, 22, p.z + 12.5), 1 - Math.exp(-dt * 6));
  camera.position.copy(camPos);
  camLook.lerp(_v2.set(p.x, 0, p.z + 1.2), 1 - Math.exp(-dt * 8));
  camera.lookAt(camLook);
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  camera,
  { ink: PAL.ink.deep, vignette: 0.3 },
);

let hudTick = 0;

const loop = new FrameLoop({
  renderer,
  camera,
  scene,
  post,
  update: (dt, time) => {
    const inUI = mg.active !== null || game.phase === "meeting";
    game.update(dt, game.phase === "play" && !inUI ? moveVector() : { x: 0, z: 0 });

    // asteroid minigame held axes
    mg.axisX = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
    mg.axisY = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
    mg.update(dt);

    // fix-the-lights hold
    if (keys.has("KeyE") && game.lightsOut && game.phase === "play") {
      game.fixingLights(dt);
    }

    updateCamera(dt);

    /* ---- beans ---- */
    const p = game.player;
    if (playerBean) {
      playerBean.group.position.set(p.x, playerBean.group.position.y, p.z);
      playerBean.group.visible = p.alive;
      const moving = Math.hypot(moveVector().x, moveVector().z) > 0.1 && game.phase === "play" && !inUI;
      playerBean.update(dt, time, moving);
      if (moving) {
        playerBean.group.rotation.y = Math.atan2(moveVector().x, moveVector().z);
        stepAcc += 4.6 * dt;
        if (stepAcc > 1.1) {
          stepAcc = 0;
          stepAlt = !stepAlt;
          audio.step(stepAlt);
        }
      }
    }
    for (const c of game.crew) {
      const rig = beanRigs.get(c.id);
      if (!rig || !c.alive) continue;
      rig.group.position.set(c.x, rig.group.position.y, c.z);
      // the fog decides who you can see
      rig.group.visible =
        game.phase !== "play" ||
        fog.isVisible(p.x, p.z, c.x, c.z, game.visionR + 0.5);
      rig.update(dt, time + c.id * 1.7, Math.hypot(c.tx - c.x, c.tz - c.z) > 1);
      if (rig.group.visible) rig.group.rotation.y = Math.atan2(c.tx - c.x, c.tz - c.z);
    }
    // bodies: synced from game state (works for kills AND debug bodies),
    // and they respect the fog
    game.bodies.forEach((b) => {
      let mesh = bodyMeshes.get(b.x * 1000 + b.z);
      if (!mesh) {
        mesh = buildBody(CREW_COLORS[b.colorIdx].hex);
        mesh.position.set(b.x, 0, b.z);
        world.add(mesh);
        bodyMeshes.set(b.x * 1000 + b.z, mesh);
      }
      mesh.visible = fog.isVisible(p.x, p.z, b.x, b.z, game.visionR + 0.5) || game.phase !== "play";
    });

    /* ---- meeting line reveal ---- */
    if (game.phase === "meeting" && game.meeting) {
      const m = game.meeting;
      while (meetLineIdx < m.lines.length && m.t > 0.6 + meetLineIdx * 1.1) {
        const line = m.lines[meetLineIdx];
        hud.addMeetingLine(line.who, line.text, line.mine);
        meetLineIdx++;
      }
    }

    /* ---- results timing ---- */
    if (game.phase === "results" && resultsT >= 0) {
      resultsT += dt;
      if (resultsT > 1.4) {
        const won = game.tasksDone.size >= 5 || !game.impostor.alive;
        const kind = won ? (game.tasksDone.size >= 5 ? "tasks" : "vote") : lastLossKind;
        hud.results(game, won, kind);
        resultsT = -1;
      }
    }

    /* ---- world systems ---- */
    ejectDrift.update(dt);
    space.update(time, camera.position);
    ship.buttonGlow.scale.setScalar(1 + Math.sin(time * 3) * 0.08);

    // fog overlay: only while playing
    fog.enabled = game.phase === "play";
    fog.update(p.x, p.z, game.visionR, camera, game.lightsOut ? 0.975 : 0.9);

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
      hud.prompt(currentPrompt());
      const room = roomAt(p.x, p.z);
      hud.roomBanner(room?.name ?? "");
    }
    hud.tick(dt * 1000);
  },
});


function currentPrompt(): string {
  if (game.phase !== "play" || mg.active) return "";
  if (!game.player.alive) return "";
  if (game.lightsOut) {
    const s = STATIONS[0];
    if (Math.hypot(s.x - game.player.x, s.z - game.player.z) < 2.4) {
      return `HOLD <b>E</b> — FIX LIGHTS`;
    }
  }
  const b = game.nearestBody();
  if (b) return `<b>R</b> — REPORT BODY`;
  const s = game.nearestStation();
  if (s) return `<b>E</b> — ${s.label}`;
  if (!game.buttonUsed && Math.hypot(BUTTON.x - game.player.x, BUTTON.z - game.player.z) < 2.4) {
    return `<b>F</b> — EMERGENCY MEETING`;
  }
  return "";
}

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    startGame();
  },
  cam(_mode: string) { /* fixed top-down rig; eject/results have their own */ },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() {
    buildVisuals();
    game.debugFinish(true);
  },
  debug() {
    const p = game.player;
    return {
      cam: camera.position.toArray(),
      player: [p.x, p.z],
      phase: game.phase,
      tasks: game.tasksDone.size,
      alive: game.crew.filter((c) => c.alive).length + (p.alive ? 1 : 0),
      impostor: game.impostor?.name,
      lightsOut: game.lightsOut,
      bodies: game.bodies.length,
      meeting: game.meeting ? { voting: game.meeting.voting, tallied: game.meeting.tallied } : null,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  teleport(x: number, z: number) { game.teleport(x, z); },
  gotoStation(task: string) {
    const s = STATIONS.find((v) => v.task === task);
    if (s) game.teleport(s.x + 1.2, s.z + 1.2);
  },
  openTask(task: string) {
    game.inTask = true;
    mg.open(task);
  },
  closeTask() { mg.close(); },
  taskState() { return { active: mg.active, ...mg["state"] }; },
  forceKill() { game.debugForceKill(); },
  bodyHere() { game.debugBodyHere(); },
  report() { game.report(); },
  emergency() { game.debugBodyHere(); game.report(); },
  lightsOut() { game.debugLightsOut(); },
  lightsFix() { game.debugLightsFix(); },
  exposeImpostor() { game.debugExposeImpostor(); },
  voteImpostor() {
    game.debugExposeImpostor();
    game.castVote(game.impostor.id);
  },
  completeTask(task: string) { game.completeTask(task); },
  finishLoss() {
    buildVisuals();
    game.debugFinish(false);
  },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
