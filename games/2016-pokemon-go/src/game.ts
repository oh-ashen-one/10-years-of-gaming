/**
 * game.ts — POCKET GO game logic. RENDER-FREE (§2.4): phases, spawns,
 * catch resolution, the gym battle, dex and scoring. It never imports a
 * renderable; main.ts subscribes to `events` and maps state →
 * HUD/audio/camera/FX. One direction only: game → events → presentation.
 *
 * Phases: title → walk ⇄ catch → gym → results.
 *
 * The 10-minute promise, as tuned below: encounters every ~4–7 s near the
 * player, common species guaranteed inside ~4 min, the gold duck at the
 * pond around minute 7, gym unlocks at 2 catches, results after the win.
 */
import { SPECIES, DEX_ORDER, type SpeciesId } from "./creatures";
import {
  biomeAt, walkable, pondShorePoint, PLACES, type Biome,
} from "./world/layout";

export type Phase = "title" | "walk" | "catch" | "gym" | "results";

/* ------------------------------------------------------------- tuning -- */

const WALK_SPEED = 4.4;
const STEP_LENGTH = 0.72;        // meters per step (step counter)
const INTERACT_RANGE = 3.4;
const RUSTLE_TIME = 1.8;
const ENC_DESPAWN = 45;
const MAX_ENCOUNTERS = 3;
const SPAWN_MIN = 3.5;
const SPAWN_MAX = 7;
const RARE_EARLIEST = 360;       // gold duck eligible ~minute 6-7
const RARE_DEX_GATE = 4;         // …or once 4 species are registered

const RING_CYCLE = 1.7;          // seconds per shrink cycle
const RING_BIG = 2.2;
const RING_SMALL = 0.7;
const THROW_TIME = 0.75;
const THROW_MIN = 2.2;           // power 0 distance
const THROW_MAX = 7.4;           // power 1 distance
const CURVE_SHIFT = 2.4;         // full-lean lateral shift, meters
const PAD_DIST = 5.2;            // creature distance from player in catch
const BERRY_MULT = 1.55;
const WOBBLE_PERIOD = 0.85;
const BURST_TIME = 1.5;
const BREAKOUT_TIME = 1.1;

const GYM_MIN_CATCHES = 2;
const BOSS_HP = 90;
const BUDDY_HP = 60;
const BUDDY_DMG = 10;
const ATTACK_CD = 0.55;
const SLAM_DMG = 13;
const TELEGRAPH_MIN = 2.2;
const TELEGRAPH_MAX = 3.2;
const TELEGRAPH_WARN = 0.9;

/* ------------------------------------------------------------- events -- */

export interface Encounter {
  id: number;
  species: SpeciesId;
  x: number;
  z: number;
  state: "rustle" | "out";
  t: number;              // time in state
  fleesLeft: number;      // gold duck: flees twice
}

export interface GameEvents {
  onPhase?(p: Phase): void;
  onStep?(): void;
  onSpawn?(enc: Encounter): void;
  onPop?(enc: Encounter): void;
  onDespawn?(enc: Encounter): void;
  onCatchStart?(enc: Encounter): void;
  onBerry?(): void;
  onThrow?(power: number, curve: number): void;
  onBallLand?(hit: boolean): void;
  onThrowGrade?(grade: "NICE" | "GREAT" | "EXCELLENT"): void;
  onWobble?(n: number): void;
  onGotcha?(id: SpeciesId): void;
  onBreakout?(id: SpeciesId): void;
  onFlee?(enc: Encounter): void;
  onGymPrompt?(need: number): void;
  onGymStart?(): void;
  onGymAttack?(dmg: number): void;
  onGymTelegraph?(lane: number): void;
  onGymSlam?(lane: number, hitPlayer: boolean): void;
  onGymWin?(): void;
  onGymLose?(): void;
  onResults?(): void;
}

/* -------------------------------------------------------- catch state -- */

export type CatchSub = "aim" | "flying" | "wobble" | "burst" | "breakout";

export interface CatchState {
  enc: Encounter;
  sub: CatchSub;
  ringT: number;          // 0 small .. 1 big (normalized, cycles)
  ringDir: 1 | -1;
  berry: boolean;
  charging: boolean;
  power: number;
  curve: number;          // -1..1 lean
  flightT: number;
  throwDist: number;
  throwX: number;
  hit: boolean;
  success: boolean;
  failAt: number;         // wobble index the breakout happens on
  wobbles: number;
  wobbleT: number;
  subT: number;           // generic timer for burst/breakout
}

export interface GymState {
  sub: "fight" | "won" | "lost";
  bossHP: number;
  buddyHP: number;
  lane: number;           // player lane -1|0|1
  attackCD: number;
  telegraphT: number;     // countdown to next telegraph
  warnLane: number | null;
  warnT: number;
  subT: number;
  retries: number;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};

  time = 0;                 // seconds since autostart
  steps = 0;
  catches = 0;
  dex = new Map<SpeciesId, number>();      // species -> count caught
  buddy: SpeciesId | null = null;          // most recent catch — your ace
  gymWon = false;

  player: { x: number; z: number; heading: number; speed: number } = {
    x: PLACES.home.x, z: PLACES.home.z, heading: 0, speed: 0,
  };
  private stepAcc = 0;

  encounters: Encounter[] = [];
  private encId = 0;
  private spawnT = 2.5;

  catch: CatchState | null = null;
  gym: GymState | null = null;
  private rareSpawned = false;

  /* ------------------------------------------------------------ phases -- */

  start(): void {
    if (this.phase !== "title") return;
    this.setPhase("walk");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  dexCount(): number {
    return this.dex.size;
  }

  /* ------------------------------------------------------------- input -- */

  /** E — interact with the nearest popped encounter. */
  pressInteract(): void {
    if (this.phase !== "walk") return;
    const enc = this.nearestEncounter();
    if (!enc) return;
    this.encounters = this.encounters.filter((e) => e !== enc);
    // the pad sits at a fixed duel distance so throw tuning is consistent
    const p = this.player;
    const d = Math.hypot(enc.x - p.x, enc.z - p.z) || 1;
    enc.x = p.x + ((enc.x - p.x) / d) * PAD_DIST;
    enc.z = p.z + ((enc.z - p.z) / d) * PAD_DIST;
    this.catch = {
      enc, sub: "aim",
      ringT: 1, ringDir: -1,
      berry: false, charging: false, power: 0, curve: 0,
      flightT: 0, throwDist: 0, throwX: 0,
      hit: false, success: false, failAt: 0,
      wobbles: 0, wobbleT: 0, subT: 0,
    };
    this.setPhase("catch");
    this.events.onCatchStart?.(enc);
  }

  /** B — one berry per encounter: calms the ring, sweetens the odds. */
  pressBerry(): void {
    const c = this.catch;
    if (this.phase !== "catch" || !c || c.sub !== "aim" || c.berry) return;
    c.berry = true;
    this.events.onBerry?.();
  }

  startCharge(): void {
    const c = this.catch;
    if (this.phase !== "catch" || !c || c.sub !== "aim" || c.charging) return;
    c.charging = true;
    c.power = 0;
  }

  setCurve(v: number): void {
    if (this.catch) this.catch.curve = Math.max(-1, Math.min(1, v));
  }

  releaseThrow(): void {
    const c = this.catch;
    if (this.phase !== "catch" || !c || c.sub !== "aim" || !c.charging) return;
    c.charging = false;
    c.sub = "flying";
    c.flightT = 0;
    c.throwDist = THROW_MIN + c.power * (THROW_MAX - THROW_MIN);
    c.throwX = c.curve * CURVE_SHIFT;
    this.events.onThrow?.(c.power, c.curve);
  }

  /** Space during the gym battle. */
  tapAttack(): void {
    const g = this.gym;
    if (this.phase !== "gym" || !g || g.sub !== "fight" || g.attackCD > 0) return;
    g.attackCD = ATTACK_CD;
    const dmg = Math.round(BUDDY_DMG * (0.9 + Math.random() * 0.4));
    g.bossHP = Math.max(0, g.bossHP - dmg);
    this.events.onGymAttack?.(dmg);
    if (g.bossHP <= 0) {
      g.sub = "won";
      g.subT = 0;
      this.gymWon = true;
      this.events.onGymWin?.();
    }
  }

  /** A/D during the gym battle — lane dodge. */
  dodge(dir: -1 | 1): void {
    const g = this.gym;
    if (this.phase !== "gym" || !g || g.sub !== "fight") return;
    g.lane = Math.max(-1, Math.min(1, g.lane + dir));
  }

  /** Enter on the results card. */
  confirm(): void {
    if (this.phase === "title") this.start();
  }

  /* ------------------------------------------------------------ update -- */

  update(dt: number, move: { x: number; z: number }): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;

    if (this.phase === "walk") this.updateWalk(dt, move);
    else if (this.phase === "catch") this.updateCatch(dt);
    else if (this.phase === "gym") this.updateGym(dt);
  }

  private updateWalk(dt: number, move: { x: number; z: number }): void {
    const p = this.player;
    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01) {
      const nx = p.x + (move.x / mag) * WALK_SPEED * dt;
      const nz = p.z + (move.z / mag) * WALK_SPEED * dt;
      // one spatial truth: layout.walkable blocks water + the gym base
      if (walkable(nx, nz)) { p.x = nx; p.z = nz; }
      else if (walkable(nx, p.z)) { p.x = nx; }
      else if (walkable(p.x, nz)) { p.z = nz; }
      const want = Math.atan2(move.x, move.z);
      let d = want - p.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.heading += d * Math.min(1, dt * 10);
      p.speed = WALK_SPEED;
      this.stepAcc += WALK_SPEED * dt;
      while (this.stepAcc >= STEP_LENGTH) {
        this.stepAcc -= STEP_LENGTH;
        this.steps++;
        this.events.onStep?.();
      }
    } else {
      p.speed = 0;
    }

    // gym trigger: entering the plaza with enough pals
    const pd = Math.hypot(p.x - PLACES.plaza.x, p.z - PLACES.plaza.z);
    if (!this.gymWon && pd < PLACES.plaza.r - 4) {
      if (this.catches >= GYM_MIN_CATCHES) this.startGym();
      else if (!this.gymPrompted) {
        this.gymPrompted = true;
        this.events.onGymPrompt?.(GYM_MIN_CATCHES);
      }
    }

    this.updateSpawns(dt);
  }
  private gymPrompted = false;

  /* ------------------------------------------------------ spawn director -- */

  private updateSpawns(dt: number): void {
    // rustle → pop, and despawn of ignored encounters
    for (const enc of [...this.encounters]) {
      enc.t += dt;
      if (enc.state === "rustle" && enc.t >= RUSTLE_TIME) {
        enc.state = "out";
        enc.t = 0;
        this.events.onPop?.(enc);
      } else if (enc.state === "out" && enc.t >= ENC_DESPAWN && !SPECIES[enc.species].rare) {
        this.encounters = this.encounters.filter((e) => e !== enc);
        this.events.onDespawn?.(enc);
      }
    }

    if (this.encounters.length >= MAX_ENCOUNTERS) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);

    const p = this.player;

    // the gold duck: pond-only, late-game or dex-gated, once at a time
    const rareEligible =
      !this.dex.has("gildquack") &&
      (this.time > RARE_EARLIEST || this.dexCount() >= RARE_DEX_GATE);
    const pondDist = Math.hypot(p.x - PLACES.pond.x, p.z - PLACES.pond.z);
    if (rareEligible && !this.rareSpawned && pondDist < 55) {
      const pt = { x: 0, z: 0 };
      pondShorePoint(Math.random() * Math.PI * 2, pt);
      if (walkable(pt.x, pt.z)) {
        this.rareSpawned = true;
        this.spawn("gildquack", pt.x, pt.z);
        return;
      }
    }

    // biome-weighted spawn around the player
    const a = Math.random() * Math.PI * 2;
    const d = 9 + Math.random() * 8;
    const x = p.x + Math.sin(a) * d;
    const z = p.z + Math.cos(a) * d;
    if (!walkable(x, z)) return;
    const biome: Biome = biomeAt(x, z);

    const pool = (Object.keys(SPECIES) as SpeciesId[])
      .filter((id) => id !== "gildquack" && SPECIES[id].biomes.includes(biome))
      .map((id) => {
        // guarantee variety: species not yet seen get a big weight boost
        const seen = this.dex.has(id);
        const late = this.time > 200 && !seen;
        return { id, w: SPECIES[id].weight * (seen ? 1 : late ? 6 : 2.5) };
      });
    if (!pool.length) return;
    let total = 0;
    for (const e of pool) total += e.w;
    let r = Math.random() * total;
    for (const e of pool) {
      r -= e.w;
      if (r <= 0) {
        this.spawn(e.id, x, z);
        return;
      }
    }
  }

  private spawn(species: SpeciesId, x: number, z: number): Encounter {
    const enc: Encounter = {
      id: ++this.encId, species, x, z,
      state: "rustle", t: 0,
      fleesLeft: SPECIES[species].rare ? 2 : 0,
    };
    this.encounters.push(enc);
    this.events.onSpawn?.(enc);
    return enc;
  }

  nearestEncounter(): Encounter | null {
    const p = this.player;
    let best: Encounter | null = null;
    let bestD = INTERACT_RANGE;
    for (const enc of this.encounters) {
      if (enc.state !== "out") continue;
      const d = Math.hypot(enc.x - p.x, enc.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = enc;
      }
    }
    return best;
  }

  /* -------------------------------------------------------- catch scene -- */

  /** Normalized ring size, 0 = smallest. Presentation reads this live. */
  ringRadius(): number {
    const c = this.catch;
    if (!c) return RING_BIG;
    return RING_SMALL + c.ringT * (RING_BIG - RING_SMALL);
  }

  private updateCatch(dt: number): void {
    const c = this.catch;
    if (!c) return;

    // the AR-ish ring shrinks, holds a beat at small, snaps back big
    if (c.sub === "aim") {
      const speed = (c.berry ? 0.55 : 1) / RING_CYCLE;
      c.ringT -= dt * speed * (c.ringT > 0.15 ? 1 : 0.35);
      if (c.ringT <= 0) c.ringT = 1; // snap back and shrink again
      if (c.charging) c.power = Math.min(1, c.power + dt / 0.9);
    } else if (c.sub === "flying") {
      c.flightT += dt;
      if (c.flightT >= THROW_TIME) this.landBall();
    } else if (c.sub === "wobble") {
      c.wobbleT += dt;
      if (c.wobbleT >= WOBBLE_PERIOD) {
        c.wobbleT = 0;
        c.wobbles++;
        if (!c.success && c.wobbles === c.failAt) {
          c.sub = "breakout";
          c.subT = 0;
          this.events.onBreakout?.(c.enc.species);
          return;
        }
        this.events.onWobble?.(c.wobbles);
        if (c.success && c.wobbles >= 3) {
          c.sub = "burst";
          c.subT = 0;
          this.events.onGotcha?.(c.enc.species);
        }
      }
    } else if (c.sub === "burst") {
      c.subT += dt;
      if (c.subT >= BURST_TIME) this.finishCatch(true);
    } else if (c.sub === "breakout") {
      c.subT += dt;
      if (c.subT >= BREAKOUT_TIME) {
        // gold duck flees the fight twice before it trusts you
        if (c.enc.fleesLeft > 0) {
          c.enc.fleesLeft--;
          const enc = c.enc;
          this.catch = null;
          this.setPhase("walk");
          this.events.onFlee?.(enc);
          // it resurfaces a little further along the pond shore
          if (enc.fleesLeft > 0) {
            const pt = { x: 0, z: 0 };
            pondShorePoint(Math.random() * Math.PI * 2, pt);
            this.spawn(enc.species, pt.x, pt.z);
          } else {
            this.rareSpawned = false; // one last stand, near the pond
            const pt = { x: 0, z: 0 };
            pondShorePoint(Math.random() * Math.PI * 2, pt);
            const last = this.spawn(enc.species, pt.x, pt.z);
            last.fleesLeft = 0;
          }
        } else {
          c.sub = "aim"; // ordinary pals just stay in the fight
        }
      }
    }
  }

  private landBall(): void {
    const c = this.catch!;
    const dx = c.throwX;
    const dz = c.throwDist - PAD_DIST;
    const ringR = this.ringRadius();
    c.hit = Math.abs(dx) <= ringR * 0.85 && Math.abs(dz) <= ringR * 0.85;
    this.events.onBallLand?.(c.hit);
    if (!c.hit) {
      c.sub = "aim";
      return;
    }
    // smaller ring at impact = better odds; berry sweetens; grade for HUD
    const grade = c.ringT < 0.3 ? "EXCELLENT" : c.ringT < 0.6 ? "GREAT" : "NICE";
    this.events.onThrowGrade?.(grade);
    const p =
      SPECIES[c.enc.species].baseCatch *
      (c.berry ? BERRY_MULT : 1) *
      (1.35 - 0.85 * c.ringT);
    c.success = Math.random() < Math.min(0.97, p);
    c.failAt = 1 + Math.floor(Math.random() * 3);
    c.sub = "wobble";
    c.wobbles = 0;
    c.wobbleT = 0;
  }

  private finishCatch(_caught: boolean): void {
    const c = this.catch!;
    const id = c.enc.species;
    this.dex.set(id, (this.dex.get(id) ?? 0) + 1);
    this.catches++;
    this.buddy = id;
    this.catch = null;
    this.setPhase("walk");
  }

  /* ------------------------------------------------------------ gym ----- */

  startGym(): void {
    if (this.phase === "gym" || this.gymWon) return;
    this.gym = {
      sub: "fight",
      bossHP: BOSS_HP, buddyHP: BUDDY_HP,
      lane: 0, attackCD: 0,
      telegraphT: 1.6, warnLane: null, warnT: 0,
      subT: 0, retries: 0,
    };
    this.setPhase("gym");
    this.events.onGymStart?.();
  }

  private updateGym(dt: number): void {
    const g = this.gym!;
    if (g.sub === "won" || g.sub === "lost") {
      g.subT += dt;
      if (g.sub === "won" && g.subT > 3.0) {
        this.setPhase("results");
        this.events.onResults?.();
      } else if (g.sub === "lost" && g.subT > 2.2) {
        // faint → patched up → straight back in (retries are cheap here)
        g.sub = "fight";
        g.buddyHP = BUDDY_HP;
        g.retries++;
        g.telegraphT = 2.0;
        g.warnLane = null;
      }
      return;
    }
    g.attackCD = Math.max(0, g.attackCD - dt);

    if (g.warnLane === null) {
      g.telegraphT -= dt;
      if (g.telegraphT <= 0) {
        g.warnLane = g.lane;           // it aims where you stand — MOVE
        g.warnT = TELEGRAPH_WARN;
        this.events.onGymTelegraph?.(g.warnLane);
      }
    } else {
      g.warnT -= dt;
      if (g.warnT <= 0) {
        const lane = g.warnLane;
        const hit = g.lane === lane;
        g.warnLane = null;
        g.telegraphT = TELEGRAPH_MIN + Math.random() * (TELEGRAPH_MAX - TELEGRAPH_MIN);
        if (hit) g.buddyHP = Math.max(0, g.buddyHP - SLAM_DMG);
        this.events.onGymSlam?.(lane, hit);
        if (g.buddyHP <= 0) {
          g.sub = "lost";
          g.subT = 0;
          this.events.onGymLose?.();
        }
      }
    }
  }

  /* ------------------------------------------------------ harness hooks -- */

  /** Skip title into gameplay (shoot tool). */
  autostart(): void {
    this.start();
  }

  /** Teleport the player to a named place, facing its center. */
  teleportTo(place: "pond" | "plaza" | "parkEast" | "parkWest" | "home"): void {
    const t = PLACES[place];
    if (place === "plaza") {
      this.player.x = t.x;
      this.player.z = t.z + PLACES.plaza.r + 8;
    } else if (place === "pond") {
      this.player.x = PLACES.pond.x;
      this.player.z = PLACES.pond.z - PLACES.pond.rz - 8;
    } else {
      const off = "r" in t ? (t as { r: number }).r + 6 : 6;
      this.player.x = t.x + off * 0.4;
      this.player.z = t.z + off;
    }
    this.player.heading = Math.atan2(t.x - this.player.x, t.z - this.player.z);
  }

  /** Force a specific species to pop in view of the player (shoot tool). */
  forceEncounter(id: SpeciesId): Encounter {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    // ahead and off to the side — never hidden behind the player's back
    const x = p.x + fx * 2.6 - fz * 1.5;
    const z = p.z + fz * 2.6 + fx * 1.5;
    const enc = this.spawn(id, x, z);
    enc.state = "out";
    enc.t = 0;
    this.events.onPop?.(enc);
    return enc;
  }

  /** Enter the catch scene with the nearest encounter (shoot tool). */
  debugEnterCatch(): void {
    this.pressInteract();
  }

  /** Force the current throw to land + play the GOTCHA burst (shoot tool). */
  debugCatchBurst(): void {
    const c = this.catch;
    if (!c) return;
    c.success = true;
    c.hit = true;
    c.sub = "wobble";
    c.wobbles = 2;
    c.wobbleT = WOBBLE_PERIOD - 0.05; // third wobble lands almost immediately
  }

  /** Give the player a buddy without touching the dex (gym shot setup). */
  debugFinishBuddy(): void {
    if (!this.buddy) {
      this.buddy = "nibbit";
      this.catches = Math.max(this.catches, 2);
    }
  }

  /** Jump straight to a plausible results card (shoot tool). */
  debugFinish(): void {
    for (const id of DEX_ORDER) if (id !== "gildquack") this.dex.set(id, id === "nibbit" ? 2 : 1);
    this.catches = 7;
    this.steps = 3456;
    this.buddy = "plumeck";
    this.gymWon = true;
    this.catch = null;
    this.gym = null;
    this.setPhase("results");
    this.events.onResults?.();
  }
}
