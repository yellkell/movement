import { createSystem } from '@iwsdk/core';
import { GRID, RIG } from '../config';
import { conductor } from '../conductor';
import { anchorAt, PLATFORMS, sqOffset, v3 } from '../score';
import { G, logEvent } from '../state';

// The frame of reference — Eye of the Temple's mechanism as stepwell built
// it (research/03 §2), SIMPLIFIED: the whole law is now one clause.
//
//   rig = anchor(tracked)
//
// One platform is tracked at a time; while tracked it is static relative to
// the physical play area, and the slice of virtual space the play area maps
// to follows it. Handover is gated and CLEAN ONLY: tracking switches to a
// platform exactly when its anchor agrees with the live rig, so the switch
// instant never moves the world at all.
//
// What was deliberately removed — the sliding parts: stepwell's forced
// switch, where ground already leaving takes the frame with it and a
// correction term drains over ~1 s, sliding the platform back into place
// under your feet. The score authors every legal step onto aligned ground,
// so the only way to be on departing un-tracked ground is to have missed
// the step — and a miss should read as a miss, not as the world moving.
// Standing there is a SLIP: the ground pulls away, the frame holds, the
// flow dies. The rig has exactly one source of truth and no history.
export class FrameOfReferenceSystem extends createSystem({}) {
  private candidate = -1;
  private candidateFrames = 0;
  private slipped = -1; // platform already charged for this departure
  private look = v3(0, 0, 0);

  update(): void {
    const rig = G.rig;
    const tracked = G.platforms[G.tracked];
    rig.x = tracked.anchor.x;
    rig.y = tracked.anchor.y;
    rig.z = tracked.anchor.z;
    this.player.position.set(rig.x, rig.y, rig.z);

    // Alignment against the live rig, for every platform: may it take tracking?
    for (const st of G.platforms) {
      st.aligned =
        Math.hypot(st.anchor.x - rig.x, st.anchor.z - rig.z) < RIG.alignEps &&
        Math.abs(st.anchor.y - rig.y) < RIG.alignEpsY;
    }

    // Whose tile owns the head? Tiles live where platforms actually are —
    // (anchor − rig) + claimed-square offset in play-area coordinates.
    const hx = G.body.x;
    const hz = G.body.z;
    let owner = -1;
    let ownerDist = Infinity;
    for (let i = 0; i < PLATFORMS.length; i++) {
      const st = G.platforms[i];
      if (Math.abs(st.anchor.y - rig.y) > 1.2) continue; // a storey away is not ground
      const half =
        GRID.tile / 2 + (i === G.tracked ? RIG.trackedOutset : -RIG.tileInset);
      const ox = st.anchor.x - rig.x;
      const oz = st.anchor.z - rig.z;
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

    if (owner !== this.slipped) this.slipped = -1;

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
    // bar ahead. Either way THE FRAME HOLDS — incoming ground is gated
    // exactly as before (research/03 §2.3), and leaving ground no longer
    // drags the world: it slides out from under you, and that is the slip.
    const now =
      Math.hypot(cand.anchor.x - rig.x, cand.anchor.z - rig.z) +
      Math.abs(cand.anchor.y - rig.y);
    anchorAt(PLATFORMS[owner], G.transport.bars + 0.25, this.look);
    const soon =
      Math.hypot(this.look.x - rig.x, this.look.z - rig.z) +
      Math.abs(this.look.y - rig.y);
    if (soon < now) return; // incoming: gated, no switch yet

    if (this.slipped !== owner) {
      this.slipped = owner;
      G.slips++;
      G.flow = 0;
      conductor.thud();
      logEvent(`slip:${PLATFORMS[owner].id}`);
    }
  }
}
