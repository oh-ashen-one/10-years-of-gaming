/**
 * audio.ts — ship sounds on the core Synth: the ever-present hum, soft
 * sneaker steps, task chimes, the kill sting, the report siren, meeting
 * murmur, vote ticks, the eject whoosh, lights-out thunk, the win/lose
 * stingers. No samples.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private hum: LoopVoice | null = null;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.hum = this.synth.makeOscVoice({ type: "sawtooth", freq: 55, filterFreq: 240, grit: 0.2 });
    this.hum.setGain(0.05, 0.6);
  }

  get ready(): boolean {
    return this.started;
  }

  step(alt: boolean): void {
    this.synth.noiseShot(0.05, "lowpass", alt ? 700 : 600, 250, 0.05);
  }

  taskStart(): void {
    this.synth.tone(660, 0.08, "square", 0.1);
    setTimeout(() => this.synth.tone(880, 0.1, "square", 0.1), 80);
  }

  taskDone(): void {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.16, "square", 0.12), i * 90));
  }

  killSting(): void {
    this.synth.tone(160, 0.3, "sawtooth", 0.2, 60);
    this.synth.noiseShot(0.2, "lowpass", 1200, 200, 0.24);
  }

  nearKill(): void {
    this.synth.tone(90, 0.2, "sawtooth", 0.1, 60);
  }

  vent(): void {
    this.synth.noiseShot(0.3, "bandpass", 500, 1600, 0.16);
    this.synth.tone(300, 0.15, "sine", 0.1, 90);
  }

  reportSiren(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.synth.tone(520, 0.16, "square", 0.16), i * 340);
      setTimeout(() => this.synth.tone(392, 0.16, "square", 0.16), i * 340 + 170);
    }
  }

  meetingSting(): void {
    [330, 392, 494, 587].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.3, "triangle", 0.12), i * 160));
  }

  voteTick(): void {
    this.synth.tone(900, 0.05, "square", 0.08);
  }

  eject(): void {
    this.synth.noiseShot(0.8, "bandpass", 400, 2400, 0.2);
    this.synth.tone(200, 0.6, "sine", 0.14, 60);
  }

  lightsOut(): void {
    this.synth.tone(120, 0.4, "sawtooth", 0.2, 50);
    this.synth.noiseShot(0.3, "lowpass", 500, 100, 0.2);
  }

  lightsFixed(): void {
    this.synth.tone(440, 0.1, "square", 0.1);
    setTimeout(() => this.synth.tone(660, 0.16, "square", 0.12), 110);
  }

  win(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.28, "square", 0.13);
        this.synth.tone(f / 2, 0.28, "triangle", 0.09);
      }, i * 150));
  }

  lose(): void {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "sawtooth", 0.11), i * 220));
  }

  titleSting(): void {
    [330, 415, 494, 659].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.3, "triangle", 0.12), i * 170));
  }
}
