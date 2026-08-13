/**
 * audio.ts — the gloom's voice on the core Synth: wind over the moor, a
 * low drone, sword whooshes (light/heavy), the parry CLANG, roll cloth,
 * guard thuds, the flask glug, grace chimes, the fog-gate shimmer, boss
 * telegraph drones, the hammer's gold crash, YOU DIED's low bell, and
 * the FELLED chord.
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
    this.wind = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 380, q: 0.5 });
    this.wind.setGain(0.06, 0.8);
    this.drone = this.synth.makeOscVoice({ type: "triangle", freq: 55, filterFreq: 300 });
    this.drone.setGain(0.04, 1.0);
  }

  get ready(): boolean {
    return this.started;
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.06, "lowpass", alt ? 640 : 560, 240, 0.05);
  }

  swing(heavy: boolean): void {
    if (heavy) this.synth.noiseShot(0.3, "bandpass", 500, 1800, 0.2);
    else this.synth.noiseShot(0.14, "bandpass", 1000, 2600, 0.14);
  }

  hit(): void {
    this.synth.noiseShot(0.1, "lowpass", 1300, 350, 0.2);
    this.synth.tone(240, 0.08, "square", 0.12, 120);
  }

  parry(): void {
    // THE clang
    this.synth.tone(1568, 0.4, "square", 0.16);
    this.synth.tone(784, 0.4, "square", 0.12);
    this.synth.noiseShot(0.2, "highpass", 3000, 5200, 0.12);
  }

  riposte(): void {
    this.synth.tone(90, 0.4, "sawtooth", 0.24, 45);
    this.synth.noiseShot(0.3, "lowpass", 1800, 200, 0.3);
    setTimeout(() => this.synth.tone(660, 0.2, "square", 0.1), 200);
  }

  roll(): void {
    this.synth.noiseShot(0.16, "lowpass", 900, 300, 0.1);
  }

  guard(): void {
    this.synth.noiseShot(0.08, "bandpass", 1600, 700, 0.16);
    this.synth.tone(180, 0.08, "square", 0.1, 100);
  }

  guardBreak(): void {
    this.synth.tone(140, 0.5, "sawtooth", 0.2, 60);
    this.synth.noiseShot(0.3, "lowpass", 1000, 200, 0.24);
  }

  playerHit(): void {
    this.synth.tone(180, 0.14, "sawtooth", 0.2, 80);
    this.synth.noiseShot(0.12, "lowpass", 900, 250, 0.18);
  }

  flask(): void {
    this.synth.tone(300, 0.12, "sine", 0.12, 480);
    setTimeout(() => this.synth.tone(480, 0.16, "sine", 0.1, 620), 130);
    this.synth.noiseShot(0.2, "bandpass", 700, 1400, 0.06);
  }

  grace(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "sine", 0.08), i * 220));
  }

  scarab(): void {
    [988, 1319, 1568].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.12, "square", 0.1), i * 70));
  }

  hint(): void {
    this.synth.tone(660, 0.3, "triangle", 0.1);
  }

  fogGate(): void {
    this.synth.noiseShot(0.9, "bandpass", 600, 2000, 0.16);
    this.synth.tone(220, 0.8, "sine", 0.1, 440);
  }

  bossMove(move: string): void {
    if (move === "overhead") this.synth.tone(110, 0.9, "sawtooth", 0.12, 70);
    else if (move === "hammer") this.synth.tone(196, 0.7, "square", 0.12, 98);
    else if (move === "tail") this.synth.noiseShot(0.3, "bandpass", 500, 1400, 0.12);
    else this.synth.tone(147, 0.4, "sawtooth", 0.1, 90);
  }

  hammerSlam(): void {
    this.synth.noiseShot(0.5, "lowpass", 1600, 100, 0.5);
    this.synth.tone(70, 0.5, "sine", 0.4, 30);
    this.synth.tone(1568, 0.3, "square", 0.08);
  }

  phase2(): void {
    [220, 277, 330, 440].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "sawtooth", 0.12), i * 180));
  }

  youDied(): void {
    this.synth.tone(98, 1.6, "sine", 0.2, 49);
    this.synth.tone(147, 1.2, "triangle", 0.12, 73);
  }

  felled(): void {
    // gold shower chord
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
