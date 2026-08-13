/**
 * game.ts — REQUIEM WARD game logic. RENDER-FREE (§2.4): first-person
 * survival horror — the flashlight (G toggles; it flickers when THEY are
 * near), scarce ammo (12 + pickups), RMB aim slows the walk and tightens
 * the cone (headshots stagger), noise as a mechanic (Shift is loud, firing
 * is louder), 6-slot inventory with herb+herb=medkit, the fuse/crank/panel
 * puzzle chain, the Pursuer (invincible — bullets stagger it 3s, sound
 * draws it), and the elevator finale: doors shut on its hand. main.ts
 * presents. One direction only.
 *
 * The 10-minute promise: ward A + first shambler by 1:00, inventory teach
 * 2:00, fuse 3:30, the guarded crank 4:30, power on 6:00 — it wakes —
 * the key off the lit desk 7:30, the elevator chase 8:30, SURVIVED 9:30.
 */
import {
  inBounds, LOBBY, EXAM, WARDA, MORGUE, DIRECTOR, LIFT,
  FUSE_AT, AMMO1_AT, AMMO2_AT, HERB1_AT, HERB2_AT, CRANK_AT,
  PANEL_AT, DESK_KEY_AT, ELEVATOR_AT, WARDB_PLATE, D_DIRECTOR,
  SHAMBLERS_AT, PURSUER_WAKE,
} from "./ward";

export type Phase = "title" | "play" | "finale" | "results";
export type ItemKind = "herb" | "medkit" | "fuse" | "crank" | "liftkey";

/* ------------------------------------------------------------- tuning -- */

const WALK = 4.0;
const FAST = 5.6;      // Shift — loud
const AIM_WALK = 1.8;
const TURN = 2.5;      // rad/s, Q/E or arrows
const PLAYER_HP = 100;

const AMMO_START = 12;
const BODY_DMG = 25;
const HEAD_DMG = 50;
const SHAMBLER_HP = 75;
const HEAD_CONE = 0.05;  // rad — the aimed headshot
const BODY_CONE = 0.13;
const FIRE_RANGE = 26;

const NOISE_STEP = 4;
const NOISE_FAST = 12;
const NOISE_SHOT = 30;

export type FoeState = "dormant" | "shamble" | "windup" | "lunge" | "stagger" | "dead";

export interface Shambler {
  id: number;
  x: number; z: number;
  hp: number;
  state: FoeState;
  stateT: number;
  flash: number;
}

export type PursuerState = "asleep" | "patrol" | "investigate" | "chase" | "stagger";

export interface Pursuer {
  x: number; z: number;
  state: PursuerState;
  stateT: number;
  tx: number; tz: number; // where it's walking to
  hitCD: number;
}

/* -------------------------------------------------------------- events -- */

export interface GameEvents {
  onPhase?(p: Phase): void;
  onFire?(headshot: boolean, hit: boolean): void;
  onShamblerDie?(s: Shambler): void;
  onShamblerHit?(s: Shambler, headshot: boolean): void;
  onPursuerStagger?(): void;
  onPursuerWake?(): void;
  onPursuerChase?(): void;
  onPlayerHit?(dmg: number): void;
  onFlatline?(): void;
  onRespawn?(): void;
  onItem?(kind: ItemKind | "ammo", label: string): void;
  onCombine?(): void;
  onExamine?(kind: ItemKind): void;
  onDoorPlate?(text: string): void;
  onDoorOpen?(which: "director"): void;
  onPowerOn?(): void;
  onStep?(fast: boolean): void;
  onFlash?(on: boolean): void;
  onFinale?(): void;
  onDoorArm?(): void;
  onSurvived?(): void;
  onAim?(on: boolean): void;
}

/* ----------------------------------------------------------- pickups -- */

interface Pickup {
  id: string;
  kind: ItemKind | "ammo";
  x: number; z: number;
  label: string;
  taken: boolean;
  needsPower: boolean;
}

/* ---------------------------------------------------------------- game -- */

export class Game {
  phase: Phase = "title";
  events: GameEvents = {};
  time = 0;

  player = {
    x: 0, z: 2, heading: Math.PI, // facing -z, down the corridor
    hp: PLAYER_HP, maxHp: PLAYER_HP,
    ammo: AMMO_START,
    aiming: false,
    flashOn: true,
    dead: false,
  };

  slots: (ItemKind | null)[] = [null, null, null, null, null, null];
  marked: number | null = null;

  directorOpen = false;
  powerOn = false;
  liftOpen = false;

  shamblers: Shambler[] = [];
  pursuer: Pursuer = { x: PURSUER_WAKE.x, z: PURSUER_WAKE.z, state: "asleep", stateT: 0, tx: 0, tz: 0, hitCD: 0 };

  prompt = "";        // the current F-interact label ("" = none)

  shotsFired = 0;
  hits = 0;
  deaths = 0;

  finaleT = 0;
  private stepAcc = 0;

  pickups: Pickup[] = [
    { id: "fuse", kind: "fuse", x: FUSE_AT.x, z: FUSE_AT.z, label: "FUSE — still good", taken: false, needsPower: false },
    { id: "ammo1", kind: "ammo", x: AMMO1_AT.x, z: AMMO1_AT.z, label: "HANDGUN ROUNDS +6", taken: false, needsPower: false },
    { id: "herb1", kind: "herb", x: HERB1_AT.x, z: HERB1_AT.z, label: "GREEN HERB", taken: false, needsPower: false },
    { id: "ammo2", kind: "ammo", x: AMMO2_AT.x, z: AMMO2_AT.z, label: "HANDGUN ROUNDS +6", taken: false, needsPower: false },
    { id: "crank", kind: "crank", x: CRANK_AT.x, z: CRANK_AT.z, label: "CRANK — heavy iron", taken: false, needsPower: false },
    { id: "herb2", kind: "herb", x: HERB2_AT.x, z: HERB2_AT.z, label: "GREEN HERB", taken: false, needsPower: false },
    { id: "liftkey", kind: "liftkey", x: DESK_KEY_AT.x, z: DESK_KEY_AT.z, label: "ELEVATOR KEY", taken: false, needsPower: true },
  ];

  /* ------------------------------------------------------------- setup -- */

  start(): void {
    if (this.phase !== "title") return;
    this.shamblers = SHAMBLERS_AT.map((s, i) => ({
      id: i + 1, x: s.x, z: s.z, hp: SHAMBLER_HP, state: "dormant", stateT: 0, flash: 0,
    }));
    this.setPhase("play");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase?.(p);
  }

  hasItem(kind: ItemKind): boolean {
    return this.slots.includes(kind);
  }

  private addItem(kind: ItemKind): boolean {
    const i = this.slots.indexOf(null);
    if (i < 0) return false;
    this.slots[i] = kind;
    return true;
  }

  /* ------------------------------------------------------------- combat -- */

  aim(on: boolean): void {
    if (this.player.dead) return;
    if (this.player.aiming !== on) this.events.onAim?.(on);
    this.player.aiming = on;
  }

  toggleFlash(): void {
    this.player.flashOn = !this.player.flashOn;
    this.events.onFlash?.(this.player.flashOn);
  }

  /** LMB — only from the shoulder (RE rules: no aim, no fire) */
  fire(): void {
    const p = this.player;
    if (this.phase !== "play" || p.dead || !p.aiming || p.ammo <= 0) return;
    p.ammo--;
    this.shotsFired++;
    this.emitNoise(p.x, p.z, NOISE_SHOT);
    // nearest living thing in the cone
    let best: { kind: "shambler" | "pursuer"; s?: Shambler; ang: number; d: number } | null = null;
    for (const s of this.shamblers) {
      if (s.state === "dead") continue;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > FIRE_RANGE) continue;
      const ang = Math.abs(this.angDiff(Math.atan2(dx, dz), p.heading));
      if (ang > BODY_CONE) continue;
      if (!best || d < best.d) best = { kind: "shambler", s, ang, d };
    }
    {
      const q = this.pursuer;
      if (q.state !== "asleep") {
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const d = Math.hypot(dx, dz);
        const ang = Math.abs(this.angDiff(Math.atan2(dx, dz), p.heading));
        if (d <= FIRE_RANGE && ang <= BODY_CONE && (!best || d < best.d)) best = { kind: "pursuer", ang, d };
      }
    }
    if (!best) {
      this.events.onFire?.(false, false);
      return;
    }
    this.hits++;
    const head = best.ang < HEAD_CONE;
    if (best.kind === "shambler" && best.s) {
      const s = best.s;
      s.hp -= head ? HEAD_DMG : BODY_DMG;
      s.flash = 0.2;
      if (head) {
        s.state = "stagger"; // the headshot stagger
        s.stateT = 0;
      }
      this.events.onShamblerHit?.(s, head);
      if (s.hp <= 0) {
        s.state = "dead";
        this.events.onShamblerDie?.(s);
      }
      this.events.onFire?.(head, true);
    } else {
      // the Pursuer does not die. It pauses.
      const q = this.pursuer;
      q.state = "stagger";
      q.stateT = 0;
      this.events.onPursuerStagger?.();
      this.events.onFire?.(head, true);
    }
  }

  private angDiff(a: number, b: number): number {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* -------------------------------------------------------------- noise -- */

  private emitNoise(x: number, z: number, radius: number): void {
    // shamblers wake
    for (const s of this.shamblers) {
      if (s.state !== "dormant") continue;
      if (Math.hypot(s.x - x, s.z - z) < radius) {
        s.state = "shamble";
        s.stateT = 0;
      }
    }
    // the Pursuer hears further
    const q = this.pursuer;
    if (q.state === "patrol" || q.state === "investigate") {
      if (Math.hypot(q.x - x, q.z - z) < radius * 1.6) {
        q.state = "investigate";
        q.tx = x;
        q.tz = z;
        q.stateT = 0;
      }
    }
  }

  /* --------------------------------------------------------- interact -- */

  /** the nearest interactable in reach + rough facing — drives the prompt */
  private scanInteract():
    | { type: "pickup"; pk: Pickup }
    | { type: "plate"; text: string }
    | { type: "door-director" }
    | { type: "panel" }
    | { type: "elevator" }
    | null {
    const p = this.player;
    const near = (x: number, z: number, r: number) => Math.hypot(p.x - x, p.z - z) < r;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (pk.needsPower && !this.powerOn) continue;
      if (near(pk.x, pk.z, 1.7)) return { type: "pickup", pk };
    }
    if (near(WARDB_PLATE.x, WARDB_PLATE.z, 1.8)) return { type: "plate", text: "WARD B — SEALED SHUT" };
    if (!this.directorOpen && near(D_DIRECTOR.x0 + 0.8, (D_DIRECTOR.z0 + D_DIRECTOR.z1) / 2, 1.8)) {
      return this.hasItem("crank")
        ? { type: "door-director" }
        : { type: "plate", text: "DIRECTOR'S OFFICE — NEEDS CRANK" };
    }
    if (near(PANEL_AT.x, PANEL_AT.z, 1.8)) {
      if (this.powerOn) return { type: "plate", text: "THE PANEL HUMS — POWER RESTORED" };
      return this.hasItem("fuse")
        ? { type: "panel" }
        : { type: "plate", text: "POWER PANEL — THE FUSE SOCKET IS EMPTY" };
    }
    if (near(ELEVATOR_AT.x, ELEVATOR_AT.z, 2.0)) {
      return this.hasItem("liftkey")
        ? { type: "elevator" }
        : { type: "plate", text: "THE ELEVATOR — DEAD. NO POWER, NO KEY" };
    }
    return null;
  }

  /** F — interact with whatever's in reach */
  interact(): void {
    const p = this.player;
    if (this.phase !== "play" || p.dead) return;
    const it = this.scanInteract();
    if (!it) return;
    switch (it.type) {
      case "pickup": {
        it.pk.taken = true;
        if (it.pk.kind === "ammo") {
          p.ammo += 6;
          this.events.onItem?.("ammo", it.pk.label);
        } else if (this.addItem(it.pk.kind)) {
          this.events.onItem?.(it.pk.kind, it.pk.label);
        }
        return;
      }
      case "plate":
        this.events.onDoorPlate?.(it.text);
        return;
      case "door-director":
        this.directorOpen = true;
        this.events.onDoorOpen?.("director");
        return;
      case "panel": {
        // slot the fuse — the ward hums awake
        this.slots[this.slots.indexOf("fuse")] = null;
        this.powerOn = true;
        this.events.onPowerOn?.();
        // …and something ELSE wakes up too
        const q = this.pursuer;
        q.state = "patrol";
        q.stateT = 0;
        q.tx = PURSUER_WAKE.x;
        q.tz = PURSUER_WAKE.z;
        this.events.onPursuerWake?.();
        return;
      }
      case "elevator":
        this.startFinale();
        return;
    }
  }

  /* ---------------------------------------------------------- inventory -- */

  /** F/Enter on slot i in the inventory overlay (main manages the cursor) */
  pressSlot(i: number): void {
    const item = this.slots[i];
    if (this.marked === null) {
      if (!item) return;
      if (item === "medkit") {
        // use it on the spot
        this.slots[i] = null;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 60);
        this.events.onCombine?.(); // the wrap-and-tape sound doubles here
        return;
      }
      if (item === "fuse" || item === "crank" || item === "liftkey") {
        this.events.onExamine?.(item); // rotate it in the light
        return;
      }
      this.marked = i; // a herb, marked for combining
      return;
    }
    if (i === this.marked) {
      this.marked = null;
      return;
    }
    if (this.slots[this.marked] === "herb" && item === "herb") {
      // herb + herb = medkit
      this.slots[this.marked] = "medkit";
      this.slots[i] = null;
      this.marked = null;
      this.events.onCombine?.();
      return;
    }
    this.marked = item ? i : null;
  }

  /* -------------------------------------------------------------- AI ---- */

  private foeMove(x: number, z: number, tx: number, tz: number, dt: number, speed: number): [number, number] {
    const step = (gx: number, gz: number): [number, number] | null => {
      const dx = gx - x;
      const dz = gz - z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = x + (dx / d) * speed * dt;
      const nz = z + (dz / d) * speed * dt;
      return inBounds(nx, nz, this.directorOpen, false) ? [nx, nz] : null;
    };
    return step(tx, tz) ?? step(0, z) ?? step(x, tz) ?? [x, z]; // funnel to the spine
  }

  private updateShambler(s: Shambler, dt: number): void {
    const p = this.player;
    s.flash = Math.max(0, s.flash - dt);
    if (s.state === "dead") return;
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    switch (s.state) {
      case "dormant":
        // the flashlight in its eyes wakes it too
        if (p.flashOn && d < 8 && !p.dead) {
          s.state = "shamble";
          s.stateT = 0;
        }
        break;
      case "shamble":
        if (p.dead) break;
        if (d < 1.9) {
          s.state = "windup";
          s.stateT = 0;
        } else {
          [s.x, s.z] = this.foeMove(s.x, s.z, p.x, p.z, dt, 1.25);
        }
        break;
      case "windup":
        if (s.stateT > 0.45) {
          s.state = "lunge";
          s.stateT = 0;
          if (d < 2.3) this.hurtPlayer(15);
        }
        break;
      case "lunge":
        if (s.stateT > 0.5) {
          s.state = "shamble";
          s.stateT = 0;
        }
        break;
      case "stagger":
        if (s.stateT > 1.2) {
          s.state = "shamble";
          s.stateT = 0;
        }
        break;
    }
    s.stateT += dt;
  }

  private updatePursuer(q: Pursuer, dt: number): void {
    const p = this.player;
    if (q.state === "asleep") return;
    q.hitCD = Math.max(0, q.hitCD - dt);
    const d = Math.hypot(p.x - q.x, p.z - q.z);

    // sight: the beam gives you away (or standing close in the dark)
    if ((q.state === "patrol" || q.state === "investigate") && !p.dead && this.phase === "play") {
      if ((p.flashOn && d < 10) || d < 3.5) {
        q.state = "chase";
        this.events.onPursuerChase?.();
      }
    }

    switch (q.state) {
      case "patrol": {
        const nodes = [
          [0, -12], [0, -30], [0, -46], [0, -54],
        ];
        const n = nodes[Math.floor(this.time / 7) % nodes.length];
        q.tx = n[0];
        q.tz = n[1];
        [q.x, q.z] = this.foeMove(q.x, q.z, q.tx, q.tz, dt, 1.6);
        break;
      }
      case "investigate":
        [q.x, q.z] = this.foeMove(q.x, q.z, q.tx, q.tz, dt, 2.6);
        if (Math.hypot(q.x - q.tx, q.z - q.tz) < 1.2 || q.stateT > 6) {
          q.state = "patrol";
          q.stateT = 0;
        }
        break;
      case "chase":
        if (p.dead) {
          q.state = "patrol";
          break;
        }
        q.tx = p.x;
        q.tz = p.z;
        [q.x, q.z] = this.foeMove(q.x, q.z, q.tx, q.tz, dt, 3.9);
        if (d > 18) {
          q.state = "investigate"; // lost you — it walks to where you were
          q.stateT = 0;
        }
        if (d < 1.5 && q.hitCD <= 0) {
          q.hitCD = 1.6; // the blow, then it savors the corridor
          this.hurtPlayer(30);
          // shove the player back down the corridor
          const dx = p.x - q.x;
          const dz = p.z - q.z;
          const dd = Math.hypot(dx, dz) || 1;
          const nx = p.x + (dx / dd) * 1.6;
          const nz = p.z + (dz / dd) * 1.6;
          if (inBounds(nx, nz, this.directorOpen, this.liftOpen)) {
            p.x = nx;
            p.z = nz;
          }
        }
        break;
      case "stagger":
        if (q.stateT > 3) {
          q.state = "chase"; // it remembers
          q.stateT = 0;
        }
        break;
    }
    q.stateT += dt;
  }

  private hurtPlayer(dmg: number): void {
    const p = this.player;
    if (p.dead) return;
    p.hp -= dmg;
    this.events.onPlayerHit?.(dmg);
    if (p.hp <= 0) {
      p.dead = true;
      this.deaths++;
      this.deadT = 0;
      this.events.onFlatline?.();
    }
  }

  private respawn(): void {
    const p = this.player;
    p.x = LOBBY.x0 + 5;
    p.z = LOBBY.z1 - 2;
    p.heading = Math.PI;
    p.hp = p.maxHp;
    p.dead = false;
    p.aiming = false;
    // the ward forgets the fight; the puzzle state stays
    this.shamblers = SHAMBLERS_AT.map((s, i) => {
      const old = this.shamblers[i];
      return {
        id: i + 1, x: s.x, z: s.z, hp: SHAMBLER_HP,
        state: old && old.state === "dead" ? "dead" : "dormant", stateT: 0, flash: 0,
      };
    });
    const q = this.pursuer;
    if (q.state !== "asleep") {
      q.x = PURSUER_WAKE.x;
      q.z = PURSUER_WAKE.z;
      q.state = "patrol";
      q.stateT = 0;
    }
    this.events.onRespawn?.();
  }

  /* ------------------------------------------------------------- finale -- */

  private startFinale(): void {
    this.liftOpen = true;
    this.setPhase("finale");
    this.finaleT = 0;
    // the player steps in; the doors begin
    this.player.x = 0;
    this.player.z = -58.6;
    this.player.heading = 0; // facing back up the corridor (+z is behind the doors)
    // it KNOWS
    const q = this.pursuer;
    q.state = "chase";
    q.stateT = 0;
    q.x = 0;
    q.z = -30; // far up the corridor — the run begins
    this.events.onFinale?.();
  }

  /* ------------------------------------------------------------- update -- */

  update(dt: number, move: { x: number; z: number }, fast: boolean, turn: number): void {
    if (this.phase === "title" || this.phase === "results") return;
    this.time += dt;
    const p = this.player;

    if (p.dead) {
      this.deadT += dt;
      if (this.deadT > 2.8) this.respawn();
      return;
    }

    if (this.phase === "finale") {
      this.finaleT += dt;
      // it charges the closing doors
      const q = this.pursuer;
      const t = this.finaleT;
      if (t < 2.5) {
        q.z = -30 + (t / 2.5) * 25.2; // from up the corridor to the doors
        q.x = 0;
      } else if (t < 3.4) {
        q.z = -56.6; // AT the doors
        if (!this.armCaught) {
          this.armCaught = true;
          this.events.onDoorArm?.(); // the doors shut ON ITS HAND
        }
      }
      if (t > 3.8) {
        this.setPhase("results");
        this.events.onSurvived?.();
      }
      return;
    }

    /* ---- play ---- */
    p.heading += turn * TURN * dt;

    const mag = Math.hypot(move.x, move.z);
    if (mag > 0.01) {
      const spd = p.aiming ? AIM_WALK : fast ? FAST : WALK;
      // heading-forward movement (first person)
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const rx = -fz;
      const rz = fx;
      const mx = fx * -move.z + rx * move.x;
      const mz = fz * -move.z + rz * move.x;
      const mm = Math.hypot(mx, mz) || 1;
      const nx = p.x + (mx / mm) * spd * dt;
      const nz = p.z + (mz / mm) * spd * dt;
      if (inBounds(nx, nz, this.directorOpen, this.liftOpen)) {
        p.x = nx;
        p.z = nz;
      }
      this.stepAcc += spd * dt;
      if (this.stepAcc > 1.9) {
        this.stepAcc = 0;
        this.events.onStep?.(fast);
        this.emitNoise(p.x, p.z, fast ? NOISE_FAST : NOISE_STEP);
      }
    }

    // the prompt (HUD reads it)
    const it = this.scanInteract();
    this.prompt =
      !it ? "" :
      it.type === "pickup" ? `F — TAKE ${it.pk.label}` :
      it.type === "door-director" ? "F — CRANK THE DOOR OPEN" :
      it.type === "panel" ? "F — SLOT THE FUSE" :
      it.type === "elevator" ? "F — THE ELEVATOR (GO)" :
      `F — READ: ${it.text}`;

    for (const s of this.shamblers) this.updateShambler(s, dt);
    this.updatePursuer(this.pursuer, dt);
  }

  private deadT = 0;
  private armCaught = false;

  /* ------------------------------------------------------ harness hooks -- */

  autostart(): void {
    this.start();
  }

  teleport(x: number, z: number): void {
    this.player.x = x;
    this.player.z = z;
  }

  face(x: number, z: number): void {
    this.player.heading = Math.atan2(x - this.player.x, z - this.player.z);
  }

  giveItem(kind: ItemKind): void {
    this.addItem(kind);
  }

  heal(): void {
    this.player.hp = this.player.maxHp;
  }

  giveAmmo(n: number): void {
    this.player.ammo = n;
  }

  forcePowerOn(): void {
    if (this.powerOn) return;
    this.powerOn = true;
    this.directorOpen = true;
    this.events.onPowerOn?.();
    const q = this.pursuer;
    q.state = "patrol";
    q.stateT = 0;
    this.events.onPursuerWake?.();
  }

  wakePursuer(state: PursuerState = "patrol"): void {
    this.pursuer.state = state;
    this.pursuer.stateT = 0;
  }

  killShamblers(): void {
    for (const s of this.shamblers) {
      if (s.state !== "dead") {
        s.state = "dead";
        this.events.onShamblerDie?.(s);
      }
    }
  }

  debugFinish(): void {
    if (this.phase === "title") this.start();
    this.powerOn = true;
    this.directorOpen = true;
    this.shotsFired = Math.max(this.shotsFired, 14);
    this.hits = Math.max(this.hits, 9);
    this.slots[0] = this.slots[0] ?? "herb";
    this.time = Math.max(this.time, 552);
    this.setPhase("results");
    this.events.onSurvived?.();
  }
}
