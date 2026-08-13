/**
 * game.ts — GLOOMMOOR game logic. RENDER-FREE (§2.4): stamina rules
 * everything (attack/roll/guard all drain; empty = exhausted), roll
 * i-frames, guard chip + guard-break, RMB-tap parry → riposte windows,
 * lock-on target, soldier packs, the scarab, grace checkpoints, the
 * death → YOU DIED → runback → corpse-recover economy, and the Bridge
 * Warden's two phases with readable telegraphs.
 * main.ts maps state + events to presentation. One direction only.
 *
 * The 10-minute promise: packs teach the moves 1:00–4:00, scarab +
 * gatehouse grace ~4:30, fog gate ~5:00, the Warden falls by ~9:00
 * (die ≤ 2–3 times), GREAT ENEMY FELLED → results.
 */
import {
  GRACE_START, GRACE_GATE, FOG_GATE, BRIDGE, PACKS, SCARAB,
  heightAt, inBounds, pastGate,
} from "./moor";

export type Phase = "title" | "play" | "boss" | "dead" | "results";

/* ------------------------------------------------------------- tuning -- */

const WALK = 4.6;
const SPRINT = 7.4;
const ROLL_DASH = 4.6;
const PLAYER_HP = 100;
const STAM_MAX = 100;
const STAM_REGEN = 30;
const FLASK_HEAL = 45;
const ROLL_IFRAME = 0.4;
const PARRY_WINDOW = 0.28;
const RIPOSTE_DMG = 65;

const SOLDIER_HP = 42;
const BOSS_HP = 600;
const POSTURE_MAX = 100;

export type EnemyKind = "soldier" | "scarab" | "warden";
export type BossMove = "sweep" | "daggers" | "overhead" | "hammer" | "tail";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number; z: number;
  hp: number;
  maxHp: number;
  state: "idle" | "engage" | "windup" | "attack" | "recover" | "stagger" | "flee" | "dead";
  stateT: number;
  attackKind: BossMove | "slash" | "stab" | null;
  posture: number;
  riposteT: number;   // >0: open to a riposte
  flash: number;
  pack: number;       // soldier group (-1 scarab, -2 warden)
  hammerX: number;    // hammer-summon target (telegraphed at windup)
  hammerZ: number;
  recoverT: number;   // punish window length after an attack
}

/* -------------------------------------------------------------- events -- */

export interface GameEvents {
  onPhase?(p: Phase): void;
  onSwing?(heavy: boolean): void;
  onHit?(e: Enemy, dmg: number, riposte: boolean): void;
  onEnemyDie?(e: Enemy): void;
  onRoll?(): void;
  onGuard?(blocked: number): void;
  onGuardBreak?(): void;
  onParry?(e: Enemy): void;
  onRiposte?(e: Enemy): void;
  onPlayerHit?(dmg: number): void;
  onFlask?(left: number): void;
  onGrace?(which: "start" | "gate"): void;
  onHint?(): void;
  onScarab?(): void;
  onFogGate?(): void;
  onBossMove?(move: BossMove): void;
  onBossPhase2?(): void;
  onYouDied?(): void;
  onRespawn?(): void;
  onCorpse?(recovered: number): void;
  onFelled?(): void;
  onLockOn?(on: boolean): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: GRACE_START.x, z: GRACE_START.z, y: 0, heading: Math.PI,
    hp: PLAYER_HP, stamina: STAM_MAX,
    flasks: 3, flaskMax: 3,
    shards: 0,
    attackT: 0, attackHeavy: false, attackHitDone: false,
    rollT: 0, guarding: false, parryT: 0,
    staggerT: 0, exhaustT: 0,
    rmbT: -1,
    dead: false,
  };

  lockTarget: Enemy | null = null;
  enemies: Enemy[] = [];
  boss!: Enemy;
  bossPhase = 1;
  lastGrace: "start" | "gate" = "start";
  corpse: { x: number; z: number; shards: number } | null = null;

  hitsTaken = 0;
  deaths = 0;
  fogGatePassed = false;

  private enemyId = 0;
  private deadT = 0;
  private bossMoveCD = 1.2;

  /* ------------------------------------------------------------- setup -- */

  start(): void {
    if (this.phase !== "title") return;
    this.player.y = heightAt(this.player.x, this.player.z);
    this.spawnWorld();
    this.setPhase("play");
  }

  private spawnWorld(): void {
    this.enemies = [];
    PACKS.forEach((pack, pi) => {
      for (let i = 0; i < pack.n; i++) {
        this.enemies.push({
          id: ++this.enemyId, kind: "soldier",
          x: pack.x + (i - 0.5) * 3, z: pack.z + (i % 2),
          hp: SOLDIER_HP, maxHp: SOLDIER_HP,
          state: "idle", stateT: 0, attackKind: null,
          posture: 0, riposteT: 0, flash: 0, pack: pi,
          hammerX: 0, hammerZ: 0, recoverT: 1.3,
        });
      }
    });
    // the scarab: skitters away when approached; kill = +1 flask
    this.enemies.push({
      id: ++this.enemyId, kind: "scarab",
      x: SCARAB.x, z: SCARAB.z, hp: 1, maxHp: 1,
      state: "idle", stateT: 0, attackKind: null,
      posture: 0, riposteT: 0, flash: 0, pack: -1,
      hammerX: 0, hammerZ: 0, recoverT: 1.3,
    });
    // the warden waits on the bridge
    this.boss = {
      id: ++this.enemyId, kind: "warden",
      x: BRIDGE.x, z: BRIDGE.z - 6, hp: BOSS_HP, maxHp: BOSS_HP,
      state: "idle", stateT: 0, attackKind: null,
      posture: POSTURE_MAX, riposteT: 0, flash: 0, pack: -2,
      hammerX: 0, hammerZ: 0, recoverT: 1.3,
    };
    this.enemies.push(this.boss);
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* ------------------------------------------------------------- combat -- */

  /** LMB — light slash. During a riposte window: THE riposte. */
  lightAttack(): void {
    const p = this.player;
    if (!this.canAct()) return;
    // riposte?
    const target = this.lockTarget ?? this.nearestEnemy(3.2);
    if (target && target.riposteT > 0 && this.distToPlayer(target) < 3.2) {
      target.riposteT = 0;
      target.hp -= RIPOSTE_DMG * (target.kind === "warden" ? 1 : 2);
      target.state = "stagger";
      target.stateT = 0;
      target.flash = 0.3;
      this.events.onRiposte?.(target);
      this.events.onHit?.(target, RIPOSTE_DMG * (target.kind === "warden" ? 1 : 2), true);
      this.checkEnemyDeath(target);
      return;
    }
    if (!this.spend(12)) return;
    p.attackT = 0.42;
    p.attackHeavy = false;
    p.attackHitDone = false;
    this.events.onSwing?.(false);
  }

  /** RMB down — start the tap/hold clock. */
  heavyDown(): void {
    if (!this.canAct()) return;
    this.player.rmbT = 0;
  }

  /** RMB up — tap = parry, hold = charged heavy. */
  heavyUp(): void {
    const p = this.player;
    if (p.rmbT < 0) return;
    const held = p.rmbT;
    p.rmbT = -1;
    if (held < 0.28) {
      // PARRY
      p.parryT = PARRY_WINDOW;
      this.events.onSwing?.(false); // reuse the swing whoosh, lighter
    } else if (this.spend(22)) {
      p.attackT = 0.7;
      p.attackHeavy = true;
      p.attackHitDone = false;
      this.events.onSwing?.(true);
    }
  }

  /** Space — the roll. i-frames, stamina, a dash. */
  roll(): void {
    const p = this.player;
    if (this.phase !== "play" && this.phase !== "boss") return;
    if (p.dead || p.staggerT > 0 || p.rollT > 0) return;
    if (!this.spend(18)) return;
    p.rollT = ROLL_IFRAME;
    p.guarding = false;
    p.attackT = 0;
    this.events.onRoll?.();
  }

  guard(on: boolean): void {
    const p = this.player;
    if (p.dead || p.staggerT > 0) return;
    p.guarding = on && this.phase !== "title";
  }

  /** Q — a flask. */
  flask(): void {
    const p = this.player;
    if (p.dead || p.flasks <= 0 || p.hp >= PLAYER_HP) return;
    p.flasks--;
    p.hp = Math.min(PLAYER_HP, p.hp + FLASK_HEAL);
    this.events.onFlask?.(p.flasks);
  }

  /** Tab — lock on to the nearest enemy in range (or clear). */
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

  private canAct(): boolean {
    const p = this.player;
    return (
      (this.phase === "play" || this.phase === "boss") &&
      !p.dead && p.attackT <= 0 && p.rollT <= 0 && p.staggerT <= 0 && p.exhaustT <= 0
    );
  }

  private spend(n: number): boolean {
    const p = this.player;
    if (p.stamina < n) {
      p.exhaustT = Math.max(p.exhaustT, 0.55); // panting — the discipline
      return false;
    }
    p.stamina -= n;
    return true;
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
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

  /** an enemy hit connects on the player */
  private hurtPlayer(dmg: number, from: Enemy, parryable: boolean): void {
    const p = this.player;
    if (p.dead) return;
    if (p.rollT > 0) return; // i-frames
    if (parryable && p.parryT > 0) {
      // PARRY — the attacker is wide open
      p.parryT = 0;
      from.state = "stagger";
      from.stateT = 0;
      from.riposteT = 2.2;
      this.events.onParry?.(from);
      return;
    }
    if (p.guarding) {
      const chip = Math.round(dmg * 0.3);
      p.hp -= chip;
      p.stamina -= dmg * 0.9;
      this.events.onGuard?.(chip);
      if (p.stamina <= 0) {
        p.stamina = 0;
        p.guarding = false;
        p.staggerT = 1.4;
        this.events.onGuardBreak?.();
      }
      if (p.hp <= 0) this.die();
      return;
    }
    p.hp -= dmg;
    this.hitsTaken++;
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) this.die();
  }

  private die(): void {
    const p = this.player;
    p.dead = true;
    this.deaths++;
    this.deadT = 0;
    // the corpse holds your shards where you fell
    this.corpse = { x: p.x, z: p.z, shards: p.shards };
    p.shards = 0;
    this.setPhase("dead");
    this.events.onYouDied?.();
  }

  private respawn(): void {
    const p = this.player;
    const g = this.lastGrace === "gate" ? GRACE_GATE : GRACE_START;
    p.x = g.x;
    p.z = g.z;
    p.y = heightAt(g.x, g.z);
    p.hp = PLAYER_HP;
    p.stamina = STAM_MAX;
    p.flasks = p.flaskMax;
    p.dead = false;
    p.attackT = 0;
    p.rollT = 0;
    p.staggerT = 0;
    // the world resets; the warden forgives (full HP), soldiers return
    const corpse = this.corpse;
    this.spawnWorld();
    this.corpse = corpse;
    this.bossPhase = 1;
    if (this.phase !== "play") this.setPhase("play");
    this.events.onRespawn?.();
  }

  /** E — rest at a grace / pass the fog gate / nothing else. */
  interact(): void {
    const p = this.player;
    if (this.phase !== "play" || p.dead) return;
    for (const [name, g] of [["start", GRACE_START], ["gate", GRACE_GATE]] as const) {
      if (Math.hypot(p.x - g.x, p.z - g.z) < 2.6) {
        this.lastGrace = name;
        p.hp = PLAYER_HP;
        p.flasks = p.flaskMax;
        // resting respawns the world's soldiers
        const bossState = { hp: this.boss.hp, phase: this.bossPhase };
        const corpse = this.corpse;
        this.spawnWorld();
        this.boss.hp = bossState.hp;
        this.bossPhase = bossState.phase;
        this.corpse = corpse;
        this.events.onGrace?.(name);
        return;
      }
    }
  }

  private checkEnemyDeath(e: Enemy): void {
    if (e.hp > 0 || e.state === "dead") return;
    e.state = "dead";
    if (e.kind === "soldier") this.player.shards += 40;
    if (e.kind === "scarab") {
      this.player.flaskMax = 4;
      this.player.flasks = Math.min(4, this.player.flasks + 1);
      this.events.onScarab?.();
    }
    if (e.kind === "warden") {
      this.player.shards += 2000;
      this.events.onFelled?.();
      this.setPhase("results");
    }
    this.events.onEnemyDie?.(e);
  }

  /* --------------------------------------------------------- enemy sim -- */

  private updateSoldier(e: Enemy, dt: number): void {
    const p = this.player;
    e.flash = Math.max(0, e.flash - dt);
    e.riposteT = Math.max(0, e.riposteT - dt);
    const d = this.distToPlayer(e);

    switch (e.state) {
      case "idle":
        if (d < 13 && !p.dead) {
          e.state = "engage";
        }
        break;
      case "stagger":
        if (e.stateT > 1.1) {
          e.state = "engage";
          e.stateT = 0;
        }
        break;
      case "engage":
        if (p.dead) {
          e.state = "idle";
          break;
        }
        if (d > 1.9) this.enemyMove(e, p.x, p.z, dt, 3.2);
        else if (e.stateT > 0.7) {
          e.state = "windup";
          e.stateT = 0;
          e.attackKind = Math.random() < 0.75 ? "slash" : "stab";
        }
        break;
      case "windup":
        if (e.stateT > 0.55) {
          e.state = "attack";
          e.stateT = 0;
          if (d < 2.6) this.hurtPlayer(e.attackKind === "stab" ? 14 : 10, e, true);
        }
        break;
      case "attack":
        if (e.stateT > 0.3) {
          e.state = "recover";
          e.stateT = 0;
        }
        break;
      case "recover":
        if (e.stateT > 1.0) {
          e.state = "engage";
          e.stateT = 0;
        }
        break;
    }
    e.stateT += dt;
  }

  private updateScarab(e: Enemy, dt: number): void {
    const d = this.distToPlayer(e);
    if (d < 8) {
      // skitter away from the player
      const a = Math.atan2(e.x - this.player.x, e.z - this.player.z);
      this.enemyMove(e, e.x + Math.sin(a) * 5, e.z + Math.cos(a) * 5, dt, 4.5);
    }
  }

  private updateWarden(e: Enemy, dt: number): void {
    const p = this.player;
    e.flash = Math.max(0, e.flash - dt);
    e.riposteT = Math.max(0, e.riposteT - dt);
    if (e.state === "idle" || p.dead) return;
    const d = this.distToPlayer(e);

    // phase 2 at half
    if (this.bossPhase === 1 && e.hp <= e.maxHp / 2) {
      this.bossPhase = 2;
      this.events.onBossPhase2?.();
    }

    switch (e.state) {
      case "stagger":
        if (e.stateT > 2.2) {
          e.state = "recover";
          e.stateT = 0;
        }
        break;
      case "engage": {
        const speed = this.bossPhase === 2 ? 4.3 : 3.4;
        if (d > 3.2) this.enemyMove(e, p.x, p.z, dt, speed);
        this.bossMoveCD -= dt;
        if (this.bossMoveCD <= 0) {
          // pick a move by range, all with clean telegraphs
          let move: BossMove;
          if (d < 4) move = Math.random() < 0.6 ? "sweep" : "overhead";
          else if (d < 13) move = Math.random() < 0.5 ? "daggers" : "sweep";
          else move = "daggers";
          if (this.bossPhase === 2 && Math.random() < 0.35) move = Math.random() < 0.5 ? "hammer" : "tail";
          e.attackKind = move;
          e.state = "windup";
          e.stateT = 0;
          if (move === "hammer") {
            e.hammerX = p.x;
            e.hammerZ = p.z;
          }
          this.events.onBossMove?.(move);
        }
        break;
      }
      case "windup": {
        const k = e.attackKind as BossMove;
        const tele = k === "overhead" ? 1.1 : k === "sweep" ? 0.65 : k === "tail" ? 0.6 : k === "hammer" ? 0.9 : 0.5;
        if (e.stateT > tele) {
          e.state = "attack";
          e.stateT = 0;
          this.bossStrike(e, k, d);
        }
        break;
      }
      case "attack":
        if (e.stateT > 0.35) {
          e.state = "recover";
          e.stateT = 0;
          // the punish window: longer after the overhead
          e.recoverT = e.attackKind === "overhead" ? 2.0 : 1.3;
        }
        break;
      case "recover":
        if (e.stateT > e.recoverT) {
          e.state = "engage";
          e.stateT = 0;
          this.bossMoveCD = this.bossPhase === 2 ? 0.7 : 1.1;
        }
        break;
    }
    e.stateT += dt;
  }

  private bossStrike(e: Enemy, move: BossMove, d: number): void {
    switch (move) {
      case "sweep":
        if (d < 3.6) this.hurtPlayer(16, e, true);
        break;
      case "overhead":
        if (d < 3.2) this.hurtPlayer(24, e, true);
        break;
      case "tail":
        if (d < 4.4) this.hurtPlayer(14, e, false);
        break;
      case "daggers": {
        // three quick throws; dodgeable at range
        if (d < 16) this.hurtPlayer(8, e, false);
        break;
      }
      case "hammer": {
        // the golden hammer falls ON the player's position at the telegraph
        const hd = Math.hypot(e.hammerX - this.player.x, e.hammerZ - this.player.z);
        if (hd < 3.4) this.hurtPlayer(20, e, false);
        break;
      }
    }
  }

  private enemyMove(e: Enemy, tx: number, tz: number, dt: number, speed: number): void {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = e.x + (dx / d) * speed * dt;
    const nz = e.z + (dz / d) * speed * dt;
    if (inBounds(nx, nz)) {
      e.x = nx;
      e.z = nz;
    }
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }, sprint: boolean): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    if (this.phase === "dead") {
      this.deadT += dt;
      if (this.deadT > 3.0) {
        this.setPhase("play");
        this.respawn();
      }
      return;
    }

    // timers
    p.attackT = Math.max(0, p.attackT - dt);
    p.rollT = Math.max(0, p.rollT - dt);
    p.parryT = Math.max(0, p.parryT - dt);
    p.staggerT = Math.max(0, p.staggerT - dt);
    p.exhaustT = Math.max(0, p.exhaustT - dt);
    if (p.rmbT >= 0) p.rmbT += dt;

    // stamina: regen unless busy; guard trickles
    if (p.attackT <= 0 && p.rollT <= 0) {
      p.stamina = Math.min(STAM_MAX, p.stamina + (p.guarding ? 8 : STAM_REGEN) * dt);
    }

    // movement (roll dash overrides; guard slows)
    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01 && !p.dead && p.staggerT <= 0) {
      let spd = sprint ? SPRINT : WALK;
      if (p.guarding) spd *= 0.45;
      if (p.attackT > 0) spd *= 0.3;
      if (p.rollT > 0) spd = ROLL_DASH / ROLL_IFRAME; // the dash
      const nx = p.x + (move.x / mag) * spd * dt;
      const nz = p.z + (move.z / mag) * spd * dt;
      if (inBounds(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
      // facing: lock-on turns you to the target; else face movement
      if (this.lockTarget && this.lockTarget.state !== "dead") {
        p.heading = Math.atan2(this.lockTarget.x - p.x, this.lockTarget.z - p.z);
      } else {
        p.heading = Math.atan2(move.x, move.z);
      }
    } else if (this.lockTarget && this.lockTarget.state !== "dead" && !p.dead) {
      p.heading = Math.atan2(this.lockTarget.x - p.x, this.lockTarget.z - p.z);
    }
    if (this.lockTarget?.state === "dead") this.lockTarget = null;

    // attacks land mid-swing
    if (p.attackT > 0 && !p.attackHitDone) {
      const hitAt = p.attackHeavy ? 0.32 : 0.24;
      if ((p.attackHeavy ? 0.7 : 0.42) - p.attackT >= hitAt) {
        p.attackHitDone = true;
        const dmg = p.attackHeavy ? 24 : 12;
        const posture = p.attackHeavy ? 35 : 15;
        const range = p.attackHeavy ? 3.0 : 2.7;
        for (const e of this.enemies) {
          if (e.state === "dead") continue;
          const d = this.distToPlayer(e);
          if (d > range) continue;
          const dx = e.x - p.x;
          const dz = e.z - p.z;
          if ((dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / (d || 1) < 0.3) continue;
          e.hp -= dmg;
          e.flash = 0.25;
          this.events.onHit?.(e, dmg, false);
          if (e.kind === "scarab") {
            // the scarab pops in one
            e.hp = 0;
          }
          if (e.kind === "warden") {
            e.posture -= posture;
            if (e.posture <= 0 && e.riposteT <= 0) {
              e.posture = POSTURE_MAX;
              e.state = "stagger";
              e.stateT = 0;
              e.riposteT = 2.2;
              this.events.onParry?.(e); // posture break reads like a parry
            }
          } else if (e.kind === "soldier") {
            e.posture += posture;
            if (e.posture >= 60) {
              e.posture = 0;
              e.state = "stagger";
              e.stateT = 0;
              e.riposteT = 1.6;
            }
          }
          this.checkEnemyDeath(e);
        }
      }
    }

    // corpse recovery
    if (this.corpse && !p.dead) {
      if (Math.hypot(p.x - this.corpse.x, p.z - this.corpse.z) < 1.6) {
        p.shards += this.corpse.shards;
        this.events.onCorpse?.(this.corpse.shards);
        this.corpse = null;
      }
    }

    // hint soldier: pack three carries it
    const hintSoldier = this.enemies.find((e) => e.pack === 2 && e.state !== "dead");
    if (!hintSoldier && !this.hintDropped && this.enemies.some((e) => e.pack === 2)) {
      this.hintDropped = true;
      this.events.onHint?.();
    }

    // fog gate → boss phase
    if (!this.fogGatePassed && pastGate(p.z)) {
      this.fogGatePassed = true;
      this.boss.state = "engage";
      this.setPhase("boss");
      this.events.onFogGate?.();
    }

    // enemies
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      if (e.kind === "soldier") this.updateSoldier(e, dt);
      else if (e.kind === "scarab") this.updateScarab(e, dt);
      else this.updateWarden(e, dt);
    }
    p.y = heightAt(p.x, p.z);
  }
  private hintDropped = false;

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

  teleportBeat(beat: "grace" | "pack" | "scarab" | "gate" | "boss"): void {
    const spots = {
      grace: GRACE_START,
      pack: { x: PACKS[0].x, z: PACKS[0].z + 8 },
      scarab: SCARAB,
      gate: { x: FOG_GATE.x, z: FOG_GATE.z + 8 },
      boss: { x: BRIDGE.x, z: BRIDGE.z + 12 },
    };
    const s = spots[beat];
    this.teleport(s.x, s.z);
  }

  setBossPhase(n: 1 | 2): void {
    this.bossPhase = n;
    if (n === 2) this.boss.hp = Math.min(this.boss.hp, this.boss.maxHp / 2);
  }

  bossHp(n: number): void {
    this.boss.hp = n;
  }

  killPlayer(): void {
    this.player.hp = 0;
    this.die();
  }

  giveShards(n: number): void {
    this.player.shards += n;
  }

  /** instantly stagger the boss with a riposte window (shot 06) */
  debugRiposteWindow(): void {
    this.boss.state = "stagger";
    this.boss.stateT = 0;
    this.boss.riposteT = 2.6;
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.boss.hp = 0;
    this.player.shards = Math.max(this.player.shards, 2300);
    this.time = Math.max(this.time, 540);
    this.deaths = Math.max(this.deaths, 2);
    this.hitsTaken = Math.max(this.hitsTaken, 9);
    this.events.onFelled?.();
    this.setPhase("results");
  }
}
