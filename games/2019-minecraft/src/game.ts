/**
 * game.ts — VOXEL VALLEY game logic. RENDER-FREE (§2.4): the day/night
 * director, mining with crack progress, the crafting tree, inventory,
 * player physics against the voxel truth, three mob AIs (zombie melee,
 * skeleton kiting archer, ONE creeper), the night siege and the dawn burn.
 * main.ts maps state + events to presentation. One direction only.
 *
 * The 10-minute promise: 5-minute day (punch → craft → mine → shelter),
 * dusk warning ~4:10, night siege 5:30–10:00, dawn burn ~10:00, then
 * YOU SURVIVED.
 */
import {
  B, H, SPAWN, getBlock, setBlock, isSolid, surfaceY, raycast, collideAABB,
  addTorch, removeTorch, torchGlow, type RayHit,
} from "./world";

export type Phase = "title" | "play" | "results";

export type Item =
  | "log" | "planks" | "stick" | "cobble" | "dirt" | "torch" | "table" | "door"
  | "coal" | "iron" | "woodpick" | "stonepick" | "sword";

/* ------------------------------------------------------------- tuning -- */

export const DAY_END = 300;
export const DUSK_END = 330;
export const NIGHT_END = 600;
export const DAWN_END = 625;
const WALK = 4.4;
const SNEAK_MULT = 0.32;
const JUMP_V = 8.2;
const GRAVITY = 24;
const REACH = 5;
const MAX_HP = 20; // ten hearts

/* -------------------------------------------------------------- blocks -- */

interface BreakRule { time: { hand?: number; woodpick?: number; stonepick?: number }; drop: Item | null; dropN?: number }
const BREAK: Record<number, BreakRule> = {
  [B.GRASS]: { time: { hand: 0.7 }, drop: "dirt" },
  [B.DIRT]: { time: { hand: 0.6 }, drop: "dirt" },
  [B.LOG]: { time: { hand: 1.4, woodpick: 0.8, stonepick: 0.7 }, drop: "log" },
  [B.LEAVES]: { time: { hand: 0.3 }, drop: null },
  [B.STONE]: { time: { woodpick: 1.6, stonepick: 0.9 }, drop: "cobble" },
  [B.COBBLE]: { time: { woodpick: 1.5, stonepick: 0.85 }, drop: "cobble" },
  [B.COAL]: { time: { woodpick: 1.4, stonepick: 0.8 }, drop: "coal" },
  [B.IRON]: { time: { stonepick: 1.6 }, drop: "iron" },
  [B.PLANKS]: { time: { hand: 0.9, woodpick: 0.6, stonepick: 0.5 }, drop: "planks" },
  [B.TORCH]: { time: { hand: 0.15 }, drop: "torch" },
  [B.TABLE]: { time: { hand: 1.2 }, drop: "table" },
  [B.DOOR]: { time: { hand: 0.9 }, drop: "door" },
};

/** item id → placeable block id (hotbar blocks only) */
export const PLACEABLE: Partial<Record<Item, number>> = {
  planks: B.PLANKS, cobble: B.COBBLE, dirt: B.DIRT, log: B.LOG,
  torch: B.TORCH, table: B.TABLE, door: B.DOOR,
};

export const HOTBAR: Item[] = ["planks", "cobble", "dirt", "log", "torch", "table", "door", "woodpick", "sword"];

/* ------------------------------------------------------------- recipes -- */

export interface Recipe {
  id: string; name: string; out: Item; n: number;
  cost: Partial<Record<Item, number>>;
  grid: "2x2" | "3x3";
}
export const RECIPES: Recipe[] = [
  { id: "planks", name: "Oak Planks ×4", out: "planks", n: 4, cost: { log: 1 }, grid: "2x2" },
  { id: "stick", name: "Sticks ×4", out: "stick", n: 4, cost: { planks: 2 }, grid: "2x2" },
  { id: "table", name: "Crafting Table", out: "table", n: 1, cost: { planks: 4 }, grid: "2x2" },
  { id: "torch", name: "Torches ×4", out: "torch", n: 4, cost: { coal: 1, stick: 1 }, grid: "3x3" },
  { id: "woodpick", name: "Wooden Pickaxe", out: "woodpick", n: 1, cost: { planks: 3, stick: 2 }, grid: "3x3" },
  { id: "stonepick", name: "Stone Pickaxe", out: "stonepick", n: 1, cost: { cobble: 3, stick: 2 }, grid: "3x3" },
  { id: "door", name: "Door", out: "door", n: 1, cost: { planks: 6 }, grid: "3x3" },
  { id: "sword", name: "Iron Sword", out: "sword", n: 1, cost: { iron: 2, stick: 1 }, grid: "3x3" },
];

/* --------------------------------------------------------------- mobs -- */

export type MobType = "zombie" | "skeleton" | "creeper";
export interface Mob {
  id: number; type: MobType;
  x: number; y: number; z: number;
  hp: number;
  attackCD: number;
  shootCD: number;
  hissT: number;        // creeper: >0 while hissing
  burnT: number;        // dawn burn
  flash: number;        // hit flash
  strafe: number;
}
export interface Arrow { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number }

/* -------------------------------------------------------------- events -- */

export interface GameEvents {
  onPhase?(p: Phase): void;
  onGain?(item: Item, n: number): void;
  onBreak?(): void;
  onPlace?(): void;
  onCraft?(r: Recipe): void;
  onSwing?(): void;
  onMobSpawn?(m: Mob): void;
  onMobHit?(m: Mob): void;
  onMobDie?(m: Mob): void;
  onPlayerHit?(dmg: number): void;
  onPlayerDie?(): void;
  onArrow?(a: Arrow): void;
  onHiss?(m: Mob): void;
  onExplode?(x: number, y: number, z: number): void;
  onBurn?(m: Mob): void;
  onDusk?(): void;
  onShelter?(): void;
  onSurvive?(): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: SPAWN.x + 0.5, y: 20, z: SPAWN.z + 0.5,
    vx: 0, vy: 0, vz: 0,
    grounded: false,
    hp: MAX_HP,
    dead: false,
    deadT: 0,
  };
  view = { ex: 0, ey: 0, ez: 0, dx: 0, dy: 0, dz: -1 };

  inv = new Map<Item, number>();
  hotbarSel = 0;

  mobs: Mob[] = [];
  arrows: Arrow[] = [];
  private mobId = 0;
  private spawnT = 0;
  private creeperSpawned = false;

  // mining progress
  mine = { x: -1, y: -1, z: -1, progress: 0, need: 1, active: false };

  placedBlocks = new Set<string>();
  private doorPos: { x: number; y: number; z: number } | null = null;
  shelterSecured = false;

  blocksMined = 0;
  blocksPlaced = 0;
  mobsSlain = 0;
  deaths = 0;

  private regenT = 0;
  private duskWarned = false;
  private shelterWarned = false;

  /* ------------------------------------------------------------ helpers -- */

  count(item: Item): number {
    return this.inv.get(item) ?? 0;
  }

  give(item: Item, n: number): void {
    this.inv.set(item, this.count(item) + n);
    this.events.onGain?.(item, n);
  }

  take(item: Item, n: number): boolean {
    if (this.count(item) < n) return false;
    this.inv.set(item, this.count(item) - n);
    return true;
  }

  /** 1 = full day, 0.12 = night floor (drives sky + mesh light). */
  dayF(): number {
    if (this.time < DAY_END) return 1;
    if (this.time < DUSK_END) return 1 - ((this.time - DAY_END) / (DUSK_END - DAY_END)) * 0.88;
    if (this.time < NIGHT_END) return 0.12;
    if (this.time < DAWN_END) return 0.12 + ((this.time - NIGHT_END) / (DAWN_END - NIGHT_END)) * 0.88;
    return 1;
  }

  isNight(): boolean {
    return this.time >= DUSK_END && this.time < NIGHT_END;
  }

  /** best pickaxe owned */
  bestPick(): "hand" | "woodpick" | "stonepick" {
    if (this.count("stonepick") > 0) return "stonepick";
    if (this.count("woodpick") > 0) return "woodpick";
    return "hand";
  }

  selectedItem(): Item | "hand" {
    // hotbar slot 8 is "pickaxe": whichever is best; bare hands otherwise
    const item = HOTBAR[this.hotbarSel];
    if (item === "woodpick") return this.bestPick();
    return item;
  }

  /* ------------------------------------------------------------- craft -- */

  nearTable(): boolean {
    for (const key of this.placedBlocks) {
      const [x, y, z] = key.split(",").map(Number);
      if (getBlock(x, y, z) === B.TABLE &&
          Math.hypot(x - this.player.x, z - this.player.z) < 5.5) return true;
    }
    return false;
  }

  canCraft(r: Recipe): boolean {
    if (r.grid === "3x3" && !this.nearTable()) return false;
    return Object.entries(r.cost).every(([k, n]) => this.count(k as Item) >= (n ?? 0));
  }

  craft(id: string): boolean {
    const r = RECIPES.find((v) => v.id === id);
    if (!r || !this.canCraft(r)) return false;
    for (const [k, n] of Object.entries(r.cost)) this.take(k as Item, n ?? 0);
    this.give(r.out, r.n);
    this.events.onCraft?.(r);
    return true;
  }

  /* ---------------------------------------------------------- mine/place -- */

  /** Hold LMB: chip the targeted block. Returns crack stage 0..4 or -1. */
  mineTick(dt: number, holding: boolean): number {
    if (!holding || this.player.dead) {
      this.mine.active = false;
      return -1;
    }
    const v = this.view;
    const hit = raycast(v.ex, v.ey, v.ez, v.dx, v.dy, v.dz, REACH);
    if (!hit) {
      this.mine.active = false;
      return -1;
    }
    const id = getBlock(hit.x, hit.y, hit.z);
    const rule = BREAK[id];
    if (!rule) {
      this.mine.active = false;
      return -1;
    }
    const tool = this.selectedItem();
    const toolKey = tool === "stonepick" || tool === "woodpick" ? tool : "hand";
    const need = rule.time[toolKey] ?? rule.time.hand ?? Infinity;
    if (!isFinite(need)) {
      this.mine.active = false;
      return -1; // wrong tool — no crack, no break
    }
    if (this.mine.x !== hit.x || this.mine.y !== hit.y || this.mine.z !== hit.z) {
      this.mine = { x: hit.x, y: hit.y, z: hit.z, progress: 0, need, active: true };
    }
    this.mine.need = need;
    this.mine.progress += dt;
    if (this.mine.progress >= need) {
      this.breakBlock(hit, rule);
      this.mine.active = false;
      return -1;
    }
    return Math.min(4, Math.floor((this.mine.progress / need) * 5));
  }

  private breakBlock(hit: RayHit, rule: BreakRule): void {
    const id = getBlock(hit.x, hit.y, hit.z);
    setBlock(hit.x, hit.y, hit.z, B.AIR);
    if (id === B.TORCH) removeTorch(hit.x, hit.y, hit.z);
    this.placedBlocks.delete(`${hit.x},${hit.y},${hit.z}`);
    this.blocksMined++;
    if (rule.drop) this.give(rule.drop, rule.dropN ?? 1);
    this.events.onBreak?.();
  }

  /** RMB: place the selected block against the targeted face. */
  placeSelected(): boolean {
    if (this.player.dead) return false;
    const sel = this.selectedItem();
    if (sel === "hand") return false;
    const item: Item = sel;
    const blockId = PLACEABLE[item];
    if (blockId === undefined || this.count(item) <= 0) return false;
    const v = this.view;
    const hit = raycast(v.ex, v.ey, v.ez, v.dx, v.dy, v.dz, REACH);
    if (!hit) return false;
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (isSolid(x, y, z)) return false;
    // never inside the player
    const p = this.player;
    if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 &&
        y + 1 > p.y && y < p.y + 1.8) return false;
    // torches need a solid block below
    if (blockId === B.TORCH && !isSolid(x, y - 1, z)) return false;
    this.take(item, 1);
    setBlock(x, y, z, blockId);
    if (blockId === B.TORCH) addTorch(x, y, z);
    this.placedBlocks.add(`${x},${y},${z}`);
    if (blockId === B.DOOR) this.doorPos = { x, y, z };
    this.blocksPlaced++;
    this.events.onPlace?.();
    this.checkShelter();
    return true;
  }

  /** "any 3-walls-and-roof counts": enough placed blocks around a door. */
  private checkShelter(): void {
    if (this.shelterSecured || !this.doorPos) return;
    const d = this.doorPos;
    let walls = 0;
    let roof = 0;
    for (const key of this.placedBlocks) {
      const [x, y, z] = key.split(",").map(Number);
      if (Math.abs(x - d.x) > 4 || Math.abs(z - d.z) > 4) continue;
      if (!isSolid(x, y, z)) continue;
      if (y >= d.y - 1 && y <= d.y + 2 && (Math.abs(x - d.x) >= 2 || Math.abs(z - d.z) >= 2)) walls++;
      if (y >= d.y + 2 && Math.abs(x - d.x) <= 2 && Math.abs(z - d.z) <= 2) roof++;
    }
    if (walls >= 8 && roof >= 3) {
      this.shelterSecured = true;
      this.events.onShelter?.();
    }
  }

  /* --------------------------------------------------------------- mobs -- */

  spawnMob(type: MobType, x?: number, z?: number): Mob {
    const p = this.player;
    let mx = x ?? 0;
    let mz = z ?? 0;
    if (x === undefined) {
      // darkness edge: a ring around the player, away from torch pools
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 10;
        mx = p.x + Math.cos(a) * r;
        mz = p.z + Math.sin(a) * r;
        if (torchGlow(mx, 12, mz) < 0.25) break;
      }
    }
    const m: Mob = {
      id: ++this.mobId, type,
      x: mx, z: mz, y: surfaceY(Math.floor(mx), Math.floor(mz)) + 1,
      hp: type === "zombie" ? 12 : type === "skeleton" ? 8 : 10,
      attackCD: 0, shootCD: 1 + Math.random() * 2, hissT: 0, burnT: 0,
      flash: 0, strafe: Math.random() < 0.5 ? -1 : 1,
    };
    this.mobs.push(m);
    this.events.onMobSpawn?.(m);
    return m;
  }

  /** LMB with a weapon-ish item (or fist): melee the mobs. */
  attackSwing(): void {
    if (this.player.dead) return;
    this.events.onSwing?.();
    const p = this.player;
    const v = this.view;
    const tool = this.selectedItem();
    const dmg = tool === "sword" ? 7 : tool === "stonepick" ? 3 : tool === "woodpick" ? 2 : 1;
    for (const m of this.mobs) {
      const dx = m.x - p.x;
      const dz = m.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.2 || Math.abs(m.y - p.y) > 2.5) continue;
      const dot = (dx * v.dx + dz * v.dz) / (d || 1);
      if (dot < 0.5) continue;
      m.hp -= dmg;
      m.flash = 0.25;
      // knockback
      m.x += (dx / d) * 1.3;
      m.z += (dz / d) * 1.3;
      this.events.onMobHit?.(m);
      if (m.hp <= 0) this.killMob(m);
      break; // one target per swing
    }
  }

  private killMob(m: Mob): void {
    this.mobs = this.mobs.filter((o) => o !== m);
    this.mobsSlain++;
    this.events.onMobDie?.(m);
  }

  private updateMobs(dt: number): void {
    const p = this.player;
    for (const m of [...this.mobs]) {
      m.flash = Math.max(0, m.flash - dt);
      // dawn burn
      if (m.burnT > 0) {
        m.burnT -= dt;
        if (m.burnT <= 0) this.killMob(m);
        continue;
      }
      const dx = p.x - m.x;
      const dz = p.z - m.z;
      const d = Math.hypot(dx, dz);

      if (m.type === "creeper" && m.hissT > 0) {
        m.hissT -= dt;
        if (m.hissT <= 0) {
          this.explode(m);
          this.killMob(m);
        }
        continue;
      }
      if (p.dead) continue;

      if (m.type === "zombie" || m.type === "creeper") {
        // shamble straight at the player, stepping up single blocks
        const spd = m.type === "zombie" ? 2.6 : 2.2;
        if (d > 0.5) this.mobMove(m, (dx / d) * spd * dt, (dz / d) * spd * dt);
        if (m.type === "zombie" && d < 1.8) {
          m.attackCD -= dt;
          if (m.attackCD <= 0) {
            m.attackCD = 1.2;
            this.hurtPlayer(3);
          }
        }
        if (m.type === "creeper" && d < 2.4 && m.hissT <= 0) {
          m.hissT = 1.3;
          this.events.onHiss?.(m);
        }
      } else {
        // skeleton: kite at 9-15m, twang arrows
        const want = d < 9 ? -1 : d > 15 ? 1 : 0;
        const spd = 2.4;
        if (d > 0.5) {
          const mx = (dx / d) * want * spd + (-dz / d) * m.strafe * 1.2;
          const mz = (dz / d) * want * spd + (dx / d) * m.strafe * 1.2;
          this.mobMove(m, mx * dt, mz * dt);
        }
        if (Math.random() < dt * 0.4) m.strafe *= -1;
        m.shootCD -= dt;
        if (m.shootCD <= 0 && d < 24) {
          m.shootCD = 2.8;
          const dy = (p.y + 1.2) - (m.y + 1.4);
          const t = d / 14; // flight time
          const a: Arrow = {
            x: m.x, y: m.y + 1.4, z: m.z,
            vx: dx / t, vy: dy / t + 0.5 * 9 * t, vz: dz / t, t: 0,
          };
          this.arrows.push(a);
          this.events.onArrow?.(a);
        }
      }
    }

    // arrows fly
    for (const a of [...this.arrows]) {
      a.t += dt;
      a.vy -= 9 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      if (isSolid(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)) || a.t > 3) {
        this.arrows = this.arrows.filter((o) => o !== a);
        continue;
      }
      if (!p.dead && Math.hypot(a.x - p.x, a.y - (p.y + 0.9), a.z - p.z) < 0.7) {
        this.arrows = this.arrows.filter((o) => o !== a);
        this.hurtPlayer(2);
      }
    }
  }

  private mobMove(m: Mob, dx: number, dz: number): void {
    // walk on the surface; refuse climbs over one block (walls work!)
    const nx = m.x + dx;
    const nz = m.z + dz;
    const sy = surfaceY(Math.floor(nx), Math.floor(nz));
    if (sy - (m.y - 1) <= 1.1) {
      m.x = nx;
      m.z = nz;
      m.y += (sy + 1 - m.y) * 0.5;
    } else {
      // slide along whichever axis is clear
      const sx = surfaceY(Math.floor(m.x + dx), Math.floor(m.z));
      if (sx - (m.y - 1) <= 1.1) {
        m.x += dx;
        m.y += (sx + 1 - m.y) * 0.5;
      } else {
        const sz = surfaceY(Math.floor(m.x), Math.floor(m.z + dz));
        if (sz - (m.y - 1) <= 1.1) {
          m.z += dz;
          m.y += (sz + 1 - m.y) * 0.5;
        }
      }
    }
  }

  private explode(m: Mob): void {
    const ex = Math.floor(m.x);
    const ey = Math.floor(m.y);
    const ez = Math.floor(m.z);
    this.events.onExplode?.(m.x, m.y, m.z);
    // a small crater (never below y 2)
    for (let x = ex - 2; x <= ex + 2; x++) {
      for (let y = Math.max(2, ey - 2); y <= ey + 2; y++) {
        for (let z = ez - 2; z <= ez + 2; z++) {
          if (Math.hypot(x - m.x, y - m.y, z - m.z) < 2.6 && getBlock(x, y, z) !== B.AIR) {
            setBlock(x, y, z, B.AIR);
            removeTorch(x, y, z);
            this.placedBlocks.delete(`${x},${y},${z}`);
          }
        }
      }
    }
    const d = Math.hypot(this.player.x - m.x, this.player.z - m.z);
    if (d < 4) this.hurtPlayer(Math.round(12 * (1 - d / 4)));
  }

  private hurtPlayer(dmg: number): void {
    const p = this.player;
    if (p.dead) return;
    p.hp = Math.max(0, p.hp - dmg);
    this.regenT = 0;
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) {
      p.dead = true;
      p.deadT = 0;
      this.deaths++;
      this.events.onPlayerDie?.();
    }
  }

  /* ------------------------------------------------------------- update -- */

  start(): void {
    if (this.phase !== "title") return;
    this.player.y = surfaceY(SPAWN.x, SPAWN.z) + 1;
    this.setPhase("play");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  update(dt: number, move: { x: number; z: number }, jump: boolean, sneak: boolean): void {
    if (this.phase !== "play") return;
    this.time += dt;
    const p = this.player;

    // day director beats
    if (!this.shelterWarned && this.time >= DAY_END - 50) {
      this.shelterWarned = true;
      this.events.onDusk?.();
    }
    if (this.time >= NIGHT_END && !this.dawnFired) {
      this.dawnFired = true;
      for (const m of this.mobs) {
        if (m.burnT <= 0) {
          m.burnT = 1.2 + Math.random() * 1.2;
          this.events.onBurn?.(m);
        }
      }
    }
    if (this.time >= DAWN_END + 8 && !p.dead) {
      this.setPhase("results");
      this.events.onSurvive?.();
      return;
    }

    // night spawns
    if (this.isNight()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.mobs.length < 9) {
        this.spawnT = 7 + Math.random() * 6;
        const roll = Math.random();
        const type: MobType =
          roll < 0.6 ? "zombie" : roll < 0.88 || this.creeperSpawned ? "skeleton" : "creeper";
        if (type === "creeper") this.creeperSpawned = true;
        this.spawnMob(type);
      }
    }

    // death / respawn
    if (p.dead) {
      p.deadT += dt;
      if (p.deadT > 2.5) {
        p.dead = false;
        p.hp = MAX_HP;
        p.x = SPAWN.x + 0.5;
        p.z = SPAWN.z + 0.5;
        p.y = surfaceY(SPAWN.x, SPAWN.z) + 1;
        p.vy = 0;
      }
    } else {
      // physics against the voxel truth
      const spd = WALK * (sneak ? SNEAK_MULT : 1);
      p.vx = move.x * spd;
      p.vz = move.z * spd;
      if (jump && p.grounded) p.vy = JUMP_V;
      p.vy -= GRAVITY * dt;
      p.vy = Math.max(-30, p.vy);

      // sneak: no edge-fall — clamp moves that would step off a ledge
      let dx = p.vx * dt;
      let dz = p.vz * dt;
      if (sneak && p.grounded) {
        const tx = p.x + dx;
        const tz = p.z + dz;
        if (surfaceY(Math.floor(tx), Math.floor(tz)) < p.y - 1.05) {
          if (surfaceY(Math.floor(tx), Math.floor(p.z)) < p.y - 1.05) dx = 0;
          if (surfaceY(Math.floor(p.x), Math.floor(tz)) < p.y - 1.05) dz = 0;
        }
      }

      const res = collideAABB(p.x, p.y, p.z, dx, p.vy * dt, dz, 0.6, 1.8);
      p.x = res.x;
      p.y = res.y;
      p.z = res.z;
      p.grounded = res.grounded;
      if (res.grounded) p.vy = 0;
      else if (p.vy > 0 && res.y < p.y + p.vy * dt) p.vy = 0;

      // slow regen out of combat
      this.regenT += dt;
      if (this.regenT > 8 && p.hp < MAX_HP) {
        p.hp = Math.min(MAX_HP, p.hp + dt * 0.3);
      }
    }

    this.updateMobs(dt);
  }
  private dawnFired = false;

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  giveItem(item: Item, n: number): void {
    this.give(item, n);
  }

  /** jump the day clock (250 = dusk warning, 340 = night, 602 = dawn burn) */
  setTime(t: number): void {
    this.time = t;
    if (t > DAY_END - 45) this.shelterWarned = true; // don't fire late warnings
  }

  teleport(x: number, z: number): void {
    this.player.x = x + 0.5;
    this.player.z = z + 0.5;
    this.player.y = surfaceY(x, z) + 1;
    this.player.vy = 0;
  }

  /** auto-build a 3-walls-and-roof shelter next to the player (shot/e2e) */
  debugShelter(): void {
    const p = this.player;
    const bx = Math.floor(p.x) + 2;
    const bz = Math.floor(p.z);
    const by = surfaceY(bx, bz) + 1;
    const place = (x: number, y: number, z: number, id: number) => {
      if (getBlock(x, y, z) === B.AIR) {
        setBlock(x, y, z, id);
        this.placedBlocks.add(`${x},${y},${z}`);
        this.blocksPlaced++;
        this.events.onPlace?.();
      }
    };
    for (let y = by; y < by + 3; y++) {
      for (let i = -2; i <= 2; i++) {
        place(bx + i, y, bz - 2, B.PLANKS);
        place(bx + i, y, bz + 2, B.PLANKS);
        place(bx - 2, y, bz + i, B.PLANKS);
      }
    }
    // door gap on the east wall + roof
    setBlock(bx + 2, by, bz, B.AIR);
    setBlock(bx + 2, by + 1, bz, B.AIR);
    place(bx + 2, by, bz, B.DOOR);
    this.doorPos = { x: bx + 2, y: by, z: bz };
    for (let i = -2; i <= 2; i++) {
      for (let k = -2; k <= 2; k++) place(bx + i, by + 3, bz + k, B.PLANKS);
    }
    this.checkShelter();
  }

  debugKillAll(): void {
    for (const m of [...this.mobs]) this.killMob(m);
  }

  debugFinish(): void {
    this.blocksMined = Math.max(this.blocksMined, 214);
    this.blocksPlaced = Math.max(this.blocksPlaced, 57);
    this.mobsSlain = Math.max(this.mobsSlain, 9);
    this.shelterSecured = true;
    this.time = DAWN_END + 9; // past the dawn-burn beat → results next frame
    if (this.phase === "title") this.start();
  }
}
