/**
 * audio.ts — the peak's voice on the core Synth: mountain wind, a temple
 * drone, staff whooshes, the bamboo KNOCK of a landed hit, the focus slam's
 * boom, the perfect-dodge shimmer bell, the immobilize seal chime, the
 * gourd glug, shrine chimes, the fog-curtain shimmer, claw/pounce/roar
 * telegraphs, the phase-2 sword sting, the fall bell, and the felled chord.
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
    this.wind = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 520, q: 0.4 });
    this.wind.setGain(0.05, 0.8);
    this.drone = this.synth.makeOscVoice({ type: "triangle", freq: 65.4, filterFreq: 260 });
    this.drone.setGain(0.035, 1.0);
  }

  get ready(): boolean {
    return this.started;
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.05, "lowpass", alt ? 700 : 620, 260, 0.045);
  }

  swing(heavy: boolean): void {
    if (heavy) this.synth.noiseShot(0.3, "bandpass", 420, 1500, 0.2);
    else this.synth.noiseShot(0.13, "bandpass", 900, 2400, 0.13);
  }

  /** the bamboo knock of a landed staff */
  knock(): void {
    this.synth.tone(820, 0.07, "square", 0.14, 620);
    this.synth.noiseShot(0.08, "lowpass", 1600, 400, 0.18);
  }

  heavySlam(): void {
    this.synth.noiseShot(0.4, "lowpass", 1500, 120, 0.42);
    this.synth.tone(75, 0.4, "sine", 0.36, 34);
  }

  dodge(): void {
    this.synth.noiseShot(0.14, "lowpass", 1000, 340, 0.09);
  }

  /** the shimmer bell — time just bent */
  perfectDodge(): void {
    this.synth.tone(2093, 0.5, "sine", 0.14);
    this.synth.tone(1568, 0.4, "sine", 0.1);
    this.synth.noiseShot(0.3, "highpass", 3600, 6400, 0.08);
  }

  /** the golden seal chime */
  immobilize(): void {
    [1319, 1760, 2637].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "triangle", 0.1), i * 90));
  }

  stance(): void {
    this.synth.tone(660, 0.08, "square", 0.1, 520);
    this.synth.noiseShot(0.05, "lowpass", 1400, 500, 0.1);
  }

  gourd(): void {
    this.synth.tone(280, 0.12, "sine", 0.12, 460);
    setTimeout(() => this.synth.tone(440, 0.16, "sine", 0.1, 580), 130);
    this.synth.noiseShot(0.18, "bandpass", 800, 1500, 0.05);
  }

  gourdEmpty(): void {
    this.synth.tone(220, 0.2, "square", 0.08, 180);
  }

  shrine(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "sine", 0.08), i * 220));
  }

  fogGate(): void {
    this.synth.noiseShot(0.9, "bandpass", 500, 1800, 0.15);
    this.synth.tone(196, 0.8, "sine", 0.1, 392);
  }

  bossMove(move: string): void {
    if (move === "claw") this.synth.noiseShot(0.16, "bandpass", 700, 2200, 0.13);
    else if (move === "pounce") this.synth.tone(98, 0.6, "sawtooth", 0.14, 60);
    else if (move === "bloodslam") {
      this.synth.tone(65, 0.6, "sine", 0.24, 32);
      this.synth.noiseShot(0.4, "lowpass", 900, 140, 0.3);
    } else if (move === "whirlwind") this.synth.noiseShot(0.3, "bandpass", 1200, 3200, 0.16);
    else if (move === "roar") {
      this.synth.tone(88, 0.9, "sawtooth", 0.24, 55);
      this.synth.noiseShot(0.7, "lowpass", 700, 200, 0.2);
    }
  }

  phase2(): void {
    // the sword leaves its sheath
    this.synth.noiseShot(0.4, "highpass", 2400, 5200, 0.12);
    [220, 277, 330, 440].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "sawtooth", 0.11), i * 180));
  }

  playerHit(): void {
    this.synth.tone(170, 0.14, "sawtooth", 0.2, 80);
    this.synth.noiseShot(0.12, "lowpass", 900, 250, 0.18);
  }

  youDied(): void {
    this.synth.tone(98, 1.6, "sine", 0.2, 49);
    this.synth.tone(147, 1.2, "triangle", 0.12, 73);
  }

  felled(): void {
    // the gold seal burst chord
    [262, 330, 392, 523, 659].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.8, "triangle", 0.11);
        this.synth.tone(f * 2, 0.5, "sine", 0.06);
      }, i * 200));
  }

  titleSting(): void {
    [196, 262, 330, 392].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.7, "triangle", 0.1), i * 260));
  }
}
