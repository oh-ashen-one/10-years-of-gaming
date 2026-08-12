/**
 * synth.ts — 100% WebAudio synthesis, zero samples (§2.5).
 *
 * Fixed by the franchise:
 *  - Master chain: Gain -> DynamicsCompressor -> destination.
 *  - Two one-shot primitives: `tone(freq, dur, type, gain, glideTo)` and
 *    `noiseShot(dur, filterType, f0, f1, gain)`. Every stinger, impact and
 *    UI blip in every game is composed from these.
 *  - Persistent loop voices (`makeLoopVoice`) for engines / wind /
 *    ambience: oscillator- or noise-based, tracked to gameplay scalars
 *    with `setTargetAtTime` smoothing. No 220 Hz test tones, no silence.
 *
 * Games build their own voice racks on top of these primitives — the chain
 * and the smoothing discipline are what stay constant.
 */

export interface LoopVoice {
  /** setTargetAtTime-smoothed parameter access */
  setFreq(hz: number, tc?: number): void;
  setGain(g: number, tc?: number): void;
  setFilterFreq(hz: number, tc?: number): void;
  setPan(p: number, tc?: number): void;
  stop(): void;
}

export interface OscVoiceParams {
  type: OscillatorType;
  freq: number;
  /** detuned second oscillator, -1 semitone offset; 0 = off */
  subLevel?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  /** waveshaper grit amount; 0 = clean */
  grit?: number;
  pan?: boolean;
}

export interface NoiseVoiceParams {
  filterType: BiquadFilterType;
  filterFreq: number;
  q?: number;
  pan?: boolean;
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private started = false;

  /** Must be called from a user gesture. Idempotent. */
  init(): void {
    if (this.started) return;
    this.started = true;
    const ctx = new AudioContext();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    this.master = ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(comp).connect(ctx.destination);
  }

  resume(): void {
    void this.ctx?.resume();
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /* --------------------------------------------------------- one-shots -- */

  /** Oscillator blip with exponential decay + optional pitch glide. */
  tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise burst with a travelling filter — thuds, whooshes, scrapes. */
  noiseShot(dur: number, filterType: BiquadFilterType, f0: number, f1: number, gain: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start();
  }

  /* ------------------------------------------------------- loop voices -- */

  /**
   * Persistent oscillator voice (engine / hum / drone). Gains start at 0 —
   * the game raises them every frame via the smoothed setters.
   */
  makeOscVoice(params: OscVoiceParams): LoopVoice {
    const ctx = this.requireCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    let pan: StereoPannerNode | null = null;
    if (params.pan) {
      pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.master);
    } else {
      gain.connect(this.master);
    }
    return this.oscVoiceRest(ctx, params, gain, pan);
  }

  private oscVoiceRest(
    ctx: AudioContext,
    params: OscVoiceParams,
    gain: GainNode,
    pan: StereoPannerNode | null,
  ): LoopVoice {
    const oscA = ctx.createOscillator();
    oscA.type = params.type;
    oscA.frequency.value = params.freq;

    let oscB: OscillatorNode | null = null;
    const subLevel = params.subLevel ?? 0;

    const filt = ctx.createBiquadFilter();
    filt.type = params.filterType ?? "lowpass";
    filt.frequency.value = params.filterFreq ?? 1200;

    let chain: AudioNode = filt;
    if (params.grit && params.grit > 0) {
      const shaper = ctx.createWaveShaper();
      const k = params.grit;
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(x * (1 + k * 3));
      }
      shaper.curve = curve;
      filt.connect(shaper);
      chain = shaper;
    }
    chain.connect(gain);

    oscA.connect(filt);
    if (subLevel > 0) {
      oscB = ctx.createOscillator();
      oscB.type = "square";
      oscB.frequency.value = params.freq * 0.5;
      const subGain = ctx.createGain();
      subGain.gain.value = subLevel;
      oscB.connect(subGain).connect(filt);
      oscB.start();
    }
    oscA.start();

    return {
      setFreq: (hz, tc = 0.03) => {
        const t = ctx.currentTime;
        oscA.frequency.setTargetAtTime(hz, t, tc);
        oscB?.frequency.setTargetAtTime(hz * 0.5, t, tc);
      },
      setGain: (g, tc = 0.05) => gain.gain.setTargetAtTime(g, ctx.currentTime, tc),
      setFilterFreq: (hz, tc = 0.05) => filt.frequency.setTargetAtTime(hz, ctx.currentTime, tc),
      setPan: (p, tc = 0.1) =>
        pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), ctx.currentTime, tc),
      stop: () => {
        oscA.stop();
        oscB?.stop();
        gain.disconnect();
      },
    };
  }

  /** Persistent filtered-noise voice (wind, dirt rush, rain, crowd). */
  makeNoiseVoice(params: NoiseVoiceParams): LoopVoice {
    const ctx = this.requireCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2);
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = params.filterType;
    filt.frequency.value = params.filterFreq;
    filt.Q.value = params.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0;

    let pan: StereoPannerNode | null = null;
    src.connect(filt).connect(gain);
    if (params.pan) {
      pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.master);
    } else {
      gain.connect(this.master);
    }
    src.start();

    return {
      setFreq: (hz, tc = 0.08) => filt.frequency.setTargetAtTime(hz, ctx.currentTime, tc),
      setGain: (g, tc = 0.08) => gain.gain.setTargetAtTime(g, ctx.currentTime, tc),
      setFilterFreq: (hz, tc = 0.08) => filt.frequency.setTargetAtTime(hz, ctx.currentTime, tc),
      setPan: (p, tc = 0.1) =>
        pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), ctx.currentTime, tc),
      stop: () => {
        src.stop();
        gain.disconnect();
      },
    };
  }

  /* ------------------------------------------------------------ helpers -- */

  private noiseCache = new Map<number, AudioBuffer>();

  private noiseBuffer(dur: number): AudioBuffer {
    const ctx = this.requireCtx();
    const key = Math.round(dur * 10);
    let buf = this.noiseCache.get(key);
    if (buf) return buf;
    const len = Math.ceil(ctx.sampleRate * dur);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseCache.set(key, buf);
    return buf;
  }

  private requireCtx(): AudioContext {
    if (!this.ctx) throw new Error("Synth.init() must be called from a user gesture first");
    return this.ctx;
  }
}
