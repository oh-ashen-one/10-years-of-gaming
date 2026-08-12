/**
 * game.ts — DUSTFALL ISLAND game logic. RENDER-FREE (§2.4): the drop, the
 * loot, the shrink director, 15 bot brains, combat resolution, the buggy.
 * No renderables imported; main.ts maps state + events to presentation.
 * One direction only: game → events → presentation.
 *
 * Phases: title → plane → drop → ground → results.
 *
 * The 10-minute promise, as scheduled below: boots-on-ground ~1:00, loot
 * to 3:00, circle 1 closes 3:00–4:05, circle 2 at 5:30, final circle
 * (the wheat, r≈22 m) at 7:30, dinner by ~9:30. The background-fight
 * cull guarantees the lobby thins on schedule even without player kills.
 */
import {
  COMPOUNDS, WHEAT, CROSSROADS, heightAt, inWheat, surfaceAt,
} from "./island";

export type Phase = "title" | "plane" | "drop" | "ground" | "results";
export type WeaponId = "rifle" | "smg" | "shotgun";

/* ------------------------------------------------------------- tuning -- */

const PLANE_ALT = 260;
const PLANE_SPEED = 55;
const PLANE_FROM = { x: -750, z: -350 };
const PLANE_TO = { x: 750, z: 350 };
const CHUTE_ALT = 90;          // auto-chute below this
const FALL_FAST = 38;
const FALL_CHUTE = 7;
const DROP_STEER = 26;         // m/s horizontal while skydiving
const CHUTE_STEER = 9;

const WALK_SPEED = 6.2;
const SPRINT_MULT = 1.55;
const PRONE_MULT = 0.32;
const PLAYER_HP = 100;
const ARMOR_CUT = 0.4;         // fraction of damage armor eats
const MEDKIT_HEAL = 40;

const BOT_HP = 100;
const BOT_COUNT = 15;
const BOT_SIGHT = 72;          // bot engagement range
const BOT_SIGHT_PRONE_WHEAT = 22;
const CULL_EARLIEST = 150;     // background fights start
const CULL_PERIOD = [18, 28];  // min/max seconds between offscreen kills

const BUGGY_MAX = 23;
const BUGGY_ACCEL = 15;

interface CircleDef { warnAt: number; closeAt: number; closeDur: number; r: number; cx: number; cz: number; dps: number }
const CIRCLES: CircleDef[] = [
  { warnAt: 140, closeAt: 180, closeDur: 65, r: 230, cx: 30, cz: -20, dps: 2 },
  { warnAt: 300, closeAt: 330, closeDur: 55, r: 110, cx: 70, cz: 30, dps: 4 },
  { warnAt: 420, closeAt: 450, closeDur: 45, r: 22, cx: WHEAT.x, cz: WHEAT.z, dps: 8 },
];

/* ------------------------------------------------------------ weapons -- */

export interface WeaponDef {
  name: string; dmg: number; interval: number; mag: number;
  reload: number; range: number; pellets: number;
}
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: { name: "DUSTER RIFLE", dmg: 26, interval: 0.19, mag: 30, reload: 1.9, range: 170, pellets: 1 },
  smg: { name: "WASP SMG", dmg: 14, interval: 0.085, mag: 36, reload: 1.6, range: 100, pellets: 1 },
  shotgun: { name: "GATEKEEPER", dmg: 9, interval: 0.85, mag: 6, reload: 2.4, range: 34, pellets: 6 },
};

/* -------------------------------------------------------------- events -- */

export interface LootItem {
  id: number;
  type: "weapon" | "armor" | "medkit";
  weapon?: WeaponId;
  x: number;
  z: number;
  taken: boolean;
}

export type BotState = "loot" | "rotate" | "fight" | "dead";
export interface Bot {
  id: number;
  name: string;
  x: number;
  z: number;
  hp: number;
  state: BotState;
  tier: number;          // weapon tier 0..2 (fire rate / damage)
  fireCD: number;
  strafe: number;
  tx: number;            // move target
  tz: number;
  retargetT: number;
  homeCompound: number;
}

export interface GameEvents {
  onPhase?(p: Phase): void;
  onJump?(): void;
  onChute?(): void;
  onLand?(): void;
  onStep?(surface: string): void;
  onPickup?(item: LootItem): void;
  onFire?(w: WeaponId): void;
  onReload?(): void;
  onHitmark?(killed: boolean): void;
  onBlood?(x: number, z: number): void;
  onPlayerHit?(dmg: number): void;
  onFeed?(text: string, mine: boolean): void;
  onSquash?(name: string): void;
  onCircleWarn?(stage: number): void;
  onCircleClose?(stage: number): void;
  onZoneTick?(dps: number): void;
  onBuggyEnter?(): void;
  onBuggyExit?(): void;
  onWin?(): void;
  onLose?(): void;
}

const BOT_NAMES = [
  "kar98_kid", "dustrunner", "p0chinki_pete", "lvl3vest", "xX_mirado_Xx",
  "sanhok_sal", "bridgecamper", "frying_pan", "erangel_ed", "zone_runner",
  "ghillie_gus", "red_dot_ron", "crate_digger", "last_circle_liv", "AFK_andy",
];

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: 0, z: 0, y: PLANE_ALT, heading: 0,
    hp: PLAYER_HP, armor: false,
    weapon: null as WeaponId | null,
    mag: 0, reloading: 0, fireCD: 0,
    prone: false, sprinting: false,
    inBuggy: false,
  };

  // aim ray, fed by main every frame (camera truth for hitscan)
  aim = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1 };

  // drop
  planeT = 0;
  chute = false;

  bots: Bot[] = [];
  loot: LootItem[] = [];
  private lootId = 0;

  buggy = { x: CROSSROADS.x, z: CROSSROADS.z, heading: 0.6, speed: 0 };

  // circle director
  stage = 0;                    // 0 = no zone, 1..3 = that circle targeted/closed
  wall = { cx: 0, cz: 0, r: 470 };   // the blue wall (current danger edge)
  target = { cx: 0, cz: 0, r: 470 }; // the white circle (next safe zone)
  warned = [false, false, false, false];

  kills = 0;
  damage = 0;
  placement = 16;
  won = false;

  private stepAcc = 0;
  private zoneTickT = 0;

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
    this.setPhase("plane");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /** Space over the island: jump. */
  jump(): void {
    if (this.phase !== "plane") return;
    this.setPhase("drop");
    this.events.onJump?.();
  }

  /* -------------------------------------------------------------- input -- */

  /** F — pick up loot underfoot / enter-exit the buggy. */
  interact(): void {
    if (this.phase !== "ground" || this.player.hp <= 0) return;
    const p = this.player;
    if (!p.inBuggy) {
      const bd = Math.hypot(p.x - this.buggy.x, p.z - this.buggy.z);
      if (bd < 3.2) {
        p.inBuggy = true;
        this.events.onBuggyEnter?.();
        return;
      }
      const item = this.nearestLoot();
      if (item) {
        item.taken = true;
        if (item.type === "weapon") {
          p.weapon = item.weapon!;
          p.mag = WEAPONS[p.weapon].mag;
          p.reloading = 0;
        } else if (item.type === "armor") {
          p.armor = true;
        } else {
          p.hp = Math.min(PLAYER_HP, p.hp + MEDKIT_HEAL);
        }
        this.events.onPickup?.(item);
      }
    } else {
      p.inBuggy = false;
      // step out beside the buggy
      p.x = this.buggy.x + Math.cos(this.buggy.heading) * 2;
      p.z = this.buggy.z - Math.sin(this.buggy.heading) * 2;
      this.events.onBuggyExit?.();
    }
  }

  nearestLoot(): LootItem | null {
    const p = this.player;
    let best: LootItem | null = null;
    let bd = 2.6;
    for (const it of this.loot) {
      if (it.taken) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  reload(): void {
    const p = this.player;
    if (!p.weapon || p.reloading > 0 || p.mag >= WEAPONS[p.weapon].mag) return;
    p.reloading = WEAPONS[p.weapon].reload;
    this.events.onReload?.();
  }

  toggleProne(): void {
    if (this.phase === "ground" && !this.player.inBuggy) {
      this.player.prone = !this.player.prone;
    }
  }

  /** Space/LMB held: fire the current weapon along the stored aim ray. */
  tryFire(): void {
    const p = this.player;
    if (this.phase !== "ground" || p.hp <= 0 || p.inBuggy) return;
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
    let best: Bot | null = null;
    let bestT = w.range;
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      const bx = b.x - a.ox;
      const by = heightAt(b.x, b.z) + 1.1 - a.oy;
      const bz = b.z - a.oz;
      const t = bx * a.dx + by * a.dy + bz * a.dz;
      if (t < 0 || t > bestT) continue;
      // perpendicular distance from the ray
      const px = bx - a.dx * t;
      const py = by - a.dy * t;
      const pz = bz - a.dz * t;
      const perp = Math.hypot(px, py, pz);
      const tol = 0.9 + t * 0.006 * w.pellets; // shotgun spreads wide
      if (perp < tol) {
        best = b;
        bestT = t;
      }
    }
    if (!best) return;
    let dmg = w.dmg * w.pellets;
    if (w.pellets > 1) dmg *= Math.max(0.25, 1 - bestT / w.range); // shotgun falloff
    else if (bestT > w.range * 0.6) dmg *= 0.75;                    // long-range chip
    dmg = Math.round(dmg);
    this.damage += dmg;
    best.hp -= dmg;
    this.events.onBlood?.(best.x, best.z);
    if (best.hp <= 0) {
      this.killBot(best, "you");
      this.kills++;
      this.events.onHitmark?.(true);
    } else {
      this.events.onHitmark?.(false);
    }
  }

  /* ------------------------------------------------------------- lobby -- */

  private spawnLobby(): void {
    // 15 bots scatter to compounds; loot spawns on compound floors
    for (let i = 0; i < BOT_COUNT; i++) {
      const home = i % COMPOUNDS.length;
      const c = COMPOUNDS[home];
      const a = (i * 2.399) % (Math.PI * 2);
      this.bots.push({
        id: i, name: BOT_NAMES[i],
        x: c.x + Math.cos(a) * c.r * 0.6,
        z: c.z + Math.sin(a) * c.r * 0.6,
        hp: BOT_HP, state: "loot", tier: i % 3,
        fireCD: 1 + Math.random() * 2, strafe: Math.random() < 0.5 ? -1 : 1,
        tx: c.x, tz: c.z, retargetT: Math.random() * 4,
        homeCompound: home,
      });
    }
    const kinds: WeaponId[] = ["rifle", "smg", "shotgun"];
    COMPOUNDS.forEach((c, ci) => {
      // each compound: 2 weapons + armor and/or medkit, deterministic ring
      const items: LootItem[] = [];
      items.push(this.makeLoot("weapon", kinds[ci % 3], c.x + 6, c.z + 3));
      items.push(this.makeLoot("weapon", kinds[(ci + 1) % 3], c.x - 7, c.z - 5));
      items.push(this.makeLoot(ci % 2 ? "armor" : "medkit", undefined, c.x + 2, c.z - 8));
      items.push(this.makeLoot(ci % 2 ? "medkit" : "armor", undefined, c.x - 4, c.z + 9));
      if (ci % 3 === 0) items.push(this.makeLoot("weapon", "rifle", c.x + 10, c.z + 10));
      this.loot.push(...items);
    });
  }

  private makeLoot(type: LootItem["type"], weapon: WeaponId | undefined, x: number, z: number): LootItem {
    return { id: ++this.lootId, type, weapon, x, z, taken: false };
  }

  /* ------------------------------------------------------------ update -- */

  update(dt: number, move: { x: number; z: number }, sprint: boolean): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    if (this.phase === "plane") {
      this.planeT += dt;
      const t = Math.min(1, (this.planeT * PLANE_SPEED) / 1060);
      p.x = PLANE_FROM.x + (PLANE_TO.x - PLANE_FROM.x) * t;
      p.z = PLANE_FROM.z + (PLANE_TO.z - PLANE_FROM.z) * t;
      p.y = PLANE_ALT;
      if (t >= 1) this.jump(); // missed the window — kicked out at the coast
      return;
    }

    if (this.phase === "drop") {
      const steer = Math.hypot(move.x, move.z) > 0.1;
      const spd = this.chute ? CHUTE_STEER : DROP_STEER;
      if (steer) {
        const mag = Math.hypot(move.x, move.z);
        p.x += (move.x / mag) * spd * dt;
        p.z += (move.z / mag) * spd * dt;
        p.heading = Math.atan2(move.x, move.z);
      }
      p.y -= (this.chute ? FALL_CHUTE : FALL_FAST) * dt;
      if (!this.chute && p.y <= CHUTE_ALT) {
        this.chute = true;
        this.events.onChute?.();
      }
      const ground = heightAt(p.x, p.z);
      if (p.y <= ground + 0.1) {
        p.y = ground;
        this.setPhase("ground");
        this.events.onLand?.();
      }
      return;
    }

    /* ---- ground ---- */
    p.fireCD = Math.max(0, p.fireCD - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0 && p.weapon) p.mag = WEAPONS[p.weapon].mag;
    }

    if (p.inBuggy) this.updateBuggy(dt, move);
    else this.updateWalk(dt, move, sprint);

    this.updateCircle(dt);
    this.updateBots(dt);
    this.updateCull(dt);

    // zone damage
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

    // win check
    if (this.aliveBots() === 0 && p.hp > 0) this.win();
  }

  private updateWalk(dt: number, move: { x: number; z: number }, sprint: boolean): void {
    const p = this.player;
    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01) {
      let spd = WALK_SPEED * (p.prone ? PRONE_MULT : 1);
      p.sprinting = sprint && !p.prone;
      if (p.sprinting) spd *= SPRINT_MULT;
      const nx = p.x + (move.x / mag) * spd * dt;
      const nz = p.z + (move.z / mag) * spd * dt;
      if (Math.hypot(nx, nz) < 505 && heightAt(nx, nz) > -1) {
        p.x = nx;
        p.z = nz;
      }
      p.heading = Math.atan2(move.x, move.z);
      this.stepAcc += spd * dt;
      const stride = p.prone ? 1.4 : 1.9;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        this.events.onStep?.(p.prone ? "wheat" : surfaceAt(p.x, p.z));
      }
    } else {
      p.sprinting = false;
    }
    p.y = heightAt(p.x, p.z);
  }

  private updateBuggy(dt: number, move: { x: number; z: number }): void {
    const b = this.buggy;
    const p = this.player;
    const fwd = -move.z; // W = forward
    b.speed += fwd * BUGGY_ACCEL * dt;
    b.speed *= 1 - Math.min(0.9, dt * (fwd === 0 ? 2.2 : 0.35));
    b.speed = Math.max(-8, Math.min(BUGGY_MAX, b.speed));
    b.heading += move.x * dt * 1.9 * Math.min(1, Math.abs(b.speed) / 8) * Math.sign(b.speed || 1);
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    if (Math.hypot(b.x, b.z) > 500 || heightAt(b.x, b.z) < -0.5) {
      b.x -= Math.sin(b.heading) * b.speed * dt;
      b.z -= Math.cos(b.heading) * b.speed * dt;
      b.speed = 0;
    }
    p.x = b.x;
    p.z = b.z;
    p.y = heightAt(b.x, b.z);
    p.heading = b.heading;

    // squash: a buggy at speed is a weapon
    if (Math.abs(b.speed) > 8) {
      for (const bot of this.bots) {
        if (bot.state === "dead") continue;
        if (Math.hypot(bot.x - b.x, bot.z - b.z) < 2.0) {
          this.killBot(bot, "buggy");
          this.kills++;
          b.speed *= 0.82;
          this.events.onSquash?.(bot.name);
        }
      }
    }
  }

  /* ------------------------------------------------------ circle director -- */

  private updateCircle(_dt: number): void {
    for (let i = 0; i < CIRCLES.length; i++) {
      const c = CIRCLES[i];
      if (!this.warned[i] && this.time >= c.warnAt) {
        this.warned[i] = true;
        this.target = { cx: c.cx, cz: c.cz, r: c.r };
        this.events.onCircleWarn?.(i + 1);
      }
      if (this.time >= c.closeAt && this.stage === i) {
        this.stage = i + 1;
        this.events.onCircleClose?.(i + 1);
      }
      if (this.stage === i + 1) {
        // wall lerps from the previous circle to this one over closeDur
        const prev = i === 0 ? { cx: 0, cz: 0, r: 470 } : CIRCLES[i - 1];
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

  /* ------------------------------------------------------------ bots ----- */

  private updateBots(dt: number): void {
    const p = this.player;
    for (const b of this.bots) {
      if (b.state === "dead") continue;
      b.fireCD -= dt;
      b.retargetT -= dt;

      // find an enemy: the player, or the nearest other bot in range
      let ex = 0, ez = 0, edist = Infinity, isPlayer = false;
      const pd = Math.hypot(p.x - b.x, p.z - b.z);
      const concealed = p.prone && inWheat(p.x, p.z);
      const sight = concealed ? BOT_SIGHT_PRONE_WHEAT : BOT_SIGHT;
      if (p.hp > 0 && pd < sight && !(p.inBuggy && Math.abs(this.buggy.speed) > 14)) {
        ex = p.x; ez = p.z; edist = pd; isPlayer = true;
      }
      for (const o of this.bots) {
        if (o === b || o.state === "dead") continue;
        const d = Math.hypot(o.x - b.x, o.z - b.z);
        if (d < edist && d < BOT_SIGHT * 0.8) {
          ex = o.x; ez = o.z; edist = d; isPlayer = false;
        }
      }

      const engaged = edist < Infinity;
      b.state = engaged ? "fight" : b.state === "fight" ? "rotate" : b.state;

      if (b.state === "fight" && engaged) {
        // strafe + keep mid range, fire in bursts
        const dx = (ex - b.x) / edist;
        const dz = (ez - b.z) / edist;
        const want = edist > 40 ? 1 : edist < 14 ? -1 : 0;
        const spd = 3.4;
        b.x += (dx * want * spd + -dz * b.strafe * 2.4) * dt;
        b.z += (dz * want * spd + dx * b.strafe * 2.4) * dt;
        if (Math.random() < dt * 0.5) b.strafe *= -1;
        if (b.fireCD <= 0) {
          b.fireCD = 0.45 + Math.random() * 0.5 - b.tier * 0.08;
          this.botFire(b, edist, isPlayer, ex, ez);
        }
      } else {
        // rotate toward the circle once it's small, else loot near home
        if (b.retargetT <= 0) {
          b.retargetT = 3 + Math.random() * 4;
          const circleBias = this.stage > 0 || this.time > 100;
          if (circleBias) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * Math.max(20, this.target.r * 0.8);
            b.tx = this.target.cx + Math.cos(a) * r;
            b.tz = this.target.cz + Math.sin(a) * r;
            b.state = "rotate";
          } else {
            const c = COMPOUNDS[b.homeCompound];
            b.tx = c.x + (Math.random() - 0.5) * c.r * 1.4;
            b.tz = c.z + (Math.random() - 0.5) * c.r * 1.4;
            b.state = "loot";
          }
        }
        const dx = b.tx - b.x;
        const dz = b.tz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 3) {
          b.x += (dx / d) * 4.4 * dt;
          b.z += (dz / d) * 4.4 * dt;
        }
      }
    }
  }

  private botFire(b: Bot, dist: number, atPlayer: boolean, ex: number, ez: number): void {
    // accuracy by range; prone-in-wheat and fast buggy are hard targets
    let hitChance = Math.max(0.07, 0.55 - dist * 0.008);
    if (atPlayer) {
      const p = this.player;
      if (p.prone && inWheat(p.x, p.z)) hitChance *= 0.4;
      if (p.inBuggy) hitChance *= 0.5;
    }
    if (Math.random() < hitChance) {
      if (atPlayer) {
        const p = this.player;
        let dmg = 5 + b.tier * 2 + Math.random() * 3;
        if (p.armor) dmg *= 1 - ARMOR_CUT;
        dmg = Math.round(dmg);
        p.hp = Math.max(0, p.hp - dmg);
        this.events.onPlayerHit?.(dmg);
        if (p.hp <= 0) this.lose();
      } else {
        // bot-on-bot: resolve against the target bot
        const victim = this.bots.find(
          (o) => o.state !== "dead" && Math.hypot(o.x - ex, o.z - ez) < 2,
        );
        if (victim) {
          victim.hp -= 8 + b.tier * 4;
          this.events.onBlood?.(victim.x, victim.z);
          if (victim.hp <= 0) this.killBot(victim, b.name);
        }
      }
    }
  }

  private killBot(b: Bot, by: string): void {
    if (b.state === "dead") return;
    b.state = "dead";
    this.events.onBlood?.(b.x, b.z);
    this.events.onFeed?.(
      by === "you" ? `you ⌦ ${b.name}` : by === "buggy" ? `you ⌦ ${b.name} (buggy)` : `${by} ⌦ ${b.name}`,
      by === "you" || by === "buggy",
    );
  }

  /** Offscreen fights thin the lobby on schedule (the 10-minute promise). */
  private nextCullAt = 0;
  private updateCull(_dt: number): void {
    if (this.time < CULL_EARLIEST || this.phase !== "ground") return;
    if (this.nextCullAt === 0) {
      this.nextCullAt = this.time + CULL_PERIOD[0];
      return;
    }
    if (this.time < this.nextCullAt) return;
    this.nextCullAt = this.time + CULL_PERIOD[0] + Math.random() * (CULL_PERIOD[1] - CULL_PERIOD[0]);
    const alive = this.bots.filter((b) => b.state !== "dead");
    if (alive.length <= 4) return; // the endgame is the player's
    const p = this.player;
    const far = alive.filter((b) => Math.hypot(b.x - p.x, b.z - p.z) > 120);
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

  /** Skip the drop: boots on the ground at compound i (0..5), rifle in hand. */
  debugLand(compoundIdx = 0): void {
    if (this.phase === "title") this.start();
    const c = COMPOUNDS[compoundIdx] ?? COMPOUNDS[0];
    this.player.x = c.x + 4;
    this.player.z = c.z + 4;
    this.player.y = heightAt(c.x, c.z);
    this.player.weapon = "rifle";
    this.player.mag = WEAPONS.rifle.mag;
    this.setPhase("ground");
    this.events.onLand?.();
  }

  /** Jump the circle director to a stage (1..3), wall nearly closed. */
  debugCircle(stage: 1 | 2 | 3): void {
    const c = CIRCLES[stage - 1];
    this.time = Math.max(this.time, c.closeAt + c.closeDur - 4);
    this.warned.fill(true);
    this.target = { cx: c.cx, cz: c.cz, r: c.r };
    if (stage < 3) {
      this.target = { cx: CIRCLES[stage].cx, cz: CIRCLES[stage].cz, r: CIRCLES[stage].r };
    }
  }

  /** Thin the lobby to n alive (incl. player) near the final circle. */
  debugAlive(n: number): void {
    const keep = Math.max(0, n - 1);
    const alive = this.bots.filter((b) => b.state !== "dead");
    // keep the closest ones to the final circle — they read in the shot
    alive.sort(
      (a, b) =>
        Math.hypot(a.x - WHEAT.x, a.z - WHEAT.z) - Math.hypot(b.x - WHEAT.x, b.z - WHEAT.z),
    );
    alive.slice(keep).forEach((b) => this.killBot(b, "offscreen"));
    // scatter the keepers around the final circle
    alive.slice(0, keep).forEach((b, i) => {
      const a = (i / Math.max(1, keep)) * Math.PI * 2;
      b.x = WHEAT.x + Math.cos(a) * 26;
      b.z = WHEAT.z + Math.sin(a) * 26;
      b.state = "rotate";
      b.tx = WHEAT.x;
      b.tz = WHEAT.z;
    });
  }

  /** Put the buggy next to the player and get in. */
  debugBuggy(): void {
    if (this.phase !== "ground") this.debugLand(3);
    this.buggy.x = this.player.x + 2;
    this.buggy.z = this.player.z + 2;
    this.player.inBuggy = true;
    this.events.onBuggyEnter?.();
  }

  /** Kill the nearest living bot (e2e combat check). */
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

  /** Bring the nearest bot within arm's reach for a scripted fight. */
  debugPullBot(dist = 14): void {
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

  /** Straight to the dinner with plausible stats. */
  debugFinish(): void {
    if (this.phase === "title") this.start();
    for (const b of this.bots) if (b.state !== "dead") this.killBot(b, "offscreen");
    this.kills = 6;
    this.damage = 1247;
    this.time = Math.max(this.time, 563);
    this.player.x = WHEAT.x;
    this.player.z = WHEAT.z;
    this.player.y = heightAt(WHEAT.x, WHEAT.z);
    if (this.phase !== "ground") this.setPhase("ground");
    this.win();
  }
}
