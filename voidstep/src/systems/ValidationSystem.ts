import { createSystem } from '@iwsdk/core';
import { PLAY_AREA } from '../config';
import { logEvent } from '../state';
import { VoidSystem } from './VoidSystem';

// bounded-floor as validation, never adaptation (research/01 §4, /03 §8.4).
// The circuit is authored against a fixed 2 × 2 m minimum; what neither
// exemplar ships is the courtesy of *saying so* — read the real room once,
// and if it can't hold the grid, warn plainly before the set.
export class ValidationSystem extends createSystem({}) {
  private checked = false;

  update(): void {
    const session = this.world.session;
    if (!session || this.checked) return;
    this.checked = true;
    session
      .requestReferenceSpace('bounded-floor')
      .then((space) => {
        const bounds = (space as XRBoundedReferenceSpace).boundsGeometry;
        if (!bounds || bounds.length < 3) return;
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        for (const p of bounds) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
        }
        const w = maxX - minX;
        const d = maxZ - minZ;
        logEvent(`bounds:${w.toFixed(2)}x${d.toFixed(2)}`);
        if (w < PLAY_AREA.requiredWidth || d < PLAY_AREA.requiredDepth) {
          this.world.getSystem(VoidSystem)?.showPlayAreaWarning(w, d);
        }
      })
      .catch(() => {
        // No bounded-floor on this runtime: nothing to validate against.
      });
  }
}
