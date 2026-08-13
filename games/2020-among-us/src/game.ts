/**
 * game.ts — SUSPECTED game logic. RENDER-FREE (§2.4): crew sim, the
 * impostor brain (isolation scoring, vent graph, alibi faking), kills,
 * bodies, meetings with generated testimony + suspicion voting, lights
 * sabotage, win/lose. No renderables; main.ts maps state + events to
 * presentation. One direction only: game → events → presentation.
 *
 * The 10-minute promise: ~30 s grace, first body ~1:30–2:30, meeting,
 * bolder impostor round two, lights-out beat mid-game; win by finishing
 * all 5 tasks or voting the impostor out; lose by dying alone.
 */
import {
  ROOMS, STATIONS, BUTTON, VENTS, PLAYER_SPAWN,
  inFloor, segPointDist, hasLOS, roomAt, WALLS,
} from "./ship";
import { CREW_COLORS } from "./palette";

export type Phase = "title" | "play" | "meeting" | "eject" | "results";

const WALK = 4.6;
const GRACE = 30;
const KILL_CD = 20;
const KILL_CD_ROUND2 = 13;
const KILL_RANGE = 1.7;
const ISOLATION_R = 10;      // no witnesses within this → killable
const WITNESS_R = 9;         // player sees a kill/vent within this + LOS
const VISION_DAY = 8.5;
const VISION_DARK = 4.2;
const MEET_CHAT_T = 8;       // seconds of testimony before the vote

export interface Crew {
  id: number;
  colorIdx: number;
  name: string;             // color name (RED, BLUE…)
  isImpostor: boolean;
  alive: boolean;
  x: number; z: number;
  tx: number; tz: number;   // wander target
  idleT: number;
  room: string;             // last known room (testimony fodder)
}

export interface Body {
  x: number; z: number;
  colorIdx: number;
  room: string;
  found: boolean;
}

export interface MeetingLine { who: string; text: string; mine: boolean }

export interface GameEvents {
  onPhase?(p: Phase): void;
  onKill?(victim: Crew | null, witnessed: boolean): void; // null = the player died
  onVent?(x: number, z: number, seen: boolean): void;
  onMeeting?(reason: "body" | "button", body: Body | null): void;
  onVoteTime?(): void;
  onEject?(colorName: string, wasImpostor: boolean, lines: string[]): void;
  onNoEject?(): void;
  onLightsOut?(): void;
  onLightsFixed?(): void;
  onTaskDone?(task: string, remaining: number): void;
  onWin?(kind: "tasks" | "vote"): void;
  onLose?(kind: "killed" | "outnumbered"): void;
  onKillAttemptNear?(): void; // sting when the impostor strikes nearby
}

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, alive: true };
  inTask = false;           // rooted in a minigame (dangerous!)
  tasksDone = new Set<string>();

  crew: Crew[] = [];
  impostor!: Crew;
  bodies: Body[] = [];
  private killCD = GRACE;
  private round2 = false;

  lightsOut = false;
  private sabotageT = 150;
  private fixT = 0;

  meeting: {
    reason: "body" | "button";
    body: Body | null;
    lines: MeetingLine[];
    t: number;
    voting: boolean;
    tallied: boolean;
    votes: Map<number, number | "skip">; // voterId → suspectId|skip
    ejectId: number | null | "skip";
  } | null = null;
  ejectT = 0;
  ejectedName = "";
  ejectedWasImpostor = false;
  buttonUsed = false;

  visionR = VISION_DAY;

  /* ------------------------------------------------------------ setup -- */

  start(): void {
    if (this.phase !== "title") return;
    // 9 bots + player; one bot is the impostor (never the same twice)
    for (let i = 0; i < 9; i++) {
      const colorIdx = i + 1 <= 8 ? i + 1 : 0; // player is RED (idx 0)
      const c = CREW_COLORS[colorIdx % CREW_COLORS.length];
      this.crew.push({
        id: i + 1, colorIdx: colorIdx % CREW_COLORS.length, name: c.name,
        isImpostor: false, alive: true,
        x: PLAYER_SPAWN.x + Math.cos(i * 1.3) * 3,
        z: PLAYER_SPAWN.z + Math.sin(i * 1.3) * 3,
        tx: 0, tz: 0, idleT: Math.random() * 2,
        room: "CAFETERIA",
      });
    }
    const impIdx = Math.floor(Math.random() * 9);
    this.crew[impIdx].isImpostor = true;
    this.impostor = this.crew[impIdx];
    this.setPhase("play");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  /* ------------------------------------------------------------ tasks -- */

  /** nearest un-done station within reach */
  nearestStation(): (typeof STATIONS[number] & { d: number }) | null {
    if (!this.player.alive) return null;
    let best: (typeof STATIONS[number] & { d: number }) | null = null;
    let bd = 2.2;
    for (const s of STATIONS) {
      if (this.tasksDone.has(s.task)) continue;
      const d = Math.hypot(s.x - this.player.x, s.z - this.player.z);
      if (d < bd) {
        bd = d;
        best = { ...s, d };
      }
    }
    return best;
  }

  /** minigame UI reports completion */
  completeTask(task: string): void {
    if (this.tasksDone.has(task)) return;
    this.tasksDone.add(task);
    this.inTask = false;
    this.events.onTaskDone?.(task, 5 - this.tasksDone.size);
    if (this.tasksDone.size >= 5) this.win("tasks");
  }

  /* -------------------------------------------------------------- body -- */

  /** nearest unreported body in report range */
  nearestBody(): Body | null {
    let best: Body | null = null;
    let bd = 2.4;
    for (const b of this.bodies) {
      if (b.found) continue;
      const d = Math.hypot(b.x - this.player.x, b.z - this.player.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /** R — report a body. */
  report(): void {
    if (this.phase !== "play" || !this.player.alive) return;
    const b = this.nearestBody();
    if (!b) return;
    b.found = true;
    this.startMeeting("body", b);
  }

  /** F — the emergency button at the cafeteria table. */
  emergency(): void {
    if (this.phase !== "play" || !this.player.alive || this.buttonUsed) return;
    if (Math.hypot(BUTTON.x - this.player.x, BUTTON.z - this.player.z) > 2.4) return;
    this.buttonUsed = true;
    this.startMeeting("button", null);
  }

  /** E — fix the lights at the Electrical panel (hold handled by main). */
  fixingLights(dt: number): boolean {
    if (!this.lightsOut) return false;
    const s = STATIONS[0]; // wires panel in electrical
    if (Math.hypot(s.x - this.player.x, s.z - this.player.z) > 2.4) return false;
    this.fixT += dt;
    if (this.fixT >= 2) {
      this.lightsOut = false;
      this.visionR = VISION_DAY;
      this.events.onLightsFixed?.();
    }
    return true;
  }

  /* ----------------------------------------------------------- meetings -- */

  private startMeeting(reason: "body" | "button", body: Body | null): void {
    this.inTask = false;
    const lines: MeetingLine[] = [];
    if (body) {
      lines.push({ who: "YOU", text: `BODY IN ${body.room}.`, mine: true });
      // witnesses: bots last seen in the body room (impostor may lie low)
      const witnesses = this.crew.filter(
        (c) => c.alive && c.room === body.room && c.colorIdx !== body.colorIdx,
      );
      if (this.ventWitness !== null) {
        lines.push({ who: "YOU", text: `I SAW ${CREW_COLORS[this.ventWitness].name} VENT!!`, mine: true });
      }
      if (this.killWitness !== null) {
        lines.push({ who: "YOU", text: `I SAW ${CREW_COLORS[this.killWitness].name} DO IT.`, mine: true });
      }
      for (const w of witnesses.slice(0, 2)) {
        lines.push({ who: w.name, text: `was in ${body.room}…`, mine: false });
      }
      if (witnesses.length === 0 && this.ventWitness === null) {
        lines.push({ who: this.randAlive().name, text: "nobody saw anything", mine: false });
      }
      // the impostor fakes an alibi
      lines.push({
        who: this.impostor.name,
        text: `i was doing tasks in ${ROOMS[Math.floor(Math.random() * ROOMS.length)].name}`,
        mine: false,
      });
      lines.push({ who: this.randAlive().name, text: "where??", mine: false });
    } else {
      lines.push({ who: "YOU", text: "EMERGENCY MEETING. talk.", mine: true });
      if (this.ventWitness !== null) {
        lines.push({ who: "YOU", text: `I SAW ${CREW_COLORS[this.ventWitness].name} VENT!!`, mine: true });
      }
      lines.push({ who: this.impostor.name, text: "i'm literally doing wires", mine: false });
      lines.push({ who: this.randAlive().name, text: "sus", mine: false });
    }
    this.meeting = {
      reason, body, lines,
      t: 0, voting: false, tallied: false,
      votes: new Map(), ejectId: null,
    };
    this.setPhase("meeting");
    this.events.onMeeting?.(reason, body);
  }

  private randAlive(): Crew {
    const alive = this.crew.filter((c) => c.alive && c !== this.impostor);
    return alive[Math.floor(Math.random() * alive.length)] ?? this.impostor;
  }

  /** suspicion score per living bot for the current meeting */
  private suspicion(c: Crew): number {
    if (this.killWitness === c.colorIdx) return 100;
    if (this.ventWitness === c.colorIdx) return 90;
    let s = Math.random() * 1.2;
    const body = this.meeting?.body;
    if (body && c.room === body.room && c.colorIdx !== body.colorIdx) s += 2.2;
    if (c.isImpostor && Math.random() < 0.35) s += 1.2; // behavioral tells
    return s;
  }

  /** player casts a vote (suspect crew id, or "skip") */
  castVote(suspectId: number | "skip"): void {
    if (!this.meeting || !this.meeting.voting || this.meeting.tallied) return;
    this.meeting.votes.set(0, suspectId);
    this.tally();
  }

  private tally(): void {
    const m = this.meeting!;
    m.tallied = true;
    // bots vote their top suspicion (sometimes wrong), ~15% skip
    for (const c of this.crew) {
      if (!c.alive) continue;
      if (Math.random() < 0.15) {
        m.votes.set(c.id, "skip");
        continue;
      }
      let bestId: number | "skip" = "skip";
      let best = 1.4; // below this, abstain-ish skip
      for (const o of this.crew) {
        if (!o.alive || o === c) continue;
        const s = this.suspicion(o);
        if (s > best) {
          best = s;
          bestId = o.id;
        }
      }
      // witnessed proof wins outright
      if (this.killWitness !== null || this.ventWitness !== null) {
        const seen = this.killWitness ?? this.ventWitness;
        const target = this.crew.find((o) => o.colorIdx === seen && o.alive);
        if (target) bestId = target.id;
      }
      m.votes.set(c.id, bestId);
    }
    // tally
    const counts = new Map<number | "skip", number>();
    for (const v of m.votes.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
    let top: number | "skip" = "skip";
    let topN = 0;
    let tie = false;
    for (const [id, n] of counts) {
      if (n > topN) {
        top = id;
        topN = n;
        tie = false;
      } else if (n === topN) {
        tie = true;
      }
    }
    if (tie || top === "skip") {
      m.ejectId = "skip";
    } else {
      m.ejectId = top;
    }
  }

  private resolveMeeting(): void {
    const m = this.meeting!;
    if (m.ejectId === null) return; // player hasn't voted
    if (m.ejectId === "skip") {
      this.meeting = null;
      this.setPhase("play");
      this.events.onNoEject?.();
    } else {
      const victim = this.crew.find((c) => c.id === m.ejectId)!;
      victim.alive = false;
      this.ejectedName = victim.name;
      this.ejectedWasImpostor = victim.isImpostor;
      this.ejectT = 0;
      this.meeting = null;
      this.setPhase("eject");
      const lines = victim.isImpostor
        ? [`${victim.name} was An Impostor.`]
        : [`${victim.name} was not An Impostor.`, "…oops."];
      this.events.onEject?.(victim.name, victim.isImpostor, lines);
      if (victim.isImpostor) {
        this.win("vote");
      } else if (this.aliveCrewCount() <= 2) {
        this.lose("outnumbered");
      }
    }
    this.ventWitness = null;
    this.killWitness = null;
    // round two: the impostor gets bolder
    this.round2 = true;
  }

  private aliveCrewCount(): number {
    return this.crew.filter((c) => c.alive && !c.isImpostor).length + (this.player.alive ? 1 : 0);
  }

  /* -------------------------------------------------------- impostor AI -- */

  private ventWitness: number | null = null;
  private killWitness: number | null = null;

  private updateImpostor(dt: number): void {
    const imp = this.impostor;
    if (!imp.alive || this.phase !== "play") return;
    this.killCD -= dt;

    // hunt: nearest isolated crew (or the player)
    if (this.killCD <= 0) {
      let victim: Crew | null = null;
      let victimIsPlayer = false;
      let bd = Infinity;
      const candidates: (Crew | null)[] = [
        ...this.crew.filter((c) => c.alive && c !== imp),
        this.player.alive ? (this.player as unknown as Crew) : null,
      ];
      for (const c of candidates) {
        if (!c) continue;
        const d = Math.hypot(c.x - imp.x, c.z - imp.z);
        if (d > 26 || d >= bd) continue;
        // isolation: nobody else within ISOLATION_R with LOS to the victim
        let isolated = true;
        for (const o of this.crew) {
          if (!o.alive || o === c || o === imp) continue;
          if (Math.hypot(o.x - c.x, o.z - c.z) < ISOLATION_R && hasLOS(o.x, o.z, c.x, c.z)) {
            isolated = false;
            break;
          }
        }
        // the player counts as a witness unless they're it
        const pd = Math.hypot(this.player.x - c.x, this.player.z - c.z);
        if (c !== (this.player as unknown as Crew) && pd < ISOLATION_R * 0.8 && this.player.alive) {
          isolated = isolated && false || (pd > ISOLATION_R * 0.8); // player near → risky
        }
        if (isolated) {
          bd = d;
          victim = c;
          victimIsPlayer = c === (this.player as unknown as Crew);
        }
      }
      if (victim) {
        // close in
        const d = Math.hypot(victim.x - imp.x, victim.z - imp.z);
        if (d < KILL_RANGE) {
          this.doKill(victim, victimIsPlayer);
          return;
        } else {
          this.botMove(imp, victim.x, victim.z, dt, 5.2);
          return;
        }
      }
    }

    // otherwise: fake tasks — wander between stations, loiter
    this.wander(imp, dt, 3.6);
  }

  private doKill(victim: Crew, isPlayer: boolean): void {
    const imp = this.impostor;
    this.killCD = this.round2 ? KILL_CD_ROUND2 : KILL_CD;

    // did the player see it?
    const pd = Math.hypot(this.player.x - victim.x, this.player.z - victim.z);
    const seen =
      !isPlayer && this.player.alive && pd < WITNESS_R &&
      hasLOS(this.player.x, this.player.z, victim.x, victim.z) &&
      pd < this.visionR;
    if (seen) this.killWitness = imp.colorIdx;
    if (pd < 16 && !isPlayer) this.events.onKillAttemptNear?.();

    if (isPlayer) {
      this.player.alive = false;
      this.events.onKill?.(null, false);
      this.lose("killed");
      return;
    }

    victim.alive = false;
    const room = roomAt(victim.x, victim.z)?.name ?? "CORRIDOR";
    this.bodies.push({ x: victim.x, z: victim.z, colorIdx: victim.colorIdx, room, found: false });
    this.events.onKill?.(victim, seen);

    // vent escape if the player is close-ish (visible if they have LOS)
    if (pd < 13) {
      const v = VENTS[0];
      const out = VENTS[v.to];
      const ventSeen = this.player.alive && hasLOS(this.player.x, this.player.z, imp.x, imp.z) && pd < this.visionR + 2;
      imp.x = out.x;
      imp.z = out.z;
      if (ventSeen) this.ventWitness = imp.colorIdx;
      this.events.onVent?.(v.x, v.z, ventSeen);
    }
  }

  /* --------------------------------------------------------------- bots -- */

  private wander(c: Crew, dt: number, speed: number): void {
    const d = Math.hypot(c.tx - c.x, c.tz - c.z);
    if (d < 1 || c.idleT > 0) {
      c.idleT -= dt;
      if (c.idleT <= 0) {
        // new fake-task spot: a station or a room point
        if (Math.random() < 0.6) {
          const s = STATIONS[Math.floor(Math.random() * STATIONS.length)];
          c.tx = s.x + (Math.random() - 0.5) * 2;
          c.tz = s.z + (Math.random() - 0.5) * 2;
        } else {
          const r = ROOMS[Math.floor(Math.random() * ROOMS.length)];
          c.tx = r.x + (Math.random() - 0.5) * (r.w - 3);
          c.tz = r.z + (Math.random() - 0.5) * (r.d - 3);
        }
      }
      return;
    }
    this.botMove(c, c.tx, c.tz, dt, speed);
  }

  private botMove(c: Crew, tx: number, tz: number, dt: number, speed: number): void {
    const dx = tx - c.x;
    const dz = tz - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = c.x + (dx / d) * speed * dt;
    const nz = c.z + (dz / d) * speed * dt;
    if (inFloor(nx, nz)) {
      c.x = nx;
      c.z = nz;
    } else {
      // slide along walls
      if (inFloor(nx, c.z)) c.x = nx;
      else if (inFloor(c.x, nz)) c.z = nz;
      else c.idleT = 0.3; // unstick
    }
    // wall push-out
    for (const s of WALLS) {
      const near = segPointDist(s, c.x, c.z);
      if (near.d < 0.5) {
        c.x += near.nx * (0.5 - near.d);
        c.z += near.nz * (0.5 - near.d);
      }
    }
    const room = roomAt(c.x, c.z);
    if (room) c.room = room.name;
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;

    if (this.phase === "eject") {
      this.ejectT += dt;
      if (this.ejectT > 3.6 && this.phase === "eject") this.setPhase("play");
      return;
    }

    if (this.phase === "meeting") {
      const m = this.meeting!;
      m.t += dt;
      if (!m.voting && m.t > MEET_CHAT_T) {
        m.voting = true;
        this.events.onVoteTime?.();
      }
      if (m.voting && m.tallied) {
        // brief pause so the tally reads, then resolve
        m.t = m.t; // (resolve on next frame via resolveTimer)
        this.resolveTimer += dt;
        if (this.resolveTimer > 1.2) {
          this.resolveTimer = 0;
          this.resolveMeeting();
        }
      }
      return;
    }
    this.resolveTimer = 0;

    /* ---- play ---- */
    const p = this.player;
    if (p.alive && !this.inTask) {
      const mag = Math.hypot(move.x, move.z);
      if (mag > 0.01) {
        const nx = p.x + (move.x / mag) * WALK * dt;
        const nz = p.z + (move.z / mag) * WALK * dt;
        if (inFloor(nx, nz)) {
          p.x = nx;
          p.z = nz;
        } else if (inFloor(nx, p.z)) {
          p.x = nx;
        } else if (inFloor(p.x, nz)) {
          p.z = nz;
        }
        for (const s of WALLS) {
          const near = segPointDist(s, p.x, p.z);
          if (near.d < 0.45) {
            p.x += near.nx * (0.45 - near.d);
            p.z += near.nz * (0.45 - near.d);
          }
        }
      }
    }

    // crew wander (faking tasks)
    for (const c of this.crew) {
      if (!c.alive || c.isImpostor) continue;
      this.wander(c, dt, 3.4);
    }
    this.updateImpostor(dt);

    // lights sabotage clock
    if (!this.lightsOut && this.time > 60) {
      this.sabotageT -= dt;
      if (this.sabotageT <= 0) {
        this.lightsOut = true;
        this.visionR = VISION_DARK;
        this.sabotageT = 95; // the impostor may pull it again later
        this.events.onLightsOut?.();
      }
    }
    if (!this.lightsOut) this.fixT = 0;
  }
  private resolveTimer = 0;

  /* ----------------------------------------------------------- outcomes -- */

  private win(kind: "tasks" | "vote"): void {
    if (this.phase === "results") return;
    this.setPhase("results");
    this.events.onWin?.(kind);
  }

  private lose(kind: "killed" | "outnumbered"): void {
    if (this.phase === "results") return;
    this.setPhase("results");
    this.events.onLose?.(kind);
  }

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  teleport(x: number, z: number): void {
    this.player.x = x;
    this.player.z = z;
  }

  /** force the impostor to kill the nearest crew bot right now (shots) */
  debugForceKill(): void {
    this.killCD = 0;
    // drag the impostor next to an isolated bot and let the sim fire
    const imp = this.impostor;
    let victim: Crew | null = null;
    let bd = Infinity;
    for (const c of this.crew) {
      if (!c.alive || c.isImpostor) continue;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d > 20 && d < bd) { // away from the player = witness-free
        bd = d;
        victim = c;
      }
    }
    if (victim) {
      imp.x = victim.x + 0.8;
      imp.z = victim.z;
    }
  }

  /** a body right in front of the player (report shot) */
  debugBodyHere(): void {
    const victim = this.crew.find((c) => c.alive && !c.isImpostor);
    if (!victim) return;
    victim.alive = false;
    this.bodies.push({
      x: this.player.x + 1.6, z: this.player.z + 1.2,
      colorIdx: victim.colorIdx, room: roomAt(this.player.x, this.player.z)?.name ?? "CAFETERIA",
      found: false,
    });
  }

  debugLightsOut(): void {
    this.lightsOut = true;
    this.visionR = VISION_DARK;
    this.events.onLightsOut?.();
  }

  debugLightsFix(): void {
    this.lightsOut = false;
    this.visionR = VISION_DAY;
    this.events.onLightsFixed?.();
  }

  /** force the vote to eject the impostor (results-win path) */
  debugExposeImpostor(): void {
    this.killWitness = this.impostor.colorIdx;
  }

  debugFinish(win = true): void {
    if (this.phase === "title") this.start();
    this.tasksDone = new Set(STATIONS.map((s) => s.task));
    if (win) this.win("tasks");
    else this.lose("killed");
  }
}
