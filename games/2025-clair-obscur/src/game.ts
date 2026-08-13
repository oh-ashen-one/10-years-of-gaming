/**
 * game.ts — OVERPAINT game logic. RENDER-FREE (§2.4): the hybrid battle —
 * YOUR turn is a menu (strike / free-aim weak point / ink lance, AP daubs),
 * the ENEMY turn is real-time: telegraphed brushstrokes you dodge (Space),
 * parry (F, the tighter window — counter splash, gradient stacks) or vault
 * (Space on the cannon's jump marker). The mime's shield breaks on the 3rd
 * parry (gradient/break); the Marionette cycles sweep → jab-jab-slam →
 * gradient cannon; OVERPAINT (Q, full meter) repaints its face for big
 * damage + stagger. Explore: picto pickups, the expedition flag checkpoint,
 * fight triggers. Death → the flag, the fight resets. main.ts presents.
 *
 * The 10-minute promise: valley walk 0:10, brushling lesson 1:00–3:30,
 * the mime's gradient 4:00–5:30, the Marionette 6:00, petals + FOR THOSE
 * WHO COME AFTER by 9:00, results (parry %, damage, turns).
 */
import {
  START, PICTO1, PICTO2, FIGHT1, FIGHT2, FLAG, ARENA,
  BRUSHLINGS, MIME_AT, MARIONETTE_AT, heightAt, inBounds,
} from "./valley";

export type Phase = "title" | "explore" | "battle" | "card" | "results";
export type EnemyKind = "brushling" | "mime" | "marionette";
export type AttackKind = "stroke" | "sweep" | "blade" | "jab" | "cannon";
export type Defense = "either" | "dodge" | "parry" | "jump";

/* ------------------------------------------------------------- tuning -- */

const WALK = 5.4;
const PLAYER_HP = 100;

const AP_PER_TURN = 3;
const COST = { strike: 1, aim: 2, lance: 3 } as const;
const DMG = { strike: 12, lance: 26, aimWeak: 30, aimGraze: 8, overpaint: 60 };
const COUNTER_DMG = 10;

const DODGE_T = 0.32;  // Space: generous
const PARRY_T = 0.2;   // F: the tight one
const AIM_TIME = 2.6;

export const ATTACKS: Record<AttackKind, { defense: Defense; beats: number[]; dmg: number[]; label: string }> = {
  stroke: { defense: "either", beats: [0.95], dmg: [10], label: "THE BRUSHSTROKE — DODGE OR PARRY" },
  sweep: { defense: "dodge", beats: [1.0], dmg: [14], label: "THE SWEEP — SPACE, DODGE!" },
  blade: { defense: "parry", beats: [0.85], dmg: [12], label: "THE BLADE — F, PARRY!" },
  jab: { defense: "parry", beats: [0.6, 0.55, 0.85], dmg: [8, 8, 16], label: "JAB · JAB · SLAM — PARRY THE CHAIN!" },
  cannon: { defense: "jump", beats: [1.25], dmg: [20], label: "GRADIENT CANNON — SPACE ON THE MARKER!" },
};

const BRUSHLING_HP = 36;
const MIME_HP = 120;
const MIME_SHIELD = 3;
const BOSS_HP = 420;

export interface Enemy {
  id: number;
  kind: EnemyKind;
  fight: number; // 1, 2, 3 (boss)
  x: number; z: number;
  hp: number; maxHp: number;
  shield: number;
  state: "waiting" | "alive" | "stagger" | "dying" | "dead";
  stateT: number;
  flash: number;
}

export interface Incoming {
  enemyId: number;
  kind: AttackKind;
  defense: Defense;
  beats: number[];
  beat: number;
  t: number;
  label: string;
}

/* -------------------------------------------------------------- events -- */

export interface GameEvents {
  onPhase?(p: Phase): void;
  onBattleStart?(fight: number): void;
  onTurn?(turn: "player" | "enemy", n: number): void;
  onSwing?(kind: "strike" | "aim" | "lance" | "overpaint"): void;
  onHit?(e: Enemy, dmg: number, kind: string): void;
  onAim?(on: boolean): void;
  onAttackTelegraph?(atk: Incoming): void;
  onAttackBeat?(atk: Incoming, beat: number): void;
  onDodge?(): void;
  onParry?(e: Enemy): void;
  onGradientBreak?(e: Enemy): void;
  onPlayerHit?(dmg: number): void;
  onEnemyDying?(e: Enemy): void;
  onBattleWon?(fight: number): void;
  onPicto?(id: string): void;
  onFlag?(): void;
  onOverpaint?(e: Enemy): void;
  onYouFell?(): void;
  onRespawn?(): void;
  onCard?(): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: START.x, z: START.z - 3, y: 0, heading: Math.PI,
    hp: PLAYER_HP, maxHp: PLAYER_HP,
    dodgeT: 0, parryT: 0,
    dead: false,
  };

  pictos = new Set<string>();
  dmgBonus = 0;
  flagTouched = false;

  /* ---- battle state ---- */
  battle: {
    fight: number;
    turn: "player" | "enemy";
    ap: number;
    queue: number[];          // enemy ids still to act this enemy turn
    incoming: Incoming | null;
    betweenT: number;         // the breath between turns / attacks
  } | null = null;
  aim: { t: number } | null = null;
  aimPhase = 0;
  meter = 0;
  targetIdx = 0;

  enemies: Enemy[] = [];

  /* ---- stats ---- */
  turns = 0;
  damageDealt = 0;
  parryAttempts = 0;
  parriesLanded = 0;
  dodges = 0;
  deaths = 0;

  private enemyId = 0;
  private deadT = 0;
  private wonFights = new Set<number>();

  /* ------------------------------------------------------------- setup -- */

  start(): void {
    if (this.phase !== "title") return;
    this.player.y = heightAt(this.player.x, this.player.z);
    this.spawnWorld();
    this.setPhase("explore");
  }

  private mkEnemy(kind: EnemyKind, fight: number, x: number, z: number, hp: number, shield = 0): Enemy {
    return {
      id: ++this.enemyId, kind, fight, x, z,
      hp, maxHp: hp, shield,
      state: "waiting", stateT: 0, flash: 0,
    };
  }

  private spawnWorld(): void {
    this.enemies = [
      ...BRUSHLINGS.map((b) => this.mkEnemy("brushling", 1, b.x, b.z, BRUSHLING_HP)),
      this.mkEnemy("mime", 2, MIME_AT.x, MIME_AT.z, MIME_HP, MIME_SHIELD),
      this.mkEnemy("marionette", 3, MARIONETTE_AT.x, MARIONETTE_AT.z, BOSS_HP),
    ];
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* --------------------------------------------------------- battle flow -- */

  private beginBattle(fight: number): void {
    for (const e of this.enemies) {
      if (e.fight === fight && e.state === "waiting") e.state = "alive";
    }
    this.battle = { fight, turn: "player", ap: AP_PER_TURN, queue: [], incoming: null, betweenT: 0.8 };
    this.turns++;
    this.targetIdx = 0;
    this.setPhase("battle");
    this.events.onBattleStart?.(fight);
    this.events.onTurn?.("player", this.turns);
  }

  private startEnemyTurn(): void {
    const b = this.battle;
    if (!b) return;
    this.aim = null;
    this.events.onAim?.(false);
    b.turn = "enemy";
    b.queue = this.enemies
      .filter((e) => e.fight === b.fight && (e.state === "alive" || e.state === "stagger"))
      .map((e) => e.id);
    b.incoming = null;
    b.betweenT = 0.7;
    this.events.onTurn?.("enemy", this.turns);
  }

  private startPlayerTurn(): void {
    const b = this.battle!;
    b.turn = "player";
    b.ap = AP_PER_TURN;
    b.incoming = null;
    b.betweenT = 0.5;
    this.turns++;
    this.events.onTurn?.("player", this.turns);
  }

  private launchAttack(e: Enemy): void {
    const b = this.battle!;
    const kind = this.pickAttack(e);
    const spec = ATTACKS[kind];
    b.incoming = {
      enemyId: e.id, kind, defense: spec.defense,
      beats: spec.beats.slice(), beat: 0, t: 0, label: spec.label,
    };
    this.events.onAttackTelegraph?.(b.incoming);
  }

  private pickAttack(e: Enemy): AttackKind {
    if (e.kind === "brushling") return Math.random() < 0.65 ? "stroke" : "sweep";
    if (e.kind === "mime") return Math.random() < 0.7 ? "blade" : "sweep";
    const cycle: AttackKind[] = ["sweep", "jab", "cannon"]; // the readable rotation
    return cycle[this.turns % 3];
  }

  /** a beat's impact lands — the real-time windows are checked HERE */
  private resolveImpact(atk: Incoming): void {
    const p = this.player;
    const spec = ATTACKS[atk.kind];
    const dmg = spec.dmg[atk.beat] ?? spec.dmg[0];
    const e = this.enemies.find((x) => x.id === atk.enemyId)!;
    const canParry = atk.defense === "either" || atk.defense === "parry";
    const canDodge = atk.defense === "either" || atk.defense === "dodge" || atk.defense === "jump";
    if (canParry && p.parryT > 0) {
      // PARRIED — the counter splash
      p.parryT = 0;
      this.parriesLanded++;
      this.meter = Math.min(100, this.meter + 12);
      this.damageEnemy(e, COUNTER_DMG + this.dmgBonus, "counter");
      if (e.kind === "mime" && e.shield > 0 && e.state !== "dying" && e.state !== "dead") {
        e.shield--;
        if (e.shield === 0) {
          e.state = "stagger";
          e.stateT = 0;
          this.events.onGradientBreak?.(e);
        }
      }
      this.events.onParry?.(e);
      return;
    }
    if (canDodge && p.dodgeT > 0) {
      this.dodges++;
      this.meter = Math.min(100, this.meter + 4);
      this.events.onDodge?.();
      return;
    }
    p.hp -= dmg;
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) this.fell();
  }

  private damageEnemy(e: Enemy, dmg: number, kind: string): void {
    if (e.state !== "alive" && e.state !== "stagger") return;
    if (e.shield > 0 && kind !== "counter") dmg = Math.max(1, Math.round(dmg * 0.1)); // the mime's shield
    e.hp -= dmg;
    e.flash = 0.3;
    this.damageDealt += dmg;
    this.events.onHit?.(e, dmg, kind);
    if (e.hp <= 0) {
      e.hp = 0;
      e.state = "dying";
      e.stateT = 0;
      this.events.onEnemyDying?.(e);
    }
  }

  private fell(): void {
    const p = this.player;
    p.dead = true;
    this.deaths++;
    this.deadT = 0;
    this.aim = null;
    this.events.onYouFell?.();
  }

  private respawn(): void {
    const p = this.player;
    const at = this.flagTouched ? FLAG : START;
    p.x = at.x;
    p.z = at.z - 2;
    p.y = heightAt(p.x, p.z);
    p.hp = p.maxHp;
    p.dead = false;
    p.dodgeT = 0;
    p.parryT = 0;
    // the fight resets in full
    const fight = this.battle?.fight ?? 0;
    for (const e of this.enemies) {
      if (e.fight === fight && e.state !== "waiting") {
        e.hp = e.maxHp;
        e.shield = e.kind === "mime" ? MIME_SHIELD : 0;
        e.state = "waiting";
        e.stateT = 0;
      }
    }
    this.battle = null;
    this.meter = 0;
    this.setPhase("explore");
    this.events.onRespawn?.();
  }

  /* ------------------------------------------------------ player actions -- */

  private inPlayerTurn(): boolean {
    return this.phase === "battle" && !!this.battle && this.battle.turn === "player"
      && !this.player.dead;
  }

  private livingFoes(): Enemy[] {
    const b = this.battle;
    if (!b) return [];
    return this.enemies.filter((e) => e.fight === b.fight && (e.state === "alive" || e.state === "stagger"));
  }

  target(): Enemy | null {
    const foes = this.livingFoes();
    if (!foes.length) return null;
    return foes[this.targetIdx % foes.length];
  }

  /** Tab — cycle the target */
  cycleTarget(): void {
    const foes = this.livingFoes();
    if (!foes.length) return;
    this.targetIdx = (this.targetIdx + 1) % foes.length;
  }

  /** 1 — STRIKE (1 AP) */
  strike(): void {
    if (!this.inPlayerTurn() || this.aim) return;
    const b = this.battle!;
    if (b.ap < COST.strike) return;
    const t = this.target();
    if (!t) return;
    b.ap -= COST.strike;
    this.meter = Math.min(100, this.meter + 6);
    this.events.onSwing?.("strike");
    this.damageEnemy(t, DMG.strike + this.dmgBonus, "strike");
    this.afterAction();
  }

  /** 2 — FREE AIM (2 AP): the reticle sways; Enter fires. */
  aimStart(): void {
    if (!this.inPlayerTurn() || this.aim) return;
    const b = this.battle!;
    if (b.ap < COST.aim || !this.target()) return;
    this.aim = { t: 0 };
    this.events.onAim?.(true);
  }

  /** Enter while aiming — take the shot. */
  aimFire(): void {
    if (!this.aim || !this.battle) return;
    const b = this.battle;
    const t = this.target();
    const align = Math.abs(Math.sin(this.aimPhase));
    this.aim = null;
    this.events.onAim?.(false);
    if (!t) return;
    b.ap -= COST.aim;
    const weak = align < 0.3;
    this.meter = Math.min(100, this.meter + (weak ? 10 : 3));
    this.events.onSwing?.("aim");
    this.damageEnemy(t, (weak ? DMG.aimWeak : DMG.aimGraze) + this.dmgBonus, weak ? "weak" : "graze");
    this.afterAction();
  }

  /** 3 — INK LANCE (3 AP): the paint spear. */
  lance(): void {
    if (!this.inPlayerTurn() || this.aim) return;
    const b = this.battle!;
    if (b.ap < COST.lance) return;
    const t = this.target();
    if (!t) return;
    b.ap -= COST.lance;
    this.meter = Math.min(100, this.meter + 8);
    this.events.onSwing?.("lance");
    this.damageEnemy(t, DMG.lance + this.dmgBonus, "lance");
    this.afterAction();
  }

  /** Q — OVERPAINT: repaint their face. Big damage + stagger. */
  overpaint(): void {
    if (!this.inPlayerTurn() || this.aim || this.meter < 100) return;
    const t = this.target();
    if (!t) return;
    this.meter = 0;
    this.events.onSwing?.("overpaint");
    this.damageEnemy(t, DMG.overpaint + this.dmgBonus, "overpaint");
    if (t.state === "alive") {
      t.state = "stagger";
      t.stateT = 0;
    }
    this.events.onOverpaint?.(t);
    this.afterAction();
  }

  /** Enter — fire the aimed shot, else end the turn early. */
  confirmOrEndTurn(): void {
    if (this.aim) {
      this.aimFire();
      return;
    }
    if (this.inPlayerTurn()) this.startEnemyTurn();
  }

  private afterAction(): void {
    const b = this.battle!;
    if (b.ap <= 0) this.startEnemyTurn();
  }

  /** Space — dodge. Also the jump-marker vault (same key, same window). */
  dodge(): void {
    const p = this.player;
    if (p.dead || this.phase !== "battle") return;
    p.dodgeT = DODGE_T;
  }

  /** F — parry. The tight window; the counter splash; the gradient stack. */
  parry(): void {
    const p = this.player;
    if (p.dead || this.phase !== "battle") return;
    p.parryT = PARRY_T;
    if (this.battle?.turn === "enemy") this.parryAttempts++;
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }): void {
    if (this.phase === "title" || this.phase === "results" || this.phase === "card") return;
    this.time += dt;
    const p = this.player;

    p.dodgeT = Math.max(0, p.dodgeT - dt);
    p.parryT = Math.max(0, p.parryT - dt);

    if (p.dead) {
      this.deadT += dt;
      if (this.deadT > 2.6) this.respawn();
      return;
    }

    if (this.phase === "explore") {
      const mag = Math.hypot(move.x, move.z);
      if (mag > 0.01) {
        const nx = p.x + (move.x / mag) * WALK * dt;
        const nz = p.z + (move.z / mag) * WALK * dt;
        if (inBounds(nx, nz)) {
          p.x = nx;
          p.z = nz;
        }
        p.heading = Math.atan2(move.x, move.z);
      }
      // pictos
      for (const pk of [PICTO1, PICTO2]) {
        if (!this.pictos.has(pk.id) && Math.hypot(p.x - pk.x, p.z - pk.z) < 1.8) {
          this.pictos.add(pk.id);
          if (pk.id === "pictoHp") {
            p.maxHp += 20;
            p.hp = p.maxHp;
          } else {
            this.dmgBonus += 3;
          }
          this.events.onPicto?.(pk.id);
        }
      }
      // the expedition flag
      if (!this.flagTouched && Math.hypot(p.x - FLAG.x, p.z - FLAG.z) < 2.6) {
        this.flagTouched = true;
        p.hp = p.maxHp;
        this.events.onFlag?.();
      }
      // fight triggers
      if (!this.wonFights.has(1) && p.z < FIGHT1.trigger) this.beginBattle(1);
      else if (!this.wonFights.has(2) && p.z < FIGHT2.trigger) this.beginBattle(2);
      else if (!this.wonFights.has(3) && p.z < ARENA.trigger) this.beginBattle(3);
      p.y = heightAt(p.x, p.z);
      return;
    }

    /* ---- battle ---- */
    const b = this.battle;
    if (!b) return;

    // dissolve / stagger timers
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.state === "dying") {
        e.stateT += dt;
        if (e.stateT > (e.kind === "marionette" ? 2.6 : 1.2)) e.state = "dead";
      } else if (e.state === "stagger") {
        e.stateT += dt;
        if (e.stateT > 3) {
          e.state = "alive";
          e.stateT = 0;
        }
      }
    }

    // the win check: every foe of this fight dissolved away
    const anyLeft = this.enemies.some(
      (e) => e.fight === b.fight && (e.state === "alive" || e.state === "stagger" || e.state === "dying"),
    );
    if (!anyLeft) {
      const fight = b.fight;
      this.wonFights.add(fight);
      this.battle = null;
      this.aim = null;
      if (fight === 3) {
        this.setPhase("card");
        this.events.onCard?.();
      } else {
        this.setPhase("explore");
        this.events.onBattleWon?.(fight);
      }
      return;
    }

    // aim mode ticks (and auto-fires at the limit)
    if (this.aim) {
      this.aim.t += dt;
      this.aimPhase += dt * 3.4;
      if (this.aim.t > AIM_TIME) this.aimFire();
    }

    if (b.turn !== "enemy") return;

    if (b.incoming) {
      const atk = b.incoming;
      atk.t += dt;
      if (atk.t >= atk.beats[atk.beat]) {
        this.resolveImpact(atk);
        atk.beat++;
        atk.t = 0;
        if (atk.beat >= atk.beats.length) {
          b.incoming = null;
          b.betweenT = 0.55;
        } else {
          this.events.onAttackBeat?.(atk, atk.beat);
        }
      }
      return;
    }

    b.betweenT -= dt;
    if (b.betweenT > 0) return;
    const id = b.queue.shift();
    if (id === undefined) {
      this.startPlayerTurn();
      return;
    }
    const e = this.enemies.find((x) => x.id === id)!;
    if (e.state === "alive") {
      this.launchAttack(e);
    } else {
      b.betweenT = 0.8; // staggered/dying enemies lose their turn
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
  }

  /** jump straight into a fight, won flags set for the skipped ones */
  gotoBeat(beat: "fight1" | "fight2" | "flag" | "boss"): void {
    if (beat === "fight1") this.teleport(FIGHT1.x, FIGHT1.z + 8);
    else if (beat === "fight2") {
      this.wonFights.add(1);
      this.teleport(FIGHT2.x, FIGHT2.z + 8);
    } else if (beat === "flag") {
      this.wonFights.add(1);
      this.wonFights.add(2);
      this.teleport(FLAG.x, FLAG.z + 3);
    } else {
      this.wonFights.add(1);
      this.wonFights.add(2);
      this.flagTouched = true;
      this.teleport(ARENA.x, ARENA.z + 10);
    }
  }

  heal(): void {
    this.player.hp = this.player.maxHp;
  }

  setMeter(n: number): void {
    this.meter = Math.min(100, n);
  }

  bossHp(n: number): void {
    const boss = this.enemies.find((e) => e.kind === "marionette");
    if (boss) boss.hp = n;
  }

  /** force an incoming attack pattern NOW from the first living foe (shots) */
  forceAttack(kind: AttackKind): void {
    const b = this.battle;
    if (!b) return;
    const foe = this.livingFoes()[0];
    if (!foe) return;
    b.turn = "enemy";
    b.betweenT = 0;
    b.queue = [];
    this.launchAttack(foe);
  }

  /** the card has read long enough — the results card */
  showResults(): void {
    if (this.phase !== "card") return;
    this.setPhase("results");
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.wonFights.add(1);
    this.wonFights.add(2);
    this.wonFights.add(3);
    this.turns = Math.max(this.turns, 21);
    this.damageDealt = Math.max(this.damageDealt, 812);
    this.parryAttempts = Math.max(this.parryAttempts, 14);
    this.parriesLanded = Math.max(this.parriesLanded, 9);
    this.dodges = Math.max(this.dodges, 6);
    this.deaths = Math.max(this.deaths, 1);
    this.time = Math.max(this.time, 548);
    this.battle = null;
    this.setPhase("card");
    this.events.onCard?.();
  }
}
