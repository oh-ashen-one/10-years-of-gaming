/**
 * audio.ts — every sound on the island, synthesized on the core Synth:
 * plane drone, dive wind, chute flap, surface-aware footsteps, three
 * distinct gun voices, distant bot fire, hit ticks, zone crackle, buggy
 * engine, the dinner fanfare. No samples.
 */
import { Synth, type LoopVoice } from "@tenyears/core";
import type { WeaponId } from "./game";

export class GameAudio {
  private synth = new Synth();
  private wind: LoopVoice | null = null;
  private planeVoice: LoopVoice | null = null;
  private buggyVoice: LoopVoice | null = null;
  private started = false;

  /** Must be called from a user gesture. */
  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.wind = this.synth.makeNoiseVoice({ filterType: "lowpass", filterFreq: 400, q: 0.6 });
    this.wind.setGain(0.04, 0.5);
  }

  get ready(): boolean {
    return this.started;
  }

  /* ------------------------------------------------------- loop voices -- */

  startPlane(): void {
    if (!this.started || this.planeVoice) return;
    this.planeVoice = this.synth.makeOscVoice({
      type: "sawtooth", freq: 82, subLevel: 0.5, filterFreq: 420, grit: 0.4,
    });
    this.planeVoice.setGain(0.14, 0.5);
  }

  stopPlane(): void {
    this.planeVoice?.stop();
    this.planeVoice = null;
  }

  /** wind rush scales with fall speed */
  setDiveWind(intensity: number): void {
    this.wind?.setGain(0.04 + intensity * 0.3, 0.2);
    this.wind?.setFilterFreq(400 + intensity * 2200, 0.2);
  }

  setBuggy(on: boolean, speed01: number): void {
    if (!this.started) return;
    if (on && !this.buggyVoice) {
      this.buggyVoice = this.synth.makeOscVoice({
        type: "sawtooth", freq: 70, subLevel: 0.6, filterFreq: 500, grit: 0.7, pan: false,
      });
    }
    if (this.buggyVoice) {
      this.buggyVoice.setFreq(60 + speed01 * 160, 0.06);
      this.buggyVoice.setGain(on ? 0.1 + speed01 * 0.12 : 0, 0.1);
    }
  }

  zoneCrackle(outside: boolean): void {
    this.wind?.setGain(outside ? 0.22 : 0.04, 0.4);
    this.wind?.setFilterFreq(outside ? 2600 : 400, 0.4);
  }

  /* ------------------------------------------------------------ one-shots -- */

  jump(): void {
    this.synth.noiseShot(0.5, "bandpass", 400, 1800, 0.2);
  }

  chute(): void {
    this.synth.noiseShot(0.35, "highpass", 900, 300, 0.35);
    this.synth.tone(140, 0.2, "sine", 0.2, 70);
  }

  land(): void {
    this.synth.noiseShot(0.2, "lowpass", 800, 150, 0.3);
    this.synth.tone(100, 0.18, "sine", 0.3, 45);
  }

  footstep(surface: string, alt: boolean): void {
    const f = surface === "dirt" ? 900 : surface === "wheat" ? 1400 : surface === "sand" ? 700 : 1100;
    this.synth.noiseShot(0.06, "bandpass", f + (alt ? 120 : 0), f * 0.4, surface === "wheat" ? 0.07 : 0.1);
  }

  gunshot(w: WeaponId, distant = false): void {
    if (w === "rifle") {
      this.synth.noiseShot(distant ? 0.3 : 0.16, "lowpass", distant ? 900 : 3400, 300, distant ? 0.1 : 0.4);
      this.synth.tone(160, 0.09, "square", distant ? 0.05 : 0.2, 60);
    } else if (w === "smg") {
      this.synth.noiseShot(0.08, "bandpass", distant ? 1200 : 2800, 700, distant ? 0.08 : 0.28);
    } else {
      this.synth.noiseShot(0.28, "lowpass", distant ? 700 : 2200, 200, distant ? 0.12 : 0.5);
      this.synth.tone(90, 0.2, "sine", distant ? 0.06 : 0.3, 40);
    }
  }

  reload(): void {
    this.synth.noiseShot(0.08, "highpass", 2000, 3000, 0.12);
    setTimeout(() => this.synth.noiseShot(0.06, "highpass", 1500, 2600, 0.14), 400);
    setTimeout(() => this.synth.tone(900, 0.05, "square", 0.08), 900);
  }

  hitmark(kill: boolean): void {
    this.synth.tone(kill ? 1320 : 990, kill ? 0.14 : 0.06, "square", kill ? 0.2 : 0.12);
    if (kill) setTimeout(() => this.synth.tone(1760, 0.16, "square", 0.14), 80);
  }

  playerHit(): void {
    this.synth.tone(220, 0.12, "sawtooth", 0.2, 110);
    this.synth.noiseShot(0.1, "lowpass", 900, 300, 0.16);
  }

  pickup(): void {
    this.synth.tone(660, 0.08, "square", 0.12);
    setTimeout(() => this.synth.tone(990, 0.1, "square", 0.12), 70);
  }

  squash(): void {
    this.synth.noiseShot(0.25, "lowpass", 600, 120, 0.4);
    this.synth.tone(70, 0.2, "sine", 0.3, 35);
  }

  circleWarn(): void {
    this.synth.tone(620, 0.3, "square", 0.12);
    setTimeout(() => this.synth.tone(620, 0.3, "square", 0.12), 400);
  }

  circleClose(): void {
    this.synth.tone(440, 0.5, "sawtooth", 0.12, 220);
    this.synth.noiseShot(0.6, "bandpass", 800, 2400, 0.1);
  }

  dinner(): void {
    // the fanfare: bright rising line, then the money chord
    const line = [392, 523, 659, 784];
    line.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.3, "square", 0.16);
        this.synth.tone(f / 2, 0.3, "triangle", 0.12);
      }, i * 170));
    setTimeout(() => {
      [523, 659, 784, 1047].forEach((f) => this.synth.tone(f, 0.9, "square", 0.09));
    }, 800);
  }

  loseSting(): void {
    [330, 262, 196, 147].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "sawtooth", 0.12), i * 220));
  }

  titleSting(): void {
    [262, 330, 392, 523].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.3, "square", 0.12);
        this.synth.tone(f * 2, 0.2, "triangle", 0.06);
      }, i * 150));
  }
}
