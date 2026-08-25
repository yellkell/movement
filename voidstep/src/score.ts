// The score: THE CIRCUIT — a closed parkour lap through the void. Out to the
// east on a runner, up the lift, across THE SKYWALK at height while the void
// throws dance's moves at your deck, down the drop, home on the west runner.
//
// The authoring discipline is stepwell's, unchanged: each platform claims
// squares of the 3×3 play-area grid (research/03 §2.2) and moves its ANCHOR —
// the rig pose that pins it to its claim — along a bar-quantized loop.
// Consecutive platforms share an anchor at handover, so every traversal is a
// pair of opposed real steps netting to zero (research/03 §2.1), and the lap
// is geometrically closed: the last step home repays the first step out.
// `validateScore()` keeps the ghost-overlay discipline executable: routed
// handovers must share a stop anchor, and no two platforms may ever park
// decks on the same world spot.

import { ATTACK, GRID } from './config';

export type Sq = readonly [number, number]; // [col +east, row +south], -1..1
export type V3 = { x: number; y: number; z: number };
export type Edge = 'N' | 'S' | 'E' | 'W';

export interface PathKey {
  bar: number;
  a: V3;
}

// The stolen moves — dance's vocabulary, the subset a 2×2 deck can host.
// Every one asks the body for a verb, and no verb repeats back to back
// (dance's set-list law):
//   beam   — a strip down one COLUMN: sidestep off the lane
//   rail   — the crossfire cousin, a strip across one ROW: step fwd/back
//   seesaw — one x-half floods, hard rail on the centreline: cross it
//   surge  — the seesaw's front/back cousin: cross the other way
//   gate   — everything floods EXCEPT one clear column: stand in the gap
//   sweep  — a blade at chest height, danger in the AIR, floor unpainted
//            (dance's one sacred exception): duck, and hold it
export type AttackKind = 'beam' | 'rail' | 'seesaw' | 'surge' | 'gate' | 'sweep';

export interface AttackSpec {
  kind: AttackKind;
  platform: string; // host platform id — judged only while riding it
  landBar: number; // loop-local bar of the landing downbeat
  /** beam/rail: the doomed lane's play-area coord on its axis.
   *  gate: the CLEAR band's coord. seesaw/surge: unused (centreline). */
  at?: number;
  /** seesaw/surge: the doomed half's sign along the axis (+1 = the
   *  greater-coordinate half). */
  side?: -1 | 1;
}

export interface PlatformSpec {
  id: string;
  claim: Sq[];
  keys: PathKey[]; // static platforms: one key; loops close back to keys[0].a
  loopBars?: number;
  gaps: { sq: Sq; edge: Edge }[]; // fence openings where a step is authored
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
// The lap circles the arena's centre and takes the free vertical dimension
// (research/03 §3): east and up, across the void's north at height — the
// skywalk rides among the arcs, the mirror floor far below — then west and
// down, and the ledger closes at centre.

const H = v3(0, 0, 0); // home, the arena's heart
const E1 = v3(2.6, 0, -1.2); // east landing
const E2 = v3(2.6, 3.8, -4.4); // the lift's high berth
const S3 = v3(-3.0, 3.8, -4.4); // the skywalk's west berth
const W4 = v3(-3.0, 0, -1.2); // west landing, back on the floor

export const ANCHORS = { H, E1, E2, S3, W4 };

const C: Sq = [0, 0];
const E: Sq = [1, 0];
const W: Sq = [-1, 0];
const NC: Sq = [0, -1];
const NE: Sq = [1, -1];
const NW: Sq = [-1, -1];
const SC: Sq = [0, 1];
const SE: Sq = [1, 1];

export const PLATFORMS: PlatformSpec[] = [
  {
    // The alpha and the omega: leave stepping east, return stepping east off
    // the west runner. The lap's ledger closes here at centre.
    id: 'home',
    claim: [C, SC],
    keys: [{ bar: 0, a: H }],
    gaps: [
      { sq: C, edge: 'E' },
      { sq: C, edge: 'W' },
    ],
  },
  {
    id: 'runner-out',
    claim: [E],
    keys: [
      { bar: 0, a: H },
      { bar: 6, a: H },
      { bar: 10, a: E1 },
      { bar: 14, a: E1 },
      { bar: 16, a: H },
    ],
    loopBars: 16,
    gaps: [{ sq: E, edge: 'W' }],
  },
  {
    // Two tiles: arrive on C, walk north, board the lift east off NC. The
    // internal +N is repaid by the −N step off the lift at the top — the
    // repayment spans the whole ride, stepwell's mill discipline.
    id: 'east-step',
    claim: [C, NC],
    keys: [{ bar: 0, a: E1 }],
    gaps: [
      { sq: C, edge: 'E' },
      { sq: NC, edge: 'E' },
    ],
  },
  {
    // The climb. One sweep mid-flight: duck on rising ground — Johansen's
    // unbuilt verb, on dance's telegraph.
    id: 'lift',
    claim: [NE],
    keys: [
      { bar: 10, a: E1 },
      { bar: 16, a: E1 },
      { bar: 20, a: E2 },
      { bar: 24, a: E2 },
      { bar: 26, a: E1 },
    ],
    loopBars: 16,
    gaps: [
      { sq: NE, edge: 'W' },
      { sq: NE, edge: 'S' },
    ],
  },
  {
    id: 'sky-east',
    claim: [E],
    keys: [{ bar: 0, a: E2 }],
    gaps: [
      { sq: E, edge: 'N' },
      { sq: E, edge: 'W' },
    ],
  },
  {
    // THE SKYWALK — the set piece. A 2×2 deck riding the void's north at
    // height, and the reason the deck is wide: THE VOLLEY lands here — all
    // six stolen moves across one twelve-bar crossing, every dodge performed
    // on ground that is itself in motion. It cycles home empty, like
    // stepwell's ferries.
    id: 'skywalk',
    claim: [W, C, NW, NC],
    keys: [
      { bar: 24, a: E2 },
      { bar: 32, a: E2 },
      { bar: 44, a: S3 },
      { bar: 50, a: S3 },
      { bar: 56, a: E2 },
    ],
    loopBars: 32,
    gaps: [{ sq: C, edge: 'E' }],
  },
  {
    id: 'sky-west',
    claim: [E],
    keys: [{ bar: 0, a: S3 }],
    gaps: [
      { sq: E, edge: 'W' },
      { sq: E, edge: 'S' },
    ],
  },
  {
    id: 'drop',
    claim: [SE],
    keys: [
      { bar: 12, a: S3 },
      { bar: 18, a: S3 },
      { bar: 22, a: W4 },
      { bar: 26, a: W4 },
      { bar: 28, a: S3 },
    ],
    loopBars: 16,
    gaps: [
      { sq: SE, edge: 'N' },
      { sq: SE, edge: 'W' },
    ],
  },
  {
    id: 'west-step',
    claim: [SC, C],
    keys: [{ bar: 0, a: W4 }],
    gaps: [
      { sq: SC, edge: 'E' },
      { sq: C, edge: 'W' },
    ],
  },
  {
    id: 'runner-home',
    claim: [W],
    keys: [
      { bar: 6, a: W4 },
      { bar: 12, a: W4 },
      { bar: 16, a: H },
      { bar: 20, a: H },
      { bar: 22, a: W4 },
    ],
    loopBars: 16,
    gaps: [{ sq: W, edge: 'E' }],
  },
];

export const INDEX: Record<string, number> = {};
PLATFORMS.forEach((p, i) => (INDEX[p.id] = i));

export const HOME_INDEX = INDEX['home'];
export const SKYWALK_INDEX = INDEX['skywalk'];

// The volley — dance's set-list, authored instead of rolled: deterministic,
// walkable by the probe, and readable as a score. Landings sit on downbeats
// inside the host's travel; charges are dance's own beat counts (config).
// Dance's laws hold: no verb twice running, a gate's gap never sits where
// the previous dodge parks you, and the final surge floods the far row so
// the volley ends on the exit tile's row — the floor manager, authored.
export const ATTACKS: AttackSpec[] = [
  // The lift's climb (travel 16–20): one ask, the duck — Johansen's own
  // unbuilt verb, on rising ground.
  { kind: 'sweep', platform: 'lift', landBar: 18 },
  // THE SKYWALK's volley (travel 32–44): all six, one every two bars.
  { kind: 'beam', platform: 'skywalk', landBar: 33, at: 0 }, // off the C column
  { kind: 'seesaw', platform: 'skywalk', landBar: 35, side: -1 }, // cross back east
  { kind: 'sweep', platform: 'skywalk', landBar: 37 }, // duck
  { kind: 'rail', platform: 'skywalk', landBar: 39, at: 0 }, // step north off the row
  { kind: 'gate', platform: 'skywalk', landBar: 41, at: -0.66 }, // thread west
  { kind: 'surge', platform: 'skywalk', landBar: 43, side: -1 }, // south, to the exit row
  // The drop (travel 18–22): the last duck, falling.
  { kind: 'sweep', platform: 'drop', landBar: 20 },
];

// The route, in order. Wayfinding walks this; the probe walks it too.
export const ROUTE: string[] = [
  'home',
  'runner-out',
  'east-step',
  'lift',
  'sky-east',
  'skywalk',
  'sky-west',
  'drop',
  'west-step',
  'runner-home',
  'home',
];

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

/** Loop-local bar time for a spec (how ATTACKS address the clock). */
export function loopBar(spec: PlatformSpec, bar: number): number {
  if (!spec.loopBars) return bar;
  const t0 = spec.keys[0].bar;
  let t = ((bar - t0) % spec.loopBars) + t0;
  if (t < t0) t += spec.loopBars;
  return t;
}

/** Dwell state; departIn counts bars until this dwell ends. */
export function dwellInfo(
  spec: PlatformSpec,
  bar: number,
): { moving: boolean; departIn: number } {
  const keys = spec.keys;
  if (keys.length === 1 || !spec.loopBars) {
    return { moving: false, departIn: Infinity };
  }
  const t = loopBar(spec, bar);
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
// (research/03 §2.4).
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

/** The deck's extent in play-area coords: [min,max] per axis over the claim. */
export function claimExtent(spec: PlatformSpec): {
  x: [number, number];
  z: [number, number];
} {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const sq of spec.claim) {
    const o = sqOffset(sq);
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x);
    minZ = Math.min(minZ, o.z);
    maxZ = Math.max(maxZ, o.z);
  }
  return { x: [minX, maxX], z: [minZ, maxZ] };
}

// The ghost-overlay discipline, executable (stepwell's law, verbatim): every
// routed handover must share a stop anchor, no two platforms may ever park
// decks on the same world spot — and the attacks must land while their host
// actually travels, on a downbeat, with the whole charge inside the ride.
export function validateScore(): void {
  const eps = 1e-6;
  const near = (a: V3, b: V3) =>
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.z - b.z) < eps;
  const stopsOf = (id: string): V3[] => endpointsOf(PLATFORMS[INDEX[id]]);

  const tilesOf = (spec: PlatformSpec): V3[] => {
    const out: V3[] = [];
    for (const a of endpointsOf(spec)) {
      for (const sq of spec.claim) {
        const o = sqOffset(sq);
        out.push(v3(a.x + o.x, a.y, a.z + o.z));
      }
    }
    return out;
  };
  for (let i = 0; i < PLATFORMS.length; i++) {
    for (let j = i + 1; j < PLATFORMS.length; j++) {
      for (const ta of tilesOf(PLATFORMS[i])) {
        for (const tb of tilesOf(PLATFORMS[j])) {
          if (near(ta, tb)) {
            throw new Error(
              `score: ${PLATFORMS[i].id} and ${PLATFORMS[j].id} park decks on the same spot (${ta.x.toFixed(2)}, ${ta.y.toFixed(2)}, ${ta.z.toFixed(2)})`,
            );
          }
        }
      }
    }
  }
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const ok = stopsOf(ROUTE[i]).some((sa) =>
      stopsOf(ROUTE[i + 1]).some((sb) => near(sa, sb)),
    );
    if (!ok) {
      throw new Error(
        `score: no shared stop between ${ROUTE[i]} and ${ROUTE[i + 1]} — the patterns don't tile`,
      );
    }
  }
  let lastVerb = '';
  const VERB: Record<AttackKind, string> = {
    beam: 'dodge-x',
    gate: 'dodge-x',
    rail: 'dodge-z',
    surge: 'cross-z',
    seesaw: 'cross-x',
    sweep: 'duck',
  };
  for (const atk of ATTACKS) {
    const spec = PLATFORMS[INDEX[atk.platform]];
    if (!spec?.loopBars) throw new Error(`attack on unknown/static host ${atk.platform}`);
    const charge = ATTACK.chargeBeats[atk.kind] / 4;
    for (const t of [atk.landBar - charge, atk.landBar]) {
      let moving = false;
      for (let k = 0; k + 1 < spec.keys.length; k++) {
        const k0 = spec.keys[k];
        const k1 = spec.keys[k + 1];
        if (t >= k0.bar && t <= k1.bar) {
          moving ||= !(k0.a.x === k1.a.x && k0.a.y === k1.a.y && k0.a.z === k1.a.z);
        }
      }
      if (!moving) {
        throw new Error(
          `score: ${atk.kind} on ${atk.platform} at bar ${atk.landBar} — the charge leaves the ride (windups are sacred)`,
        );
      }
    }
    if (atk.landBar % 1 !== 0) {
      throw new Error(`score: ${atk.kind} on ${atk.platform} misses the downbeat`);
    }
    if (atk.platform === 'skywalk' && VERB[atk.kind] === lastVerb) {
      throw new Error(`score: ${atk.kind} repeats verb ${lastVerb} back to back`);
    }
    if (atk.platform === 'skywalk') lastVerb = VERB[atk.kind];
  }
}
