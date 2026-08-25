import { createSystem, VisibilityState } from '@iwsdk/core';
import { CLIMB, MUSIC } from '../config';
import { conductor } from '../conductor';
import { G } from '../state';

// Advances the one clock everything obeys. Pauses when the runtime blurs the
// session (system menu open) so the set never plays to a covered headset.
export class ConductorSystem extends createSystem({}) {
  update(dt: number): void {
    const blurred =
      this.visibilityState.value === VisibilityState.VisibleBlurred;
    conductor.playing = G.transport.playing && !blurred;
    conductor.advance(Math.min(dt, 0.1));
    G.transport.bars = conductor.bars;
    G.transport.barPhase = conductor.barPhase;
    G.transport.beat = Math.floor(conductor.barPhase * MUSIC.beatsPerBar);
    conductor.setClimb(G.rig.y / CLIMB.top);
    conductor.setArpLevel(Math.min(1, G.flow / 6));
  }
}
