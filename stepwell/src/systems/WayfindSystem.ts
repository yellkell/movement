import {
  AdditiveBlending,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { COLOR, GRID, WAYFIND } from '../config';
import { Bank, shadedBoxGeometry } from '../lib/banks';
import { registerDim } from '../lib/dimmer';
import { glowTexture } from '../lib/textures';
import {
  endpointsOf,
  INDEX,
  PLATFORMS,
  ROUTE_DOWN,
  ROUTE_UP,
  sqOffset,
} from '../score';
import { G } from '../state';

interface BerthSlot {
  platform: number;
  stop: { x: number; y: number; z: number };
  nubs: { idx: number; x: number; y: number; z: number }[];
}

// Wayfinding: the headset feedback was that where to stand wasn't obvious
// until it was. Two answers, both on the floor where the game already talks:
//   - the INVITATION: a breathing circle of light on the next tile of the
//     route, whenever that ground is present and steppable
//   - the BERTH: dim corner brackets marking where the next machine will
//     dock while it is still away — you aim your body at ground that is
//     coming, not gone
// The route runs down until the ember is held, then up. Neither marker
// gates anything; like the fences they are suggestions (research/03 §2.4).
export class WayfindSystem extends createSystem({}) {
  private invitation!: Mesh;
  private invitationMat!: MeshBasicMaterial;
  private berths!: Bank;
  private berthSlots: BerthSlot[] = [];

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
      ({ p }) => p.keys.length > 1 || p.mill,
    );
    let cap = 0;
    for (const { p } of moving) cap += endpointsOf(p).length * p.claim.length * 4;
    cap += 8; // the mill's far stop
    const mat = new MeshBasicMaterial({});
    registerDim(mat, 'gameplay');
    this.berths = new Bank(shadedBoxGeometry(), mat, cap, true);
    for (const { p, i } of moving) {
      const stops = endpointsOf(p);
      if (p.mill) {
        stops.push({
          x: p.keys[0].a.x + p.mill.travel.x,
          y: p.keys[0].a.y + p.mill.travel.y,
          z: p.keys[0].a.z + p.mill.travel.z,
        });
      }
      for (const stop of stops) {
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
    const route = G.ember.held ? ROUTE_UP : ROUTE_DOWN;
    const trackedId = PLATFORMS[G.tracked].id;
    let at = -1;
    for (let i = 0; i < route.length; i++) {
      if (route[i].includes(trackedId)) {
        at = i;
        break;
      }
    }
    let target = -1;
    if (at >= 0 && at + 1 < route.length) {
      const nextIds = route[at + 1];
      // Prefer an aligned candidate (a car at the door beats one in transit).
      for (const id of nextIds) {
        if (G.platforms[INDEX[id]].aligned) {
          target = INDEX[id];
          break;
        }
      }
      if (target === -1) target = INDEX[nextIds[0]];
    }
    G.wayfind.targetIndex = target;
    G.wayfind.targetAligned = target >= 0 && G.platforms[target].aligned;

    // The invitation: on the target's nearest steppable tile when its ground
    // is here; at boot, on the threshold's own centre — "begin here".
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
          const px = st.anchor.x + st.claimShift.x + o.x;
          const pz = st.anchor.z + st.claimShift.z + o.z;
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
