// All tunables. VOIDSTEP consolidates the two houses: the movement grammar
// is stepwell's (../stepwell — Eye-of-the-Temple frame-of-reference on a
// rhythm grid), SIMPLIFIED — the forced-switch slide correction is gone, so
// numbers for it don't exist here; the environment and the attack language
// are RAVE RAID's (the dance repo), cloned. Numbers with a research pedigree
// cite their source note in ../research/.

export const GRID = {
  // Eye of the Temple's 3×3 grid over a 2×2 m play area (research/03 §2.2).
  pitch: 0.66,
  tile: 0.6, // deck tile edge; the 6 cm gap is the visual seam between squares
};

export const RIG = {
  // Handover is gated, not immediate (research/03 §2.3): a platform may take
  // tracking only when its anchor sits within alignEps of the live rig.
  // That is the WHOLE law here. Stepwell's other clause — ground already
  // leaving forces a switch and the world slides back under your feet — is
  // deliberately not carried over: the slide was the part that read as the
  // world moving, so in VOIDSTEP the frame never moves except by riding.
  // Standing on departing un-tracked ground is a SLIP, not a slide.
  alignEps: 0.025,
  alignEpsY: 0.04,
  // A tile owns the head only when the head is clearly inside it; the tracked
  // tile keeps a wider skirt so ownership can't flicker on the border.
  tileInset: 0.05,
  trackedOutset: 0.09,
};

export const BODY = {
  // Crouch calibration copied shape-for-shape from dance's PlayerSystem
  // (research/01 §3): instant attack, glacial release, hard floor.
  standingFloor: 1.1,
  standingRelease: 0.015, // m/s
  duckFrac: 0.78,
};

export const MUSIC = {
  bpm: 122, // a rave tempo — dance's 110–117 shelf, pushed one notch up
  beatsPerBar: 4,
};

// The attacks — dance's move vocabulary, the subset that fits a 2×2 deck.
// Charges are dance's own (MOVES in the dance repo's config): the windup is
// sacred — escalation may compress gaps between moves, never the read.
export const ATTACK = {
  chargeBeats: { beam: 3, rail: 3, seesaw: 4, surge: 4, gate: 4, sweep: 4 },
  // Judged half-widths, in metres of play-area space. Render is drawn a
  // touch WIDER than the judge cuts (dance's law, research/01 §3: stricter
  // picture than score) — clearing the picture always clears the judge.
  laneHalf: 0.3, // beam/rail: |coord − lane| < laneHalf is clipped
  gapHalf: 0.31, // gate: |coord − gap| > gapHalf is clipped
  halfEps: 0.05, // seesaw/surge: past the centreline by this is safe
  sweepPaneHeight: 1.26, // the blade line; judge is the duck flag itself
  flashSec: 0.4, // the landing burn
};

// The void's palette — RAVE RAID's laser wheel, cloned. Saturated colour is
// reserved for light (research/02 §6); amber→red stays gameplay's alone.
export const LASER_HUES = [0.9, 0.55, 0.75, 0.33, 0.12];

/** hue (0..1) → saturated neon colour (dance's hueToColor, cloned). */
export function hueToColor(hue: number, light = 0.55): number {
  const h = (((hue % 1) + 1) % 1) * 6;
  const l = Math.max(0.2, Math.min(0.9, light));
  const c = (1 - Math.abs(2 * l - 1)) * 1;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

export const COLOR = {
  deck: 0x0d1016,
  deckTop: 0x14121e,
  rimSafe: 0x66d9ff,
  rimWarn: 0xffaa22,
  rimDanger: 0xff2244,
  // Fences whisper; rims speak (research/03 §2.4).
  fence: 0x33304e,
  pattern: 0xffffff,
  gateFrame: 0x1c2230,
};

export const ENERGY = {
  // The scenery ducks while a telegraph owns the deck; danger never competes
  // with scenery (research/02 §6) — dance's own energy law.
  base: 0.8,
  ducked: 0.35,
  flowBonus: 0.015,
  ease: 2.2, // 1/s toward target
};

export const PLAY_AREA = {
  // Fixed minimum, never adapted (research/03 §1, §8.4).
  requiredWidth: 2.0,
  requiredDepth: 2.0,
};

export const BUDGET = {
  // research/02 §8 — measured by the probe, not hoped for.
  maxDrawCalls: 60,
  maxTriangles: 100_000,
};

export const COUNTDOWN = {
  postIdle: 0.05,
  postWarn: 0.34,
  postSize: 0.05,
};

export const WAYFIND = {
  breathBars: 1,
  berthPulse: 0.35,
};

// The circuit's ceiling — how high the skywalk rides. The audio climbs with
// you: the drone root rises +7 semitones over this span, the mirror image of
// stepwell's descending well (research/01 §6, inverse locomotion's audio
// cousin).
export const CLIMB = {
  top: 3.8,
};
