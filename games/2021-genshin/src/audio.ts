/**
 * audio.ts — the meadow's synth voice on the core Synth: wind bed,
 * butterflies-birdsong, slash whooshes per stance, the vortex pull, the
 * flame ring, the burst stingers (wind/flame), the swirl chime-bloom,
 * perfect-dodge shimmer + slow-mo whoomp, boss telegraphs, core ping,
 * the chest fanfare.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private wind: LoopVoice | null = null;
  private chirpT = 3;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.wind = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 500, q: 0.5 });
    this.wind.setGain(0.05, 0.6);
  }

  get ready(): boolean {
    return this.started;
  }

  update(dt: number, gliding: boolean): void {
    if (!this.started) return;
    this.wind?.setGain(gliding ? 0.16 : 0.05, 0.3);
    this.wind?.setFilterFreq(gliding ? 900 : 500, 0.3);
    this.chirpT -= dt;
    if (this.chirpT <= 0) {
      this.chirpT = 3 + Math.random() * 5;
      const f = 2400 + Math.random() * 1200;
      this.synth.tone(f, 0.08, "sine", 0.035, f * 1.35);
    }
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.05, "bandpass", alt ? 1300 : 1100, 500, 0.05);
  }

  slash(stance: 1 | 2): void {
    if (stance === 1) this.synth.noiseShot(0.12, "bandpass", 1400, 3200, 0.16);
    else this.synth.noiseShot(0.16, "lowpass", 1200, 300, 0.22);
  }

  hit(kind: string): void {
    if (kind === "pyro") this.synth.tone(220, 0.09, "sawtooth", 0.14, 110);
    else this.synth.tone(520, 0.06, "square", 0.1, 300);
  }

  skill(stance: 1 | 2): void {
    if (stance === 1) {
      this.synth.noiseShot(0.5, "bandpass", 600, 2600, 0.2);
      this.synth.tone(300, 0.4, "sine", 0.1, 700);
    } else {
      this.synth.noiseShot(0.4, "lowpass", 1600, 200, 0.3);
      this.synth.tone(120, 0.3, "sawtooth", 0.16, 60);
    }
  }

  burst(stance: 1 | 2): void {
    // camera-snap stinger
    const base = stance === 1 ? [523, 784, 1047, 1568] : [392, 587, 784, 1175];
    base.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.3, "square", 0.14);
        this.synth.tone(f / 2, 0.3, "triangle", 0.1);
      }, i * 90));
    this.synth.noiseShot(0.6, "bandpass", 800, 3200, 0.16);
  }

  swirl(): void {
    // the reaction bloom: bright chirp cascade
    [880, 1175, 1568, 2093].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.12, "sine", 0.1), i * 45));
  }

  dodge(): void {
    this.synth.noiseShot(0.14, "bandpass", 900, 2400, 0.12);
  }

  perfectDodge(): void {
    this.synth.tone(1800, 0.4, "sine", 0.12, 900);
    this.synth.noiseShot(0.3, "highpass", 2400, 600, 0.1);
  }

  playerHit(): void {
    this.synth.tone(200, 0.12, "sawtooth", 0.18, 90);
  }

  telegraph(kind: string): void {
    if (kind === "spin") this.synth.tone(140, 0.7, "sawtooth", 0.14, 220);
    else if (kind === "volley") this.synth.tone(660, 0.3, "square", 0.12, 440);
    else this.synth.tone(180, 0.3, "sawtooth", 0.14, 90);
  }

  missile(): void {
    this.synth.noiseShot(0.3, "bandpass", 1200, 500, 0.12);
  }

  core(): void {
    this.synth.tone(990, 0.4, "square", 0.12);
    setTimeout(() => this.synth.tone(1320, 0.4, "square", 0.1), 180);
  }

  ring(): void {
    this.synth.tone(700, 0.14, "sine", 0.12, 1050);
    setTimeout(() => this.synth.tone(1050, 0.16, "sine", 0.1), 100);
  }

  glide(open: boolean): void {
    if (open) this.synth.noiseShot(0.35, "highpass", 700, 300, 0.24);
  }

  climb(): void {
    this.synth.noiseShot(0.08, "bandpass", 900, 500, 0.08);
  }

  land(): void {
    this.synth.noiseShot(0.14, "lowpass", 800, 200, 0.2);
  }

  bossDown(): void {
    [330, 415, 494, 659, 880].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.4, "sawtooth", 0.12);
        this.synth.tone(f * 2, 0.3, "triangle", 0.08);
      }, i * 170));
  }

  chest(): void {
    [659, 784, 988, 1319, 1568].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.2, "square", 0.12), i * 90));
  }

  titleSting(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.3, "sine", 0.12);
        this.synth.tone(f / 2, 0.3, "triangle", 0.08);
      }, i * 170));
  }
}
