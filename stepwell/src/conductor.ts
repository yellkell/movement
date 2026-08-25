// The conductor: one clock owns the set. Transport advances on simulation
// delta — not wall clock — so the probe can step it deterministically and a
// headless run needs no AudioContext. Audio, when the first gesture unlocks
// it, is scheduled against the transport with a small lookahead. Departures,
// telegraphs, gates and lights all read this clock; the music and the floor
// can never disagree.

import { MUSIC } from './config';

const BEAT_SEC = 60 / MUSIC.bpm;
const BAR_SEC = BEAT_SEC * MUSIC.beatsPerBar;
const LOOKAHEAD_SEC = 0.14;

export class Conductor {
  bars = 0;
  playing = true;

  private ctx: AudioContext | undefined;
  private master!: GainNode;
  private crush!: BiquadFilterNode;
  private droneOsc: OscillatorNode[] = [];
  private droneGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private scheduledBeat8 = -1; // last scheduled eighth-note index
  private depth01 = 0;
  private arpLevel = 0;

  get barPhase(): number {
    return this.bars - Math.floor(this.bars);
  }

  get beat(): number {
    return Math.floor(this.barPhase * MUSIC.beatsPerBar);
  }

  get barSec(): number {
    return BAR_SEC;
  }

  advance(dt: number): void {
    if (!this.playing) return;
    this.bars += dt / BAR_SEC;
    this.schedule();
  }

  warp(bars: number): void {
    this.bars += bars;
    this.scheduledBeat8 = Math.floor(this.bars * MUSIC.beatsPerBar * 2);
  }

  /** The throat: the set begins again. Continuous audio, bar zero. */
  reset(): void {
    this.bars = 0;
    this.scheduledBeat8 = -1;
  }

  /** Call from any user gesture; safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setDepth(depth01: number): void {
    this.depth01 = Math.min(1, Math.max(0, depth01));
  }

  setArpLevel(level01: number): void {
    this.arpLevel = Math.min(1, Math.max(0, level01));
  }

  private ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.crush = ctx.createBiquadFilter();
    this.crush.type = 'lowpass';
    this.crush.frequency.value = 16000;
    this.master.connect(this.crush).connect(ctx.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = noise;

    // The drone: two detuned saws through a slow lowpass. Its root follows
    // depth — the well sinks in pitch as you sink in the world, the audio
    // cousin of inverse locomotion (research/01 §6).
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.droneGain.connect(lp).connect(this.master);
    for (const mult of [1, 1.5]) {
      for (const cents of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 55 * mult;
        o.detune.value = cents;
        o.connect(this.droneGain);
        o.start();
        this.droneOsc.push(o);
      }
    }
  }

  private schedule(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const beat8Now = this.bars * MUSIC.beatsPerBar * 2;
    const target = Math.floor(beat8Now + (LOOKAHEAD_SEC / BEAT_SEC) * 2);
    if (this.scheduledBeat8 < Math.floor(beat8Now) - 4) {
      this.scheduledBeat8 = Math.floor(beat8Now) - 1; // dropped frames: skip, don't burst
    }
    const root = 55 * Math.pow(2, (-7 / 12) * this.depth01);
    for (const [i, o] of this.droneOsc.entries()) {
      const mult = i < 2 ? 1 : 1.5;
      o.frequency.setTargetAtTime(root * mult, ctx.currentTime, 0.6);
    }
    while (this.scheduledBeat8 < target) {
      this.scheduledBeat8++;
      const b8 = this.scheduledBeat8;
      const at =
        ctx.currentTime + Math.max(0.005, (b8 / 2 - beat8Now / 2) * BEAT_SEC);
      if (b8 % 2 === 0) this.kick(at, (b8 / 2) % MUSIC.beatsPerBar === 0);
      this.hat(at, b8 % 2 === 1);
      if (this.arpLevel > 0) this.arp(at, b8);
    }
  }

  private kick(at: number, downbeat: boolean): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(downbeat ? 165 : 140, at);
    o.frequency.exponentialRampToValueAtTime(44, at + 0.09);
    g.gain.setValueAtTime(downbeat ? 0.6 : 0.42, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.26);
  }

  private hat(at: number, off: boolean): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(off ? 0.05 : 0.09, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    s.connect(hp).connect(g).connect(this.master);
    s.start(at);
    s.stop(at + 0.06);
  }

  private static ARP = [0, 7, 3, 5, 0, 10, 7, 12];
  private arp(at: number, b8: number): void {
    const ctx = this.ctx!;
    const semis = Conductor.ARP[b8 % Conductor.ARP.length];
    const root = 220 * Math.pow(2, (-7 / 12) * this.depth01);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = root * Math.pow(2, semis / 12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 2.2;
    g.gain.setValueAtTime(0.055 * this.arpLevel, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.11);
    o.connect(bp).connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.12);
  }

  chime(step: number): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.01;
    const penta = [0, 3, 5, 7, 10];
    const f = 440 * Math.pow(2, penta[step % penta.length] / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const m = ctx.createOscillator();
    const mg = ctx.createGain();
    m.frequency.value = f * 2.01;
    mg.gain.value = 90;
    m.connect(mg).connect(o.frequency);
    g.gain.setValueAtTime(0.12, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
    o.connect(g).connect(this.master);
    o.start(at);
    m.start(at);
    o.stop(at + 0.75);
    m.stop(at + 0.75);
  }

  thud(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.005;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    s.connect(lp).connect(g).connect(this.master);
    s.start(at);
    s.stop(at + 0.32);
    // The whole mix ducks dark for a beat — the miss is audible as absence.
    this.crush.frequency.cancelScheduledValues(at);
    this.crush.frequency.setValueAtTime(700, at);
    this.crush.frequency.exponentialRampToValueAtTime(16000, at + 0.9);
  }
}

export const conductor = new Conductor();
