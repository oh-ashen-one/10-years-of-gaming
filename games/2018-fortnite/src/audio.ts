/**
 * audio.ts — toy-island synth on the core Synth: bus drone + balloon
 * creaks, dive wind, glider flap, footsteps, pickaxe whacks (wood/metal/
 * brick voices), build thunks, three gun voices, chest jingle, storm
 * crackle, the VICTORY ROYALE fanfare. No samples.
 */
import { Synth, type LoopVoice } from "@tenyears/core";
import type { WeaponId } from "./game";

export class GameAudio {
  private synth = new Synth();
  private wind: LoopVoice | null = null;
  private busVoice: LoopVoice | null = null;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.wind = this.synth.makeNoiseVoice({ filterType: "lowpass", filterFreq: 380, q: 0.6 });
    this.wind.setGain(0.035, 0.5);
  }

  get ready(): boolean {
    return this.started;
  }

  startBus(): void {
    if (!this.started || this.busVoice) return;
    this.busVoice = this.synth.makeOscVoice({
      type: "sawtooth", freq: 66, subLevel: 0.5, filterFreq: 380, grit: 0.35,
    });
    this.busVoice.setGain(0.12, 0.5);
  }

  stopBus(): void {
    this.busVoice?.stop();
    this.busVoice = null;
  }

  setDiveWind(intensity: number): void {
    this.wind?.setGain(0.035 + intensity * 0.28, 0.2);
    this.wind?.setFilterFreq(380 + intensity * 2000, 0.2);
  }

  stormCrackle(outside: boolean): void {
    this.wind?.setGain(outside ? 0.2 : 0.035, 0.4);
    this.wind?.setFilterFreq(outside ? 2400 : 380, 0.4);
  }

  /* ------------------------------------------------------------ one-shots -- */

  jump(): void {
    this.synth.noiseShot(0.4, "bandpass", 500, 1600, 0.18);
  }

  glider(open: boolean): void {
    if (open) {
      this.synth.noiseShot(0.3, "highpass", 800, 300, 0.3);
      this.synth.tone(160, 0.18, "sine", 0.16, 80);
    } else {
      this.synth.noiseShot(0.25, "bandpass", 1200, 400, 0.16);
    }
  }

  land(): void {
    this.synth.noiseShot(0.18, "lowpass", 800, 150, 0.26);
    this.synth.tone(100, 0.16, "sine", 0.26, 45);
  }

  footstep(alt: boolean): void {
    this.synth.noiseShot(0.06, "bandpass", alt ? 1000 : 900, 400, 0.08);
  }

  swing(): void {
    this.synth.noiseShot(0.18, "bandpass", 600, 1800, 0.16);
  }

  whack(kind: string): void {
    if (kind === "tree" || kind === "wood") {
      this.synth.noiseShot(0.1, "lowpass", 900, 300, 0.3);
      this.synth.tone(180, 0.08, "triangle", 0.2, 90);
    } else if (kind === "car" || kind === "metal") {
      this.synth.noiseShot(0.12, "bandpass", 2400, 900, 0.26);
      this.synth.tone(320, 0.14, "square", 0.1, 180);
    } else {
      this.synth.noiseShot(0.1, "lowpass", 1200, 400, 0.3);
      this.synth.tone(120, 0.1, "triangle", 0.2, 60);
    }
  }

  treeFall(): void {
    this.synth.noiseShot(0.6, "lowpass", 500, 100, 0.3);
    this.synth.tone(90, 0.4, "sine", 0.2, 40);
  }

  carCrush(): void {
    this.synth.noiseShot(0.4, "lowpass", 1600, 200, 0.35);
    this.synth.tone(70, 0.3, "sawtooth", 0.2, 35);
  }

  build(): void {
    this.synth.noiseShot(0.12, "lowpass", 700, 250, 0.3);
    this.synth.tone(240, 0.1, "triangle", 0.2, 140);
    setTimeout(() => this.synth.tone(360, 0.08, "triangle", 0.12), 70);
  }

  buildBreak(): void {
    this.synth.noiseShot(0.3, "lowpass", 1400, 200, 0.35);
    this.synth.tone(110, 0.2, "sawtooth", 0.16, 50);
  }

  edit(): void {
    this.synth.tone(520, 0.08, "square", 0.12);
    setTimeout(() => this.synth.tone(780, 0.08, "square", 0.1), 70);
  }

  chestJingle(): void {
    [880, 1109, 1319].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.12, "sine", 0.06), i * 90));
  }

  chestOpen(): void {
    [659, 784, 988, 1319].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.18, "square", 0.12), i * 80));
    this.synth.noiseShot(0.4, "highpass", 2400, 4800, 0.08);
  }

  gunshot(w: WeaponId, distant = false): void {
    const g = distant ? 0.25 : 1;
    if (w === "ar") {
      this.synth.noiseShot(0.12, "lowpass", 3000, 300, 0.32 * g);
      this.synth.tone(150, 0.07, "square", 0.16 * g, 60);
    } else if (w === "pistol") {
      this.synth.noiseShot(0.09, "bandpass", 2200, 600, 0.24 * g);
      this.synth.tone(220, 0.06, "square", 0.12 * g, 90);
    } else {
      this.synth.noiseShot(0.26, "lowpass", 2000, 180, 0.45 * g);
      this.synth.tone(85, 0.18, "sine", 0.26 * g, 38);
    }
  }

  reload(): void {
    this.synth.noiseShot(0.07, "highpass", 1800, 2800, 0.1);
    setTimeout(() => this.synth.noiseShot(0.06, "highpass", 1400, 2400, 0.12), 350);
  }

  hitmark(kill: boolean): void {
    this.synth.tone(kill ? 1240 : 940, kill ? 0.13 : 0.05, "square", kill ? 0.18 : 0.1);
    if (kill) setTimeout(() => this.synth.tone(1650, 0.15, "square", 0.12), 70);
  }

  playerHit(): void {
    this.synth.tone(210, 0.12, "sawtooth", 0.18, 100);
    this.synth.noiseShot(0.1, "lowpass", 800, 280, 0.14);
  }

  stormWarn(): void {
    this.synth.tone(560, 0.28, "square", 0.1);
    setTimeout(() => this.synth.tone(560, 0.28, "square", 0.1), 380);
  }

  stormClose(): void {
    this.synth.tone(400, 0.5, "sawtooth", 0.1, 200);
    this.synth.noiseShot(0.5, "bandpass", 700, 2200, 0.09);
  }

  botFall(): void {
    this.synth.tone(400, 0.3, "sine", 0.16, 120);
    this.synth.noiseShot(0.2, "lowpass", 900, 200, 0.2);
  }

  victory(): void {
    // theROYALE fanfare: rising toy-trumpet line + chord
    const line = [523, 659, 784, 1047, 988, 1175];
    line.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.26, "square", 0.14);
        this.synth.tone(f / 2, 0.26, "triangle", 0.1);
      }, i * 150));
    setTimeout(() => {
      [523, 659, 784, 1047].forEach((f) => this.synth.tone(f, 1.0, "square", 0.08));
    }, 950);
  }

  loseSting(): void {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.36, "sawtooth", 0.1), i * 200));
  }

  titleSting(): void {
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.24, "square", 0.11);
        this.synth.tone(f * 2, 0.16, "triangle", 0.05);
      }, i * 140));
  }
}
