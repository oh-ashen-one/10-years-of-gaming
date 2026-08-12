/**
 * audio.ts — every sound in the neighborhood, synthesized on the core
 * Synth (§2.5): morning ambience (wind + bird chirps), footsteps, the
 * rustle/encounter stings, throw → wobble → GOTCHA one-shots, the title
 * jingle and the gym fanfare. No samples, no silence, no test tones.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private wind: LoopVoice | null = null;
  private chirpT = 2;
  private started = false;

  /** Must be called from a user gesture (first input). */
  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.wind = this.synth.makeNoiseVoice({ filterType: "lowpass", filterFreq: 320, q: 0.5 });
    this.wind.setGain(0.05, 0.5);
  }

  get ready(): boolean {
    return this.started;
  }

  /** Morning birds, on a loose timer — call each frame while walking. */
  update(dt: number): void {
    if (!this.started) return;
    this.chirpT -= dt;
    if (this.chirpT <= 0) {
      this.chirpT = 2.5 + Math.random() * 5;
      const base = 2200 + Math.random() * 1200;
      this.synth.tone(base, 0.09, "sine", 0.05, base * 1.4);
      setTimeout(() => this.synth.tone(base * 1.2, 0.07, "sine", 0.04, base * 0.9), 120);
    }
  }

  footstep(alt: boolean): void {
    this.synth.noiseShot(0.07, "lowpass", alt ? 700 : 560, 220, 0.10);
  }

  rustle(): void {
    this.synth.noiseShot(0.3, "bandpass", 900, 2400, 0.12);
  }

  pop(): void {
    this.synth.tone(500, 0.12, "square", 0.14, 900);
    this.synth.noiseShot(0.1, "highpass", 1200, 2400, 0.08);
  }

  encounterSting(): void {
    [660, 880, 990].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.14, "square", 0.14), i * 90));
  }

  berry(): void {
    this.synth.tone(780, 0.12, "sine", 0.16, 1180);
    setTimeout(() => this.synth.tone(1180, 0.14, "sine", 0.12), 100);
  }

  throwWhoosh(): void {
    this.synth.noiseShot(0.4, "bandpass", 500, 2600, 0.2);
  }

  ballHit(): void {
    this.synth.tone(300, 0.1, "square", 0.2, 180);
    this.synth.noiseShot(0.08, "lowpass", 1400, 400, 0.16);
  }

  miss(): void {
    this.synth.noiseShot(0.25, "lowpass", 800, 200, 0.12);
    this.synth.tone(220, 0.18, "sine", 0.1, 130);
  }

  wobbleTick(n: number): void {
    this.synth.tone(340 + n * 40, 0.1, "triangle", 0.18, 300 + n * 40);
  }

  gotcha(): void {
    // the GOTCHA burst: bright little fanfare
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.22, "square", 0.16);
        this.synth.tone(f / 2, 0.22, "triangle", 0.1);
      }, i * 95));
    this.synth.noiseShot(0.5, "highpass", 2000, 5000, 0.1);
  }

  breakout(): void {
    this.synth.noiseShot(0.2, "bandpass", 1800, 500, 0.2);
    [520, 390, 260].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.16, "sawtooth", 0.1), i * 110));
  }

  flee(): void {
    this.synth.noiseShot(0.5, "bandpass", 600, 3600, 0.16);
    this.synth.tone(900, 0.4, "sine", 0.1, 1600);
  }

  titleJingle(): void {
    // cheerful morning arpeggio — the "let's go outside" theme
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.26, "square", 0.13);
        this.synth.tone(f / 2, 0.26, "triangle", 0.09);
      }, i * 160));
  }

  gymStart(): void {
    [220, 220, 330, 440].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.22, "sawtooth", 0.12), i * 160));
  }

  attack(): void {
    this.synth.noiseShot(0.14, "bandpass", 1400, 500, 0.2);
    this.synth.tone(500, 0.1, "square", 0.14, 240);
  }

  telegraph(): void {
    this.synth.tone(180, 0.5, "sawtooth", 0.12, 150);
  }

  slam(hit: boolean): void {
    this.synth.noiseShot(0.3, "lowpass", 900, 120, hit ? 0.4 : 0.2);
    this.synth.tone(90, 0.25, "sine", hit ? 0.35 : 0.18, 45);
  }

  dodge(): void {
    this.synth.noiseShot(0.16, "bandpass", 900, 2400, 0.12);
  }

  gymFanfare(): void {
    const notes = [523, 659, 784, 1047, 988, 1047, 1319, 1568];
    notes.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.34, "square", 0.14);
        this.synth.tone(f / 2, 0.34, "triangle", 0.1);
      }, i * 170));
  }

  faint(): void {
    [440, 330, 220, 165].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.3, "sawtooth", 0.1), i * 200));
  }

  click(): void {
    this.synth.tone(1600, 0.05, "square", 0.08);
  }
}
