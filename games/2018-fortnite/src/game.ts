/**
 * game.ts — BUILD ROYALE game logic. RENDER-FREE (§2.4): the bus, the
 * glider drop, the harvest economy, grid-snapped builds with HP and
 * edits, 11 bot brains with build reflexes, the storm director, combat,
 * chests. No renderables; main.ts maps state + events to presentation.
 *
 * Phases: title → bus → drop → ground → results.
 *
 * The 10-minute promise: boots down ~1:00, harvest/loot to ~3:00, build
 * mode from there, storm 1 closes 4:30, mid-fight ramp beat ~6:30, final
 * circle on Hero Hill 8:00, Victory Royale by ~9:30.
 */
import {
  TILTED, FARM, HILL, TREES, CARS, CHESTS, TILTED_BUILDINGS,
  heightAt, CELL, STORY, MAX_LEVEL,
} from "./map";

export type Phase = "title" | "bus" | "drop" | "ground" | "results";
export type WeaponId = "pistol" | "ar" | "pump";
export type BuildType = "wall" | "ramp" | "floor" | "cone";
export type Mat = "wood" | "brick" | "metal";

/* ------------------------------------------------------------- tuning -- */

const BUS_ALT = 120;
const BUS_SPEED = 30;
const BUS_FROM = { x: -430, z: -280 };
const BUS_TO = { x: 430, z: 280 };
const FALL_FAST = 30;
const FALL_GLIDE = 6.5;
const GLIDE_STEER = 15;
const DIVE_STEER = 22;

const WALK_SPEED = 6.4;
const SPRINT_MULT = 1.5;
const PLAYER_HP = 100;
const GRAVITY = 22;

const BOT_HP = 100;
const BOT_COUNT = 11;
const BOT_SIGHT = 55;
const CULL_EARLIEST = 200;
const CULL_PERIOD = [16, 26];

const HARVEST_RANGE = 3.6;
const PIECE_COST = 10;
const PLACE_RANGE = 7.5;
const PIECE_HP: Record<BuildType, number> = { wall: 150, ramp: 120, floor: 120, cone: 100 };

interface CircleDef { warnAt: number; closeAt: number; closeDur: number; r: number; cx: number; cz: number; dps: number }
const CIRCLES: CircleDef[] = [
  { warnAt: 240, closeAt: 270, closeDur: 55, r: 165, cx: -20, cz: 20, dps: 2 },
  { warnAt: 375, closeAt: 405, closeDur: 50, r: 85, cx: 10, cz: 120, dps: 5 },
  { warnAt: 470, closeAt: 500, closeDur: 40, r: 22, cx: HILL.x, cz: HILL.z, dps: 9 },
];

/* ------------------------------------------------------------ weapons -- */

export interface WeaponDef {
  name: string; dmg: number; interval: number; mag: number;
  reload: number; range: number; pellets: number;
}
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { name: "POPPER PISTOL", dmg: 18, interval: 0.25, mag: 12, reload: 1.5, range: 90, pellets: 1 },
  ar: { name: "RATCHET AR", dmg: 22, interval: 0.13, mag: 30, reload: 1.9, range: 150, pellets: 1 },
  pump: { name: "DOORKNOB PUMP", dmg: 10, interval: 0.9, mag: 5, reload: 2.4, range: 28, pellets: 7 },
};

/* -------------------------------------------------------------- pieces -- */

export interface BuildPiece {
  key: string;
  type: BuildType;
  gx: number; gy: number; gz: number;
  face: number;          // 0..3 (rotY = face * 90°)
  x: number; y: number; z: number; // world anchor (cell center, base height)
  hp: number;
  owner: string;         // "you" or bot name
  edit: 0 | 1 | 2;       // none / door / window (walls only)
}

export interface Chest { id: number; x: number; z: number; opened: boolean }
export interface Harvestable { id: number; kind: "tree" | "car"; x: number; z: number; hp: number; alive: boolean }

export type BotState = "loot" | "rotate" | "fight" | "stunned" | "dead";
export interface Bot {
  id: number; name: string;
  x: number; z: number;
  hp: number; state: BotState;
  fireCD: number; strafe: number;
  tx: number; tz: number; retargetT: number;
  fightT: number;        // time in the current fight (drives build reflexes)
  walled: boolean;       // panic wall already up
  ramped: boolean;       // panic ramp already built
  stunT: number;
}

export interface GameEvents {
  onPhase?(p: Phase): void;
  onJump?(): void;
  onGlider?(open: boolean): void;
  onLand?(): void;
  onStep?(surface: string): void;
  onSwing?(): void;
  onHarvestChip?(kind: string, x: number, z: number): void;
  onTreeFall?(id: number): void;
  onCarCrush?(id: number): void;
  onChestOpen?(id: number, what: string): void;
  onFire?(w: WeaponId): void;
  onReload?(): void;
  onHitmark?(killed: boolean): void;
  onBlood?(x: number, z: number): void;
  onPlayerHit?(dmg: number): void;
  onFeed?(text: string, mine: boolean): void;
  onBuild?(piece: BuildPiece): void;
  onBuildEdit?(piece: BuildPiece): void;
  onBuildBreak?(piece: BuildPiece): void;
  onBotFall?(b: Bot): void;
  onStormWarn?(stage: number): void;
  onStormClose?(stage: number): void;
  onZoneTick?(dps: number): void;
  onWin?(): void;
  onLose?(): void;
}

const BOT_NAMES = [
  "tilted_tom", "builder_bea", "crank_90s", "loot_llama", "default_dan",
  "peely_pal", "skybase_sue", "rampart_ron", "edit_eve", "boxfight_bo", "glider_gail",
];

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: 0, z: 0, y: BUS_ALT, heading: 0,
    hp: PLAYER_HP,
    weapon: null as WeaponId | null,
    gold: false,                  // chest-tier weapon
    mag: 0, reloading: 0, fireCD: 0,
    vy: 0,
    mats: { wood: 0, brick: 0, metal: 0 },
    glider: false,
  };

  aim = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1 };
  buildMode: BuildType | null = null;

  busT = 0;
  bots: Bot[] = [];
  builds = new Map<string, BuildPiece>();
  chests: Chest[] = [];
  harvestables: Harvestable[] = [];

  wall = { cx: 0, cz: 0, r: 310 };
  target = { cx: CIRCLES[0].cx, cz: CIRCLES[0].cz, r: CIRCLES[0].r };
  stage = 0;
  private warned = [false, false, false, false];
  private nextCullAt = 0;

  kills = 0;
  damage = 0;
  buildsPlaced = 0;
  matsHarvested = 0;
  placement = 12;
  won = false;

  private stepAcc = 0;
  private zoneTickT = 0;
  swingCD = 0;

  aliveBots(): number {
    return this.bots.filter((b) => b.state !== "dead").length;
  }
  aliveCount(): number {
    return this.aliveBots() + (this.player.hp > 0 ? 1 : 0);
  }

  /* ------------------------------------------------------------ phases -- */

  start(): void {
    if (this.phase !== "title") return;
    this.spawnLobby();
    this.setPhase("bus");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /** Space: jump from the bus / toggle the glider / nothing on ground. */
  space(): void {
    if (this.phase === "bus") {
      this.setPhase("drop");
      this.events.onJump?.();
      return;
    }
    if (this.phase === "drop") {
      const p = this.player;
      const ground = this.groundAt(p.x, p.z);
      if (!p.glider && p.y - ground < 100) {
        p.glider = true;
        this.events.onGlider?.(true);
      } else if (p.glider) {
        p.glider = false; // cut away, dive
        this.events.onGlider?.(false);
      }
    }
  }

  /* --------------------------------------------------------------- lobby -- */

  private spawnLobby(): void {
    for (let i = 0; i < BOT_COUNT; i++) {
      const homes = [TILTED, FARM, HILL];
      const c = homes[i % 3];
      const a = (i * 2.399) % (Math.PI * 2);
      this.bots.push({
        id: i, name: BOT_NAMES[i],
        x: c.x + Math.cos(a) * c.r * 0.5,
        z: c.z + Math.sin(a) * c.r * 0.5,
        hp: BOT_HP, state: "loot",
        fireCD: 1 + Math.random() * 2, strafe: Math.random() < 0.5 ? -1 : 1,
        tx: c.x, tz: c.z, retargetT: Math.random() * 3,
        fightT: 0, walled: false, ramped: false, stunT: 0,
      });
    }
    this.chests = CHESTS.map((c, i) => ({ id: i, x: c.x, z: c.z, opened: false }));
    this.harvestables = [
      ...TREES.map((t, i) => ({ id: i, kind: "tree" as const, x: t.x, z: t.z, hp: 3, alive: true })),
      ...CARS.map((c, i) => ({ id: 100 + i, kind: "car" as const, x: c.x, z: c.z, hp: 4, alive: true })),
    ];
  }

  /* ----------------------------------------------------------- harvest -- */

  /** What the pickaxe would hit right now (nearest harvestable in reach). */
  harvestTarget(): { kind: "tree" | "car" | "brick"; id: number; x: number; z: number } | null {
    const p = this.player;
    let best: { kind: "tree" | "car" | "brick"; id: number; x: number; z: number } | null = null;
    let bd = HARVEST_RANGE;
    for (const h of this.harvestables) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bd) {
        bd = d;
        best = { kind: h.kind, id: h.id, x: h.x, z: h.z };
      }
    }
    // town towers yield brick, indestructible
    for (const t of TILTED_BUILDINGS) {
      const d = Math.hypot(t.x - p.x, t.z - p.z) - Math.max(t.w, t.d) / 2;
      if (d < bd) {
        bd = d;
        best = { kind: "brick", id: -1, x: t.x, z: t.z };
      }
    }
    return best;
  }

  /** LMB: swing the pickaxe near a harvestable, else fire the weapon. */
  primaryAction(): void {
    const p = this.player;
    if (this.phase !== "ground" || p.hp <= 0) return;
    if (this.buildMode) return; // placement is tryPlace()
    if (this.swingCD > 0) return;
    const target = this.harvestTarget();
    if (target) {
      this.swingCD = 0.55;
      this.events.onSwing?.();
      this.harvest(target);
      return;
    }
    this.tryFire();
  }

  private harvest(t: { kind: "tree" | "car" | "brick"; id: number; x: number; z: number }): void {
    const p = this.player;
    if (t.kind === "brick") {
      p.mats.brick += 4;
      this.matsHarvested += 4;
      this.events.onHarvestChip?.("brick", t.x, t.z);
      return;
    }
    const h = this.harvestables.find((v) => v.id === t.id);
    if (!h) return;
    h.hp--;
    if (h.kind === "tree") {
      p.mats.wood += 8;
      this.matsHarvested += 8;
    } else {
      p.mats.metal += 6;
      this.matsHarvested += 6;
    }
    this.events.onHarvestChip?.(h.kind, h.x, h.z);
    if (h.hp <= 0) {
      h.alive = false;
      if (h.kind === "tree") this.events.onTreeFall?.(h.id);
      else this.events.onCarCrush?.(h.id);
    }
  }

  /* ------------------------------------------------------------ chests -- */

  nearestChest(): Chest | null {
    const p = this.player;
    let best: Chest | null = null;
    let bd = 2.8;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** E — open a chest. */
  interact(): void {
    if (this.phase !== "ground") return;
    const c = this.nearestChest();
    if (!c) return;
    c.opened = true;
    const p = this.player;
    if (Math.random() < 0.62) {
      const kinds: WeaponId[] = ["pump", "ar", "pistol"];
      p.weapon = kinds[Math.floor(Math.random() * kinds.length)];
      p.gold = true;
      p.mag = WEAPONS[p.weapon].mag;
      this.events.onChestOpen?.(c.id, "GOLD " + WEAPONS[p.weapon].name);
    } else {
      const mat: Mat = (["wood", "brick", "metal"] as Mat[])[Math.floor(Math.random() * 3)];
      p.mats[mat] += 25;
      this.matsHarvested += 25;
      this.events.onChestOpen?.(c.id, `+25 ${mat.toUpperCase()}`);
    }
  }

  /* ------------------------------------------------------------- builds -- */

  /** Q — cycle wall→ramp→floor→cone→exit. */
  cycleBuild(): void {
    if (this.phase !== "ground") return;
    const order: (BuildType | null)[] = ["wall", "ramp", "floor", "cone", null];
    const i = order.indexOf(this.buildMode);
    this.buildMode = order[(i + 1) % order.length];
  }

  /** The cell the ghost would occupy (main computes from camera aim). */
  ghostCell(): { gx: number; gy: number; gz: number; face: number } {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const tx = p.x + fx * CELL * 0.9;
    const tz = p.z + fz * CELL * 0.9;
    const ground = heightAt(p.x, p.z);
    const gy = Math.max(0, Math.min(MAX_LEVEL, Math.round((p.y - ground) / STORY)));
    const face = Math.round(p.heading / (Math.PI / 2));
    return {
      gx: Math.round(tx / CELL),
      gy,
      gz: Math.round(tz / CELL),
      face: ((face % 4) + 4) % 4,
    };
  }

  pieceKey(type: BuildType, gx: number, gy: number, gz: number, face: number): string {
    return `${type}:${gx},${gy},${gz},${type === "wall" || type === "ramp" ? face : 0}`;
  }

  canPlace(type: BuildType, gx: number, gy: number, gz: number, face: number): boolean {
    const p = this.player;
    const x = gx * CELL;
    const z = gz * CELL;
    if (Math.hypot(x - p.x, z - p.z) > PLACE_RANGE) return false;
    if (this.builds.has(this.pieceKey(type, gx, gy, gz, face))) return false;
    if (gy > 0 && !this.supportBelow(gx, gy, gz)) return false;
    return this.totalMats() >= PIECE_COST;
  }

  private supportBelow(gx: number, gy: number, gz: number): boolean {
    for (const piece of this.builds.values()) {
      if (piece.gx === gx && piece.gz === gz && piece.gy === gy - 1) return true;
      // a ramp one level down in the neighbor cell also counts
      if (piece.type === "ramp" && piece.gy === gy - 1 &&
          Math.abs(piece.gx - gx) <= 1 && Math.abs(piece.gz - gz) <= 1) return true;
    }
    return false;
  }

  totalMats(): number {
    const m = this.player.mats;
    return m.wood + m.brick + m.metal;
  }

  private payMats(): void {
    let cost = PIECE_COST;
    for (const k of ["wood", "brick", "metal"] as Mat[]) {
      const take = Math.min(this.player.mats[k], cost);
      this.player.mats[k] -= take;
      cost -= take;
      if (cost <= 0) break;
    }
  }

  /** LMB in build mode. Returns the piece or null. */
  tryPlace(owner = "you"): BuildPiece | null {
    if (this.phase !== "ground" || !this.buildMode) return null;
    const { gx, gy, gz, face } = this.ghostCell();
    if (!this.canPlace(this.buildMode, gx, gy, gz, face)) return null;
    const piece = this.placePiece(this.buildMode, gx, gy, gz, face, owner);
    this.payMats();
    this.buildsPlaced++;
    return piece;
  }

  placePiece(type: BuildType, gx: number, gy: number, gz: number, face: number, owner: string): BuildPiece {
    const x = gx * CELL;
    const z = gz * CELL;
    const piece: BuildPiece = {
      key: this.pieceKey(type, gx, gy, gz, face),
      type, gx, gy, gz, face,
      x, y: heightAt(x, z) + gy * STORY, z,
      hp: PIECE_HP[type],
      owner, edit: 0,
    };
    this.builds.set(piece.key, piece);
    this.events.onBuild?.(piece);
    return piece;
  }

  /** G — edit your own wall in reach: none → door → window. */
  editNearest(): void {
    const p = this.player;
    let best: BuildPiece | null = null;
    let bd = 4.5;
    for (const piece of this.builds.values()) {
      if (piece.owner !== "you" || piece.type !== "wall") continue;
      const d = Math.hypot(piece.x - p.x, piece.z - p.z);
      if (d < bd) {
        bd = d;
        best = piece;
      }
    }
    if (best) {
      best.edit = ((best.edit + 1) % 3) as 0 | 1 | 2;
      this.events.onBuildEdit?.(best);
    }
  }

  /** Standable surface under (x,z): terrain or the top of a build. */
  groundAt(x: number, z: number): number {
    let h = heightAt(x, z);
    for (const piece of this.builds.values()) {
      const inCell = Math.abs(x - piece.x) < CELL / 2 && Math.abs(z - piece.z) < CELL / 2;
      if (!inCell) continue;
      if (piece.type === "floor") {
        h = Math.max(h, piece.y + STORY);
      } else if (piece.type === "ramp") {
        // ramp ascends along its face direction across the cell
        const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const [dx, dz] = dirs[piece.face];
        const t = Math.min(1, Math.max(0,
          ((x - (piece.x - dx * CELL / 2)) * dx + (z - (piece.z - dz * CELL / 2)) * dz) / CELL));
        h = Math.max(h, piece.y + t * STORY);
      }
    }
    return h;
  }

  /* ------------------------------------------------------------ combat -- */

  reload(): void {
    const p = this.player;
    if (!p.weapon || p.reloading > 0 || p.mag >= WEAPONS[p.weapon].mag) return;
    p.reloading = WEAPONS[p.weapon].reload;
    this.events.onReload?.();
  }

  tryFire(): void {
    const p = this.player;
    if (this.phase !== "ground" || p.hp <= 0 || this.buildMode) return;
    if (!p.weapon || p.fireCD > 0 || p.reloading > 0) return;
    if (p.mag <= 0) {
      this.reload();
      return;
    }
    const w = WEAPONS[p.weapon];
    p.mag--;
    p.fireCD = w.interval;
    this.events.onFire?.(p.weapon);
    this.resolveShot(w);
  }

  private resolveShot(w: WeaponDef): void {
    const a = this.aim;
    const dmgMult = this.player.gold ? 1.2 : 1;

    // nearest piece along the ray (builds have HP — shoot out their ramp!)
    let bestPiece: BuildPiece | null = null;
    let bestPieceT = w.range;
    for (const piece of this.builds.values()) {
      const cy = piece.y + (piece.type === "floor" ? 0.2 : STORY / 2);
      const t = this.rayDist(piece.x, cy, piece.z, a);
      if (t >= 0 && t < bestPieceT && this.perpDist(piece.x, cy, piece.z, a, t) < 2.2) {
        bestPiece = piece;
        bestPieceT = t;
      }
    }

    let bestBot: Bot | null = null;
    let bestBotT = bestPieceT; // a closer wall eats the shot
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      const by = this.groundAt(b.x, b.z) + 1.1;
      const t = this.rayDist(b.x, by, b.z, a);
      if (t < 0 || t > bestBotT) continue;
      const tol = 0.9 + t * 0.006 * w.pellets;
      if (this.perpDist(b.x, by, b.z, a, t) < tol) {
        bestBot = b;
        bestBotT = t;
      }
    }

    if (bestBot) {
      let dmg = w.dmg * w.pellets * dmgMult;
      if (w.pellets > 1) dmg *= Math.max(0.25, 1 - bestBotT / w.range);
      else if (bestBotT > w.range * 0.6) dmg *= 0.75;
      dmg = Math.round(dmg);
      this.damage += dmg;
      bestBot.hp -= dmg;
      this.events.onBlood?.(bestBot.x, bestBot.z);
      if (bestBot.hp <= 0) {
        this.killBot(bestBot, "you");
        this.kills++;
        this.events.onHitmark?.(true);
      } else {
        this.events.onHitmark?.(false);
      }
      return;
    }

    if (bestPiece) {
      bestPiece.hp -= Math.round(w.dmg * w.pellets * dmgMult);
      this.events.onBlood?.(bestPiece.x, bestPiece.z); // splinter puff, tinted by main
      if (bestPiece.hp <= 0) this.breakPiece(bestPiece);
    }
  }

  private rayDist(x: number, y: number, z: number, a: typeof this.aim): number {
    const bx = x - a.ox;
    const by = y - a.oy;
    const bz = z - a.oz;
    return bx * a.dx + by * a.dy + bz * a.dz;
  }

  private perpDist(x: number, y: number, z: number, a: typeof this.aim, t: number): number {
    const px = x - a.ox - a.dx * t;
    const py = y - a.oy - a.dy * t;
    const pz = z - a.oz - a.dz * t;
    return Math.hypot(px, py, pz);
  }

  breakPiece(piece: BuildPiece): void {
    this.builds.delete(piece.key);
    this.events.onBuildBreak?.(piece);
    // anyone standing on it falls (the ramp shoot-out beat)
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      const standY = this.groundAt(b.x, b.z);
      const bodyY = heightAt(b.x, b.z);
      if (standY > bodyY + 1 && Math.abs(b.x - piece.x) < CELL && Math.abs(b.z - piece.z) < CELL) {
        b.hp -= 15;
        b.stunT = 1.2;
        b.state = "stunned";
        this.events.onBotFall?.(b);
        if (b.hp <= 0) this.killBot(b, "gravity");
      }
    }
  }

  private killBot(b: Bot, by: string): void {
    if (b.state === "dead") return;
    b.state = "dead";
    this.events.onBlood?.(b.x, b.z);
    this.events.onFeed?.(
      by === "you" ? `you ⌦ ${b.name}` : `${by} ⌦ ${b.name}`,
      by === "you",
    );
  }

  /* ------------------------------------------------------------ update -- */

  update(dt: number, move: { x: number; z: number }, sprint: boolean): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    if (this.phase === "bus") {
      this.busT += dt;
      const t = Math.min(1, (this.busT * BUS_SPEED) / 720);
      p.x = BUS_FROM.x + (BUS_TO.x - BUS_FROM.x) * t;
      p.z = BUS_FROM.z + (BUS_TO.z - BUS_FROM.z) * t;
      p.y = BUS_ALT;
      if (t >= 1) this.space(); // end of the line — out you go
      return;
    }

    if (this.phase === "drop") {
      const mag = Math.hypot(move.x, move.z);
      if (mag > 0.1) {
        const spd = p.glider ? GLIDE_STEER : DIVE_STEER;
        p.x += (move.x / mag) * spd * dt;
        p.z += (move.z / mag) * spd * dt;
        p.heading = Math.atan2(move.x, move.z);
      }
      p.y -= (p.glider ? FALL_GLIDE : FALL_FAST) * dt;
      const ground = this.groundAt(p.x, p.z);
      if (p.y <= ground + 0.05) {
        p.y = ground;
        p.glider = false;
        this.setPhase("ground");
        this.events.onLand?.();
      }
      return;
    }

    /* ---- ground ---- */
    p.fireCD = Math.max(0, p.fireCD - dt);
    this.swingCD = Math.max(0, this.swingCD - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0 && p.weapon) p.mag = WEAPONS[p.weapon].mag;
    }

    // walk + vertical resolution (ramps, floors, falls)
    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01) {
      const spd = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
      const nx = p.x + (move.x / mag) * spd * dt;
      const nz = p.z + (move.z / mag) * spd * dt;
      if (Math.hypot(nx, nz) < 300 && heightAt(nx, nz) > -0.7) {
        p.x = nx;
        p.z = nz;
      }
      p.heading = Math.atan2(move.x, move.z);
      this.stepAcc += spd * dt;
      if (this.stepAcc > 2) {
        this.stepAcc = 0;
        this.events.onStep?.("grass");
      }
    }
    const support = this.groundAt(p.x, p.z);
    if (p.y > support + 0.05) {
      p.vy -= GRAVITY * dt;
      p.y = Math.max(support, p.y + p.vy * dt);
      if (p.y === support) p.vy = 0;
    } else {
      p.y = support;
      p.vy = 0;
    }

    this.updateStorm();
    this.updateBots(dt);
    this.updateCull();

    // storm damage
    const wd = Math.hypot(p.x - this.wall.cx, p.z - this.wall.cz);
    if (this.stage > 0 && wd > this.wall.r && p.hp > 0) {
      this.zoneTickT += dt;
      if (this.zoneTickT >= 1) {
        this.zoneTickT = 0;
        const dps = CIRCLES[this.stage - 1].dps;
        p.hp = Math.max(0, p.hp - dps);
        this.events.onZoneTick?.(dps);
        if (p.hp <= 0) this.lose();
      }
    }

    if (this.aliveBots() === 0 && p.hp > 0) this.win();
  }

  /* ------------------------------------------------------------- storm -- */

  private updateStorm(): void {
    for (let i = 0; i < CIRCLES.length; i++) {
      const c = CIRCLES[i];
      if (!this.warned[i] && this.time >= c.warnAt) {
        this.warned[i] = true;
        this.target = { cx: c.cx, cz: c.cz, r: c.r };
        this.events.onStormWarn?.(i + 1);
      }
      if (this.time >= c.closeAt && this.stage === i) {
        this.stage = i + 1;
        this.events.onStormClose?.(i + 1);
      }
      if (this.stage === i + 1) {
        const prev = i === 0 ? { cx: 0, cz: 0, r: 310 } : CIRCLES[i - 1];
        const k = Math.min(1, (this.time - c.closeAt) / c.closeDur);
        this.wall = {
          cx: prev.cx + (c.cx - prev.cx) * k,
          cz: prev.cz + (c.cz - prev.cz) * k,
          r: prev.r + (c.r - prev.r) * k,
        };
        if (i + 1 < CIRCLES.length && k >= 1) {
          this.target = { cx: CIRCLES[i + 1].cx, cz: CIRCLES[i + 1].cz, r: CIRCLES[i + 1].r };
        }
      }
    }
  }

  /* -------------------------------------------------------------- bots -- */

  private updateBots(dt: number): void {
    const p = this.player;
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      b.fireCD -= dt;
      b.retargetT -= dt;
      if (b.stunT > 0) {
        b.stunT -= dt;
        if (b.stunT <= 0) b.state = "fight";
        continue;
      }

      const pd = Math.hypot(p.x - b.x, p.z - b.z);
      const seesPlayer = p.hp > 0 && pd < BOT_SIGHT;

      if (seesPlayer) {
        if (b.state !== "fight") {
          b.state = "fight";
          b.fightT = 0;
        }
        b.fightT += dt;

        // build reflex 1: panic wall the moment a fight starts
        if (!b.walled && this.totalMatsCheat(b)) {
          b.walled = true;
          this.botBuildWall(b, p.x, p.z);
        }
        // build reflex 2: a few seconds in, ramp toward the player and climb
        if (!b.ramped && b.fightT > 3.5 && pd > 15) {
          b.ramped = true;
          this.botBuildRamp(b, p.x, p.z);
        }

        // strafe + range keeping; ramped bots hold the high ground
        const onHigh = this.groundAt(b.x, b.z) > heightAt(b.x, b.z) + 1;
        if (!onHigh) {
          const dx = (p.x - b.x) / pd;
          const dz = (p.z - b.z) / pd;
          const want = pd > 32 ? 1 : pd < 12 ? -1 : 0;
          b.x += (dx * want * 3.2 + -dz * b.strafe * 2.2) * dt;
          b.z += (dz * want * 3.2 + dx * b.strafe * 2.2) * dt;
          if (Math.random() < dt * 0.5) b.strafe *= -1;
        }

        if (b.fireCD <= 0 && pd < BOT_SIGHT * 1.2) {
          b.fireCD = 0.5 + Math.random() * 0.5;
          const hitChance = Math.max(0.06, 0.42 - pd * 0.007) * (onHigh ? 1.25 : 1);
          if (Math.random() < hitChance) {
            const dmg = Math.round(5 + Math.random() * 6);
            p.hp = Math.max(0, p.hp - dmg);
            this.events.onPlayerHit?.(dmg);
            if (p.hp <= 0) this.lose();
          }
        }
      } else {
        if (b.state === "fight") b.state = "rotate";
        if (b.retargetT <= 0) {
          b.retargetT = 3 + Math.random() * 4;
          if (this.stage > 0 || this.time > 90) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * Math.max(18, this.target.r * 0.75);
            b.tx = this.target.cx + Math.cos(a) * r;
            b.tz = this.target.cz + Math.sin(a) * r;
            b.state = "rotate";
          } else {
            const homes = [TILTED, FARM, HILL];
            const c = homes[b.id % 3];
            b.tx = c.x + (Math.random() - 0.5) * c.r * 1.3;
            b.tz = c.z + (Math.random() - 0.5) * c.r * 1.3;
            b.state = "loot";
          }
        }
        const dx = b.tx - b.x;
        const dz = b.tz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 3) {
          b.x += (dx / d) * 4.2 * dt;
          b.z += (dz / d) * 4.2 * dt;
        }
      }
    }
  }

  /** Bots have infinite mats — the reflex is what matters, not the economy. */
  private totalMatsCheat(_b: Bot): boolean {
    return true;
  }

  private botBuildWall(b: Bot, tx: number, tz: number): void {
    // a wall on the line between bot and threat
    const dx = tx - b.x;
    const dz = tz - b.z;
    const d = Math.hypot(dx, dz) || 1;
    const gx = Math.round((b.x + (dx / d) * 2.5) / CELL);
    const gz = Math.round((b.z + (dz / d) * 2.5) / CELL);
    const face = Math.round(Math.atan2(dx, dz) / (Math.PI / 2));
    const f = ((face % 4) + 4) % 4;
    if (!this.builds.has(this.pieceKey("wall", gx, 0, gz, f))) {
      this.placePiece("wall", gx, 0, gz, f, b.name);
    }
  }

  private botBuildRamp(b: Bot, tx: number, tz: number): void {
    const dx = tx - b.x;
    const dz = tz - b.z;
    const face = Math.round(Math.atan2(dx, dz) / (Math.PI / 2));
    const f = ((face % 4) + 4) % 4;
    const gx = Math.round(b.x / CELL);
    const gz = Math.round(b.z / CELL);
    if (!this.builds.has(this.pieceKey("ramp", gx, 0, gz, f))) {
      this.placePiece("ramp", gx, 0, gz, f, b.name);
      // the bot scrambles to the ramp's high end (toward the threat)
      b.x += Math.sin(f * Math.PI / 2) * 1.2;
      b.z += Math.cos(f * Math.PI / 2) * 1.2;
    }
  }

  private updateCull(): void {
    if (this.time < CULL_EARLIEST || this.phase !== "ground") return;
    if (this.nextCullAt === 0) {
      this.nextCullAt = this.time + CULL_PERIOD[0];
      return;
    }
    if (this.time < this.nextCullAt) return;
    this.nextCullAt = this.time + CULL_PERIOD[0] + Math.random() * (CULL_PERIOD[1] - CULL_PERIOD[0]);
    const alive = this.bots.filter((b) => b.state !== "dead");
    if (alive.length <= 2) return; // the build-off endgame is the player's
    const p = this.player;
    const far = alive.filter((b) => Math.hypot(b.x - p.x, b.z - p.z) > 100);
    if (!far.length) return;
    const victim = far[Math.floor(Math.random() * far.length)];
    const killer = alive.filter((b) => b !== victim)[Math.floor(Math.random() * (alive.length - 1))];
    if (victim && killer) this.killBot(victim, killer.name);
  }

  private win(): void {
    if (this.phase === "results") return;
    this.won = true;
    this.placement = 1;
    this.setPhase("results");
    this.events.onWin?.();
  }

  private lose(): void {
    if (this.phase === "results") return;
    this.placement = this.aliveBots() + 1;
    this.setPhase("results");
    this.events.onLose?.();
  }

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  /** Skip the drop: on the ground near a named place, pistol in hand. */
  debugLand(place: "tilted" | "farm" | "hill" = "tilted"): void {
    if (this.phase === "title") this.start();
    const c = place === "tilted" ? TILTED : place === "farm" ? FARM : HILL;
    this.player.x = c.x + 6;
    this.player.z = c.z + 6;
    this.player.y = heightAt(c.x + 6, c.z + 6);
    this.player.weapon = "pistol";
    this.player.mag = WEAPONS.pistol.mag;
    this.setPhase("ground");
    this.events.onLand?.();
  }

  /** Mid-air over a place, glider open, facing its center (shot 03). */
  debugGlideOver(place: "tilted" | "farm" | "hill", alt = 55): void {
    if (this.phase === "title") this.start();
    const c = place === "tilted" ? TILTED : place === "farm" ? FARM : HILL;
    this.player.x = c.x;
    this.player.z = c.z + 34;
    this.player.y = alt;
    this.player.heading = Math.atan2(c.x - this.player.x, c.z - this.player.z);
    this.player.glider = true;
    this.phase = "drop";
    this.events.onGlider?.(true);
  }

  /** Put the player in front of the nearest living tree, facing it. */
  debugGotoTree(): void {
    const p = this.player;
    let best: Harvestable | null = null;
    let bd = Infinity;
    for (const h of this.harvestables) {
      if (!h.alive || h.kind !== "tree") continue;
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    if (best) {
      p.x = best.x - 2.4;
      p.z = best.z;
      p.y = heightAt(p.x, p.z);
      p.heading = Math.atan2(best.x - p.x, best.z - p.z);
    }
  }

  debugCircle(stage: 1 | 2 | 3): void {
    const c = CIRCLES[stage - 1];
    this.time = Math.max(this.time, c.closeAt + c.closeDur - 4);
    this.warned.fill(true);
    this.target = { cx: c.cx, cz: c.cz, r: c.r };
    if (stage < 3) {
      this.target = { cx: CIRCLES[stage].cx, cz: CIRCLES[stage].cz, r: CIRCLES[stage].r };
    }
  }

  debugAlive(n: number): void {
    const keep = Math.max(0, n - 1);
    const alive = this.bots.filter((b) => b.state !== "dead");
    alive.sort(
      (a, b) => Math.hypot(a.x - HILL.x, a.z - HILL.z) - Math.hypot(b.x - HILL.x, b.z - HILL.z),
    );
    alive.slice(keep).forEach((b) => this.killBot(b, "offscreen"));
    alive.slice(0, keep).forEach((b, i) => {
      const a = (i / Math.max(1, keep)) * Math.PI * 2;
      b.x = HILL.x + Math.cos(a) * 18;
      b.z = HILL.z + Math.sin(a) * 18;
      b.state = "rotate";
      b.tx = HILL.x;
      b.tz = HILL.z;
    });
  }

  /** A demo ramp+wall next to the player (shot 05). */
  debugBuildDemo(): void {
    const p = this.player;
    p.mats.wood = Math.max(p.mats.wood, 60);
    const gx = Math.round((p.x + Math.sin(p.heading) * 4) / CELL);
    const gz = Math.round((p.z + Math.cos(p.heading) * 4) / CELL);
    const face = Math.round(p.heading / (Math.PI / 2));
    const f = ((face % 4) + 4) % 4;
    if (!this.builds.has(this.pieceKey("ramp", gx, 0, gz, f))) {
      this.placePiece("ramp", gx, 0, gz, f, "you");
      this.buildsPlaced++;
    }
    const wx = gx + Math.round(Math.sin(f * Math.PI / 2));
    const wz = gz + Math.round(Math.cos(f * Math.PI / 2));
    if (!this.builds.has(this.pieceKey("wall", wx, 1, wz, f))) {
      this.placePiece("wall", wx, 1, wz, f, "you");
      this.buildsPlaced++;
    }
  }

  /** The last bot performs its build-off near the player (shot 07). */
  debugBuildRush(): void {
    const alive = this.bots.filter((b) => b.state !== "dead");
    if (!alive.length) return;
    const b = alive[0];
    const p = this.player;
    b.x = p.x + Math.sin(p.heading) * 20;
    b.z = p.z + Math.cos(p.heading) * 20;
    b.walled = true;   // pre-walled: the shot wants the RAMP, not a turtle
    b.ramped = false;
    b.fightT = 3.6; // trigger the ramp reflex immediately
    b.state = "fight";
  }

  debugKillNearestBot(): void {
    const p = this.player;
    let best: Bot | null = null;
    let bd = Infinity;
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) {
      this.killBot(best, "you");
      this.kills++;
      this.events.onBlood?.(best.x, best.z);
      this.events.onHitmark?.(true);
    }
  }

  debugPullBot(dist = 12): void {
    const p = this.player;
    let best: Bot | null = null;
    let bd = Infinity;
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) {
      best.x = p.x + Math.sin(p.heading) * dist;
      best.z = p.z + Math.cos(p.heading) * dist;
      best.state = "fight";
    }
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    for (const b of this.bots) if (b.state !== "dead") this.killBot(b, "offscreen");
    this.kills = 5;
    this.damage = 980;
    this.buildsPlaced = 23;
    this.matsHarvested = 410;
    this.time = Math.max(this.time, 552);
    this.player.x = HILL.x;
    this.player.z = HILL.z;
    this.player.y = heightAt(HILL.x, HILL.z);
    if (this.phase !== "ground") this.setPhase("ground");
    this.win();
  }
}
