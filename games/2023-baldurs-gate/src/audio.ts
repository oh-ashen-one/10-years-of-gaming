/**
 * audio.ts — the tollhouse in synth: the tavern murmur + crackling fire,
 * lute-ish plucks, the DICE CLATTER (the important one), crit/fail
 * stingers, sword clangs, the shove whoosh, the river splash, grease
 * splat + fire whoomph, the chest's golden chord.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private fire: LoopVoice | null = null;
  private pluckT = 4;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.fire = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 700, q: 0.6 });
    this.fire.setGain(0.03, 0.8);
  }

  get ready(): boolean {
    return this.started;
  }

  update(dt: number): void {
    if (!this.started) return;
    this.pluckT -= dt;
    if (this.pluckT <= 0) {
      this.pluckT = 4 + Math.random() * 6;
      // a lazy tavern pluck figure
      const scale = [262, 330, 392, 440];
      const f = scale[Math.floor(Math.random() * scale.length)];
      this.synth.tone(f, 0.5, "triangle", 0.05);
      setTimeout(() => this.synth.tone(f * 1.5, 0.4, "triangle", 0.04), 300);
    }
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.05, "lowpass", alt ? 620 : 540, 220, 0.05);
  }

  diceClatter(): void {
    // knucklebone on wood: a burst of little knocks
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        this.synth.noiseShot(0.04, "bandpass", 1400 + Math.random() * 800, 700, 0.16 * (1 - i / 8));
        this.synth.tone(300 + Math.random() * 200, 0.05, "square", 0.05);
      }, i * 90 + Math.random() * 60);
    }
  }

  diceSettle(): void {
    this.synth.noiseShot(0.1, "bandpass", 900, 400, 0.2);
    this.synth.tone(220, 0.2, "triangle", 0.12, 110);
  }

  verdict(kind: "crit" | "success" | "fail"): void {
    if (kind === "crit") {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        setTimeout(() => this.synth.tone(f, 0.3, "square", 0.13), i * 70));
    } else if (kind === "success") {
      [523, 784].forEach((f, i) => setTimeout(() => this.synth.tone(f, 0.24, "square", 0.11), i * 110));
    } else {
      [330, 233].forEach((f, i) => setTimeout(() => this.synth.tone(f, 0.4, "sawtooth", 0.12), i * 160));
    }
  }

  swing(): void {
    this.synth.noiseShot(0.14, "bandpass", 1100, 2600, 0.16);
  }

  clang(): void {
    this.synth.tone(1400, 0.12, "square", 0.1);
    this.synth.noiseShot(0.1, "highpass", 2400, 4000, 0.1);
  }

  hurt(): void {
    this.synth.tone(200, 0.1, "sawtooth", 0.14, 90);
  }

  shove(): void {
    this.synth.noiseShot(0.2, "bandpass", 700, 1900, 0.2);
  }

  splash(): void {
    this.synth.noiseShot(0.5, "lowpass", 1400, 300, 0.35);
    this.synth.tone(140, 0.3, "sine", 0.14, 60);
  }

  grease(): void {
    this.synth.noiseShot(0.3, "lowpass", 500, 150, 0.2);
  }

  ignite(): void {
    this.synth.noiseShot(0.5, "bandpass", 900, 2600, 0.3);
    this.synth.tone(160, 0.3, "sawtooth", 0.14, 80);
  }

  slip(): void {
    this.synth.tone(600, 0.2, "sine", 0.12, 180);
  }

  bolt(): void {
    this.synth.tone(1200, 0.16, "square", 0.1, 500);
    this.synth.noiseShot(0.14, "highpass", 2600, 4400, 0.1);
  }

  dip(): void {
    this.synth.noiseShot(0.25, "bandpass", 800, 2000, 0.16);
    this.synth.tone(440, 0.2, "sine", 0.1, 660);
  }

  barrel(): void {
    this.synth.noiseShot(0.3, "lowpass", 900, 200, 0.3);
    this.synth.tone(100, 0.25, "sine", 0.2, 45);
  }

  turnChime(): void {
    this.synth.tone(880, 0.06, "square", 0.06);
  }

  loot(): void {
    [659, 784, 988, 1319].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.22, "square", 0.11), i * 90));
  }

  results(): void {
    [392, 494, 587, 784].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.4, "triangle", 0.11);
        this.synth.tone(f / 2, 0.4, "triangle", 0.07);
      }, i * 190));
  }

  titleSting(): void {
    [262, 330, 392, 523].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.5, "triangle", 0.1), i * 220));
  }
}
