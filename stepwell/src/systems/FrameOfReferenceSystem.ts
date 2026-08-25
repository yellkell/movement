import { createSystem } from '@iwsdk/core';
import { GRID, RIG } from '../config';
import { anchorAt, PLATFORMS, sqOffset, v3 } from '../score';
import { G, logEvent } from '../state';

// The frame of reference — Eye of the Temple's mechanism, faithfully
// (research/03 §2). One platform is tracked at a time; while tracked it is
// static relative to the physical play area, and the slice of virtual space
// the play area maps to follows it. A platform's ANCHOR is the rig pose that
// pins it to its claimed squares, so:
//
//   rig = anchor(tracked) + correction
//
// Handover is gated, not immediate: tracking never switches to an incoming
// platform until it is properly aligned (research/03 §2.3). Stepping onto
// ground that is already leaving forces the switch, and the platform slides
// back into alignment under your feet — the correction drains to zero with no
// jump at the instant of switch. Yaw never changes: Johansen's primary
// articles never describe rotational redirection, so we resolve that open
// question (research/03 §10) the conservative way — orientation is purely a
// consequence of authored geometry.
export class FrameOfReferenceSystem extends createSystem({}) {
  private candidate = -1;
  private candidateFrames = 0;
  private look = v3(0, 0, 0);

  update(dt: number): void {
    const rig = G.rig;
    const corr = G.correction;

    // Drain the slide correction — "larger corrections resolve in a couple
    // of seconds at most" (research/03 §2.3).
    if (corr.active) {
      const k = Math.exp((-dt * Math.LN2) / RIG.correctionHalfLife);
      corr.x *= k;
      corr.y *= k;
      corr.z *= k;
      if (
        Math.hypot(corr.x, corr.y, corr.z) < RIG.correctionDone
      ) {
        corr.x = corr.y = corr.z = 0;
        corr.active = false;
        logEvent('correction-done');
      }
    }

    const tracked = G.platforms[G.tracked];
    rig.x = tracked.anchor.x + corr.x;
    rig.y = tracked.anchor.y + corr.y;
    rig.z = tracked.anchor.z + corr.z;
    this.player.position.set(rig.x, rig.y, rig.z);

    // Alignment against the live rig, for every platform: may it take tracking?
    for (const st of G.platforms) {
      st.aligned =
        Math.hypot(st.anchor.x - rig.x, st.anchor.z - rig.z) < RIG.alignEps &&
        Math.abs(st.anchor.y - rig.y) < RIG.alignEpsY;
    }

    // Whose tile owns the head? Tiles live where platforms actually are —
    // (anchor − rig) + claimed-square offset in play-area coordinates — so an
    // unaligned platform's tile is wherever it has slid to, not its claim.
    const hx = G.body.x;
    const hz = G.body.z;
    let owner = -1;
    let ownerDist = Infinity;
    for (let i = 0; i < PLATFORMS.length; i++) {
      const st = G.platforms[i];
      if (Math.abs(st.anchor.y - rig.y) > 1.2) continue; // a storey away is not ground
      const half =
        GRID.tile / 2 + (i === G.tracked ? RIG.trackedOutset : -RIG.tileInset);
      const ox = st.anchor.x - rig.x + st.claimShift.x;
      const oz = st.anchor.z - rig.z + st.claimShift.z;
      for (const sq of PLATFORMS[i].claim) {
        const o = sqOffset(sq);
        const dx = hx - (ox + o.x);
        const dz = hz - (oz + o.z);
        if (Math.abs(dx) <= half && Math.abs(dz) <= half) {
          const d = dx * dx + dz * dz;
          if (i === G.tracked) {
            owner = i;
            ownerDist = -1; // the tracked platform always wins its skirt
          } else if (ownerDist >= 0 && d < ownerDist) {
            owner = i;
            ownerDist = d;
          }
        }
      }
    }

    if (owner === G.tracked || owner === -1) {
      // Standing your ground, or over a seam/void: the frame holds.
      this.candidate = -1;
      this.candidateFrames = 0;
      return;
    }

    // Debounce ownership so a toe on the border can't thrash tracking.
    if (owner === this.candidate) this.candidateFrames++;
    else {
      this.candidate = owner;
      this.candidateFrames = 1;
    }
    if (this.candidateFrames < 3) return;

    const cand = G.platforms[owner];
    if (cand.aligned) {
      // Clean handover: anchors agree, the rig does not move.
      logEvent(`switch:${PLATFORMS[G.tracked].id}->${PLATFORMS[owner].id}:clean`);
      G.tracked = owner;
      G.handovers++;
      this.candidate = -1;
      this.candidateFrames = 0;
      return;
    }

    // Unaligned ground under the feet. Incoming or leaving? Look a quarter
    // bar ahead: ground moving toward alignment is incoming, and the gate
    // holds — "keep the frame where it is until the platforms are correctly
    // aligned" (research/03 §2.3). Ground moving away has the player aboard
    // and must take the frame with it: forced switch, slide correction.
    const now = Math.hypot(cand.anchor.x - rig.x, cand.anchor.z - rig.z) +
      Math.abs(cand.anchor.y - rig.y);
    anchorAt(PLATFORMS[owner], G.transport.bars + 0.25, this.look, cand.phaseShift);
    const soon =
      Math.hypot(this.look.x - rig.x, this.look.z - rig.z) +
      Math.abs(this.look.y - rig.y);
    if (soon < now) return; // incoming: gated, no switch yet

    corr.x = rig.x - cand.anchor.x;
    corr.y = rig.y - cand.anchor.y;
    corr.z = rig.z - cand.anchor.z;
    corr.active = true;
    logEvent(`switch:${PLATFORMS[G.tracked].id}->${PLATFORMS[owner].id}:slide`);
    G.tracked = owner;
    G.handovers++;
    this.candidate = -1;
    this.candidateFrames = 0;
  }
}
