/**
 * main.ts — boots VOXEL VALLEY and runs the frame loop.
 *
 * First-person: the camera is the player's eyes (arrows or pointer-lock
 * mouse look), physics runs against the voxel truth in game.ts. Wiring
 * only: chunk mesher, blocky sky, mob rigs, crack overlay, viewmodel arm,
 * event plumbing (game → audio/HUD/FX), and the __game harness API.
 */
import * as THREE from "three";
import { configureCelEnv, PostFX, FrameLoop, installHarness, col } from "@tenyears/core";
import { PAL } from "./palette";
import {
  B, HALF, SPAWN, CAVE_CORE, generateWorld, getBlock, setBlock, setDirtyHandler, surfaceY,
  addTorch, raycast,
} from "./world";
import { VoxelMesher, CrackOverlay } from "./world/mesher";
import { Game, RECIPES, type Item, type MobType } from "./game";
import { buildVoxelSky } from "./sky";
import { buildMob, buildArrowMesh, type MobRig } from "./mobs";
import { HUD } from "./hud";
import { GameAudio } from "./audio";

/* ----------------------------------------------------------- art direction -- */

const skyRigHolder: { sky?: ReturnType<typeof buildVoxelSky> } = {};
configureCelEnv(PAL, {
  sunDir: new THREE.Vector3(0.5, 0.62, 0.35),
  sunTint: 0xfff0c8,
  ambient: 0x8a9ac8,
  hazeNear: 60,
  hazeFar: 260,
});

/* ---------------------------------------------------------------- renderer -- */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DAY_BG = col(0x87ceeb).clone();
const NIGHT_BG = col(PAL.extra.night0).clone();
scene.background = DAY_BG.clone();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1800);
scene.add(camera); // the viewmodel rides along

// world renders in block coords, shifted so block 0,0 sits at -HALF
const world = new THREE.Group();
world.position.set(-HALF, 0, -HALF);
scene.add(world);

/* ------------------------------------------------------------------- world -- */

generateWorld();
const mesher = new VoxelMesher(world);
setDirtyHandler((cx, cz) => mesher.markDirty(cx, cz));
const sky = buildVoxelSky(scene);
skyRigHolder.sky = sky;
const crack = new CrackOverlay(world);

/* ------------------------------------------------------------------- game -- */

const game = new Game();
const hud = new HUD();
const audio = new GameAudio();

const mobRigs = new Map<number, MobRig>();
const arrowPool: { g: THREE.Group; used: boolean }[] = [];
const puffs: { mesh: THREE.Mesh; t: number; life: number }[] = [];
const puffGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);

function puff(x: number, y: number, z: number, color: number, n = 8): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color }));
    m.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.6);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    world.add(m);
    puffs.push({ mesh: m, t: 0, life: 0.5 + Math.random() * 0.4 });
  }
}

/* ------------------------------------------------------------------ events -- */

let groanT = 3;
let shakeT = 0;

game.events = {
  onGain(item, n) { hud.gain(item, n); audio.gainPop(); },
  onBreak() { audio.punch(); },
  onPlace() { audio.place(); },
  onCraft(r) {
    audio.craft();
    hud.msg(r.name.toUpperCase(), 900);
  },
  onSwing() { audio.swing(); },
  onMobSpawn(m) {
    const rig = buildMob(m);
    mobRigs.set(m.id, rig);
    world.add(rig.group);
  },
  onMobHit(m) {
    audio.mobHit();
    puff(m.x, m.y + 1.2, m.z, 0xe04a4a, 5);
  },
  onMobDie(m) {
    const rig = mobRigs.get(m.id);
    if (rig) {
      puff(m.x, m.y + 1, m.z, 0x8a8a9a, 10);
      world.remove(rig.group);
      mobRigs.delete(m.id);
    }
  },
  onPlayerHit() {
    audio.playerHit();
    shakeT = 0.35;
  },
  onPlayerDie() {
    audio.playerDie();
  },
  onArrow() { audio.skeletonShoot(); },
  onHiss() { audio.hiss(); },
  onExplode(x, y, z) {
    audio.explode();
    shakeT = 0.9;
    puff(x, y + 0.5, z, 0xffa04a, 16);
    puff(x, y + 0.5, z, 0x3a3a4a, 12);
  },
  onBurn(m) { audio.burnCrackle(); puff(m.x, m.y + 1.4, m.z, 0xff8a2a, 8); },
  onDusk() {
    audio.dusk();
    hud.msg("NIGHT IS COMING — BUILD SHELTER", 3000, true);
  },
  onShelter() {
    audio.shelter();
    hud.msg("SHELTER SECURED", 2000);
  },
  onSurvive() {
    audio.survive();
    hud.results(game);
  },
};

/* ------------------------------------------------------------------- input -- */

const keys = new Set<string>();
let started = false;
let yaw = Math.PI; // face the grove from spawn
let pitch = -0.05;
let lmb = false;
let rmb = false;
let rmbCD = 0;
let swingCD = 0;
let swingAnim = 0;

function firstInput(): void {
  if (started) return;
  started = true;
  audio.init();
  audio.titleSting();
}

function startGame(): void {
  document.getElementById("title")!.classList.add("hidden");
  game.start();
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
  if (game.phase !== "play") return;
  if (e.code === "KeyE") hud.toggleCraft(game);
  if (e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) {
      game.hotbarSel = n - 1;
      audio.gainPop();
    }
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  firstInput();
  if (game.phase !== "play") return;
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
// pointer-lock mouse look (arrows work too — keyboard-only stays viable)
document.getElementById("app")!.addEventListener("click", () => {
  if (game.phase === "play" && !hud.craftOpen) {
    // headless film-test pages can't take pointer lock — never error there
    try {
      const r = document.getElementById("app")!.requestPointerLock?.() as unknown;
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => {});
      }
    } catch { /* unsupported */ }
  }
});
window.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement && game.phase === "play") {
    yaw -= e.movementX * 0.0028;
    pitch -= e.movementY * 0.0028;
    pitch = THREE.MathUtils.clamp(pitch, -1.45, 1.45);
  }
});
hud.onCraft = (id) => game.craft(id);

/* -------------------------------------------------------------- viewmodel -- */

const viewmodel = new THREE.Group();
{
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xe8b890 }),
  );
  arm.position.set(0.34, -0.3, -0.5);
  arm.rotation.x = 0.3;
  viewmodel.add(arm);
  const held = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xb08a54 }),
  );
  held.name = "held";
  held.position.set(0.34, -0.22, -0.85);
  viewmodel.add(held);
}
camera.add(viewmodel);

const HELD_COLORS: Record<string, number> = {
  planks: PAL.extra.planks, cobble: PAL.extra.cobble, dirt: PAL.extra.dirt,
  log: PAL.extra.log, torch: PAL.extra.torch, table: PAL.extra.table,
  door: PAL.extra.door, woodpick: 0xc8a05a, stonepick: 0x9a9aa4, sword: 0xe8e0d0,
};

/* -------------------------------------------------------------- frame loop -- */

const post = new PostFX(
  Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)),
  Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)),
  camera,
  { ink: PAL.ink.deep },
);

let hudTick = 0;
let titleA = 0;

const loop = new FrameLoop({
  renderer,
  camera,
  scene,
  post,
  update: (dt, time) => {
    const dayF = game.dayF();

    /* ---- look ---- */
    if (game.phase === "play" && !hud.craftOpen) {
      const turn = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      const look = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
      yaw -= turn * dt * 2.2;
      pitch = THREE.MathUtils.clamp(pitch + look * dt * 1.6, -1.45, 1.45);
    }

    /* ---- move (camera-relative) ---- */
    const fx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const fz = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const move = hud.craftOpen ? { x: 0, z: 0 } : {
      x: fx * cos - fz * sin,
      z: -fx * sin - fz * cos,
    };
    if (game.phase === "play") {
      game.update(
        dt, move,
        keys.has("Space"),
        keys.has("ShiftLeft") || keys.has("ShiftRight"),
      );
    }

    /* ---- camera ---- */
    const p = game.player;
    shakeT = Math.max(0, shakeT - dt);
    const shx = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.2 : 0;
    const shy = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.2 : 0;
    if (game.phase === "title") {
      titleA += dt * 0.06;
      camera.position.set(
        SPAWN.x - HALF + Math.sin(titleA) * 40,
        26,
        SPAWN.z - HALF + Math.cos(titleA) * 40,
      );
      camera.lookAt(SPAWN.x - HALF, 10, SPAWN.z - HALF);
    } else if (game.phase === "results") {
      titleA += dt * 0.25;
      camera.position.set(
        p.x - HALF + Math.sin(titleA) * 9,
        p.y + 5,
        p.z - HALF + Math.cos(titleA) * 9,
      );
      camera.lookAt(p.x - HALF, p.y + 1, p.z - HALF);
    } else {
      camera.position.set(p.x - HALF + shx, p.y + 1.62 + shy, p.z - HALF);
      camera.rotation.set(0, 0, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }

    // feed the view ray to the game (block coords)
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    game.view.ex = p.x;
    game.view.ey = p.y + 1.62;
    game.view.ez = p.z;
    game.view.dx = dir.x;
    game.view.dy = dir.y;
    game.view.dz = dir.z;

    /* ---- mine / place / attack ---- */
    swingCD = Math.max(0, swingCD - dt);
    if (lmb && game.phase === "play" && !hud.craftOpen && !p.dead) {
      // mob in the face? attack. otherwise mine.
      let mobClose = false;
      for (const m of game.mobs) {
        const d = Math.hypot(m.x - p.x, m.z - p.z);
        if (d < 3 && Math.abs(m.y - p.y) < 2.5) {
          mobClose = true;
          break;
        }
      }
      if (mobClose && swingCD <= 0) {
        swingCD = 0.45;
        swingAnim = 0.3;
        game.attackSwing();
      } else if (!mobClose) {
        const stage = game.mineTick(dt, true);
        if (stage >= 0) {
          crack.set(stage, game.mine.x, game.mine.y, game.mine.z);
          swingAnim = Math.max(swingAnim, 0.12);
        } else {
          crack.set(-1);
          if (stage === -1 && game.mine.progress === 0) { /* no target */ }
        }
      } else {
        crack.set(-1);
      }
    } else {
      crack.set(-1);
      game.mineTick(0, false);
    }
    swingAnim = Math.max(0, swingAnim - dt);

    rmbCD = Math.max(0, rmbCD - dt);
    if (rmb && rmbCD <= 0 && game.phase === "play" && !hud.craftOpen) {
      if (game.placeSelected()) rmbCD = 0.28;
      else rmbCD = 0.12;
    }

    /* ---- world systems ---- */
    mesher.update(6);
    mesher.uDayF.value = dayF;
    sky.update(time, camera.position, dayF);
    scene.background = NIGHT_BG.clone().lerp(DAY_BG, dayF);
    viewmodel.rotation.x = swingAnim > 0 ? -Math.sin((swingAnim / 0.3) * Math.PI) * 0.9 : 0;
    const held = viewmodel.getObjectByName("held") as THREE.Mesh;
    const sel = game.selectedItem();
    (held.material as THREE.MeshBasicMaterial).color.set(HELD_COLORS[sel] ?? 0xb08a54);
    viewmodel.visible = game.phase === "play";

    /* ---- mobs ---- */
    for (const m of game.mobs) {
      const rig = mobRigs.get(m.id);
      if (!rig) continue;
      // rig groups are children of `world` — block coords, offset is free
      rig.group.position.set(m.x, 0, m.z);
      rig.group.rotation.y = Math.atan2(p.x - m.x, p.z - m.z);
      rig.update(dt, time, m);
    }
    // arrows
    while (arrowPool.length < game.arrows.length) {
      const g = buildArrowMesh();
      g.visible = false;
      world.add(g);
      arrowPool.push({ g, used: false });
    }
    arrowPool.forEach((a, i) => {
      const arr = game.arrows[i];
      if (arr) {
        a.g.visible = true;
        a.g.position.set(arr.x, arr.y, arr.z); // local = block coords
        a.g.lookAt(arr.x - HALF + arr.vx, arr.y + arr.vy, arr.z - HALF + arr.vz); // world target
      } else {
        a.g.visible = false;
      }
    });
    // puffs
    for (const pf of [...puffs]) {
      pf.t += dt;
      pf.mesh.position.y += dt * 1.2;
      pf.mesh.scale.setScalar(Math.max(0.01, 1 - pf.t / pf.life));
      if (pf.t >= pf.life) {
        world.remove(pf.mesh);
        puffs.splice(puffs.indexOf(pf), 1);
      }
    }
    // zombie groans at night
    groanT -= dt;
    if (groanT <= 0) {
      groanT = 3 + Math.random() * 4;
      if (game.isNight() && game.mobs.some((m) => m.type === "zombie")) audio.zombieGroan();
    }
    audio.update(dt, game.isNight());

    /* ---- HUD ---- */
    hudTick += dt * 1000;
    if (hudTick > 33) {
      hudTick = 0;
      hud.update(game);
    }
    hud.tick(dt * 1000, game);
  },
});

/* ----------------------------------------------------------------- harness -- */

installHarness({
  autostart() {
    firstInput();
    startGame();
  },
  cam(_mode: string) { /* first-person only; results orbits automatically */ },
  get phase() { return game.phase; },
  get time() { return loop.time; },
  get frames() { return loop.frames; },
  debugFinish() { game.debugFinish(); },
  debug() {
    const p = game.player;
    return {
      cam: camera.position.toArray(),
      player: [p.x, p.y, p.z],
      yaw, pitch,
      phase: game.phase,
      hp: p.hp,
      timeOfDay: game.time,
      mobs: game.mobs.length,
      rigCount: mobRigs.size,
      rigProbe: (() => {
        const first = mobRigs.values().next().value;
        if (!first) return null;
        const v = new THREE.Vector3();
        first.group.getWorldPosition(v);
        return { world: v.toArray().map((n) => +n.toFixed(1)), visible: first.group.visible, inWorld: !!first.group.parent };
      })(),
      mobList: game.mobs.map((m) => ({ t: m.type, x: +m.x.toFixed(1), y: +m.y.toFixed(1), z: +m.z.toFixed(1) })),
      inv: Object.fromEntries(game.inv),
      mined: game.blocksMined,
      placed: game.blocksPlaced,
      mobsSlain: game.mobsSlain,
      nearestMob: (() => {
        const p = game.player;
        let bd = Infinity;
        let bdot = 0;
        for (const m of game.mobs) {
          const dx = m.x - p.x;
          const dz = m.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < bd) {
            bd = d;
            const v = game.view;
            bdot = (dx * v.dx + dz * v.dz) / (d || 1);
          }
        }
        return isFinite(bd) ? { d: +bd.toFixed(2), dot: +bdot.toFixed(2) } : null;
      })(),
      target: (() => {
        const v = game.view;
        const hit = raycast(v.ex, v.ey, v.ez, v.dx, v.dy, v.dz, 5);
        return hit ? { x: hit.x, y: hit.y, z: hit.z, id: getBlock(hit.x, hit.y, hit.z) } : null;
      })(),
      shelter: game.shelterSecured,
      pixelScale: loop.pixelScale,
    };
  },
  /* scenario hooks */
  give(item: Item, n = 8) { game.giveItem(item, n); },
  setTime(t: number) { game.setTime(t); },
  teleport(x: number, z: number) { game.teleport(x, z); },
  lookAt(x: number, y: number, z: number) {
    const p = game.player;
    const dx = x - p.x;
    const dy = y - (p.y + 1.62);
    const dz = z - p.z;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  },
  /** stand before a tree with a clear line to its trunk (punch shot/e2e) */
  aimNearestTree() {
    const p = game.player;
    // terrain height ignoring vegetation (surfaceY would sit us on canopies)
    const terrainY = (x: number, z: number): number => {
      for (let y = 30; y >= 1; y--) {
        const id = getBlock(x, y, z);
        if (id === B.GRASS || id === B.DIRT || id === B.STONE || id === B.COBBLE) return y;
      }
      return 1;
    };
    // trunk bases = a LOG sitting on soil, nearest first
    const cands: { x: number; y: number; z: number; d: number }[] = [];
    for (let x = Math.floor(p.x) - 24; x < p.x + 24; x++) {
      for (let z = Math.floor(p.z) - 24; z < p.z + 24; z++) {
        const gy = terrainY(x, z);
        if (getBlock(x, gy + 1, z) === B.LOG) {
          cands.push({ x, y: gy + 1, z, d: Math.hypot(x - p.x, z - p.z) });
        }
      }
    }
    cands.sort((a, b) => a.d - b.d);
    const SPOTS = [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2], [1.6, 1.6], [-1.6, -1.6]];
    for (const c of cands.slice(0, 8)) {
      for (const [ox, oz] of SPOTS) {
        const sx = c.x + ox;
        const sz = c.z + oz;
        const gy = terrainY(Math.floor(sx), Math.floor(sz)) + 1;
        const ex = sx + 0.5;
        const ey = gy + 1.62;
        const ez = sz + 0.5;
        const ddx = c.x + 0.5 - ex;
        const ddy = c.y + 0.2 - ey; // low on the trunk — under the canopy
        const ddz = c.z + 0.5 - ez;
        const len = Math.hypot(ddx, ddy, ddz);
        const hit = raycast(ex, ey, ez, ddx / len, ddy / len, ddz / len, 5);
        if (hit && getBlock(hit.x, hit.y, hit.z) === B.LOG) {
          p.x = ex;
          p.z = ez;
          p.y = ey - 1.62;
          p.vy = 0;
          yaw = Math.atan2(-ddx, -ddz);
          pitch = Math.atan2(ddy, Math.hypot(ddx, ddz));
          return;
        }
      }
    }
  },
  spawnMob(type: MobType, dist = 8) {
    const p = game.player;
    return game.spawnMob(type, p.x + Math.sin(yaw + Math.PI) * dist, p.z + Math.cos(yaw + Math.PI) * dist).id;
  },
  killAll() { game.debugKillAll(); },
  /** a small arc of torches ahead of the player — torch pools for night shots */
  torchRing() {
    const p = game.player;
    for (const [ox, oz] of [[-2.5, 3.5], [2.5, 3.5], [0, 6]]) {
      const x = Math.floor(p.x + ox);
      const z = Math.floor(p.z + oz);
      for (let y = 30; y >= 1; y--) {
        const id = getBlock(x, y, z);
        if (id !== B.AIR && id !== B.LEAVES && id !== B.TORCH) {
          setBlock(x, y + 1, z, B.TORCH);
          addTorch(x, y + 1, z);
          break;
        }
      }
    }
  },
  shelter() { game.debugShelter(); },
  cave() {
    // find the carved chamber's floor cells, light them, stand inside
    const floors: { x: number; y: number; z: number }[] = [];
    for (let x = CAVE_CORE.x - 12; x < CAVE_CORE.x + 10; x++) {
      for (let z = CAVE_CORE.z - 8; z < CAVE_CORE.z + 8; z++) {
        for (let y = 7; y < 16; y++) {
          if (getBlock(x, y, z) === B.AIR && getBlock(x, y + 1, z) === B.AIR &&
              getBlock(x, y - 1, z) !== B.AIR) {
            floors.push({ x, y, z });
          }
        }
      }
    }
    if (floors.length) {
      // torches at three spread floor spots (direct world-truth placement)
      const picks = [0, Math.floor(floors.length / 2), floors.length - 1];
      for (const i of picks) {
        const f = floors[i];
        setBlock(f.x, f.y, f.z, B.TORCH);
        addTorch(f.x, f.y, f.z);
      }
      const f = floors[Math.floor(floors.length / 2)];
      game.player.x = f.x + 0.5;
      game.player.z = f.z + 0.5;
      game.player.y = f.y;
      game.player.vy = 0;
      // face an ore glint if one is near
      let target: { x: number; y: number; z: number } | null = null;
      let bd = 100;
      for (let x = f.x - 8; x < f.x + 8; x++) {
        for (let y = f.y - 2; y < f.y + 6; y++) {
          for (let z = f.z - 8; z < f.z + 8; z++) {
            const id = getBlock(x, y, z);
            if (id === B.COAL || id === B.IRON) {
              const d = Math.hypot(x - f.x, z - f.z);
              if (d < bd) {
                bd = d;
                target = { x, y, z };
              }
            }
          }
        }
      }
      if (target) {
        const p = game.player;
        const dx = target.x + 0.5 - p.x;
        const dy = target.y - (p.y + 1.62);
        const dz = target.z + 0.5 - p.z;
        yaw = Math.atan2(-dx, -dz);
        pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }
    }
  },
  craft(id: string) { return game.craft(id); },
  mine() { /* e2e helper: force-complete current mine target */ },
});

/* --------------------------------------------------------------------- boot -- */

loop.start();
void RECIPES;
void skyRigHolder;
