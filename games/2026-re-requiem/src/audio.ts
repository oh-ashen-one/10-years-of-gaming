/**
 * audio.ts — the ward's voice on the core Synth: rain on the facade, a
 * sub drone, footsteps (loud when fast), the gunshot's crack, the
 * shambler's wet moan, the headshot crunch, the pursuer's subterranean
 * thud-steps, the pickup's dull chime, the combine wrap, the power-on
 * hum, the elevator's dying ding, the door-arm SLAM, and the flatline.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private rain: LoopVoice | null = null;
  private drone: LoopVoice | null = null;
  private hum: LoopVoice | null = null;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.rain = this.synth.makeNoiseVoice({ filterType: "bandpass", filterFreq: 2400, q: 0.3 });
    this.rain.setGain(0.05, 1.2);
    this.drone = this.synth.makeOscVoice({ type: "sine", freq: 41, filterFreq: 120 });
    this.drone.setGain(0.06, 1.5);
  }

  get ready(): boolean {
    return this.started;
  }

  /** rain fades once you're inside */
  setRainInside(inside: boolean): void {
    this.rain?.setGain(inside ? 0.012 : 0.05, 0.8);
  }

  step(fast: boolean): void {
    this.synth.noiseShot(fast ? 0.08 : 0.05, "lowpass", fast ? 500 : 420, 200, fast ? 0.1 : 0.05);
  }

  /** its steps — felt in the floor */
  pursuerStep(): void {
    this.synth.tone(55, 0.18, "sine", 0.16, 30);
  }

  fire(headshot: boolean, hit: boolean): void {
    this.synth.noiseShot(0.18, "lowpass", 3200, 300, 0.4);
    this.synth.tone(160, 0.1, "square", 0.2, 60);
    if (hit && headshot) {
      this.synth.noiseShot(0.14, "lowpass", 1200, 200, 0.3);
      setTimeout(() => this.synth.tone(90, 0.2, "sine", 0.2, 40), 40);
    }
  }

  dryFire(): void {
    this.synth.tone(900, 0.05, "square", 0.06, 700);
  }

  moan(): void {
    this.synth.tone(140, 0.9, "sawtooth", 0.06, 90);
    this.synth.noiseShot(0.6, "lowpass", 500, 200, 0.05);
  }

  playerHit(): void {
    this.synth.tone(140, 0.16, "sawtooth", 0.22, 70);
    this.synth.noiseShot(0.14, "lowpass", 800, 220, 0.2);
  }

  pickup(): void {
    this.synth.tone(660, 0.12, "triangle", 0.1, 880);
    setTimeout(() => this.synth.tone(880, 0.16, "triangle", 0.08), 110);
  }

  combine(): void {
    this.synth.noiseShot(0.15, "bandpass", 900, 1600, 0.08);
    setTimeout(() => this.synth.tone(523, 0.2, "sine", 0.1, 660), 140);
  }

  examine(): void {
    this.synth.tone(440, 0.1, "triangle", 0.07, 550);
  }

  doorOpen(): void {
    this.synth.noiseShot(0.5, "lowpass", 700, 150, 0.2);
    this.synth.tone(98, 0.4, "sawtooth", 0.08, 65);
  }

  plate(): void {
    this.synth.tone(330, 0.15, "square", 0.05, 260);
  }

  powerOn(): void {
    this.hum = this.synth.makeOscVoice({ type: "sawtooth", freq: 120, filterFreq: 400 });
    this.hum.setGain(0.03, 1.2);
    this.synth.tone(65, 1.2, "sine", 0.2, 130);
    [262, 330, 392].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "triangle", 0.07), i * 200));
  }

  wake(): void {
    this.synth.tone(49, 2.0, "sawtooth", 0.2, 30);
    this.synth.noiseShot(1.2, "lowpass", 300, 90, 0.2);
  }

  chase(): void {
    this.synth.tone(73, 0.8, "sawtooth", 0.16, 55);
  }

  stagger(): void {
    this.synth.noiseShot(0.3, "lowpass", 1400, 200, 0.3);
    this.synth.tone(82, 0.4, "sine", 0.2, 41);
  }

  doorArm(): void {
    // the doors shut on its hand
    this.synth.noiseShot(0.3, "lowpass", 2000, 150, 0.5);
    this.synth.tone(60, 0.6, "sine", 0.4, 30);
    setTimeout(() => this.synth.tone(220, 0.3, "square", 0.08, 110), 200);
  }

  survived(): void {
    this.synth.tone(880, 0.4, "sine", 0.1); // the ding
    [330, 392, 523, 659].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.9, "triangle", 0.09), 400 + i * 280));
  }

  flatline(): void {
    this.synth.tone(880, 1.8, "sine", 0.12); // the long beep
    this.synth.tone(65, 1.6, "sine", 0.16, 33);
  }

  titleSting(): void {
    [110, 165, 220, 165].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 1.0, "triangle", 0.09), i * 400));
  }
}
