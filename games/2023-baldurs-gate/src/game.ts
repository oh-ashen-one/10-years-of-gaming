/**
 * game.ts — TOLLHOUSE game logic. RENDER-FREE (§2.4): the branching
 * dialogue with real d20 resolution (modifiers, crits — every roll
 * logged for the results card), the turn-based combat engine
 * (initiative, move budget, action/bonus-action, shove physics with the
 * river as the instant kill, grease + fire surface combos), the spark
 * mage's own turns, enemy intents, the toll chest, and the companion
 * barks that remember your choice. main.ts maps state + events to
 * presentation. One direction only.
 *
 * The 10-minute promise: approach ~0:30, the tollkeeper dialogue ~1:00,
 * the fight 3:00–7:00 (or a smooth mouth and no fight at all), loot by
 * 8:00, results by ~9:00.
 */
import {
  PARTY_START, TOLLKEEPER_AT, GUARDS_AT, DIALOGUE_TRIGGER, CHEST,
  inRiver, inBounds,
} from "./scene";

export type Phase = "title" | "explore" | "dialogue" | "roll" | "combat" | "results";
export type Outcome = "free" | "cowed" | "robbed" | "fight" | "fight-surprised";

/* --------------------------------------------------------------- rolls -- */

export interface RollRecord {
  label: string;
  roll: number;       // the raw d20
  mod: number;
  total: number;
  dc: number;
  crit: "crit" | "critfail" | null;
  success: boolean;
}

let nextForced: number | null = null;

export function d20(): number {
  if (nextForced !== null) {
    const v = nextForced;
    nextForced = null;
    return v;
  }
  return 1 + Math.floor(Math.random() * 20);
}

function d(n: number): number {
  return 1 + Math.floor(Math.random() * n);
}

/* ----------------------------------------------------------- combatants -- */

export type Kind = "player" | "mage" | "tollkeeper" | "guard";

export interface Combatant {
  id: number;
  kind: Kind;
  name: string;
  side: "party" | "enemy";
  x: number; z: number;
  hp: number; maxHp: number;
  ac: number;
  alive: boolean;
  dipped: boolean;          // blade dipped in candle fire
  moveLeft: number;
  moveFromX: number; moveFromZ: number;
  actionUsed: boolean;
  bonusUsed: boolean;
  slipped: boolean;
  init: number;             // initiative total
}

export interface Grease { x: number; z: number; r: number; igniteT: number; lit: boolean }

export interface Combat {
  order: Combatant[];
  turnIdx: number;
  round: number;
  surprisedSkip: Set<number>;
  grease: Grease[];
  aiT: number;              // pause before AI acts (readability)
  turnPending: boolean;     // AI acted; advance on the next beat
}

/* -------------------------------------------------------------- events -- */

export interface DialogueChoice {
  key: string;
  label: string;      // with the [Skill DC] tag where relevant
}

export interface GameEvents {
  onPhase?(p: Phase): void;
  onLine?(who: string, text: string): void;
  onChoices?(choices: DialogueChoice[]): void;
  onRollStart?(label: string, dc: number, mod: number): void;
  onRollResult?(rec: RollRecord): void;
  onOutcome?(o: Outcome): void;
  onCombatStart?(order: Combatant[]): void;
  onTurn?(c: Combatant): void;
  onDamage?(x: number, z: number, amount: number, label: string): void;
  onPush?(c: Combatant, intoRiver: boolean): void;
  onSlip?(c: Combatant): void;
  onIgnite?(g: Grease): void;
  onDeath?(c: Combatant, inRiver: boolean): void;
  onCombatWin?(): void;
  onLoot?(): void;
  onBark?(text: string): void;
  onResults?(): void;
  onDip?(): void;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};

  time = 0;
  gold = 60;
  cloak = false;
  path: Outcome | null = null;
  rolls: RollRecord[] = [];
  bodiesInRiver = 0;
  kills = 0;

  player = { x: PARTY_START.x, z: PARTY_START.z, heading: 0 };
  mage = { x: PARTY_START.x + 2.4, z: PARTY_START.z + 1.6 };

  // dialogue
  choices: DialogueChoice[] | null = null;
  private pendingSkill: { key: string; dc: number; mod: number } | null = null;
  dialogueDone = false;

  // combat
  combat: Combat | null = null;
  targetIdx = 0;
  looted = false;

  /* ------------------------------------------------------------ phases -- */

  start(): void {
    if (this.phase !== "title") return;
    this.setPhase("explore");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* ----------------------------------------------------------- dialogue -- */

  private startDialogue(): void {
    this.setPhase("dialogue");
    this.events.onLine?.("TOLLKEEPER", "Five hundred gold. Cross… or swim.");
    this.events.onLine?.("YOU", "(Sixty. I have sixty.)");
    this.choices = [
      { key: "deception", label: "[Deception 12] “The Baroness already paid. Wave receipt.”" },
      { key: "intimidation", label: "[Intimidation 14] “Count my sword's notches instead.”" },
      { key: "persuasion", label: "[Persuasion 12] “We're both working people. Be decent.”" },
      { key: "attack", label: "[Attack] Draw steel." },
      { key: "pay", label: "[Pay] All 60 of it. Take it." },
    ];
    this.events.onChoices?.(this.choices);
  }

  /** number-key dialogue choice */
  choose(i: number): void {
    if (this.phase !== "dialogue" || !this.choices) return;
    const c = this.choices[i];
    if (!c) return;
    this.choices = null;
    if (c.key === "attack") {
      this.events.onLine?.("YOU", "For the record — I offered nothing.");
      this.outcome("fight-surprised");
      return;
    }
    if (c.key === "pay") {
      this.gold -= 60;
      this.events.onLine?.("TOLLKEEPER", "…Sixty. Hm. The desperation discount. Cross, pauper.");
      this.outcome("robbed");
      return;
    }
    // a skill check — the d20 decides
    const dc = c.key === "intimidation" ? 14 : 12;
    this.pendingSkill = { key: c.key, dc, mod: 3 };
    this.setPhase("roll");
    this.events.onRollStart?.(c.key.toUpperCase(), dc, 3);
  }

  /** the dice overlay reports the settled face */
  resolveRoll(roll: number): void {
    const sk = this.pendingSkill!;
    this.pendingSkill = null;
    const total = roll + sk.mod;
    const crit = roll === 20 ? "crit" : roll === 1 ? "critfail" : null;
    const success = crit === "crit" || (crit !== "critfail" && total >= sk.dc);
    const rec: RollRecord = {
      label: sk.key.toUpperCase(), roll, mod: sk.mod, total, dc: sk.dc, crit, success,
    };
    this.rolls.push(rec);
    this.events.onRollResult?.(rec);
    this.setPhase("dialogue");
    if (success) {
      const kind = sk.key === "intimidation" ? "cowed" : "free";
      this.events.onLine?.("TOLLKEEPER", kind === "cowed"
        ? "—ahem. The bridge is… unguarded today. Walk. WALK."
        : "…Hm. Paperwork checks out. Or I'm tired. Cross, quickly.");
      this.outcome(kind);
    } else {
      this.events.onLine?.("TOLLKEEPER", "HA. Guards — TOLL EVADERS!");
      this.outcome("fight");
    }
  }

  private outcome(o: Outcome): void {
    this.path = o;
    this.dialogueDone = true;
    this.events.onOutcome?.(o);
    if (o === "fight" || o === "fight-surprised") {
      this.beginCombat(o === "fight-surprised");
    } else {
      // a clean pass: he steps aside; the chest waits (and he watches)
      this.setPhase("explore");
      this.events.onBark?.(
        o === "robbed"
          ? "MAGE: “Sixty gold lighter and he let us WALK past him. You're a poet.”"
          : "MAGE: “Remind me to never haggle with you.”",
      );
    }
  }

  /* ------------------------------------------------------------- combat -- */

  beginCombat(surprised: boolean): void {
    const party: Combatant[] = [
      this.mkCombatant(1, "player", "YOU", "party", this.player.x, this.player.z, 34, 12),
      this.mkCombatant(2, "mage", "MAGE", "party", this.mage.x, this.mage.z, 24, 12),
    ];
    const foes: Combatant[] = [
      this.mkCombatant(3, "tollkeeper", "TOLLKEEPER", "enemy", TOLLKEEPER_AT.x, TOLLKEEPER_AT.z, 30, 13),
      ...GUARDS_AT.map((g, i) => this.mkCombatant(4 + i, "guard", `GUARD ${i + 1}`, "enemy", g.x, g.z, 18, 11)),
    ];
    // initiative: rolled, logged
    const order = [...party, ...foes];
    for (const c of order) {
      const roll = d20();
      c.init = roll + (c.side === "party" ? 2 : 1);
      this.rolls.push({
        label: `INITIATIVE ${c.name}`, roll, mod: c.side === "party" ? 2 : 1,
        total: c.init, dc: 0, crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success: true,
      });
    }
    order.sort((a, b) => b.init - a.init);
    this.combat = {
      order, turnIdx: -1, round: 1,
      surprisedSkip: new Set(surprised ? [3] : []),
      grease: [], aiT: 0.6,
      turnPending: false,
    };
    this.setPhase("combat");
    this.events.onCombatStart?.(order);
    this.nextTurn();
  }

  private combatantSeq = 0;
  private mkCombatant(id: number, kind: Kind, name: string, side: "party" | "enemy", x: number, z: number, hp: number, ac: number): Combatant {
    void this.combatantSeq;
    return {
      id, kind, name, side, x, z, hp, maxHp: hp, ac,
      alive: true, dipped: false,
      moveLeft: 8, moveFromX: x, moveFromZ: z,
      actionUsed: false, bonusUsed: false, slipped: false, init: 0,
    };
  }

  active(): Combatant | null {
    const c = this.combat;
    if (!c) return null;
    return c.order[c.turnIdx] ?? null;
  }

  nextTurn(): void {
    const c = this.combat!;
    // end condition
    const partyAlive = c.order.some((o) => o.side === "party" && o.alive);
    const foesAlive = c.order.some((o) => o.side === "enemy" && o.alive);
    if (!partyAlive || !foesAlive) {
      if (partyAlive) {
        this.events.onCombatWin?.();
        this.setPhase("explore");
        this.events.onBark?.(
          this.path === "fight-surprised"
            ? "MAGE: “You could've just paid him, you know.”"
            : "MAGE: “So much for diplomacy. I liked the fire part.”",
        );
      } else {
        this.setPhase("results");
        this.events.onResults?.();
      }
      return;
    }
    c.turnIdx = (c.turnIdx + 1) % c.order.length;
    if (c.turnIdx === 0) c.round++;
    const a = c.order[c.turnIdx];
    if (!a.alive) {
      this.nextTurn();
      return;
    }
    // surprised units lose their first turn
    if (c.surprisedSkip.has(a.id)) {
      c.surprisedSkip.delete(a.id);
      this.events.onDamage?.(a.x, a.z, 0, "SURPRISED");
      this.nextTurn();
      return;
    }
    a.moveLeft = 8;
    a.moveFromX = a.x;
    a.moveFromZ = a.z;
    a.actionUsed = false;
    a.bonusUsed = false;
    // grease: slip at turn start (unlit) or burn (ignited)
    for (const g of c.grease) {
      if (Math.hypot(a.x - g.x, a.z - g.z) < g.r) {
        if (g.igniteT > 0) {
          this.damage(a, d(12), "FIRE");
        } else if (!a.slipped) {
          a.slipped = true;
          this.events.onSlip?.(a);
          this.events.onDamage?.(a.x, a.z, 0, "SLIPPED");
          this.events.onTurn?.(a);
          this.endTurnSoon(0.9); // slip eats the turn
          return;
        }
      }
    }
    this.events.onTurn?.(a);
    if (a.kind !== "player") {
      c.aiT = 0.8; // AI acts after a beat
    }
  }

  private endTurnSoon(t: number): void {
    const c = this.combat!;
    c.aiT = t;
    // mark that the current active is done — AI driver ends it
    const a = this.active();
    if (a) a.actionUsed = true;
    c.turnPending = true;
  }

  /** Enter — the player ends their turn. */
  endTurn(): void {
    if (this.phase !== "combat" || !this.combat) return;
    const a = this.active();
    if (!a || a.kind !== "player") return;
    this.nextTurn();
  }

  /* -------------------------------------------------- player actions -- */

  /** WASD during the player's turn: free move inside the budget ring */
  moveActive(dx: number, dz: number, dt: number): void {
    const a = this.active();
    if (!a || a.kind !== "player" || this.phase !== "combat") return;
    const spd = 6 * dt;
    const nx = a.x + dx * spd;
    const nz = a.z + dz * spd;
    const cost = Math.hypot(nx - a.moveFromX, nz - a.moveFromZ);
    if (cost > 8) return;           // out of budget
    if (!inBounds(nx, nz)) return;
    a.x = nx;
    a.z = nz;
    a.moveLeft = Math.max(0, 8 - cost);
  }

  /** Tab — cycle targets (living enemies) */
  cycleTarget(): void {
    const c = this.combat;
    if (!c) return;
    const foes = c.order.filter((o) => o.side === "enemy" && o.alive);
    if (!foes.length) return;
    this.targetIdx = (this.targetIdx + 1) % foes.length;
  }

  target(): Combatant | null {
    const c = this.combat;
    if (!c) return null;
    const foes = c.order.filter((o) => o.side === "enemy" && o.alive);
    if (!foes.length) return null;
    return foes[this.targetIdx % foes.length];
  }

  /** 1 — melee strike. To-hit d20+4 vs AC, 1d8+3 (+6 fire if dipped). */
  strike(): void {
    const a = this.active();
    const t = this.target();
    if (!a || !t || a.kind !== "player" || a.actionUsed) return;
    if (Math.hypot(t.x - a.x, t.z - a.z) > 2.4) {
      this.events.onDamage?.(t.x, t.z, 0, "TOO FAR");
      return;
    }
    a.actionUsed = true;
    const roll = d20();
    const hit = roll === 20 || (roll !== 1 && roll + 4 >= t.ac);
    this.rolls.push({
      label: "STRIKE", roll, mod: 4, total: roll + 4, dc: t.ac,
      crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success: hit,
    });
    if (!hit) {
      this.events.onDamage?.(t.x, t.z, 0, "MISS");
      return;
    }
    let dmg = d(8) + 3 + (roll === 20 ? d(8) : 0);
    let label = "STRIKE";
    if (a.dipped) {
      dmg += 6;
      label = "FIRE";
      a.dipped = false;
      this.igniteUnder(t.x, t.z);
    }
    this.damage(t, dmg, label);
  }

  /** 2 — SHOVE. Contest d20+2 vs 12; 4 m push; the river is the answer. */
  shove(): void {
    const a = this.active();
    const t = this.target();
    if (!a || !t || a.kind !== "player" || a.actionUsed) return;
    if (Math.hypot(t.x - a.x, t.z - a.z) > 2.4) {
      this.events.onDamage?.(t.x, t.z, 0, "TOO FAR");
      return;
    }
    a.actionUsed = true;
    const roll = d20();
    const success = roll === 20 || (roll !== 1 && roll + 2 >= 12);
    this.rolls.push({
      label: "SHOVE", roll, mod: 2, total: roll + 2, dc: 12,
      crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success,
    });
    if (!success) {
      this.events.onDamage?.(t.x, t.z, 0, "RESISTED");
      return;
    }
    const dx = t.x - a.x;
    const dz = t.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    t.x += (dx / d) * 4.2;
    t.z += (dz / d) * 4.2;
    const wet = inRiver(t.x, t.z);
    this.events.onPush?.(t, wet);
    if (wet) this.drown(t);
  }

  /** 3 — dip the blade (bonus action): next strike +6 fire, ignites grease */
  dipBlade(): void {
    const a = this.active();
    if (!a || a.kind !== "player" || a.bonusUsed) return;
    a.bonusUsed = true;
    a.dipped = true;
    this.events.onDip?.();
  }

  /** 4 — throw the barrel: AoE 2d6 + a shove that can drown too */
  throwBarrel(): void {
    const a = this.active();
    const t = this.target();
    if (!a || !t || a.kind !== "player" || a.actionUsed) return;
    if (Math.hypot(t.x - a.x, t.z - a.z) > 8.5) {
      this.events.onDamage?.(t.x, t.z, 0, "TOO FAR");
      return;
    }
    a.actionUsed = true;
    for (const o of this.combat!.order) {
      if (o.side !== "enemy" || !o.alive) continue;
      if (Math.hypot(o.x - t.x, o.z - t.z) < 2.4) {
        this.damage(o, d(6) + d(6), "BARREL");
        if (o.alive) {
          const dx = o.x - t.x;
          const dz = o.z - t.z;
          const dd = Math.hypot(dx, dz) || 1;
          o.x += (dx / dd) * 2.2;
          o.z += (dz / dd) * 2.2;
          if (inRiver(o.x, o.z)) {
            this.events.onPush?.(o, true);
            this.drown(o);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------- shared rules -- */

  private damage(c: Combatant, amount: number, label: string): void {
    if (!c.alive) return;
    c.hp -= amount;
    this.events.onDamage?.(c.x, c.z, amount, label);
    if (c.hp <= 0) {
      c.hp = 0;
      c.alive = false;
      this.kills++;
      this.events.onDeath?.(c, false);
    }
  }

  private drown(c: Combatant): void {
    c.alive = false;
    c.hp = 0;
    this.bodiesInRiver++;
    this.kills++;
    this.events.onDeath?.(c, true);
  }

  private igniteUnder(x: number, z: number): void {
    for (const g of this.combat?.grease ?? []) {
      if (g.igniteT <= 0 && Math.hypot(x - g.x, z - g.z) < g.r + 1) {
        g.igniteT = 2;
        g.lit = true;
        this.events.onIgnite?.(g);
        for (const o of this.combat!.order) {
          if (o.alive && Math.hypot(o.x - g.x, o.z - g.z) < g.r) this.damage(o, d(12), "FIRE");
        }
      }
    }
  }

  /* ------------------------------------------------------------- AI ----- */

  private mageTurn(m: Combatant): void {
    const c = this.combat!;
    const foes = c.order.filter((o) => o.side === "enemy" && o.alive);
    if (!foes.length) return;
    // nearest foe: spark bolt if reachable line, else grease under them
    foes.sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z));
    const t = foes[0];
    const dist = Math.hypot(t.x - m.x, t.z - m.z);
    if (dist > 9) this.aiMoveToward(m, t.x, t.z, 5);
    const bunched = foes.filter((f) => Math.hypot(f.x - t.x, f.z - t.z) < 3).length >= 2;
    if (bunched) {
      // grease puddle under the cluster
      const g: Grease = { x: t.x, z: t.z, r: 2.4, igniteT: 0, lit: false };
      c.grease.push(g);
      this.events.onDamage?.(t.x, t.z, 0, "GREASE");
    } else {
      // spark bolt: 2-wide line to the target, 2d6
      const roll = d20();
      const hit = roll === 20 || (roll !== 1 && roll + 4 >= t.ac);
      this.rolls.push({
        label: "SPARK BOLT", roll, mod: 4, total: roll + 4, dc: t.ac,
        crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success: hit,
      });
      if (hit) {
        const dx = t.x - m.x;
        const dz = t.z - m.z;
        const dd = Math.hypot(dx, dz) || 1;
        for (const o of foes) {
          // point-to-line distance in the corridor
          const proj = ((o.x - m.x) * dx + (o.z - m.z) * dz) / dd;
          if (proj < 0 || proj > 12) continue;
          const perp = Math.abs((o.x - m.x) * dz - (o.z - m.z) * dx) / dd;
          if (perp < 1.6) this.damage(o, d(6) + d(6), "SPARK");
        }
      } else {
        this.events.onDamage?.(t.x, t.z, 0, "MISS");
      }
    }
  }

  private enemyTurn(e: Combatant): void {
    const c = this.combat!;
    const party = c.order.filter((o) => o.side === "party" && o.alive);
    if (!party.length) return;
    party.sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
    const t = party[0];
    const dist = Math.hypot(t.x - e.x, t.z - e.z);
    if (dist > 2.2) this.aiMoveToward(e, t.x, t.z, e.kind === "tollkeeper" ? 7 : 6);
    const nd = Math.hypot(t.x - e.x, t.z - e.z);
    if (nd > 2.4) return;
    // the tollkeeper shoves when the player flirts with the edge
    if (e.kind === "tollkeeper" && Math.abs(t.z) < 8 && Math.random() < 0.4) {
      const roll = d20();
      const success = roll + 2 >= 12;
      this.rolls.push({
        label: "TOLLKEEPER SHOVE", roll, mod: 2, total: roll + 2, dc: 12,
        crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success,
      });
      if (success) {
        const dx = t.x - e.x;
        const dz = t.z - e.z;
        const dd = Math.hypot(dx, dz) || 1;
        t.x += (dx / dd) * 4.2;
        t.z += (dz / dd) * 4.2;
        const wet = inRiver(t.x, t.z);
        this.events.onPush?.(t, wet);
        if (wet) {
          t.alive = false;
          t.hp = 0;
          this.events.onDeath?.(t, true);
        }
      }
      return;
    }
    const roll = d20();
    const hitMod = e.kind === "tollkeeper" ? 5 : 3;
    const hit = roll === 20 || (roll !== 1 && roll + hitMod >= t.ac);
    this.rolls.push({
      label: `${e.name} SWING`, roll, mod: hitMod, total: roll + hitMod, dc: t.ac,
      crit: roll === 20 ? "crit" : roll === 1 ? "critfail" : null, success: hit,
    });
    if (hit) {
      this.damage(t, e.kind === "tollkeeper" ? d(10) + 3 : d(6) + 2, e.name);
    } else {
      this.events.onDamage?.(t.x, t.z, 0, "MISS");
    }
  }

  private aiMoveToward(c: Combatant, tx: number, tz: number, budget: number): void {
    const dx = tx - c.x;
    const dz = tz - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(budget, d - 1.8);
    if (step <= 0) return;
    const nx = c.x + (dx / d) * step;
    const nz = c.z + (dz / d) * step;
    if (inBounds(nx, nz)) {
      c.x = nx;
      c.z = nz;
    }
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }): void {
    if (this.phase === "title" || this.phase === "results" || this.phase === "dialogue" || this.phase === "roll") return;
    this.time += dt;

    if (this.phase === "explore") {
      const p = this.player;
      const mag = Math.hypot(move.x, move.z);
      if (mag > 0.01) {
        const spd = 6;
        const nx = p.x + (move.x / mag) * spd * dt;
        const nz = p.z + (move.z / mag) * spd * dt;
        if (inBounds(nx, nz)) {
          p.x = nx;
          p.z = nz;
        }
        p.heading = Math.atan2(move.x, move.z);
      }
      // the mage trails you
      const md = Math.hypot(p.x - this.mage.x - 1.2, p.z - this.mage.z - 1.2);
      if (md > 2.2) {
        this.mage.x += (p.x - 1.2 - this.mage.x) * dt * 2.2;
        this.mage.z += (p.z - 1.2 - this.mage.z) * dt * 2.2;
      }
      // dialogue trigger at the bridge foot
      if (!this.dialogueDone && Math.hypot(p.x - DIALOGUE_TRIGGER.x, p.z - DIALOGUE_TRIGGER.z) < DIALOGUE_TRIGGER.r) {
        this.startDialogue();
      }
      return;
    }

    if (this.phase === "combat" && this.combat) {
      const c = this.combat;
      // ignited grease burns down; unlit pools persist the fight
      for (const g of c.grease) {
        if (g.igniteT > 0) g.igniteT -= dt * 0.5;
      }
      c.grease = c.grease.filter((g) => !g.lit || g.igniteT > 0);
      const a = this.active();
      if (a && a.kind !== "player") {
        c.aiT -= dt;
        if (c.aiT <= 0) {
          if (c.turnPending) {
            c.turnPending = false;
            this.nextTurn();
          } else {
            if (a.kind === "mage") this.mageTurn(a);
            else this.enemyTurn(a);
            c.aiT = 0.9;
            c.turnPending = true;
          }
        }
      }
    }
  }

  /* --------------------------------------------------------------- loot -- */

  /** E — the toll chest. */
  interact(): void {
    if (this.phase !== "explore" || this.looted) return;
    const p = this.player;
    if (Math.hypot(p.x - CHEST.x, p.z - CHEST.z) > 3) return;
    this.looted = true;
    this.gold += 500;
    this.cloak = true;
    this.events.onLoot?.();
    this.setPhase("results");
    this.events.onResults?.();
  }

  nearChest(): boolean {
    return Math.hypot(this.player.x - CHEST.x, this.player.z - CHEST.z) < 3;
  }

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  teleport(x: number, z: number): void {
    this.player.x = x;
    this.player.z = z;
    this.mage.x = x + 2;
    this.mage.z = z + 1.5;
  }

  gotoDialogue(): void {
    this.teleport(DIALOGUE_TRIGGER.x, DIALOGUE_TRIGGER.z - 1);
  }

  /** rig the next d20 (shots: 20 = the crit) */
  forceRoll(v: number): void {
    nextForced = v;
  }

  /** stage another check purely for the theater (shot 04's crit) */
  debugReroll(): void {
    this.pendingSkill = { key: "intimidation", dc: 14, mod: 3 };
    this.setPhase("roll");
    this.events.onRollStart?.("INTIMIDATION", 14, 3);
  }

  startFight(surprised = true): void {
    if (this.phase === "combat") return;
    this.dialogueDone = true;
    this.path = surprised ? "fight-surprised" : "fight";
    this.beginCombat(surprised);
  }

  /** put a guard on the bridge edge and shove him in (shot 06) */
  forceShoveKill(): void {
    if (this.phase !== "combat") this.startFight(true);
    const c = this.combat!;
    const a = c.order.find((o) => o.kind === "player")!;
    const g = c.order.find((o) => o.kind === "guard" && o.alive)!;
    a.x = 0;
    a.z = -1;             // on the bridge
    g.x = 3.4;
    g.z = 0.5;            // at the deck's east edge — river beyond
    c.turnIdx = c.order.indexOf(a);
    a.actionUsed = false;
    this.forceRoll(17);
  }

  /** ignite a grease pool under the guards (shot 07) */
  forceGreaseFire(): void {
    if (this.phase !== "combat") this.startFight(true);
    const c = this.combat!;
    const guards = c.order.filter((o) => o.kind === "guard" && o.alive);
    if (guards.length >= 2) {
      guards[0].x = -5;
      guards[0].z = 8;
      guards[1].x = -4;
      guards[1].z = 9.5;
      const g: Grease = { x: -4.5, z: 8.7, r: 2.6, igniteT: 0, lit: false };
      c.grease.push(g);
      this.igniteUnder(-4.5, 8.7);
    }
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.path = this.path ?? "fight-surprised";
    this.gold = 560;
    this.cloak = true;
    this.kills = Math.max(this.kills, 4);
    this.bodiesInRiver = Math.max(this.bodiesInRiver, 2);
    if (this.rolls.length === 0) {
      this.rolls.push(
        { label: "INTIMIDATION", roll: 4, mod: 3, total: 7, dc: 14, crit: null, success: false },
        { label: "STRIKE", roll: 20, mod: 4, total: 24, dc: 11, crit: "crit", success: true },
        { label: "SHOVE", roll: 17, mod: 2, total: 19, dc: 12, crit: null, success: true },
      );
    }
    this.setPhase("results");
    this.events.onResults?.();
  }
}
