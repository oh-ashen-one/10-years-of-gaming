/**
 * audio.ts — the valley's voice on the core Synth: wind through the
 * gallery, a waltz-ish drone, rapier swishes, the aim tick and the shot,
 * the ink lance's wet streak, the parry's GILT CHIME, the dodge's silk
 * swish, the cannon's charge, the overpaint's orchestral repaint, the
 * flag's flourish, the petal dissolve, and the expedition's final cadence.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private wind: LoopVoice | null = null;
  private drone: LoopVoice | null = null;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.wind = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 480, q: 0.4 });
    this.wind.setGain(0.05, 0.8);
    this.drone = this.synth.makeOscVoice({ type: "triangle", freq: 73.4, filterFreq: 320 });
    this.drone.setGain(0.035, 1.0);
  }

  get ready(): boolean {
    return this.started;
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.05, "lowpass", alt ? 760 : 680, 300, 0.04);
  }

  swing(kind: string): void {
    if (kind === "strike") this.synth.noiseShot(0.12, "bandpass", 1100, 2600, 0.13);
    else if (kind === "aim") {
      this.synth.noiseShot(0.06, "highpass", 2400, 4800, 0.14);
      this.synth.tone(1320, 0.06, "square", 0.08);
    } else if (kind === "lance") {
      this.synth.noiseShot(0.28, "bandpass", 600, 2400, 0.18);
      this.synth.tone(392, 0.25, "sawtooth", 0.1, 196);
    } else if (kind === "overpaint") {
      [262, 330, 392, 523].forEach((f, i) =>
        setTimeout(() => this.synth.tone(f, 0.7, "triangle", 0.12), i * 120));
      this.synth.noiseShot(0.6, "bandpass", 800, 2600, 0.16);
    }
  }

  hit(): void {
    this.synth.noiseShot(0.09, "lowpass", 1500, 400, 0.18);
    this.synth.tone(280, 0.07, "square", 0.1, 160);
  }

  weak(): void {
    this.synth.tone(1568, 0.3, "sine", 0.12);
    this.synth.tone(784, 0.2, "square", 0.08);
  }

  /** THE gilt chime — the parry */
  parry(): void {
    this.synth.tone(1760, 0.4, "square", 0.14);
    this.synth.tone(880, 0.35, "square", 0.1);
    this.synth.noiseShot(0.18, "highpass", 3200, 5600, 0.1);
  }

  gradientBreak(): void {
    [2093, 1568, 1047, 784].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.3, "square", 0.12), i * 90));
    this.synth.noiseShot(0.5, "lowpass", 2400, 300, 0.24);
  }

  dodge(): void {
    this.synth.noiseShot(0.14, "lowpass", 1200, 400, 0.08);
  }

  telegraph(kind: string): void {
    if (kind === "cannon") this.synth.tone(110, 1.1, "sawtooth", 0.12, 220); // the charge rises
    else if (kind === "jab") this.synth.tone(196, 0.3, "square", 0.08, 147);
    else this.synth.noiseShot(0.4, "bandpass", 400, 1200, 0.08);
  }

  playerHit(): void {
    this.synth.tone(165, 0.14, "sawtooth", 0.2, 82);
    this.synth.noiseShot(0.12, "lowpass", 900, 250, 0.16);
  }

  picto(): void {
    [1047, 1319, 1760].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.2, "triangle", 0.1), i * 80));
  }

  flag(): void {
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "triangle", 0.1), i * 160));
  }

  battleStart(): void {
    this.synth.tone(220, 0.5, "sawtooth", 0.1, 110);
    this.synth.tone(330, 0.4, "triangle", 0.08);
  }

  battleWon(): void {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "triangle", 0.1), i * 180));
  }

  dissolve(): void {
    this.synth.noiseShot(0.8, "highpass", 1800, 4200, 0.08);
    [880, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "sine", 0.06), i * 150));
  }

  youFell(): void {
    this.synth.tone(98, 1.6, "sine", 0.2, 49);
    this.synth.tone(147, 1.2, "triangle", 0.1, 73);
  }

  card(): void {
    // the final cadence — strings and gold
    [262, 330, 392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 1.0, "triangle", 0.1);
        this.synth.tone(f / 2, 1.2, "sine", 0.06);
      }, i * 260));
  }

  titleSting(): void {
    [196, 262, 330, 392].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.7, "triangle", 0.1), i * 260));
  }
}
