import {
  AdditiveBlending,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { COLOR, GRID, WAYFIND } from '../config';
import { conductor } from '../conductor';
import { Bank, shadedBoxGeometry } from '../lib/banks';
import { registerDim } from '../lib/dimmer';
import { glowTexture } from '../lib/textures';
import {
  endpointsOf,
  HOME_INDEX,
  INDEX,
  PLATFORMS,
  ROUTE,
  sqOffset,
} from '../score';
import { G, logEvent } from '../state';

interface BerthSlot {
  platform: number;
  stop: { x: number; y: number; z: number };
  nubs: { idx: number; x: number; y: number; z: number }[];
}

// Wayfinding, stepwell's v2 answer kept whole (headset feedback: where to
// stand wasn't obvious until it was):
//   - the INVITATION: a breathing circle of light on the next tile of the
//     route, whenever that ground is present and steppable
//   - the BERTH: dim corner brackets marking where the next machine will
//     dock while it is still away — you aim your body at ground that is
//     coming, not gone
// The route is one ring here — the circuit — so this system also keeps the
// lap ledger: stepping home off the west runner closes a lap and rings it.
export class WayfindSystem extends createSystem({}) {
  private invitation!: Mesh;
  private invitationMat!: MeshBasicMaterial;
  private berths!: Bank;
  private berthSlots: BerthSlot[] = [];
  private lastTracked = 0;

  init(): void {
    const tex = glowTexture();
    this.invitationMat = new MeshBasicMaterial({
      map: tex,
      color: COLOR.rimSafe,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.invitation = new Mesh(
      new PlaneGeometry(GRID.tile * 0.95, GRID.tile * 0.95),
      this.invitationMat,
    );
    this.invitation.rotation.x = -Math.PI / 2;
    this.invitation.visible = false;
    registerDim(this.invitationMat, 'gameplay');
    this.scene.add(this.invitation);

    // Every stop of every moving platform gets a set of corner nubs; per
    // frame only the route-relevant berth is shown.
    const moving = PLATFORMS.map((p, i) => ({ p, i })).filter(
      ({ p }) => p.keys.length > 1,
    );
    let cap = 0;
    for (const { p } of moving) cap += endpointsOf(p).length * p.claim.length * 4;
    const mat = new MeshBasicMaterial({});
    registerDim(mat, 'gameplay');
    this.berths = new Bank(shadedBoxGeometry(), mat, cap, true);
    for (const { p, i } of moving) {
      for (const stop of endpointsOf(p)) {
        const nubs: BerthSlot['nubs'] = [];
        for (const sq of p.claim) {
          const o = sqOffset(sq);
          for (const [cx, cz] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            const inset = GRID.tile / 2 - 0.02;
            const x = stop.x + o.x + cx * inset;
            const y = stop.y + 0.05;
            const z = stop.z + o.z + cz * inset;
            nubs.push({ idx: this.berths.add(x, y, z, 0.04, 0.1, 0.04, COLOR.rimSafe), x, y, z });
          }
        }
        this.berthSlots.push({ platform: i, stop, nubs });
      }
    }
    this.scene.add(this.berths.mesh);
  }

  update(): void {
    // The lap ledger: arriving home off the west runner closes the circuit.
    if (G.tracked !== this.lastTracked) {
      if (
        G.tracked === HOME_INDEX &&
        this.lastTracked === INDEX['runner-home']
      ) {
        G.laps++;
        conductor.bell(G.laps);
        logEvent('circuit');
      }
      this.lastTracked = G.tracked;
    }

    const trackedId = PLATFORMS[G.tracked].id;
    let at = -1;
    for (let i = 0; i < ROUTE.length - 1; i++) {
      if (ROUTE[i] === trackedId) {
        at = i;
        break;
      }
    }
    const target = at >= 0 ? INDEX[ROUTE[at + 1]] : -1;
    G.wayfind.targetIndex = target;
    G.wayfind.targetAligned = target >= 0 && G.platforms[target].aligned;

    // The invitation: on the target's nearest steppable tile when its ground
    // is here; at boot, on the home pad's own centre — "begin here".
    let invTile: { x: number; y: number; z: number } | undefined;
    if (G.handovers === 0 && G.laps === 0) {
      invTile = { x: G.rig.x, y: G.rig.y, z: G.rig.z };
    } else if (target >= 0) {
      const st = G.platforms[target];
      if (st.aligned && !st.moving) {
        const spec = PLATFORMS[target];
        let best: { x: number; y: number; z: number } | undefined;
        let bestD = Infinity;
        for (const sq of spec.claim) {
          const o = sqOffset(sq);
          const px = st.anchor.x + o.x;
          const pz = st.anchor.z + o.z;
          const d = Math.hypot(px - (G.rig.x + G.body.x), pz - (G.rig.z + G.body.z));
          if (d < bestD) {
            bestD = d;
            best = { x: px, y: st.anchor.y, z: pz };
          }
        }
        invTile = best;
      }
    }
    if (invTile) {
      const urgent = target >= 0 && G.platforms[target].departIn <= 1;
      const breath =
        0.86 +
        0.14 *
          Math.sin(
            (G.transport.bars / WAYFIND.breathBars) * Math.PI * 2 * (urgent ? 4 : 1),
          );
      this.invitation.visible = true;
      this.invitation.position.set(invTile.x, invTile.y + 0.025, invTile.z);
      this.invitation.scale.setScalar(breath);
      this.invitationMat.color.setHex(urgent ? COLOR.rimWarn : COLOR.rimSafe);
    } else {
      this.invitation.visible = false;
    }

    // The berth: brackets only where the route's next machine will dock,
    // and only while it is away from that dock.
    for (const slot of this.berthSlots) {
      const st = G.platforms[slot.platform];
      const relevant =
        slot.platform === target &&
        !st.aligned &&
        Math.hypot(slot.stop.x - G.rig.x, slot.stop.z - G.rig.z) +
          Math.abs(slot.stop.y - G.rig.y) <
          1.2;
      const pulse =
        WAYFIND.berthPulse *
        (0.7 + 0.3 * Math.sin(G.transport.bars * Math.PI * 2));
      for (const n of slot.nubs) {
        if (relevant) {
          this.berths.set(n.idx, n.x, n.y, n.z, 0.04, 0.1, 0.04);
          this.berths.color(n.idx, COLOR.rimSafe, pulse);
        } else {
          this.berths.set(n.idx, n.x, -999, n.z, 0.0001, 0.0001, 0.0001);
        }
      }
    }
  }
}
