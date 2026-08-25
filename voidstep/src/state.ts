// Shared game state. One mutable singleton, dance-style: systems are the only
// writers of their own fields, everyone may read.

export interface PlatformState {
  anchor: { x: number; y: number; z: number };
  moving: boolean;
  departIn: number; // bars until this dwell ends (Infinity when static/moving)
  aligned: boolean; // anchor within alignEps of the live rig
}

export type AttackPhase = 'idle' | 'charge' | 'flash' | 'done';

export interface AttackState {
  phase: AttackPhase;
  fill: number; // 0..1 charge progress (the amber→red countdown)
  hit: boolean; // judged clipped at the landing
  flashLeft: number; // seconds of landing burn remaining
}

export const G = {
  transport: {
    bars: 0, // continuous bar time since set start
    barPhase: 0,
    beat: 0, // integer beat within bar
    playing: true,
  },
  rig: { x: 0, y: 0, z: 0 }, // world pose of the play-area origin (yaw always 0)
  tracked: 0, // platform index that owns the frame of reference
  handovers: 0,
  slips: 0, // departures stood through — the miss that replaced the slide
  body: {
    x: 0,
    z: 0, // head in play-area coordinates
    y: 1.7,
    standingHeight: 1.7,
    ducked: false,
    presenting: false,
  },
  platforms: [] as PlatformState[],
  attacks: [] as AttackState[], // parallel to score's ATTACKS
  doom: [] as { platform: number; c: number; r: number; level: number; red: boolean }[],
  wayfind: { targetIndex: -1, targetAligned: false }, // route-next platform
  flow: 0,
  hits: 0,
  clears: 0,
  energy: 0.8,
  hazardLive: false, // a telegraph or landing owns the deck right now
  laps: 0, // full circuits closed
  ghosts: false, // the authoring overlay toggle
  events: [] as string[], // ring log for the probe
};

export function logEvent(kind: string): void {
  G.events.push(kind);
  if (G.events.length > 300) G.events.splice(0, G.events.length - 300);
}

export type VoidstepState = typeof G;
