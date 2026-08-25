// The score: the authored route down the well, in the notation the research
// arrived at. Each platform claims squares of the 3×3 play-area grid
// (research/03 §2.2) and moves its ANCHOR — the rig pose that pins the
// platform to its claim — along a bar-quantized loop. Consecutive platforms
// share an anchor at handover, so every traversal is a pair of opposed real
// steps that nets to zero (research/03 §2.1). Correctness is by construction
// here, and made visible by the ghost overlays (research/03 §3).

import { GRID } from './config';

export type Sq = readonly [number, number]; // [col +east, row +south], -1..1
export type V3 = { x: number; y: number; z: number };
export type Edge = 'N' | 'S' | 'E' | 'W';

export interface PathKey {
  bar: number;
  a: V3;
}

export interface GateSpec {
  kind: 'sweep' | 'beam';
  seg: number; // path segment index on the host platform (keys[seg] → keys[seg+1])
  frac: number; // spatial fraction along that segment
  lane: Sq; // beam: the blocked square; sweep: the square the pane is centred on
}

export interface PlatformSpec {
  id: string;
  claim: Sq[];
  keys: PathKey[]; // static platforms: one key; loops close back to keys[0].a
  loopBars?: number;
  gaps: { sq: Sq; edge: Edge }[]; // fence openings where a step is authored
  gates?: GateSpec[];
}

// Derived, consumed by systems -----------------------------------------------

export interface GateRuntime {
  kind: 'sweep' | 'beam';
  platform: number; // index into platforms
  lane: Sq;
  pos: V3; // world position of the gate on the lane's travel path
  axis: 'x' | 'z'; // horizontal travel axis of the host segment
  span: number; // half-width of the judged window along that axis
  telegraph: number; // distance along axis at which the amber warning begins
}

export interface FenceSeg {
  // world-space is platform-local here: offset from platform anchor
  x: number;
  z: number;
  edge: Edge;
}

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const sqOffset = (sq: Sq): { x: number; z: number } => ({
  x: sq[0] * GRID.pitch,
  z: sq[1] * GRID.pitch,
});

const EDGES: Edge[] = ['N', 'S', 'E', 'W'];
const EDGE_DIR: Record<Edge, Sq> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
};

// The route ------------------------------------------------------------------
// Anchors: each is the previous one plus that ride's travel. The elevator and
// rafts spend no floor (verticality is the free dimension, research/03 §3).

const A0 = v3(0, 0, 0); // threshold
const A1 = v3(0, 0, -3.2); // ferry-east glides north
const A2 = v3(0, -2.6, -3.2); // elevator sinks a storey
const A3 = v3(0, -2.6, -7.4); // long ferry glides north, one sweep midway
const A4 = v3(0, -7.8, -11.4); // barge dives two storeys while running north
const A5 = v3(0, -13.0, -11.4); // raft settles onto the water

export const ANCHORS = [A0, A1, A2, A3, A4, A5];

const C: Sq = [0, 0];
const E: Sq = [1, 0];
const W: Sq = [-1, 0];
const NC: Sq = [0, -1];
const NE: Sq = [1, -1];
const NW: Sq = [-1, -1];

export const PLATFORMS: PlatformSpec[] = [
  {
    // Two tiles so the loop can close: the raft's final +N step is repaid by
    // the −S step off this jetty after rebirth — the ledger balances across
    // the whole loop, not just each ride.
    id: 'threshold',
    claim: [C, NC],
    keys: [{ bar: 0, a: A0 }],
    gaps: [{ sq: C, edge: 'E' }],
  },
  {
    id: 'ferry-east',
    claim: [E],
    keys: [
      { bar: 0, a: A0 },
      { bar: 4, a: A0 },
      { bar: 6, a: A1 },
      { bar: 10, a: A1 },
      { bar: 12, a: A0 },
    ],
    loopBars: 12,
    gaps: [{ sq: E, edge: 'W' }],
  },
  {
    id: 'gallery-a',
    claim: [C],
    keys: [{ bar: 0, a: A1 }],
    gaps: [
      { sq: C, edge: 'E' },
      { sq: C, edge: 'N' },
    ],
  },
  {
    id: 'elevator',
    claim: [NC],
    keys: [
      { bar: 6, a: A1 },
      { bar: 10, a: A1 },
      { bar: 12, a: A2 },
      { bar: 16, a: A2 },
      { bar: 18, a: A1 },
    ],
    loopBars: 12,
    gaps: [{ sq: NC, edge: 'S' }],
  },
  {
    id: 'gallery-b',
    claim: [C],
    keys: [{ bar: 0, a: A2 }],
    gaps: [
      { sq: C, edge: 'N' },
      { sq: C, edge: 'W' },
    ],
  },
  {
    id: 'ferry-long',
    claim: [W],
    keys: [
      { bar: 12, a: A2 },
      { bar: 18, a: A2 },
      { bar: 22, a: A3 },
      { bar: 26, a: A3 },
      { bar: 28, a: A2 },
    ],
    loopBars: 16,
    gaps: [{ sq: W, edge: 'E' }],
    gates: [{ kind: 'sweep', seg: 1, frac: 0.5, lane: W }],
  },
  {
    id: 'gallery-c',
    claim: [C],
    keys: [{ bar: 0, a: A3 }],
    gaps: [
      { sq: C, edge: 'W' },
      { sq: C, edge: 'N' },
    ],
  },
  {
    // Two lanes: the beams are Johansen's own "dodge to the side while on a
    // moving platform" (research/03 §5) — dance's `beam`, on moving ground.
    id: 'barge',
    claim: [NC, NE],
    keys: [
      { bar: 22, a: A3 },
      { bar: 28, a: A3 },
      { bar: 34, a: A4 },
      { bar: 40, a: A4 },
      { bar: 46, a: A3 },
    ],
    loopBars: 24,
    gaps: [{ sq: NC, edge: 'S' }],
    gates: [
      { kind: 'beam', seg: 1, frac: 0.24, lane: NC },
      { kind: 'sweep', seg: 1, frac: 0.52, lane: NC },
      { kind: 'beam', seg: 1, frac: 0.8, lane: NE },
    ],
  },
  {
    id: 'verge',
    claim: [C],
    keys: [{ bar: 0, a: A4 }],
    gaps: [{ sq: C, edge: 'N' }],
  },
  {
    id: 'raft',
    claim: [NW, NC, NE],
    keys: [
      { bar: 34, a: A4 },
      { bar: 42, a: A4 },
      { bar: 50, a: A5 },
      { bar: 58, a: A5 },
      { bar: 62, a: A4 },
    ],
    loopBars: 28,
    gaps: [{ sq: NC, edge: 'S' }],
  },
];

export const RAFT_INDEX = PLATFORMS.findIndex((p) => p.id === 'raft');
export const THRESHOLD_INDEX = 0;

// Evaluation -----------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t);

export function anchorAt(spec: PlatformSpec, bar: number, out: V3): V3 {
  const keys = spec.keys;
  if (keys.length === 1 || !spec.loopBars) {
    const a = keys[0].a;
    out.x = a.x;
    out.y = a.y;
    out.z = a.z;
    return out;
  }
  const t0 = keys[0].bar;
  let t = ((bar - t0) % spec.loopBars) + t0;
  if (t < t0) t += spec.loopBars;
  for (let i = keys.length - 2; i >= 0; i--) {
    if (t >= keys[i].bar) {
      const k0 = keys[i];
      const k1 = keys[i + 1];
      const span = k1.bar - k0.bar;
      const f = span > 0 ? smooth((t - k0.bar) / span) : 0;
      out.x = k0.a.x + (k1.a.x - k0.a.x) * f;
      out.y = k0.a.y + (k1.a.y - k0.a.y) * f;
      out.z = k0.a.z + (k1.a.z - k0.a.z) * f;
      return out;
    }
  }
  const a = keys[0].a;
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}

/** True while the platform sits inside a dwell (both neighbouring keys equal). */
export function dwellInfo(
  spec: PlatformSpec,
  bar: number,
): { moving: boolean; departIn: number } {
  const keys = spec.keys;
  if (keys.length === 1 || !spec.loopBars) {
    return { moving: false, departIn: Infinity };
  }
  const t0 = keys[0].bar;
  let t = ((bar - t0) % spec.loopBars) + t0;
  if (t < t0) t += spec.loopBars;
  for (let i = keys.length - 2; i >= 0; i--) {
    if (t >= keys[i].bar) {
      const k0 = keys[i];
      const k1 = keys[i + 1];
      const still =
        k0.a.x === k1.a.x && k0.a.y === k1.a.y && k0.a.z === k1.a.z;
      if (!still) return { moving: true, departIn: Infinity };
      // Sitting in a dwell: departure is the end of this key span (dwells are
      // authored as single spans in this score).
      return { moving: false, departIn: k1.bar - t };
    }
  }
  return { moving: false, departIn: Infinity };
}

// Fences: every deck-tile edge grows a fence unless it is an authored gap or
// faces another tile of the same platform. Purely visual, prevents nothing
// (research/03 §2.4) — the gap is simply less effort than the rail.
export function fencesOf(spec: PlatformSpec): FenceSeg[] {
  const out: FenceSeg[] = [];
  const has = (c: number, r: number) =>
    spec.claim.some((s) => s[0] === c && s[1] === r);
  for (const sq of spec.claim) {
    for (const edge of EDGES) {
      const d = EDGE_DIR[edge];
      if (has(sq[0] + d[0], sq[1] + d[1])) continue;
      if (spec.gaps.some((g) => g.sq[0] === sq[0] && g.sq[1] === sq[1] && g.edge === edge))
        continue;
      const o = sqOffset(sq);
      out.push({ x: o.x, z: o.z, edge });
    }
  }
  return out;
}

/** Distinct anchor poses of a platform's loop — the ghost-overlay endpoints. */
export function endpointsOf(spec: PlatformSpec): V3[] {
  const seen: V3[] = [];
  for (const k of spec.keys) {
    if (!seen.some((a) => a.x === k.a.x && a.y === k.a.y && a.z === k.a.z)) {
      seen.push(k.a);
    }
  }
  return seen;
}

// Gates resolve to fixed world structures on the lane's travel path. The
// judge window and telegraph are geometric (distance along the travel axis),
// so they stay honest under any easing.
export function resolveGates(): GateRuntime[] {
  const out: GateRuntime[] = [];
  PLATFORMS.forEach((spec, pi) => {
    if (!spec.gates) return;
    for (const g of spec.gates) {
      const k0 = spec.keys[g.seg];
      const k1 = spec.keys[g.seg + 1];
      const lane = sqOffset(g.lane);
      const pos = v3(
        k0.a.x + (k1.a.x - k0.a.x) * g.frac + lane.x,
        k0.a.y + (k1.a.y - k0.a.y) * g.frac,
        k0.a.z + (k1.a.z - k0.a.z) * g.frac + lane.z,
      );
      const dx = Math.abs(k1.a.x - k0.a.x);
      const dz = Math.abs(k1.a.z - k0.a.z);
      const axis: 'x' | 'z' = dx > dz ? 'x' : 'z';
      const segBars = k1.bar - k0.bar;
      const travel = axis === 'x' ? dx : dz;
      out.push({
        kind: g.kind,
        platform: pi,
        lane: g.lane,
        pos,
        axis,
        span: GRID.tile * 0.5,
        telegraph: Math.max(travel / Math.max(segBars, 1), GRID.tile * 1.5),
      });
    }
  });
  return out;
}

// The intended step sequence of a perfect run, for the ledger probe: each
// entry is [fromSquare, toSquare] in grid units. The floor manager's law —
// a correct sequence returns the dancer to centre (research/01 §3, §5).
export const INTENDED_STEPS: [Sq, Sq][] = [
  [C, E], // board ferry-east
  [E, C], // alight gallery-a
  [C, NC], // board elevator
  [NC, C], // alight gallery-b
  [C, W], // board ferry-long
  [W, C], // alight gallery-c
  [C, NC], // board barge
  [NC, NE], // dodge beam
  [NE, NC], // dodge back
  [NC, C], // alight verge
  [C, NC], // board raft
  [NC, NC], // rebirth on the threshold jetty's north tile
  [NC, C], // step down to centre — the loop's ledger closes at zero
];
