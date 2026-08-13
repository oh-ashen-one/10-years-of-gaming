/**
 * audio.ts — voxel valley synth on the core Synth: day birds / night
 * crickets ambience, the punch, block-break pops (per material), place
 * thunk, craft click, zombie groans, skeleton rattle + bow twang, the
 * creeper hiss, explosion, dawn crackle, the YOU SURVIVED fanfare.
 */
import { Synth, type LoopVoice } from "@tenyears/core";

export class GameAudio {
  private synth = new Synth();
  private amb: LoopVoice | null = null;
  private chirpT = 2;
  private night = false;
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.synth.init();
    this.synth.resume();
    this.amb = this.synth.makeNoiseVoice({ filterType: "highpass", filterFreq: 4000, q: 0.8 });
    this.amb.setGain(0.0, 0.5);
  }

  get ready(): boolean {
    return this.started;
  }

  /** ambience tracker: birds by day, crickets by night */
  update(dt: number, isNight: boolean): void {
    if (!this.started) return;
    if (isNight !== this.night) {
      this.night = isNight;
      if (isNight) {
        this.amb?.setFilterFreq(4200, 0.5);
        this.amb?.setGain(0.03, 0.5); // cricket bed
      } else {
        this.amb?.setGain(0, 0.5);
      }
    }
    this.chirpT -= dt;
    if (this.chirpT <= 0) {
      this.chirpT = isNight ? 1.5 + Math.random() * 2 : 3 + Math.random() * 5;
      if (isNight) {
        this.synth.tone(4200 + Math.random() * 800, 0.05, "sine", 0.02);
      } else {
        const f = 2300 + Math.random() * 1200;
        this.synth.tone(f, 0.08, "sine", 0.04, f * 1.3);
      }
    }
  }

  /* ------------------------------------------------------------ one-shots -- */

  punch(): void {
    this.synth.noiseShot(0.07, "bandpass", 700, 300, 0.14);
  }

  breakBlock(id: number): void {
    // pop character by material: woody, stony, earthy
    if (id === 5 || id === 7 || id === 11 || id === 12) {
      this.synth.noiseShot(0.12, "lowpass", 1000, 300, 0.26);
      this.synth.tone(200, 0.09, "triangle", 0.16, 90);
    } else if (id === 3 || id === 4 || id === 8 || id === 9) {
      this.synth.noiseShot(0.14, "bandpass", 1800, 500, 0.26);
      this.synth.tone(140, 0.08, "square", 0.1, 70);
    } else {
      this.synth.noiseShot(0.1, "lowpass", 800, 250, 0.22);
    }
  }

  place(): void {
    this.synth.noiseShot(0.08, "lowpass", 900, 350, 0.2);
    this.synth.tone(260, 0.07, "triangle", 0.14, 160);
  }

  craft(): void {
    this.synth.tone(700, 0.07, "square", 0.1);
    setTimeout(() => this.synth.tone(1050, 0.09, "square", 0.1), 80);
  }

  gainPop(): void {
    this.synth.tone(880, 0.06, "sine", 0.08, 1200);
  }

  swing(): void {
    this.synth.noiseShot(0.12, "bandpass", 900, 2200, 0.1);
  }

  mobHit(): void {
    this.synth.noiseShot(0.08, "lowpass", 1100, 300, 0.22);
    this.synth.tone(300, 0.07, "square", 0.12, 150);
  }

  zombieGroan(): void {
    const f = 90 + Math.random() * 40;
    this.synth.tone(f, 0.5, "sawtooth", 0.08, f * 0.7);
  }

  skeletonShoot(): void {
    this.synth.noiseShot(0.05, "highpass", 2600, 3600, 0.1);
    this.synth.tone(1200, 0.12, "sine", 0.08, 500);
  }

  hiss(): void {
    this.synth.noiseShot(1.2, "highpass", 3000, 5200, 0.3);
  }

  explode(): void {
    this.synth.noiseShot(0.7, "lowpass", 1400, 60, 0.7);
    this.synth.tone(60, 0.5, "sine", 0.5, 28);
  }

  playerHit(): void {
    this.synth.tone(240, 0.1, "sawtooth", 0.16, 120);
  }

  playerDie(): void {
    [330, 262, 196, 131].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "sawtooth", 0.12), i * 200));
  }

  burnCrackle(): void {
    this.synth.noiseShot(0.5, "bandpass", 1600, 700, 0.14);
  }

  dusk(): void {
    [392, 330, 262].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.4, "triangle", 0.12), i * 260));
  }

  shelter(): void {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.synth.tone(f, 0.2, "square", 0.1), i * 100));
  }

  survive(): void {
    const line = [523, 659, 784, 1047, 988, 1047, 1319];
    line.forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.3, "square", 0.13);
        this.synth.tone(f / 2, 0.3, "triangle", 0.09);
      }, i * 160));
  }

  titleSting(): void {
    [262, 330, 392, 523, 659].forEach((f, i) =>
      setTimeout(() => {
        this.synth.tone(f, 0.28, "triangle", 0.12);
      }, i * 170));
  }
}
