// The conductor: one clock owns the set — stepwell's transport, cloned.
// Transport advances on simulation delta, not wall clock, so the probe can
// step it deterministically and a headless run needs no AudioContext.
// Departures, telegraphs, attacks and lights all read this clock; the music
// and the floor can never disagree.
//
// The kit is stepwell's procedural set a storey brighter, at a rave tempo.
// One inversion: stepwell's drone root DESCENDS as the rig descends; here it
// CLIMBS as the rig climbs (research/01 §6 — inverse locomotion's audio
// cousin, played the other way up).

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
  private climb01 = 0;
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

  /** 0 on the floor → 1 at the skywalk; the drone root rises with it. */
  setClimb(climb01: number): void {
    this.climb01 = Math.min(1, Math.max(0, climb01));
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
    // the climb — the void brightens in pitch as you rise through it.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
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
    const root = 55 * Math.pow(2, (7 / 12) * this.climb01);
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
    o.frequency.setValueAtTime(downbeat ? 170 : 145, at);
    o.frequency.exponentialRampToValueAtTime(46, at + 0.08);
    g.gain.setValueAtTime(downbeat ? 0.62 : 0.44, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.24);
  }

  private hat(at: number, off: boolean): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7800 - this.climb01 * 800;
    const g = ctx.createGain();
    const base = off ? 0.055 : 0.095;
    g.gain.setValueAtTime(base * (1 + this.climb01 * 0.3), at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    s.connect(hp).connect(g).connect(this.master);
    s.start(at);
    s.stop(at + 0.06);
  }

  private static ARP = [0, 7, 3, 5, 0, 10, 7, 12];
  private arp(at: number, b8: number): void {
    const ctx = this.ctx!;
    const semis = Conductor.ARP[b8 % Conductor.ARP.length];
    const root = 220 * Math.pow(2, (7 / 12) * this.climb01);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = root * Math.pow(2, semis / 12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 2.2;
    g.gain.setValueAtTime(0.055 * this.arpLevel, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.11);
    o.connect(bp).connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.12);
  }

  /** A clean dodge: the pentatonic step, climbing with flow. */
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

  /** Departure countdown click; pitch climbs as beats run out. */
  tick(beatsLeft: number): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 900 + (4 - Math.min(4, beatsLeft)) * 180;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 5;
    g.gain.setValueAtTime(0.07, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    o.connect(bp).connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.07);
  }

  /** Every landing is audible, dodged or not — the impact, not a warning. */
  strike(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(38, at + 0.12);
    g.gain.setValueAtTime(0.34, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.32);
  }

  /** Clipped. The whole mix ducks dark for a beat — the miss is audible as
   *  absence (stepwell's thud, kept word for word). */
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
    this.crush.frequency.cancelScheduledValues(at);
    this.crush.frequency.setValueAtTime(700, at);
    this.crush.frequency.exponentialRampToValueAtTime(16000, at + 0.9);
  }

  /** A lap closes: one deep bell over the drone. */
  bell(step: number): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.01;
    const penta = [0, 3, 5, 7, 10];
    const f = 220 * Math.pow(2, penta[step % penta.length] / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const m = ctx.createOscillator();
    const mg = ctx.createGain();
    m.frequency.value = f * 1.41; // inharmonic partial: bell, not chime
    mg.gain.value = 160;
    m.connect(mg).connect(o.frequency);
    g.gain.setValueAtTime(0.17, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.8);
    o.connect(g).connect(this.master);
    o.start(at);
    m.start(at);
    o.stop(at + 1.9);
    m.stop(at + 1.9);
  }
}

export const conductor = new Conductor();
