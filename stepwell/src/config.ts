// All tunables. Numbers with a research pedigree cite their source note.

export const GRID = {
  // Eye of the Temple's 3×3 grid over a 2×2 m play area (research/03 §2.2).
  // Pitch 0.66 keeps the outer square centres at ±0.66 m, whole grid 1.98 m
  // wide — inside the 2×2 m minimum both exemplar games demand.
  pitch: 0.66,
  tile: 0.6, // deck tile edge; the 6 cm gap is the visual seam between squares
};

export const RIG = {
  // Handover is gated, not immediate (research/03 §2.3): a platform may take
  // tracking only when its anchor sits within alignEps of the live rig.
  alignEps: 0.025,
  alignEpsY: 0.04,
  // Stepping onto ground that is already leaving forces a switch and a slide
  // correction — "resolves in a couple of seconds at most" (research/03 §2.3).
  correctionHalfLife: 0.45,
  correctionDone: 0.01,
  // A tile owns the head only when the head is clearly inside it; the tracked
  // tile keeps a wider skirt so ownership can't flicker on the border.
  tileInset: 0.05,
  trackedOutset: 0.09,
};

export const BODY = {
  // Crouch calibration copied shape-for-shape from dance's PlayerSystem
  // (research/01 §3): instant attack, glacial release, hard floor. You can't
  // fake tall, and a set spent crouching never quietly lowers the bar.
  standingFloor: 1.1,
  standingRelease: 0.015, // m/s
  duckFrac: 0.78,
};

export const HAZARD = {
  // Render the hazard stricter than you judge it (research/01 §3): the pane
  // sits a touch below the judged cut, so clearing the picture clears the
  // judge, never the reverse.
  sweepPaneHeight: 1.26,
  // A gate is "passing" while its plane is within this fraction of a tile of
  // the lane centre, and telegraphs one bar of travel ahead of that.
  windowHalf: 0.5,
  laneHalf: 0.5, // fraction of pitch a blocked lane claims when judging a beam
};

export const MUSIC = {
  bpm: 96,
  beatsPerBar: 4,
};

// A real stepwell is a long trench, not a square shaft — the route descends
// along its length, so the whole walk is inside the architecture and the
// far end is visible from the threshold: see something far away, then make
// your way there on your own feet (research/03 §7).
export const WELL = {
  halfX: 4.2, // trench half-width
  zNear: 2.8, // south end wall (behind the threshold)
  zFar: -14.6, // north end wall (beyond the water raft)
  storey: 2.6,
  waterY: -13.0,
  mouthY: 3.2,
};

// Saturated colour is reserved for light (research/02 §6); amber→red stays
// exclusive to gameplay the way dance keeps its hazard language.
export const COLOR = {
  structure: 0x141822,
  window: 0x1fb6c9,
  windowWarm: 0x2a6f8a,
  deck: 0x0d1016,
  deckTop: 0x151a24,
  rimSafe: 0x2affd4,
  rimWarn: 0xffaa22,
  rimDanger: 0xff2244,
  // Fences whisper; rims speak. A fence is a suggestion, not a light
  // (research/03 §2.4), so it must never outshine the telegraph language.
  fence: 0x24444e,
  pattern: 0xffffff,
  water: 0x04101c,
  dust: 0x9adfe8,
  shaft: 0x136978,
  flow: 0x2affd4,
  gateFrame: 0x1c2230,
};

export const ENERGY = {
  // The scenery ducks while a telegraph owns the deck; danger never competes
  // with scenery (research/02 §6). Energy is an input the environment obeys.
  base: 0.8,
  ducked: 0.35,
  flowBonus: 0.015,
  ease: 2.2, // 1/s toward target
};

export const PLAY_AREA = {
  // Fixed minimum, never adapted (research/03 §1, §8.4). bounded-floor is
  // read for validation only: warn when the room can't hold the grid.
  requiredWidth: 2.0,
  requiredDepth: 2.0,
};

export const BUDGET = {
  // research/02 §8 — measured by the probe, not hoped for.
  maxDrawCalls: 60,
  maxTriangles: 100_000,
};
