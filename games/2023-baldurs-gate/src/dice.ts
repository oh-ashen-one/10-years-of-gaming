/**
 * dice.ts — the physical tumbling d20. THE star of the show: a chunky
 * gold-inked twenty-sider that hurls in from the left, bounces with
 * squash-and-stretch across the screen, its face flickering through
 * numbers, then SETTLES — modifier flyouts stack (+3 PROF), the total
 * slams against the DC, and the verdict lands (CRIT! / SUCCESS / FAIL)
 * with a stinger. Canvas 2D physics; the game gets the settled value.
 */

export interface RollShow {
  label: string;      // "INTIMIDATION"
  dc: number;
  mod: number;
  forced: number | null;
}

export class DiceStage {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private active = false;
  private t = 0;
  private show: RollShow | null = null;
  private onSettled: (v: number) => void = () => {};
  private face = 1;
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private rot = 0;
  private vrot = 0;
  private settledV = 0;

  constructor() {
    this.cv = document.getElementById("dice") as HTMLCanvasElement;
    this.ctx = this.cv.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize(): void {
    this.cv.width = window.innerWidth;
    this.cv.height = window.innerHeight;
  }

  /** hurl the die. onSettled fires with the (possibly forced) value. */
  roll(show: RollShow, onSettled: (v: number) => void): void {
    this.show = show;
    this.onSettled = onSettled;
    this.active = true;
    this.t = 0;
    this.face = 1 + Math.floor(Math.random() * 20);
    const w = this.cv.width;
    const h = this.cv.height;
    this.x = -80;
    this.y = h * 0.55;
    this.vx = w * 0.55;
    this.vy = -h * 0.32;
    this.rot = 0;
    this.vrot = 9;
    this.settledV = 0;
  }

  private ground(): number {
    return this.cv.height * 0.68;
  }

  update(dt: number): void {
    if (!this.active || !this.show) return;
    const g = this.ctx;
    const W = this.cv.width;
    const H = this.cv.height;
    this.t += dt;
    g.clearRect(0, 0, W, H);

    // tumble phase (0 → 1.15s)
    if (this.t < 1.15) {
      this.vy += 2400 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vrot * dt;
      if (this.y > this.ground()) {
        this.y = this.ground();
        this.vy = -Math.abs(this.vy) * 0.52;
        this.vx *= 0.72;
        this.vrot *= 0.7;
      }
      if (Math.floor(this.t / 0.07) !== Math.floor((this.t - dt) / 0.07)) {
        this.face = 1 + Math.floor(Math.random() * 20);
      }
    } else {
      // settle: slide to center, face locks to the result
      if (this.settledV === 0) {
        this.settledV = this.show.forced ?? 1 + Math.floor(Math.random() * 20);
      }
      this.face = this.settledV;
      this.x += (W * 0.5 - this.x) * Math.min(1, dt * 6);
      this.y += (this.ground() - 30 - this.y) * Math.min(1, dt * 6);
      this.rot += (Math.round(this.rot / (Math.PI * 2)) * Math.PI * 2 - this.rot) * Math.min(1, dt * 6);
    }

    const settleK = Math.max(0, Math.min(1, (this.t - 1.15) / 0.35));
    const scale = 1 + Math.sin(settleK * Math.PI) * 0.25;

    // the die: chunky gold-inked d20
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot);
    g.scale(scale, scale * (this.t < 1.15 && this.y >= this.ground() - 1 ? 0.82 : 1));
    const R = 64;
    // body
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(a) * R;
      const py = Math.sin(a) * R;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = "#2a1a30";
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#f0d890";
    g.stroke();
    // facet lines
    g.beginPath();
    for (let i = 0; i < 6; i += 2) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94);
    }
    g.strokeStyle = "rgba(240,216,144,0.4)";
    g.lineWidth = 2.5;
    g.stroke();
    // the face
    g.fillStyle = "#f0d890";
    g.font = "italic 900 52px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(this.face), 0, 4);
    g.restore();

    // label + tally after settling
    if (this.t > 0.2) {
      g.font = "italic 900 30px Georgia, serif";
      g.textAlign = "center";
      g.fillStyle = "#f0d890";
      g.fillText(`${this.show.label} — DC ${this.show.dc}`, W / 2, this.ground() - 130);
    }
    if (settleK > 0.4) {
      const v = this.settledV;
      g.font = "italic 700 26px Georgia, serif";
      g.fillStyle = "#c8b8a8";
      g.fillText(`${v} + ${this.show.mod} = ${v + this.show.mod}`, W / 2, this.ground() + 60);
    }
    if (settleK > 0.75) {
      const v = this.settledV;
      const critWin = v === 20;
      const critFail = v === 1;
      const success = critWin || (!critFail && v + this.show.mod >= this.show.dc);
      g.font = "italic 900 46px Georgia, serif";
      g.fillStyle = critWin ? "#ffe98a" : critFail ? "#e04a3a" : success ? "#8fe08a" : "#e04a3a";
      const text = critWin ? "CRITICAL!" : critFail ? "CRITICAL FAIL" : success ? "SUCCESS" : "FAILURE";
      g.fillText(text, W / 2, this.ground() + 110);
    }

    // hand back to the game
    if (this.t > 2.6) {
      this.active = false;
      g.clearRect(0, 0, W, H);
      this.onSettled(this.settledV);
    }
  }

  get busy(): boolean {
    return this.active;
  }
}
