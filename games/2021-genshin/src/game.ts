/**
 * game.ts — GALE MEADOW game logic. RENDER-FREE (§2.4): stamina
 * (run/glide/climb), the two-stance combat core (wind blade / flame
 * arcs), skills and bursts, the SWIRL reaction (flame meets wind), the
 * mosslunk camp, the Ruin Warden boss brain (3 tells + vulnerability
 * windows), perfect-dodge detection, glide rings, quest beats, stats.
 * main.ts maps state + events to presentation. One direction only.
 *
 * The 10-minute promise: camp fight ~1:00–3:30, climb ~4:00, glide
 * ~4:30, Warden engaged ~5:00, felled by ~9:00, chest + results ~9:30.
 */
import { CAMP, CLIFF, ARENA, RINGS, SPAWN, heightAt, onClimbWall, inArena, inBounds } from "./meadow";

export type Phase = "title" | "play" | "boss" | "results";
export type Stance = 1 | 2; // 1 wind blade, 2 flame

/* ------------------------------------------------------------- tuning -- */

const RUN = 7.2;
const GRAVITY = 22;
const JUMP_V = 8.5;
const GLIDE_FALL = 2.6;
const GLIDE_SPEED = 9.5;
const GLIDE_DRAIN = 8;
const CLIMB_SPEED = 3.2;
const CLIMB_DRAIN = 11;
const STAMINA_REGEN = 22;
const DODGE_IFRAME = 0.36;
const DODGE_CD = 0.8;
const PLAYER_HP = 100;

const COMBO = {
  1: { dmg: [8, 8, 12], interval: [0.26, 0.26, 0.4], range: 2.7 },   // wind: fast
  2: { dmg: [12, 14, 20], interval: [0.38, 0.38, 0.55], range: 3.0 }, // flame: slower, pyro
};
const SKILL_CD = 6;
const VORTEX_DMG = 15;
const RING_DMG = 22;
const BURST_DMG = 46;
const SWIRL_DMG = 26;
const PYRO_T = 4.5;

const MOB_HP = 60;
const BOSS_HP = 420;

/* --------------------------------------------------------------- mobs -- */

export interface Mob {
  id: number;
  x: number; z: number; y: number;
  hp: number;
  pyroUntil: number;
  attackCD: number;
  flash: number;
  pullX: number; pullZ: number; pullT: number; // vortex drag
  dead: boolean;
}

export type BossState = "dormant" | "intro" | "approach" | "teleSpin" | "spin" | "core" | "teleVolley" | "volley" | "teleSlam" | "slam" | "recover" | "dead";

export interface Missile { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; dead: boolean }

export interface Boss {
  x: number; z: number; heading: number;
  hp: number; maxHp: number;
  state: BossState; stateT: number;
  missiles: Missile[];
  volleyLeft: number;
  spinHitT: number;
  coreOut: boolean;
  pyroUntil: number;
}

/* -------------------------------------------------------------- events -- */

export type DmgKind = "wind" | "pyro" | "swirl" | "core" | "plain";

export interface GameEvents {
  onPhase?(p: Phase): void;
  onHit?(x: number, z: number, dmg: number, kind: DmgKind): void;
  onSwirl?(x: number, z: number, dmg: number): void;
  onMobDie?(m: Mob): void;
  onSkill?(stance: Stance): void;
  onBurst?(stance: Stance): void;
  onDodge?(): void;
  onPerfectDodge?(): void;
  onPlayerHit?(dmg: number): void;
  onBossTelegraph?(kind: "spin" | "volley" | "slam"): void;
  onCore?(exposed: boolean): void;
  onMissile?(m: Missile): void;
  onRing?(): void;
  onGlide?(open: boolean): void;
  onClimb?(on: boolean): void;
  onLand?(): void;
  onQuest?(stage: number): void;
  onChest?(): void;
  onWin?(): void;
  onRespawn?(): void;
  onStep?(): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: SPAWN.x, z: SPAWN.z, y: 0, vy: 0, heading: Math.PI,
    hp: PLAYER_HP, stamina: 100, energy: 30,
    stance: 1 as Stance,
    grounded: true, gliding: false, climbing: false,
    dodgeT: 0, dodgeCD: 0,
    comboStep: 0, comboT: 0, skillCD: 0,
  };

  mobs: Mob[] = [];
  boss: Boss = {
    x: ARENA.x, z: ARENA.z - 12, heading: 0,
    hp: BOSS_HP, maxHp: BOSS_HP,
    state: "dormant", stateT: 0,
    missiles: [], volleyLeft: 0, spinHitT: 0, coreOut: false,
    pyroUntil: 0,
  };

  quest = 0;
  deaths = 0;
  damageDealt = 0;
  biggestSwirl = 0;
  chests = 0;
  chestSpawned = false;
  won = false;

  private stepAcc = 0;
  private burstT = 0;        // burst damage-over-time window
  private burstStance: Stance = 1;

  /* ------------------------------------------------------------ phases -- */

  start(): void {
    if (this.phase !== "title") return;
    const p = this.player;
    p.y = heightAt(p.x, p.z);
    // the camp: four mosslunks around their fire
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.mobs.push({
        id: i, x: CAMP.x + Math.cos(a) * 6, z: CAMP.z + Math.sin(a) * 6,
        y: 0, hp: MOB_HP, pyroUntil: 0, attackCD: 1 + i * 0.4,
        flash: 0, pullX: 0, pullZ: 0, pullT: 0, dead: false,
      });
    }
    this.setPhase("play");
    this.events.onQuest?.(0);
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* ------------------------------------------------------------- combat -- */

  /** LMB: combo swing in the current stance. */
  attack(): void {
    const p = this.player;
    if (this.phase !== "play" && this.phase !== "boss") return;
    if (p.climbing || p.gliding) return;
    if (p.comboT > 0) return;
    const c = COMBO[p.stance];
    const step = p.comboStep % 3;
    p.comboStep++;
    p.comboT = c.interval[step];
    const dmg = c.dmg[step];
    this.meleeHit(dmg, c.range, p.stance === 2 ? "pyro" : "wind");
  }

  private meleeHit(dmg: number, range: number, element: "wind" | "pyro"): void {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    let hitAny = false;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const dx = m.x - p.x;
      const dz = m.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > range || (dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      this.applyHit(m, dmg, element);
      hitAny = true;
    }
    // the boss takes melee too
    const b = this.boss;
    if ((b.state !== "dormant" && b.state !== "dead") && Math.hypot(b.x - p.x, b.z - p.z) < range + 1.4) {
      this.hitBoss(dmg, element);
      hitAny = true;
    }
    if (hitAny) p.energy = Math.min(100, p.energy + 4);
  }

  private applyHit(m: Mob, dmg: number, element: "wind" | "pyro"): void {
    const p = this.player;
    // swirl: pyro-tagged and wind hits it
    if (element === "wind" && m.pyroUntil > this.time) {
      m.pyroUntil = 0;
      const swirl = SWIRL_DMG;
      this.biggestSwirl = Math.max(this.biggestSwirl, swirl);
      m.hp -= swirl;
      p.energy = Math.min(100, p.energy + 12);
      this.events.onSwirl?.(m.x, m.z, swirl);
    } else {
      if (element === "pyro") m.pyroUntil = this.time + PYRO_T;
      this.events.onHit?.(m.x, m.z, dmg, element);
    }
    m.hp -= dmg;
    m.flash = 0.2;
    this.damageDealt += dmg;
    if (m.hp <= 0 && !m.dead) {
      m.dead = true;
      this.events.onMobDie?.(m);
      if (this.mobs.every((o) => o.dead) && this.quest === 0) {
        this.quest = 1;
        this.events.onQuest?.(1);
      }
    }
  }

  /** E — the stance skill. */
  skill(): void {
    const p = this.player;
    if ((this.phase !== "play" && this.phase !== "boss") || p.skillCD > 0) return;
    p.skillCD = SKILL_CD;
    this.events.onSkill?.(p.stance);
    if (p.stance === 1) {
      // pull vortex 7m ahead: drag mobs in, wind damage
      const vx = p.x + Math.sin(p.heading) * 7;
      const vz = p.z + Math.cos(p.heading) * 7;
      for (const m of this.mobs) {
        if (m.dead) continue;
        if (Math.hypot(m.x - vx, m.z - vz) < 9) {
          m.pullX = vx;
          m.pullZ = vz;
          m.pullT = 1.5;
          this.applyHit(m, VORTEX_DMG, "wind");
        }
      }
      if (Math.hypot(this.boss.x - vx, this.boss.z - vz) < 9) this.hitBoss(VORTEX_DMG, "wind");
    } else {
      // flame burst ring around the player
      for (const m of this.mobs) {
        if (m.dead) continue;
        if (Math.hypot(m.x - p.x, m.z - p.z) < 6) this.applyHit(m, RING_DMG, "pyro");
      }
      if (Math.hypot(this.boss.x - p.x, this.boss.z - p.z) < 7) this.hitBoss(RING_DMG, "pyro");
    }
  }

  /** Q — the elemental burst (needs full energy). */
  burst(): void {
    const p = this.player;
    if ((this.phase !== "play" && this.phase !== "boss") || p.energy < 100) return;
    p.energy = 0;
    this.burstT = 1.4;
    this.burstStance = p.stance;
    this.events.onBurst?.(p.stance);
  }

  private burstTick(dt: number): void {
    if (this.burstT <= 0) return;
    this.burstT -= dt;
    const p = this.player;
    const tickDmg = BURST_DMG * dt * 2.2; // spread over the window
    const element = this.burstStance === 1 ? "wind" : "pyro";
    const cx = p.x + Math.sin(p.heading) * 5;
    const cz = p.z + Math.cos(p.heading) * 5;
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (Math.hypot(m.x - cx, m.z - cz) < 8) {
        if (element === "wind") {
          m.pullX = cx;
          m.pullZ = cz;
          m.pullT = 0.5;
        }
        this.applyHit(m, tickDmg, element);
      }
    }
    if (Math.hypot(this.boss.x - cx, this.boss.z - cz) < 9) this.hitBoss(tickDmg, element);
  }

  private hitBoss(dmg: number, element: "wind" | "pyro"): void {
    const b = this.boss;
    if (b.state === "dormant" || b.state === "dead") return;
    let mult = 1;
    if (b.coreOut) mult = 3;
    let final = dmg * mult;
    // swirl vs the boss: it carries pyro from flame hits
    if (element === "wind" && b.pyroUntil > this.time) {
      b.pyroUntil = 0;
      final += SWIRL_DMG * mult;
      this.biggestSwirl = Math.max(this.biggestSwirl, Math.round(final));
      this.events.onSwirl?.(b.x, b.z, Math.round(final));
    } else if (element === "pyro") {
      b.pyroUntil = this.time + PYRO_T;
    }
    final = Math.round(final);
    b.hp -= final;
    this.damageDealt += final;
    this.events.onHit?.(b.x, b.z, final, b.coreOut ? "core" : element);
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = "dead";
      this.onBossDown();
    }
  }

  /** Shift — dodge dash with i-frames. */
  dodge(): void {
    const p = this.player;
    if (p.dodgeCD > 0 || p.climbing) return;
    p.dodgeCD = DODGE_CD;
    p.dodgeT = DODGE_IFRAME;
    this.events.onDodge?.();
  }

  private hurtPlayer(dmg: number, attackKind: "spin" | "missile" | "slam" | "mob"): void {
    const p = this.player;
    if (p.hp <= 0) return;
    if (p.dodgeT > 0) {
      // PERFECT DODGE — the hit connected inside i-frames
      if (attackKind !== "mob") {
        p.energy = Math.min(100, p.energy + 25);
        this.events.onPerfectDodge?.();
      }
      return;
    }
    p.hp = Math.max(0, p.hp - dmg);
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) {
      this.deaths++;
      this.events.onRespawn?.();
      // walk it off: back at the arena edge / spawn, boss keeps its HP
      if (this.phase === "boss") {
        p.x = ARENA.x;
        p.z = ARENA.z + ARENA.r + 8;
      } else {
        p.x = SPAWN.x;
        p.z = SPAWN.z;
      }
      p.hp = PLAYER_HP;
      p.y = heightAt(p.x, p.z);
    }
  }

  setStance(s: Stance): void {
    this.player.stance = s;
  }

  /* ------------------------------------------------------------- boss -- */

  private onBossDown(): void {
    this.quest = 4;
    this.events.onQuest?.(4);
    this.chestSpawned = true;
    this.events.onChest?.();
  }

  /** E at the victory chest → results */
  claimChest(): boolean {
    if (!this.chestSpawned || this.won) return false;
    const p = this.player;
    if (Math.hypot(p.x - ARENA.x, p.z - ARENA.z) > 4) return false;
    this.chests++;
    this.won = true;
    this.setPhase("results");
    this.events.onWin?.();
    return true;
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    const p = this.player;
    if (b.state === "dormant") {
      if (this.phase === "play" && inArena(p.x, p.z)) {
        this.setPhase("boss");
        b.state = "intro";
        b.stateT = 0;
        if (this.quest < 3) {
          this.quest = 3;
          this.events.onQuest?.(3);
        }
      }
      return;
    }
    if (b.state === "dead") return;
    b.stateT += dt;
    const d = Math.hypot(p.x - b.x, p.z - b.z);

    switch (b.state) {
      case "intro":
        if (b.stateT > 1.6) this.toState("approach");
        break;
      case "approach":
        b.heading = Math.atan2(p.x - b.x, p.z - b.z);
        b.x += Math.sin(b.heading) * 3.1 * dt;
        b.z += Math.cos(b.heading) * 3.1 * dt;
        if (d < 5) this.toState("teleSlam");
        else if (b.stateT > 2.2) this.toState(Math.random() < 0.55 ? "teleSpin" : "teleVolley");
        break;
      case "teleSpin":
        if (b.stateT === dt) this.events.onBossTelegraph?.("spin");
        if (b.stateT > 0.9) this.toState("spin");
        break;
      case "spin":
        b.heading = Math.atan2(p.x - b.x, p.z - b.z);
        b.x += Math.sin(b.heading) * 8.5 * dt;
        b.z += Math.cos(b.heading) * 8.5 * dt;
        b.spinHitT -= dt;
        if (d < 3.4 && b.spinHitT <= 0) {
          b.spinHitT = 0.5;
          this.hurtPlayer(16, "spin");
        }
        if (b.stateT > 2.3) {
          // the spin winds down — CORE EXPOSED
          b.coreOut = true;
          this.events.onCore?.(true);
          this.toState("core");
        }
        break;
      case "core":
        if (b.stateT > 4.2) {
          b.coreOut = false;
          this.events.onCore?.(false);
          this.toState("recover");
        }
        break;
      case "teleVolley":
        if (b.stateT === dt) this.events.onBossTelegraph?.("volley");
        if (b.stateT > 0.8) {
          b.volleyLeft = 6;
          this.toState("volley");
        }
        break;
      case "volley":
        if (b.volleyLeft > 0 && Math.floor(b.stateT / 0.28) > 6 - b.volleyLeft) {
          b.volleyLeft--;
          const m: Missile = {
            x: b.x, y: heightAt(b.x, b.z) + 4.2, z: b.z,
            vx: 0, vy: 7, vz: 0, t: 0, dead: false,
          };
          b.missiles.push(m);
          this.events.onMissile?.(m);
        }
        if (b.stateT > 2.2) this.toState("recover");
        break;
      case "teleSlam":
        if (b.stateT === dt) this.events.onBossTelegraph?.("slam");
        if (b.stateT > 0.7) this.toState("slam");
        break;
      case "slam":
        if (b.stateT > 0.25 && d < 4.2) {
          this.hurtPlayer(15, "slam");
          this.toState("recover");
        } else if (b.stateT > 0.4) this.toState("recover");
        break;
      case "recover":
        if (b.stateT > 1.2) this.toState("approach");
        break;
    }
    b.heading = Math.atan2(p.x - b.x, p.z - b.z);

    // missiles: slow homing, pillar-blockable
    for (const m of b.missiles) {
      if (m.dead) continue;
      m.t += dt;
      const tx = p.x - m.x;
      const ty = p.y + 1 - m.y;
      const tz = p.z - m.z;
      const td = Math.hypot(tx, ty, tz) || 1;
      const spd = 13;
      m.vx += ((tx / td) * spd - m.vx) * Math.min(1, dt * 2.2);
      m.vy += ((ty / td) * spd - m.vy) * Math.min(1, dt * 2.2);
      m.vz += ((tz / td) * spd - m.vz) * Math.min(1, dt * 2.2);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      if (m.t > 5 || m.y < heightAt(m.x, m.z)) m.dead = true;
      if (Math.hypot(m.x - p.x, m.y - (p.y + 1), m.z - p.z) < 1.1) {
        m.dead = true;
        this.hurtPlayer(10, "missile");
      }
    }
    b.missiles = b.missiles.filter((m) => !m.dead);
  }

  private toState(s: BossState): void {
    this.boss.state = s;
    this.boss.stateT = 0;
    this.boss.spinHitT = 0;
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }, jumpHeld: boolean): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    p.comboT = Math.max(0, p.comboT - dt);
    p.skillCD = Math.max(0, p.skillCD - dt);
    p.dodgeCD = Math.max(0, p.dodgeCD - dt);
    p.dodgeT = Math.max(0, p.dodgeT - dt);

    /* ---- movement ---- */
    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01 && !p.climbing) {
      const spd = RUN * (p.gliding ? GLIDE_SPEED / RUN : 1);
      const nx = p.x + (move.x / mag) * spd * dt * (p.gliding ? 1 : 1);
      const nz = p.z + (move.z / mag) * spd * dt;
      if (inBounds(nx, nz)) {
        p.x = nx;
        p.z = nz;
      }
      p.heading = Math.atan2(move.x, move.z);
      if (p.grounded) {
        this.stepAcc += RUN * dt;
        if (this.stepAcc > 2.2) {
          this.stepAcc = 0;
          this.events.onStep?.();
        }
      }
    }
    if (p.gliding) {
      // glide keeps drifting forward even with no input
      p.x += Math.sin(p.heading) * GLIDE_SPEED * 0.55 * dt;
      p.z += Math.cos(p.heading) * GLIDE_SPEED * 0.55 * dt;
    }

    /* ---- vertical: ground / climb / glide ---- */
    const ground = heightAt(p.x, p.z);
    const wasAirborne = !p.grounded && !p.gliding && !p.climbing;

    if (p.climbing) {
      p.stamina = Math.max(0, p.stamina - CLIMB_DRAIN * dt);
      p.y += CLIMB_SPEED * dt;
      if (!onClimbWall(p.x, p.z) || p.stamina <= 0) {
        p.climbing = false;
        this.events.onClimb?.(false);
      }
      // mantle at the top
      if (p.y >= heightAt(p.x, p.z + 2)) {
        p.climbing = false;
        p.z += 2.4;
        p.y = heightAt(p.x, p.z);
        p.vy = 0;
        this.events.onClimb?.(false);
        if (this.quest === 1) {
          this.quest = 2;
          this.events.onQuest?.(2);
        }
      }
    } else if (p.gliding) {
      p.stamina = Math.max(0, p.stamina - GLIDE_DRAIN * dt);
      p.y -= GLIDE_FALL * dt;
      // updraft rings
      for (const r of RINGS) {
        if (Math.hypot(p.x - r.x, p.z - r.z) < r.r && Math.abs(p.y - r.y) < 3.5) {
          p.y += 5.5;
          p.stamina = Math.min(100, p.stamina + 30);
          this.events.onRing?.();
          if (this.quest === 2) {
            this.quest = 3;
            this.events.onQuest?.(3);
          }
        }
      }
      if (p.stamina <= 0 || p.y <= ground + 0.1) {
        p.gliding = false;
        p.y = Math.max(ground, p.y);
        this.events.onGlide?.(false);
        this.events.onLand?.();
      }
    } else {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= ground) {
        p.y = ground;
        p.vy = 0;
        if (!p.grounded && wasAirborne) this.events.onLand?.();
        p.grounded = true;
      } else {
        p.grounded = false;
      }
      // jump / climb-grab / glide-open on Space
      if (jumpHeld) {
        if (p.grounded) {
          p.vy = JUMP_V;
          p.grounded = false;
        } else if (onClimbWall(p.x, p.z) && p.stamina > 5 && p.y < heightAt(p.x, p.z + 2) + CLIFF.h) {
          if (!p.climbing) this.events.onClimb?.(true);
          p.climbing = true;
          p.vy = 0;
        } else if (!p.grounded && p.vy < 2 && p.stamina > 5) {
          if (!p.gliding) this.events.onGlide?.(true);
          p.gliding = true;
        }
      }
      // stamina regen on the ground
      if (p.grounded) p.stamina = Math.min(100, p.stamina + STAMINA_REGEN * dt);
    }

    /* ---- mobs ---- */
    for (const m of this.mobs) {
      if (m.dead) continue;
      m.flash = Math.max(0, m.flash - dt);
      if (m.pullT > 0) {
        m.pullT -= dt;
        const dx = m.pullX - m.x;
        const dz = m.pullZ - m.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.6) {
          m.x += (dx / d) * 8 * dt;
          m.z += (dz / d) * 8 * dt;
        }
      } else {
        const dx = p.x - m.x;
        const dz = p.z - m.z;
        const d = Math.hypot(dx, dz);
        // leash to the camp unless the player is close
        if (d < 24 && !p.climbing) {
          if (d > 1.8) {
            m.x += (dx / d) * 3.4 * dt;
            m.z += (dz / d) * 3.4 * dt;
          }
          m.attackCD -= dt;
          if (d < 2 && m.attackCD <= 0) {
            m.attackCD = 1.4;
            this.hurtPlayer(8, "mob");
          }
        }
      }
      m.y = heightAt(m.x, m.z);
    }

    this.burstTick(dt);
    this.updateBoss(dt);

    // quest 2 → 3 nudge: reaching the arena floor without rings also counts
    if (this.quest === 2 && inArena(p.x, p.z)) {
      this.quest = 3;
      this.events.onQuest?.(3);
    }
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
    p.vy = 0;
  }

  /** pull the nearest living mob into melee range ahead (e2e) */
  debugPullMob(): void {
    const p = this.player;
    let best: Mob | null = null;
    let bd = Infinity;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) {
      best.x = p.x + Math.sin(p.heading) * 1.8;
      best.z = p.z + Math.cos(p.heading) * 1.8;
    }
  }

  /** stand right in front of the boss (e2e) */
  debugToBoss(): void {
    const p = this.player;
    const b = this.boss;
    p.x = b.x - Math.sin(b.heading) * 3;
    p.z = b.z - Math.cos(b.heading) * 3;
    p.y = heightAt(p.x, p.z);
    p.heading = Math.atan2(b.x - p.x, b.z - p.z);
  }

  setEnergy(n: number): void {
    this.player.energy = n;
  }

  setStanceHook(s: Stance): void {
    this.player.stance = s;
  }

  /** mid-air above the valley, glider open (shot 05) */
  debugGlide(): void {
    const p = this.player;
    p.x = 45;
    p.z = 138;
    p.y = 24;
    p.gliding = true;
    p.grounded = false;
    p.heading = Math.PI + 0.5; // toward the rings
    this.events.onGlide?.(true);
  }

  /** wake the boss in a chosen state (shots 06/07) */
  debugBossState(s: "spin" | "core" | "volley"): void {
    if (this.phase === "title") this.start();
    const b = this.boss;
    if (b.state === "dormant") {
      this.setPhase("boss");
    }
    // center stage, facing the player — the shot reads the tell
    b.x = ARENA.x;
    b.z = ARENA.z - 6;
    b.state = s === "spin" ? "spin" : s === "core" ? "core" : "volley";
    b.stateT = s === "volley" ? 0.1 : 0;
    b.volleyLeft = 6;
    b.coreOut = s === "core";
    if (s === "core") this.events.onCore?.(true);
    if (s === "spin") this.events.onBossTelegraph?.("spin");
  }

  debugKillCamp(): void {
    for (const m of this.mobs) {
      if (!m.dead) {
        m.dead = true;
        this.events.onMobDie?.(m);
      }
    }
    if (this.quest === 0) {
      this.quest = 1;
      this.events.onQuest?.(1);
    }
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.damageDealt = Math.max(this.damageDealt, 4200);
    this.biggestSwirl = Math.max(this.biggestSwirl, 182);
    this.chests = 1;
    this.time = Math.max(this.time, 541);
    this.won = true;
    if (!this.chestSpawned) {
      this.chestSpawned = true;
      this.events.onChest?.();
    }
    this.setPhase("results");
    this.events.onWin?.();
  }
}
