/**
 * game.ts — INKPEAK game logic. RENDER-FREE (§2.4): the focus-point combo
 * economy (lights build beads, heavies spend them), the 3-hit staff string,
 * dodge i-frames with the PERFECT-DODGE window (slow-mo + focus refund),
 * Immobilize (freeze mid-leap, cooldown), stance swap (smash ↔ poke heavies),
 * the gourd (4 sips), incense shrines (rest/refill/checkpoint, world reset),
 * death → shrine → full boss reset, and the TIGER ABBOT: phase 1 claw
 * strings / pounce / blood-pool slam (punish the 4th claw), phase 2 at 60%
 * (sword, whirlwind dash chain, roar AOE). main.ts maps state + events to
 * presentation. One direction only.
 *
 * The 10-minute promise: shrine 0:10, the bamboo court teaches light/heavy/
 * dodge by 3:00, Immobilize beat ~3:30, gate shrine 4:00, fog curtain 4:30,
 * the Abbot falls by ~9:00 (die ≤ 2–3 times), YAOGUAI FELLED → results.
 */
import {
  SHRINE_START, SHRINE_GATE, COURT, FOG_GATE, ARENA, LESSERS,
  heightAt, inBounds, inArena, pastGate,
} from "./mountain";

export type Phase = "title" | "play" | "boss" | "dead" | "results";
export type Stance = "smash" | "poke";

/* ------------------------------------------------------------- tuning -- */

const WALK = 5.2;
const PLAYER_HP = 100;
const GOURD_MAX = 4;
const GOURD_HEAL = 45;
const GOURD_SIP = 0.9;

const DODGE_DUR = 0.4;
const DODGE_DASH = 4.8;
const PERFECT_WINDOW = 0.22; // dodge this fresh when the hit lands = perfect

const LIGHT_DUR = 0.38;
const LIGHT_DMG = [10, 11, 18]; // the string: jab, backhand, finisher
const LIGHT_RANGE = 2.9;
const CHAIN_WINDOW = 1.1;
const COMBO_WINDOW = 1.4;
const FOCUS_PER_HIT = 0.34; // 3 landed lights ≈ one bead
const FOCUS_MAX = 3;

const HEAVY_SMASH = { dur: 0.72, hitAt: 0.42, dmg: 34, range: 3.4 };
const HEAVY_POKE = { dur: 0.38, hitAt: 0.2, dmg: 26, range: 4.6 };
const POKE_PUNISH_MULT = 1.6; // vs the whirlwind recovery

const IMMOBILIZE_CD = 12;
const IMMOBILIZE_T = 3.5;
const IMMOBILIZE_BOSS_T = 2.2;

const LESSER_HP = 48;
const BOSS_HP = 700;
const PHASE2_AT = 0.6;

export type LesserMove = "swipe" | "leap";
export type BossMove = "claw" | "pounce" | "bloodslam" | "whirlwind" | "roar";

export interface Enemy {
  id: number;
  kind: "lesser" | "abbot";
  x: number; z: number;
  hp: number; maxHp: number;
  state: "idle" | "engage" | "windup" | "leap" | "dash" | "attack" | "recover" | "stagger" | "frozen" | "dead";
  stateT: number;
  move: LesserMove | BossMove | null;
  leapSX: number; leapSZ: number; leapTX: number; leapTZ: number; leapDur: number;
  frozenT: number;
  preFrozen: Enemy["state"] | null;
  flash: number;
  clawN: number;
  dashN: number;
  dashHitDone: boolean;
  slamX: number; slamZ: number;
  recoverT: number;
  whirlRecover: boolean; // the poke-punish window
}

export interface BloodPool { x: number; z: number; r: number; t: number; }

/* -------------------------------------------------------------- events -- */

export interface GameEvents {
  onPhase?(p: Phase): void;
  onSwing?(kind: "light" | "heavy"): void;
  onHit?(e: Enemy, dmg: number, kind: "light" | "finisher" | "smash" | "poke"): void;
  onEnemyDie?(e: Enemy): void;
  onDodge?(): void;
  onPerfectDodge?(): void;
  onImmobilize?(e: Enemy): void;
  onStance?(s: Stance): void;
  onGourd?(left: number): void;
  onGourdEmpty?(): void;
  onShrine?(which: "start" | "gate"): void;
  onFogGate?(): void;
  onBossMove?(move: BossMove): void;
  onBossPhase2?(): void;
  onPlayerHit?(dmg: number): void;
  onYouDied?(): void;
  onRespawn?(): void;
  onFelled?(): void;
  onLockOn?(on: boolean): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: SHRINE_START.x, z: SHRINE_START.z - 4, y: 0, heading: Math.PI,
    hp: PLAYER_HP,
    gourd: GOURD_MAX, gourdT: 0,
    focus: 0,
    stance: "smash" as Stance,
    attackT: 0, attackDur: 0, attackStage: 0, attackHeavy: false,
    attackHitDone: false, queued: false, chainEndT: 0,
    dodgeT: 0, dodgeDX: 0, dodgeDZ: -1,
    staggerT: 0,
    dead: false,
  };

  combo = 0;
  comboT = 0;
  longestCombo = 0;
  immobilizeCD = 0;

  lockTarget: Enemy | null = null;
  enemies: Enemy[] = [];
  boss!: Enemy;
  bossPhase = 1;
  pools: BloodPool[] = [];
  lastShrine: "start" | "gate" = "start";
  fogGatePassed = false;

  perfectDodges = 0;
  deaths = 0;
  hitsTaken = 0;

  private enemyId = 0;
  private deadT = 0;
  private bossMoveCD = 1.4;

  /* ------------------------------------------------------------- setup -- */

  start(): void {
    if (this.phase !== "title") return;
    this.player.y = heightAt(this.player.x, this.player.z);
    this.spawnWorld();
    this.setPhase("play");
  }

  private mkLesser(x: number, z: number): Enemy {
    return {
      id: ++this.enemyId, kind: "lesser", x, z,
      hp: LESSER_HP, maxHp: LESSER_HP,
      state: "idle", stateT: 0, move: null,
      leapSX: 0, leapSZ: 0, leapTX: 0, leapTZ: 0, leapDur: 0.55,
      frozenT: 0, preFrozen: null, flash: 0, clawN: 0, dashN: 0,
      dashHitDone: false, slamX: 0, slamZ: 0, recoverT: 1.1, whirlRecover: false,
    };
  }

  private spawnWorld(): void {
    this.enemies = LESSERS.map((l) => this.mkLesser(l.x, l.z));
    this.boss = {
      id: ++this.enemyId, kind: "abbot",
      x: ARENA.x, z: ARENA.z - 6, hp: BOSS_HP, maxHp: BOSS_HP,
      state: "idle", stateT: 0, move: null,
      leapSX: 0, leapSZ: 0, leapTX: 0, leapTZ: 0, leapDur: 0.55,
      frozenT: 0, preFrozen: null, flash: 0, clawN: 0, dashN: 0,
      dashHitDone: false, slamX: 0, slamZ: 0, recoverT: 1.3, whirlRecover: false,
    };
    this.enemies.push(this.boss);
    this.pools = [];
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* ------------------------------------------------------ player actions -- */

  /** LMB — the staff string: jab → backhand → finisher. Builds focus. */
  lightAttack(): void {
    const p = this.player;
    if (this.phase !== "play" && this.phase !== "boss") return;
    if (p.dead || p.dodgeT > 0 || p.staggerT > 0 || p.gourdT > 0) return;
    if (p.attackT > 0) {
      // chain the next swing if pressed late in the current one
      if (p.attackT < p.attackDur * 0.55 && p.attackStage < 3) p.queued = true;
      return;
    }
    this.startSwing(false);
  }

  private startSwing(heavy: boolean): void {
    const p = this.player;
    p.attackHeavy = heavy;
    p.attackHitDone = false;
    p.queued = false;
    if (heavy) {
      const spec = p.stance === "smash" ? HEAVY_SMASH : HEAVY_POKE;
      p.attackDur = spec.dur;
      p.attackStage = 0;
      p.focus -= 1;
    } else {
      p.attackStage = this.time - p.chainEndT < CHAIN_WINDOW ? (p.attackStage % 3) + 1 : 1;
      p.attackDur = LIGHT_DUR;
    }
    p.attackT = p.attackDur;
    this.events.onSwing?.(heavy ? "heavy" : "light");
  }

  /** RMB — the focus heavy. Smash = wide slam, poke = long thrust. */
  heavyAttack(): void {
    const p = this.player;
    if (this.phase !== "play" && this.phase !== "boss") return;
    if (p.dead || p.attackT > 0 || p.dodgeT > 0 || p.staggerT > 0 || p.gourdT > 0) return;
    if (p.focus < 1) return; // no bead, no slam
    this.startSwing(true);
  }

  /** Space — the dodge. i-frames; a fresh dodge under an incoming hit is PERFECT. */
  dodge(moveX: number, moveZ: number): void {
    const p = this.player;
    if (this.phase !== "play" && this.phase !== "boss") return;
    if (p.dead || p.dodgeT > 0 || p.staggerT > 0) return;
    p.dodgeT = DODGE_DUR;
    const mag = Math.hypot(moveX, moveZ);
    if (mag > 0.01) {
      p.dodgeDX = moveX / mag;
      p.dodgeDZ = moveZ / mag;
    } else {
      p.dodgeDX = -Math.sin(p.heading);
      p.dodgeDZ = -Math.cos(p.heading);
    }
    p.attackT = 0;
    p.queued = false;
    this.events.onDodge?.();
  }

  /** C — smash ↔ poke. The heavy's timing changes; poke punishes the dash. */
  swapStance(): void {
    const p = this.player;
    if (p.dead) return;
    p.stance = p.stance === "smash" ? "poke" : "smash";
    this.events.onStance?.(p.stance);
  }

  /** Q — IMMOBILIZE. Freeze one mid-leap; the seal blooms. */
  immobilize(): void {
    const p = this.player;
    if ((this.phase !== "play" && this.phase !== "boss") || p.dead) return;
    if (this.immobilizeCD > 0) return;
    const t = (this.lockTarget && this.lockTarget.state !== "dead" && this.distToPlayer(this.lockTarget) < 15)
      ? this.lockTarget
      : this.nearestEnemy(14);
    if (!t) return;
    this.immobilizeCD = IMMOBILIZE_CD;
    t.frozenT = t.kind === "abbot" ? IMMOBILIZE_BOSS_T : IMMOBILIZE_T;
    this.events.onImmobilize?.(t);
  }

  /** F — a sip from the gourd. */
  drinkGourd(): void {
    const p = this.player;
    if (p.dead || p.gourdT > 0 || p.hp >= PLAYER_HP) return;
    if (p.gourd <= 0) {
      this.events.onGourdEmpty?.();
      return;
    }
    p.gourd--;
    p.gourdT = GOURD_SIP;
    p.hp = Math.min(PLAYER_HP, p.hp + GOURD_HEAL);
    this.events.onGourd?.(p.gourd);
  }

  /** Tab — lock on to the nearest living enemy (or clear). */
  lockOn(): void {
    if (this.lockTarget) {
      this.lockTarget = null;
      this.events.onLockOn?.(false);
      return;
    }
    const t = this.nearestEnemy(30);
    if (t) {
      this.lockTarget = t;
      this.events.onLockOn?.(true);
    }
  }

  /** E — rest at an incense shrine: refill, checkpoint, the world resets. */
  rest(): void {
    const p = this.player;
    if (this.phase !== "play" || p.dead) return;
    for (const [name, s] of [["start", SHRINE_START], ["gate", SHRINE_GATE]] as const) {
      if (Math.hypot(p.x - s.x, p.z - s.z) < 3) {
        this.lastShrine = name;
        p.hp = PLAYER_HP;
        p.gourd = GOURD_MAX;
        // resting returns the lessers to the court (classic)
        if (this.enemies.some((e) => e.kind === "lesser" && e.state === "dead")) {
          const bossKept = { hp: this.boss.hp, phase: this.bossPhase };
          this.spawnWorld();
          this.boss.hp = bossKept.hp;
          this.bossPhase = bossKept.phase;
          this.lockTarget = null;
        }
        this.events.onShrine?.(name);
        return;
      }
    }
  }

  /* --------------------------------------------------------- combat core -- */

  private canBeHit(e: Enemy): boolean {
    return e.state !== "dead";
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (!this.canBeHit(e)) continue;
      const d = this.distToPlayer(e);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  distToPlayer(e: Enemy): number {
    return Math.hypot(e.x - this.player.x, e.z - this.player.z);
  }

  /** the swing lands — range + facing cone, focus and combo bookkeeping */
  private applySwing(): void {
    const p = this.player;
    const heavy = p.attackHeavy;
    const spec = heavy ? (p.stance === "smash" ? HEAVY_SMASH : HEAVY_POKE) : null;
    const range = heavy ? spec!.range : LIGHT_RANGE;
    const minDot = heavy && p.stance === "smash" ? -0.2 : heavy ? 0.55 : 0.25;
    const stage = p.attackStage;
    const kind = heavy ? p.stance : stage === 3 ? "finisher" : "light";
    for (const e of this.enemies) {
      if (!this.canBeHit(e)) continue;
      const d = this.distToPlayer(e);
      if (d > range) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      if (d > 0.3 && (dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / d < minDot) continue;
      let dmg = heavy ? spec!.dmg : LIGHT_DMG[stage - 1];
      // poke punishes the whirlwind recovery
      if (heavy && p.stance === "poke" && e.kind === "abbot" && e.whirlRecover) dmg = Math.round(dmg * POKE_PUNISH_MULT);
      e.hp -= dmg;
      e.flash = 0.25;
      this.events.onHit?.(e, dmg, kind);
      if (heavy) {
        if (e.kind === "lesser") {
          e.state = "stagger";
          e.stateT = 0;
        }
      } else {
        p.focus = Math.min(FOCUS_MAX, p.focus + FOCUS_PER_HIT);
      }
      this.combo++;
      this.comboT = COMBO_WINDOW;
      this.longestCombo = Math.max(this.longestCombo, this.combo);
      this.checkEnemyDeath(e);
    }
  }

  /** an enemy hit connects on the player — dodge windows checked HERE */
  private hurtPlayer(dmg: number, _from: Enemy): void {
    const p = this.player;
    if (p.dead) return;
    if (p.dodgeT > 0) {
      const elapsed = DODGE_DUR - p.dodgeT;
      if (elapsed <= PERFECT_WINDOW) {
        // PERFECT DODGE — slow-mo streak, a focus bead back
        p.focus = Math.min(FOCUS_MAX, Math.floor(p.focus) + 1);
        this.perfectDodges++;
        this.events.onPerfectDodge?.();
      }
      return; // i-frames either way
    }
    p.hp -= dmg;
    this.hitsTaken++;
    this.combo = 0;
    p.staggerT = Math.max(p.staggerT, 0.35);
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) this.die();
  }

  private die(): void {
    const p = this.player;
    p.dead = true;
    this.deaths++;
    this.deadT = 0;
    this.setPhase("dead");
    this.events.onYouDied?.();
  }

  private respawn(): void {
    const p = this.player;
    const s = this.lastShrine === "gate" ? SHRINE_GATE : SHRINE_START;
    p.x = s.x;
    p.z = s.z;
    p.y = heightAt(s.x, s.z);
    p.hp = PLAYER_HP;
    p.gourd = GOURD_MAX;
    p.gourdT = 0;
    p.focus = 0;
    p.attackT = 0;
    p.dodgeT = 0;
    p.staggerT = 0;
    p.dead = false;
    this.combo = 0;
    this.lockTarget = null;
    // the world resets — the Abbot forgives nothing (FULL reset, classic)
    this.spawnWorld();
    this.bossPhase = 1;
    this.setPhase("play");
    this.events.onRespawn?.();
  }

  private checkEnemyDeath(e: Enemy): void {
    if (e.hp > 0 || e.state === "dead") return;
    e.state = "dead";
    if (e.kind === "abbot") {
      this.events.onFelled?.();
      this.setPhase("results");
    }
    this.events.onEnemyDie?.(e);
  }

  /* --------------------------------------------------------- lesser sim -- */

  private updateLesser(e: Enemy, dt: number): void {
    const p = this.player;
    e.flash = Math.max(0, e.flash - dt);
    const d = this.distToPlayer(e);

    switch (e.state) {
      case "idle":
        if (d < 12 && !p.dead) e.state = "engage";
        break;
      case "stagger":
        if (e.stateT > 0.9) {
          e.state = "engage";
          e.stateT = 0;
        }
        break;
      case "engage":
        if (p.dead) {
          e.state = "idle";
          break;
        }
        if (d > 2.2) {
          this.enemyMove(e, p.x, p.z, dt, 3.6, false);
        } else if (d < 1.2) {
          this.enemyMove(e, e.x + (e.x - p.x) + 0.3, e.z + (e.z - p.z) + 0.2, dt, 1.6, false); // hop back
        } else if (e.stateT > 0.6) {
          // the LEAP is the showcase (immobilize it mid-air); swipe up close
          e.move = d < 2.6 && Math.random() < 0.55 ? "swipe" : "leap";
          e.state = "windup";
          e.stateT = 0;
        }
        if (d >= 2.2 && d < 8 && e.stateT > 1.6 && Math.random() < 0.4) {
          e.move = "leap";
          e.state = "windup";
          e.stateT = 0;
        }
        break;
      case "windup": {
        const tele = e.move === "leap" ? 0.55 : 0.42;
        if (e.stateT > tele) {
          if (e.move === "leap") {
            e.leapSX = e.x;
            e.leapSZ = e.z;
            e.leapTX = p.x;
            e.leapTZ = p.z;
            e.leapDur = 0.5;
            e.state = "leap";
          } else {
            e.state = "attack";
            if (d < 2.6) this.hurtPlayer(9, e);
          }
          e.stateT = 0;
        }
        break;
      }
      case "leap": {
        const k = Math.min(1, e.stateT / e.leapDur);
        e.x = e.leapSX + (e.leapTX - e.leapSX) * k;
        e.z = e.leapSZ + (e.leapTZ - e.leapSZ) * k;
        if (k >= 1) {
          e.state = "recover";
          e.stateT = 0;
          e.recoverT = 1.2;
          if (this.distToPlayer(e) < 1.9) this.hurtPlayer(13, e);
        }
        break;
      }
      case "attack":
        if (e.stateT > 0.28) {
          e.state = "recover";
          e.stateT = 0;
          e.recoverT = 0.9;
        }
        break;
      case "recover":
        if (e.stateT > e.recoverT) {
          e.state = "engage";
          e.stateT = 0;
        }
        break;
    }
    e.stateT += dt;
  }

  /* ----------------------------------------------------------- boss sim -- */

  private updateAbbot(e: Enemy, dt: number): void {
    const p = this.player;
    e.flash = Math.max(0, e.flash - dt);
    if (e.state === "idle") {
      // re-engage on the runback
      if (this.fogGatePassed && !p.dead && Math.hypot(p.x - ARENA.x, p.z - ARENA.z) < ARENA.r) {
        e.state = "engage";
        this.setPhase("boss");
      }
      return;
    }
    if (p.dead) return;
    const d = this.distToPlayer(e);

    // phase 2 at 60% — the sword comes out
    if (this.bossPhase === 1 && e.hp <= e.maxHp * PHASE2_AT) {
      this.bossPhase = 2;
      e.state = "recover"; // a breath while the sword is drawn
      e.stateT = 0;
      e.recoverT = 1.2;
      this.events.onBossPhase2?.();
    }

    switch (e.state) {
      case "engage": {
        if (d > 3.2) this.enemyMove(e, p.x, p.z, dt, this.bossPhase === 2 ? 4.4 : 3.6, true);
        else if (d < 1.9) this.enemyMove(e, e.x + (e.x - p.x) + 0.3, e.z + (e.z - p.z) + 0.2, dt, 2.4, true); // give ground
        this.bossMoveCD -= dt;
        if (this.bossMoveCD <= 0) {
          let move: BossMove;
          const roll = Math.random();
          if (this.bossPhase === 1) {
            if (d < 4.4) move = roll < 0.62 ? "claw" : roll < 0.85 ? "bloodslam" : "pounce";
            else if (d < 14) move = roll < 0.5 ? "pounce" : roll < 0.8 ? "bloodslam" : "claw";
            else move = "pounce";
          } else {
            if (d < 4.4) move = roll < 0.4 ? "claw" : roll < 0.68 ? "roar" : roll < 0.86 ? "bloodslam" : "whirlwind";
            else if (d < 15) move = roll < 0.45 ? "whirlwind" : roll < 0.72 ? "pounce" : "bloodslam";
            else move = roll < 0.6 ? "whirlwind" : "pounce";
          }
          e.move = move;
          e.state = "windup";
          e.stateT = 0;
          if (move === "claw") e.clawN = 1;
          if (move === "whirlwind") e.dashN = 1;
          if (move === "bloodslam") {
            e.slamX = p.x;
            e.slamZ = p.z;
          }
          this.events.onBossMove?.(move);
        }
        break;
      }
      case "windup": {
        const k = e.move as BossMove;
        const tele =
          k === "claw" ? (e.clawN === 1 ? 0.52 : 0.36) :
          k === "pounce" ? 0.6 :
          k === "bloodslam" ? 0.9 :
          k === "whirlwind" ? 0.5 : 0.85;
        if (e.stateT > tele) {
          if (k === "pounce") {
            e.leapSX = e.x;
            e.leapSZ = e.z;
            e.leapTX = p.x;
            e.leapTZ = p.z;
            e.leapDur = 0.5;
            e.state = "leap";
          } else if (k === "whirlwind") {
            // dash THROUGH the player, 6m past
            const dx = p.x - e.x;
            const dz = p.z - e.z;
            const dd = Math.hypot(dx, dz) || 1;
            e.leapSX = e.x;
            e.leapSZ = e.z;
            e.leapTX = p.x + (dx / dd) * 6;
            e.leapTZ = p.z + (dz / dd) * 6;
            e.leapDur = 0.3;
            e.dashHitDone = false;
            e.state = "dash";
          } else {
            e.state = "attack";
            this.bossStrike(e, k, d);
          }
          e.stateT = 0;
        }
        break;
      }
      case "leap": { // the pounce
        const k = Math.min(1, e.stateT / e.leapDur);
        e.x = e.leapSX + (e.leapTX - e.leapSX) * k;
        e.z = e.leapSZ + (e.leapTZ - e.leapSZ) * k;
        if (k >= 1) {
          e.state = "recover";
          e.stateT = 0;
          e.recoverT = 1.4;
          if (this.distToPlayer(e) < 2.8) this.hurtPlayer(18, e);
        }
        break;
      }
      case "dash": { // the whirlwind
        const k = Math.min(1, e.stateT / e.leapDur);
        e.x = e.leapSX + (e.leapTX - e.leapSX) * k;
        e.z = e.leapSZ + (e.leapTZ - e.leapSZ) * k;
        if (!e.dashHitDone && this.distToPlayer(e) < 1.9) {
          e.dashHitDone = true;
          this.hurtPlayer(16, e);
        }
        if (k >= 1) {
          if (e.dashN < 3) {
            // wheel around for the next pass
            e.dashN++;
            e.state = "windup";
            e.stateT = 0.32; // a short re-aim beat
            this.events.onBossMove?.("whirlwind");
          } else {
            e.state = "recover";
            e.stateT = 0;
            e.recoverT = 2.5; // THE poke-punish window
            e.whirlRecover = true;
          }
        }
        break;
      }
      case "attack":
        if (e.stateT > 0.3) {
          if (e.move === "claw" && e.clawN < 4) {
            // the string continues
            e.clawN++;
            e.state = "windup";
            e.stateT = 0;
            this.events.onBossMove?.("claw");
          } else {
            e.state = "recover";
            e.stateT = 0;
            // punish the 4th claw; roar recovers fast
            e.recoverT = e.move === "claw" ? 2.3 : e.move === "bloodslam" ? 1.7 : 1.2;
          }
        }
        break;
      case "recover":
        if (e.stateT > e.recoverT) {
          e.state = "engage";
          e.stateT = 0;
          e.whirlRecover = false;
          this.bossMoveCD = this.bossPhase === 2 ? 0.9 : 1.3;
        }
        break;
      case "stagger":
        if (e.stateT > 1.2) {
          e.state = "engage";
          e.stateT = 0;
        }
        break;
    }
    e.stateT += dt;
  }

  private bossStrike(e: Enemy, move: BossMove, d: number): void {
    switch (move) {
      case "claw":
        if (d < 3.6) this.hurtPlayer(12, e);
        break;
      case "bloodslam": {
        const hd = Math.hypot(e.slamX - this.player.x, e.slamZ - this.player.z);
        if (hd < 3.1) this.hurtPlayer(26, e);
        this.pools.push({ x: e.slamX, z: e.slamZ, r: 3.0, t: 4.5 });
        break;
      }
      case "roar":
        if (d < 9) this.hurtPlayer(22, e);
        break;
      default:
        break;
    }
  }

  private enemyMove(e: Enemy, tx: number, tz: number, dt: number, speed: number, boss: boolean): void {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = e.x + (dx / d) * speed * dt;
    const nz = e.z + (dz / d) * speed * dt;
    if (boss ? inArena(nx, nz) : inBounds(nx, nz)) {
      e.x = nx;
      e.z = nz;
    }
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    if (this.phase === "dead") {
      this.deadT += dt;
      if (this.deadT > 2.6) this.respawn();
      return;
    }

    // timers
    p.attackT = Math.max(0, p.attackT - dt);
    p.dodgeT = Math.max(0, p.dodgeT - dt);
    p.staggerT = Math.max(0, p.staggerT - dt);
    p.gourdT = Math.max(0, p.gourdT - dt);
    this.immobilizeCD = Math.max(0, this.immobilizeCD - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;

    // a swing ends — stamp the chain clock FIRST…
    if (p.attackT <= 0 && p.attackDur > 0) {
      if (!p.attackHeavy) p.chainEndT = this.time;
      p.attackDur = 0;
    }
    // …THEN a queued swing follows through (so the chain reads fresh)
    if (p.queued && p.attackT <= 0 && !p.dead && p.dodgeT <= 0) {
      this.startSwing(false);
    }

    // movement (dodge dash overrides; sipping slows)
    const mag = Math.hypot(move.x, move.z);
    if (p.dodgeT > 0 && !p.dead) {
      const nx = p.x + p.dodgeDX * (DODGE_DASH / DODGE_DUR) * dt;
      const nz = p.z + p.dodgeDZ * (DODGE_DASH / DODGE_DUR) * dt;
      if (inBounds(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
      p.heading = Math.atan2(p.dodgeDX, p.dodgeDZ);
    } else if (mag > 0.01 && !p.dead && p.staggerT <= 0) {
      let spd = WALK;
      if (p.attackT > 0) spd *= 0.3;
      if (p.gourdT > 0) spd *= 0.45;
      const nx = p.x + (move.x / mag) * spd * dt;
      const nz = p.z + (move.z / mag) * spd * dt;
      if (inBounds(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
      if (this.lockTarget && this.lockTarget.state !== "dead") {
        p.heading = Math.atan2(this.lockTarget.x - p.x, this.lockTarget.z - p.z);
      } else {
        p.heading = Math.atan2(move.x, move.z);
      }
    } else if (this.lockTarget && this.lockTarget.state !== "dead" && !p.dead) {
      p.heading = Math.atan2(this.lockTarget.x - p.x, this.lockTarget.z - p.z);
    }
    if (this.lockTarget?.state === "dead") this.lockTarget = null;

    // swings land mid-swing
    if (p.attackT > 0 && !p.attackHitDone) {
      const hitAt = p.attackHeavy
        ? (p.stance === "smash" ? HEAVY_SMASH.hitAt : HEAVY_POKE.hitAt)
        : 0.2;
      if (p.attackDur - p.attackT >= hitAt) {
        p.attackHitDone = true;
        this.applySwing();
      }
    }

    // blood pools burn
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pool = this.pools[i];
      pool.t -= dt;
      if (pool.t <= 0) {
        this.pools.splice(i, 1);
        continue;
      }
      if (!p.dead && p.dodgeT <= 0 && Math.hypot(p.x - pool.x, p.z - pool.z) < pool.r) {
        p.hp -= 9 * dt;
        if (p.hp <= 0) this.die();
      }
    }

    // fog curtain → the Abbot
    if (!this.fogGatePassed && pastGate(p.z)) {
      this.fogGatePassed = true;
      this.boss.state = "engage";
      this.setPhase("boss");
      this.events.onFogGate?.();
    }

    // enemies (frozen ones simply do not advance — mid-leap and all)
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      if (e.frozenT > 0) {
        e.frozenT -= dt;
        continue;
      }
      if (e.kind === "lesser") this.updateLesser(e, dt);
      else this.updateAbbot(e, dt);
    }
    p.y = heightAt(p.x, p.z);
  }

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  teleport(x: number, z: number): void {
    const p = this.player;
    p.x = x;
    p.z = z;
    p.y = heightAt(x, z);
  }

  teleportBeat(beat: "shrine" | "court" | "gate" | "boss"): void {
    const spots = {
      shrine: { x: SHRINE_START.x, z: SHRINE_START.z - 4 },
      court: { x: COURT.x, z: COURT.z + 12 },
      gate: { x: FOG_GATE.x, z: FOG_GATE.z + 8 },
      boss: { x: ARENA.x, z: ARENA.z + 12 },
    };
    const s = spots[beat];
    this.teleport(s.x, s.z);
  }

  setBossPhase(n: 1 | 2): void {
    this.bossPhase = n;
    if (n === 2) this.boss.hp = Math.min(this.boss.hp, Math.floor(this.boss.maxHp * PHASE2_AT));
  }

  bossHp(n: number): void {
    this.boss.hp = n;
  }

  killPlayer(): void {
    this.player.hp = 0;
    this.die();
  }

  giveFocus(n = 3): void {
    this.player.focus = Math.min(FOCUS_MAX, n);
  }

  /** force the nearest lesser into its leap windup (shot 04: freeze it mid-air) */
  debugLesserLeap(): Enemy | null {
    const e = this.nearestEnemy(20);
    if (!e || e.kind !== "lesser") return null;
    // stage it close — the leap covers ~4.5m, dead into the camera's lap
    e.x = this.player.x + Math.sin(this.player.heading) * 4.5;
    e.z = this.player.z + Math.cos(this.player.heading) * 4.5;
    e.move = "leap";
    e.state = "windup";
    e.stateT = 0;
    return e;
  }

  /** force a lesser swipe windup point-blank (shot 05: dodge through it) */
  debugLesserSwipe(): Enemy | null {
    const e = this.nearestEnemy(20);
    if (!e || e.kind !== "lesser") return null;
    e.x = this.player.x + Math.sin(this.player.heading) * 2.0;
    e.z = this.player.z + Math.cos(this.player.heading) * 2.0;
    e.move = "swipe";
    e.state = "windup";
    e.stateT = 0;
    return e;
  }

  /** force a boss move's windup now (shots 06/07) */
  debugBossMove(move: BossMove): void {
    const b = this.boss;
    if (b.state === "dead") return;
    b.move = move;
    b.state = "windup";
    b.stateT = 0;
    if (move === "claw") b.clawN = 1;
    if (move === "whirlwind") b.dashN = 1;
    if (move === "bloodslam") {
      b.slamX = this.player.x;
      b.slamZ = this.player.z;
    }
    this.events.onBossMove?.(move);
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.boss.hp = 0;
    this.deaths = Math.max(this.deaths, 2);
    this.perfectDodges = Math.max(this.perfectDodges, 7);
    this.longestCombo = Math.max(this.longestCombo, 14);
    this.time = Math.max(this.time, 545);
    this.events.onFelled?.();
    this.setPhase("results");
  }
}
