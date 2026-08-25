// The score: the full winding of the well — down the east side to the water,
// back up the west side with the ember. Each platform claims squares of the
// 3×3 play-area grid (research/03 §2.2) and moves its ANCHOR — the rig pose
// that pins it to its claim — along a bar-quantized loop. Consecutive
// platforms share an anchor at handover, so every traversal is a pair of
// opposed real steps that nets to zero (research/03 §2.1), and the whole
// loop is geometrically closed: the ascent returns to the exact anchor the
// descent left, so rebirth needs no teleport at all. `validateScore()` makes
// the ghost-overlay discipline executable: every routed handover must have a
// shared stop anchor, or the score refuses to boot.

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

export interface PlateSpec {
  sq: Sq; // the glyph square on the host platform
  target: string; // platform id whose loop the plate rephases
  targetKeyBar: number; // the key bar whose dwell the plate summons
}

export interface PlatformSpec {
  id: string;
  claim: Sq[];
  keys: PathKey[]; // static platforms: one key; loops close back to keys[0].a
  loopBars?: number;
  gaps: { sq: Sq; edge: Edge }[]; // fence openings where a step is authored
  gates?: GateSpec[];
  plate?: PlateSpec;
  mill?: { travel: V3; driftSquares: number; bars: number }; // walk-driven drift
  extraGhosts?: { a: V3; sq: Sq }[]; // stamped poses beyond the key anchors
}

export interface GateRuntime {
  kind: 'sweep' | 'beam';
  platform: number;
  lane: Sq;
  pos: V3;
  axis: 'x' | 'z';
  span: number;
  telegraph: number;
}

export interface FenceSeg {
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

// Anchors ---------------------------------------------------------------------
// Verticality is the free dimension (research/03 §3): the elevator, the
// paternoster and the rafts spend no floor. The descent runs the east side of
// the trench, the ascent the west, and both end where they began.

const A0 = v3(0, 0, 0); // the threshold
const B1 = v3(0.9, 0, -2.6); // ferry-east far berth
const B2 = v3(0.9, -2.6, -2.6); // elevator bottom
const B3 = v3(0.9, -2.6, -6.2); // long ferry far berth
const M1 = v3(1.5, -2.6, -8.2); // the relay's mid-well meeting
const B4 = v3(0.7, -5.2, -9.4); // paternoster top, east column
const B5 = v3(0.7, -10.4, -9.4); // paternoster bottom, east column
const CROSS = v3(-2.0, 0, 0); // the paternoster's column-to-column throw
const B5w = v3(B5.x + CROSS.x, B5.y, B5.z); // bottom, west column
const B4w = v3(B4.x + CROSS.x, B4.y, B4.z); // top, west column
const B6 = v3(0.7, -10.4, -11.2); // beyond the mill: the raft bay
const B7 = v3(0.7, -13.0, -11.2); // the water
const C3 = v3(-1.0, -2.6, -5.8); // the gauntlet's high berth
const MILL_TRAVEL = v3(B6.x - B5.x, B6.y - B5.y, B6.z - B5.z);

export const ANCHORS = { A0, B1, B2, B3, M1, B4, B5, B5w, B4w, B6, B7, C3 };
export const WATER_ANCHOR = B7;

const C: Sq = [0, 0];
const E: Sq = [1, 0];
const W: Sq = [-1, 0];
const NC: Sq = [0, -1];
const NE: Sq = [1, -1];
const NW: Sq = [-1, -1];
const SC: Sq = [0, 1];
const SE: Sq = [1, 1];

// A paternoster car's full circuit: down the east column, across, up the
// west, across again. One-bar dwells at all four stops; three cars four bars
// apart put a car at every stop every four bars.
function paternosterCar(phase: number): PlatformSpec {
  const k = (bar: number, a: V3): PathKey => ({ bar: bar + phase, a });
  return {
    id: `car-${phase / 4 + 1}`,
    claim: [NC],
    keys: [
      k(0, B4),
      k(1, B4),
      k(4, B5),
      k(5, B5),
      k(6, B5w),
      k(7, B5w),
      k(10, B4w),
      k(11, B4w),
      k(12, B4),
    ],
    loopBars: 12,
    gaps: [{ sq: NC, edge: 'S' }],
  };
}

export const PLATFORMS: PlatformSpec[] = [
  {
    // The alpha and the omega: you leave stepping east, you return stepping
    // east off the home ferry. The loop's ledger closes here at centre.
    id: 'threshold',
    claim: [C, NC],
    keys: [{ bar: 0, a: A0 }],
    gaps: [
      { sq: C, edge: 'E' },
      { sq: C, edge: 'S' },
    ],
  },
  {
    id: 'ferry-east',
    claim: [E],
    keys: [
      { bar: 0, a: A0 },
      { bar: 4, a: A0 },
      { bar: 6, a: B1 },
      { bar: 10, a: B1 },
      { bar: 12, a: A0 },
    ],
    loopBars: 12,
    gaps: [{ sq: E, edge: 'W' }],
  },
  {
    id: 'gallery-a',
    claim: [C],
    keys: [{ bar: 0, a: B1 }],
    gaps: [
      { sq: C, edge: 'E' },
      { sq: C, edge: 'N' },
    ],
  },
  {
    id: 'elevator',
    claim: [NC],
    keys: [
      { bar: 6, a: B1 },
      { bar: 10, a: B1 },
      { bar: 12, a: B2 },
      { bar: 16, a: B2 },
      { bar: 18, a: B1 },
    ],
    loopBars: 12,
    gaps: [{ sq: NC, edge: 'S' }],
  },
  {
    id: 'gallery-b',
    claim: [C],
    keys: [{ bar: 0, a: B2 }],
    gaps: [
      { sq: C, edge: 'N' },
      { sq: C, edge: 'W' },
    ],
  },
  {
    id: 'ferry-long',
    claim: [W],
    keys: [
      { bar: 12, a: B2 },
      { bar: 18, a: B2 },
      { bar: 22, a: B3 },
      { bar: 26, a: B3 },
      { bar: 28, a: B2 },
    ],
    loopBars: 16,
    gaps: [{ sq: W, edge: 'E' }],
    gates: [{ kind: 'sweep', seg: 1, frac: 0.5, lane: W }],
  },
  {
    id: 'gallery-c',
    claim: [C],
    keys: [{ bar: 0, a: B3 }],
    gaps: [
      { sq: C, edge: 'W' },
      { sq: C, edge: 'E' },
    ],
  },
  {
    // The relay, first leg: out to the middle of the well, where its partner
    // meets it. Transfer between two machines, mid-air, on a shared dwell.
    id: 'relay-a',
    claim: [E],
    keys: [
      { bar: 22, a: B3 },
      { bar: 26, a: B3 },
      { bar: 28, a: M1 },
      { bar: 34, a: M1 },
      { bar: 38, a: B3 },
    ],
    loopBars: 16,
    gaps: [
      { sq: E, edge: 'W' },
      { sq: E, edge: 'N' },
    ],
  },
  {
    id: 'relay-b',
    claim: [NE],
    keys: [
      { bar: 28, a: M1 },
      { bar: 32, a: M1 },
      { bar: 35, a: B4 },
      { bar: 41, a: B4 },
      { bar: 44, a: M1 },
    ],
    loopBars: 16,
    gaps: [{ sq: NE, edge: 'S' }],
    gates: [{ kind: 'sweep', seg: 1, frac: 0.5, lane: NE }],
  },
  {
    // Serves the relay's arrival and the paternoster's east boarding.
    id: 'top-landing',
    claim: [E, C],
    keys: [{ bar: 0, a: B4 }],
    gaps: [
      { sq: E, edge: 'N' },
      { sq: C, edge: 'N' },
    ],
  },
  paternosterCar(0),
  paternosterCar(4),
  paternosterCar(8),
  {
    id: 'deep-landing',
    claim: [C],
    keys: [{ bar: 0, a: B5 }],
    gaps: [
      { sq: C, edge: 'N' },
      { sq: C, edge: 'S' },
    ],
  },
  {
    // The mill: the research's sharpest unbuilt idea (research/03 §8) — a
    // drum that converts a walk into travel. It grinds only while you walk:
    // the claim drifts two squares north across the real floor as the anchor
    // advances through the world, and the walking raises the water gate.
    id: 'mill',
    claim: [SC],
    keys: [{ bar: 0, a: B5 }],
    gaps: [
      { sq: SC, edge: 'N' },
      { sq: SC, edge: 'S' },
    ],
    mill: { travel: MILL_TRAVEL, driftSquares: 2, bars: 6 },
    extraGhosts: [{ a: B6, sq: NC }],
  },
  {
    // The mill's finished tile owns NC here, so everything else at this
    // anchor keeps clear of it: the raft berths east, the plate sits south.
    id: 'raft-bay',
    claim: [C, SC],
    keys: [{ bar: 0, a: B6 }],
    gaps: [
      { sq: C, edge: 'N' },
      { sq: C, edge: 'E' },
      { sq: C, edge: 'W' },
    ],
    plate: { sq: SC, target: 'raft', targetKeyBar: 0 },
  },
  {
    id: 'raft',
    claim: [NE, E, SE],
    keys: [
      { bar: 0, a: B6 },
      { bar: 8, a: B6 },
      { bar: 16, a: B7 },
      { bar: 24, a: B7 },
      { bar: 28, a: B6 },
    ],
    loopBars: 28,
    gaps: [{ sq: E, edge: 'W' }],
  },
  {
    id: 'ferry-west',
    claim: [W],
    keys: [
      { bar: 0, a: B6 },
      { bar: 4, a: B6 },
      { bar: 6, a: B5w },
      { bar: 10, a: B5w },
      { bar: 12, a: B6 },
    ],
    loopBars: 12,
    gaps: [{ sq: W, edge: 'E' }],
  },
  {
    id: 'west-landing',
    claim: [C],
    keys: [{ bar: 0, a: B5w }],
    gaps: [
      { sq: C, edge: 'W' },
      { sq: C, edge: 'N' },
    ],
  },
  {
    // The paternoster's cars own NC at this anchor; the gauntlet berths in
    // the west column and the plate sits east, clear of both.
    id: 'high-landing',
    claim: [C, E],
    keys: [{ bar: 0, a: B4w }],
    gaps: [
      { sq: C, edge: 'N' },
      { sq: C, edge: 'W' },
    ],
    plate: { sq: E, target: 'gauntlet', targetKeyBar: 0 },
  },
  {
    // The ascent's finale: two lanes climbing home through four gates.
    id: 'gauntlet',
    claim: [W, NW],
    keys: [
      { bar: 0, a: B4w },
      { bar: 6, a: B4w },
      { bar: 12, a: C3 },
      { bar: 18, a: C3 },
      { bar: 24, a: B4w },
    ],
    loopBars: 24,
    gaps: [{ sq: W, edge: 'E' }],
    // One ask per beat-ish of travel; consecutive beams block opposite
    // lanes with a clear bar between their windows — a dodge is a move,
    // never a coin-flip between two simultaneous demands.
    gates: [
      { kind: 'beam', seg: 1, frac: 0.18, lane: NW },
      { kind: 'sweep', seg: 1, frac: 0.46, lane: W },
      { kind: 'beam', seg: 1, frac: 0.68, lane: W },
      { kind: 'beam', seg: 1, frac: 0.93, lane: NW },
    ],
  },
  {
    id: 'arrival',
    claim: [C],
    keys: [{ bar: 0, a: C3 }],
    gaps: [
      { sq: C, edge: 'W' },
      { sq: C, edge: 'S' },
    ],
  },
  {
    // Berths south so the gauntlet's west lanes stay clear at both anchors;
    // the last step home is the −N that closes the ledger at centre.
    id: 'ferry-home',
    claim: [SC],
    keys: [
      { bar: 0, a: C3 },
      { bar: 6, a: C3 },
      { bar: 10, a: A0 },
      { bar: 14, a: A0 },
      { bar: 16, a: C3 },
    ],
    loopBars: 16,
    gaps: [{ sq: SC, edge: 'N' }],
    gates: [{ kind: 'sweep', seg: 1, frac: 0.55, lane: SC }],
  },
];

export const INDEX: Record<string, number> = {};
PLATFORMS.forEach((p, i) => (INDEX[p.id] = i));

export const THRESHOLD_INDEX = INDEX['threshold'];
export const MILL_INDEX = INDEX['mill'];
export const RAFT_INDEX = INDEX['raft'];
export const CAR_INDICES = [INDEX['car-1'], INDEX['car-2'], INDEX['car-3']];

// The route, both directions. An entry with several ids (the paternoster
// cars) is satisfied by whichever candidate is aligned. Wayfinding walks
// this; the probe walks it too.
export const ROUTE_DOWN: string[][] = [
  ['threshold'],
  ['ferry-east'],
  ['gallery-a'],
  ['elevator'],
  ['gallery-b'],
  ['ferry-long'],
  ['gallery-c'],
  ['relay-a'],
  ['relay-b'],
  ['top-landing'],
  ['car-1', 'car-2', 'car-3'],
  ['deep-landing'],
  ['mill'],
  ['raft-bay'],
  ['raft'],
];
export const ROUTE_UP: string[][] = [
  ['raft'],
  ['raft-bay'],
  ['ferry-west'],
  ['west-landing'],
  ['car-1', 'car-2', 'car-3'],
  ['high-landing'],
  ['gauntlet'],
  ['arrival'],
  ['ferry-home'],
  ['threshold'],
];

// Evaluation -----------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t);

export function anchorAt(
  spec: PlatformSpec,
  bar: number,
  out: V3,
  phaseShift = 0,
): V3 {
  const keys = spec.keys;
  if (keys.length === 1 || !spec.loopBars) {
    const a = keys[0].a;
    out.x = a.x;
    out.y = a.y;
    out.z = a.z;
    return out;
  }
  const b = bar - phaseShift;
  const t0 = keys[0].bar;
  let t = ((b - t0) % spec.loopBars) + t0;
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

/** Dwell state; departIn counts bars until this dwell ends. */
export function dwellInfo(
  spec: PlatformSpec,
  bar: number,
  phaseShift = 0,
): { moving: boolean; departIn: number } {
  const keys = spec.keys;
  if (keys.length === 1 || !spec.loopBars) {
    return { moving: false, departIn: Infinity };
  }
  const b = bar - phaseShift;
  const t0 = keys[0].bar;
  let t = ((b - t0) % spec.loopBars) + t0;
  if (t < t0) t += spec.loopBars;
  for (let i = keys.length - 2; i >= 0; i--) {
    if (t >= keys[i].bar) {
      const k0 = keys[i];
      const k1 = keys[i + 1];
      const still =
        k0.a.x === k1.a.x && k0.a.y === k1.a.y && k0.a.z === k1.a.z;
      if (!still) return { moving: true, departIn: Infinity };
      return { moving: false, departIn: k1.bar - t };
    }
  }
  return { moving: false, departIn: Infinity };
}

// Fences: every deck-tile edge grows a rail unless it is an authored gap or
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
      if (
        spec.gaps.some(
          (g) => g.sq[0] === sq[0] && g.sq[1] === sq[1] && g.edge === edge,
        )
      )
        continue;
      const o = sqOffset(sq);
      out.push({ x: o.x, z: o.z, edge });
    }
  }
  return out;
}

/** Distinct anchor poses of a platform's loop — the ghost/berth stops. */
export function endpointsOf(spec: PlatformSpec): V3[] {
  const seen: V3[] = [];
  for (const k of spec.keys) {
    if (!seen.some((a) => a.x === k.a.x && a.y === k.a.y && a.z === k.a.z)) {
      seen.push(k.a);
    }
  }
  return seen;
}

// Gates resolve to fixed world structures on the lane's travel path; judge
// window and telegraph are geometric, honest under any easing.
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

// The ghost-overlay discipline, executable: every routed handover must share
// a stop anchor between its two platforms. If the patterns wouldn't tile,
// the score refuses to boot.
export function validateScore(): void {
  const eps = 1e-6;
  const stopsOf = (id: string): V3[] => {
    const spec = PLATFORMS[INDEX[id]];
    const stops = endpointsOf(spec);
    if (spec.mill) {
      stops.push(
        v3(
          spec.keys[0].a.x + spec.mill.travel.x,
          spec.keys[0].a.y + spec.mill.travel.y,
          spec.keys[0].a.z + spec.mill.travel.z,
        ),
      );
    }
    return stops;
  };
  const near = (a: V3, b: V3) =>
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.z - b.z) < eps;

  // No two platforms may ever park a deck tile on the same world spot — the
  // lesson of the mill stealing the raft's handover, made permanent. The
  // paternoster's cars timeshare their berths by phase and are exempt as a
  // fleet.
  const tilesOf = (spec: PlatformSpec): V3[] => {
    const stops = endpointsOf(spec);
    if (spec.mill) {
      stops.push(
        v3(
          spec.keys[0].a.x + spec.mill.travel.x,
          spec.keys[0].a.y + spec.mill.travel.y,
          spec.keys[0].a.z + spec.mill.travel.z,
        ),
      );
    }
    const out: V3[] = [];
    for (const a of stops) {
      for (const sq of spec.claim) {
        const o = sqOffset(sq);
        // The mill's claim slides with its walk: its far stop carries the
        // drifted square, its home stop the authored one.
        const drift =
          spec.mill && a !== spec.keys[0].a
            ? -spec.mill.driftSquares * GRID.pitch
            : 0;
        out.push(v3(a.x + o.x, a.y, a.z + o.z + drift));
      }
    }
    return out;
  };
  for (let i = 0; i < PLATFORMS.length; i++) {
    for (let j = i + 1; j < PLATFORMS.length; j++) {
      const a = PLATFORMS[i];
      const b = PLATFORMS[j];
      if (a.id.startsWith('car-') && b.id.startsWith('car-')) continue;
      for (const ta of tilesOf(a)) {
        for (const tb of tilesOf(b)) {
          if (near(ta, tb)) {
            throw new Error(
              `score: ${a.id} and ${b.id} park decks on the same spot (${ta.x.toFixed(2)}, ${ta.y.toFixed(2)}, ${ta.z.toFixed(2)})`,
            );
          }
        }
      }
    }
  }
  for (const route of [ROUTE_DOWN, ROUTE_UP]) {
    for (let i = 0; i + 1 < route.length; i++) {
      const ok = route[i].some((fromId) =>
        route[i + 1].some((toId) =>
          stopsOf(fromId).some((sa) => stopsOf(toId).some((sb) => near(sa, sb))),
        ),
      );
      if (!ok) {
        throw new Error(
          `score: no shared stop between [${route[i]}] and [${route[i + 1]}] — the patterns don't tile`,
        );
      }
    }
  }
}
