import { createSystem } from '@iwsdk/core';
import { ATTACK, GRID } from '../config';
import { conductor } from '../conductor';
import {
  gateTelegraph,
  halfTelegraph,
  stripTelegraph,
  sweepTelegraph,
  type Telegraph,
} from '../lib/telegraphs';
import {
  ATTACKS,
  claimExtent,
  INDEX,
  loopBar,
  PLATFORMS,
  type AttackSpec,
} from '../score';
import { G, logEvent } from '../state';

// The stolen moves, worked: dance's choreography machine, reduced to what a
// parkour circuit needs. Every attack is authored in the score against its
// host platform's own loop clock, so the volley is as deterministic as the
// ferries — the probe can walk it, and a spectator on the home pad watches
// the same show every lap.
//
// The rules ride along from dance unchanged:
//  - the telegraph is the whole instruction: whatever fills amber→red,
//    don't be in it; where the doorposts point, be there
//  - windups are sacred — the charge is dance's own beat count per move
//  - landings hit bar downbeats
//  - floor paint means "move your feet", so the sweep — whose answer is
//    stay put and DROP — paints only the air
//  - only a RIDDEN deck judges: watching a volley from a still floor asks
//    nothing of the body (stepwell's gate law, kept)
// And one law of stepwell's holds over everything: the ground itself never
// cheats. Attacks mark the deck; the deck's own travel is telegraphed by
// the countdown grammar, separately, always.
interface Runtime {
  spec: AttackSpec;
  host: number;
  chargeStart: number; // loop-local bar the telegraph opens
  centre: { x: number; z: number }; // deck centre, play-area coords
  telegraph: Telegraph;
  cycle: number;
  doomTiles: { c: number; r: number }[]; // floor paint (empty for sweep)
}

export class AttackSystem extends createSystem({}) {
  private runtimes: Runtime[] = [];
  private clock = 0;

  init(): void {
    G.attacks = ATTACKS.map(() => ({
      phase: 'idle' as const,
      fill: 0,
      hit: false,
      flashLeft: 0,
    }));

    for (const spec of ATTACKS) {
      const host = INDEX[spec.platform];
      const hostSpec = PLATFORMS[host];
      const ext = claimExtent(hostSpec);
      const centre = {
        x: (ext.x[0] + ext.x[1]) / 2,
        z: (ext.z[0] + ext.z[1]) / 2,
      };
      const spanX = ext.x[1] - ext.x[0] + GRID.tile;
      const spanZ = ext.z[1] - ext.z[0] + GRID.tile;
      const chargeStart = spec.landBar - ATTACK.chargeBeats[spec.kind] / 4;

      let telegraph: Telegraph;
      const doomTiles: { c: number; r: number }[] = [];
      const tiles = hostSpec.claim;
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
      switch (spec.kind) {
        case 'beam': {
          telegraph = stripTelegraph('x', spec.at! - centre.x, ATTACK.laneHalf * 2 + 0.04, spanZ + 0.3);
          for (const t of tiles) if (near(t[0] * GRID.pitch, spec.at!)) doomTiles.push({ c: t[0], r: t[1] });
          break;
        }
        case 'rail': {
          telegraph = stripTelegraph('z', spec.at! - centre.z, ATTACK.laneHalf * 2 + 0.04, spanX + 0.3);
          for (const t of tiles) if (near(t[1] * GRID.pitch, spec.at!)) doomTiles.push({ c: t[0], r: t[1] });
          break;
        }
        case 'seesaw': {
          telegraph = halfTelegraph('x', spec.side!, spanX, spanZ);
          for (const t of tiles)
            if ((t[0] * GRID.pitch - centre.x) * spec.side! > 0) doomTiles.push({ c: t[0], r: t[1] });
          break;
        }
        case 'surge': {
          telegraph = halfTelegraph('z', spec.side!, spanZ, spanX);
          for (const t of tiles)
            if ((t[1] * GRID.pitch - centre.z) * spec.side! > 0) doomTiles.push({ c: t[0], r: t[1] });
          break;
        }
        case 'gate': {
          telegraph = gateTelegraph(spanX / 2, spanZ / 2, spec.at! - centre.x, ATTACK.gapHalf);
          for (const t of tiles) if (!near(t[0] * GRID.pitch, spec.at!)) doomTiles.push({ c: t[0], r: t[1] });
          break;
        }
        case 'sweep': {
          // Danger in the air; the floor stays unpainted (dance's law).
          telegraph = sweepTelegraph(spanX + 0.25, spanZ + 0.25, ATTACK.sweepPaneHeight, 0.045, 1);
          break;
        }
      }
      telegraph.group.visible = false;
      this.scene.add(telegraph.group);
      this.runtimes.push({ spec, host, chargeStart, centre, telegraph, cycle: -1, doomTiles });
    }
  }

  private judge(rt: Runtime): boolean {
    const { spec, centre } = rt;
    const b = G.body;
    switch (spec.kind) {
      case 'beam':
        return Math.abs(b.x - spec.at!) < ATTACK.laneHalf;
      case 'rail':
        return Math.abs(b.z - spec.at!) < ATTACK.laneHalf;
      case 'seesaw':
        return (b.x - centre.x) * spec.side! > -ATTACK.halfEps;
      case 'surge':
        return (b.z - centre.z) * spec.side! > -ATTACK.halfEps;
      case 'gate':
        return Math.abs(b.x - spec.at!) > ATTACK.gapHalf;
      case 'sweep':
        return !b.ducked;
    }
  }

  update(dt: number): void {
    this.clock += dt;
    G.doom.length = 0;
    let live = false;

    for (let i = 0; i < this.runtimes.length; i++) {
      const rt = this.runtimes[i];
      const s = G.attacks[i];
      const hostSpec = PLATFORMS[rt.host];
      const host = G.platforms[rt.host];
      const t = loopBar(hostSpec, G.transport.bars);
      const cycle = Math.floor((G.transport.bars - hostSpec.keys[0].bar) / hostSpec.loopBars!);
      if (cycle !== rt.cycle) {
        rt.cycle = cycle;
        s.phase = 'idle';
        s.fill = 0;
        s.hit = false;
        s.flashLeft = 0;
      }
      const riding = G.tracked === rt.host;

      if (s.phase === 'idle' && t >= rt.chargeStart && t < rt.spec.landBar) {
        s.phase = 'charge';
      }
      if (s.phase === 'charge') {
        s.fill = Math.min(
          1,
          (t - rt.chargeStart) / (rt.spec.landBar - rt.chargeStart),
        );
        if (t >= rt.spec.landBar) {
          // THE LANDING — judged once, at the drop, only for a rider.
          if (riding) {
            if (this.judge(rt)) {
              s.hit = true;
              G.hits++;
              G.flow = 0;
              conductor.thud();
              logEvent(`clip:${rt.spec.kind}`);
            } else {
              G.clears++;
              G.flow++;
              conductor.strike();
              conductor.chime(G.flow);
              logEvent(`dodge:${rt.spec.kind}`);
            }
          }
          s.phase = 'flash';
          s.fill = 1;
          s.flashLeft = ATTACK.flashSec;
        }
      }
      if (s.phase === 'flash') {
        s.flashLeft -= dt;
        if (s.flashLeft <= 0) s.phase = 'done';
      }

      const showing = s.phase === 'charge' || s.phase === 'flash';
      rt.telegraph.group.visible = showing;
      if (showing) {
        rt.telegraph.group.position.set(
          host.anchor.x + rt.centre.x,
          host.anchor.y + 0.015,
          host.anchor.z + rt.centre.z,
        );
        rt.telegraph.update(s.fill, this.clock);
        // The floor is the instruction: doomed tiles burn with the charge.
        for (const tile of rt.doomTiles) {
          G.doom.push({
            platform: rt.host,
            c: tile.c,
            r: tile.r,
            level: s.fill,
            red: s.phase === 'flash',
          });
        }
        if (riding) live = true;
      }
    }

    G.hazardLive = live;
  }
}
