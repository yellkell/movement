// Shared game state. One mutable singleton, dance-style: systems are the only
// writers of their own fields, everyone may read.

import type { GateRuntime } from './score';

export interface PlatformState {
  anchor: { x: number; y: number; z: number };
  moving: boolean;
  departIn: number; // bars until this dwell ends (Infinity when static/moving)
  aligned: boolean; // anchor within alignEps of the live rig
}

export const G = {
  transport: {
    bars: 0, // continuous bar time since set start
    barPhase: 0,
    beat: 0, // integer beat within bar
    playing: true,
  },
  rig: { x: 0, y: 0, z: 0 }, // world pose of the play-area origin (yaw always 0)
  correction: { x: 0, y: 0, z: 0, active: false },
  tracked: 0, // platform index that owns the frame of reference
  body: {
    x: 0,
    z: 0, // head in play-area coordinates
    y: 1.7,
    standingHeight: 1.7,
    ducked: false,
    presenting: false,
  },
  platforms: [] as PlatformState[],
  gates: [] as GateRuntime[],
  gateState: [] as {
    phase: 'idle' | 'telegraph' | 'window' | 'done';
    hit: boolean;
  }[],
  doom: [] as { platform: number; c: number; r: number; level: number; red: boolean }[],
  flow: 0,
  hits: 0,
  clears: 0,
  energy: 0.8,
  hazardLive: false, // a telegraph or window owns the deck right now
  fade: 0, // 0 clear → 1 black (the throat)
  throat: { armed: false, sinceBar: 0 },
  laps: 0,
  ghosts: false, // the authoring overlay toggle
  events: [] as string[], // ring log for the probe
};

export function logEvent(kind: string): void {
  G.events.push(kind);
  if (G.events.length > 200) G.events.splice(0, G.events.length - 200);
}

export type StepwellState = typeof G;
