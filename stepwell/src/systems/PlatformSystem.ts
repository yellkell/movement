import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  createSystem,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { COLOR, GRID, WELL } from '../config';
import { conductor } from '../conductor';
import { Bank, mirrorOf, shadedBoxGeometry } from '../lib/banks';
import { registerDim } from '../lib/dimmer';
import { patternTexture } from '../lib/textures';
import {
  anchorAt,
  dwellInfo,
  endpointsOf,
  fencesOf,
  PLATFORMS,
  RAFT_INDEX,
  sqOffset,
  THRESHOLD_INDEX,
  v3,
} from '../score';
import { G, logEvent } from '../state';

const EDGE_OFF: Record<string, [number, number, number, number]> = {
  // cx, cz, sx, sz for a rim strip on each edge of a tile
  N: [0, -1, 1, 0],
  S: [0, 1, 1, 0],
  E: [1, 0, 0, 1],
  W: [-1, 0, 0, 1],
};
const FILL_ORDER = ['N', 'E', 'S', 'W'] as const;

interface TileSlot {
  platform: number;
  c: number;
  r: number;
  ox: number;
  oz: number;
  deck: number;
  rims: Record<string, number>;
}

interface FenceSlot {
  platform: number;
  x: number;
  z: number;
  edge: string;
  rail: number;
  posts: [number, number];
}

// Owns everything the platforms are: quantized travel (already authored in
// the score), decks, rim telegraphs in the amber→red fill language — the
// floor itself as a move (research/01 §5) — fences, ghost overlays, and the
// throat that loops the well.
export class PlatformSystem extends createSystem({}) {
  private decks!: Bank;
  private fences!: Bank;
  private tiles: TileSlot[] = [];
  private fenceSlots: FenceSlot[] = [];
  private ghostGroup!: Group;
  private rigPattern!: Mesh;
  private tmp = v3(0, 0, 0);

  init(): void {
    G.platforms = PLATFORMS.map(() => ({
      anchor: { x: 0, y: 0, z: 0 },
      moving: false,
      departIn: Infinity,
      aligned: false,
    }));

    const box = shadedBoxGeometry();
    const deckMat = new MeshBasicMaterial({ vertexColors: true });
    const rimMat = new MeshBasicMaterial({});
    const fenceMat = new MeshBasicMaterial({});
    registerDim(deckMat, 'scenery');
    registerDim(rimMat, 'gameplay');
    registerDim(fenceMat, 'gameplay');

    let tileCount = 0;
    for (const p of PLATFORMS) tileCount += p.claim.length;

    this.decks = new Bank(box, deckMat, tileCount, true);
    const rims = new Bank(box, rimMat, tileCount * 4, true);
    this.rims = rims;

    let fenceCount = 0;
    const fenceLists = PLATFORMS.map((p) => fencesOf(p));
    for (const l of fenceLists) fenceCount += l.length;
    this.fences = new Bank(box, fenceMat, fenceCount * 3, true);

    PLATFORMS.forEach((spec, pi) => {
      for (const sq of spec.claim) {
        const o = sqOffset(sq);
        const slot: TileSlot = {
          platform: pi,
          c: sq[0],
          r: sq[1],
          ox: o.x,
          oz: o.z,
          deck: this.decks.add(0, 0, 0, GRID.tile, 0.1, GRID.tile, 0xffffff),
          rims: {},
        };
        for (const e of FILL_ORDER) {
          slot.rims[e] = rims.add(0, 0, 0, 0.05, 0.035, 0.05, COLOR.rimSafe);
        }
        this.tiles.push(slot);
      }
      for (const f of fenceLists[pi]) {
        this.fenceSlots.push({
          platform: pi,
          x: f.x,
          z: f.z,
          edge: f.edge,
          rail: this.fences.add(0, 0, 0, 1, 1, 1, COLOR.fence),
          posts: [
            this.fences.add(0, 0, 0, 1, 1, 1, COLOR.fence),
            this.fences.add(0, 0, 0, 1, 1, 1, COLOR.fence),
          ],
        });
      }
    });

    this.scene.add(this.decks.mesh, rims.mesh, this.fences.mesh);
    // The platforms ride the water too: the mirror shares their live buffers,
    // so the reflection animates for free (research/02 §2).
    this.scene.add(
      mirrorOf(this.decks, WELL.waterY),
      mirrorOf(rims, WELL.waterY, 0.22),
    );

    this.buildGhosts();
  }

  private rims!: Bank;

  // The ghost overlays (research/03 §3): every platform stamped with the
  // play-area pattern crop of its claim, at BOTH ends of its travel. If
  // neighbouring patterns tile like puzzle pieces, the level works. Toggle in
  // play — the authoring view is part of the experience.
  private buildGhosts(): void {
    const tex = patternTexture();
    const positions: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    let vi = 0;
    const half = GRID.pitch / 2;
    for (const spec of PLATFORMS) {
      for (const a of endpointsOf(spec)) {
        for (const sq of spec.claim) {
          const o = sqOffset(sq);
          const cx = a.x + o.x;
          const cz = a.z + o.z;
          const y = a.y + 0.012;
          const u0 = (sq[0] + 1) / 3;
          const v0 = 1 - (sq[1] + 2) / 3;
          positions.push(
            cx - half, y, cz - half,
            cx + half, y, cz - half,
            cx + half, y, cz + half,
            cx - half, y, cz + half,
          );
          uvs.push(u0, v0 + 1 / 3, u0 + 1 / 3, v0 + 1 / 3, u0 + 1 / 3, v0, u0, v0);
          index.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
          vi += 4;
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(index);
    const mat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: DoubleSide,
    });
    const endpointMesh = new Mesh(geo, mat);

    // The live rig's own pattern — the full play area drawn under your feet.
    const rp = GRID.pitch * 3;
    const rigGeo = new BufferGeometry();
    rigGeo.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([
          -rp / 2, 0, -rp / 2, rp / 2, 0, -rp / 2, rp / 2, 0, rp / 2, -rp / 2, 0, rp / 2,
        ]),
        3,
      ),
    );
    rigGeo.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2),
    );
    rigGeo.setIndex([0, 2, 1, 0, 3, 2]);
    this.rigPattern = new Mesh(
      rigGeo,
      new MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.ghostGroup = new Group();
    this.ghostGroup.add(endpointMesh, this.rigPattern);
    this.ghostGroup.visible = false;
    this.scene.add(this.ghostGroup);
  }

  update(dt: number): void {
    const bar = G.transport.bars;
    const beatPulse = 0.75 + 0.25 * Math.cos(G.transport.barPhase * Math.PI * 8);

    for (let i = 0; i < PLATFORMS.length; i++) {
      const st = G.platforms[i];
      anchorAt(PLATFORMS[i], bar, st.anchor);
      const d = dwellInfo(PLATFORMS[i], bar);
      st.moving = d.moving;
      st.departIn = d.departIn;
    }

    // Decks and rims follow their platforms; rim colour is the ground's own
    // telegraph: cyan = steppable now, amber fill = departure countdown,
    // red = riding. Never step on red.
    for (const t of this.tiles) {
      const st = G.platforms[t.platform];
      const x = st.anchor.x + t.ox;
      const y = st.anchor.y;
      const z = st.anchor.z + t.oz;
      this.decks.set(t.deck, x, y - 0.05, z, GRID.tile, 0.1, GRID.tile);

      // The floor is the instruction (research/01 §3): a beam's doomed lane
      // burns amber on the deck itself, red for the moment of passage.
      let doomed: (typeof G.doom)[number] | undefined;
      for (const dm of G.doom) {
        if (dm.platform === t.platform && dm.c === t.c && dm.r === t.r) {
          doomed = dm;
          break;
        }
      }
      if (doomed) {
        this.decks.color(
          t.deck,
          doomed.red ? COLOR.rimDanger : COLOR.rimWarn,
          doomed.red ? 0.9 : 0.25 + 0.65 * doomed.level,
        );
      } else {
        this.decks.color(t.deck, COLOR.deckTop);
      }

      const warn = st.departIn <= 1;
      const fill = warn ? 1 - st.departIn : 0;
      for (let e = 0; e < FILL_ORDER.length; e++) {
        const edge = FILL_ORDER[e];
        const [cx, cz, sx, sz] = EDGE_OFF[edge];
        const half = GRID.tile / 2 - 0.025;
        const idx = t.rims[edge];
        this.rims.set(
          idx,
          x + cx * half,
          y + 0.018,
          z + cz * half,
          sx === 1 ? GRID.tile : 0.05,
          0.035,
          sz === 1 ? GRID.tile : 0.05,
        );
        if (st.moving) {
          this.rims.color(idx, COLOR.rimDanger, 0.9 + 0.5 * beatPulse);
        } else if (warn) {
          const lit = (e + 1) / 4 <= fill + 0.001;
          this.rims.color(
            idx,
            lit ? COLOR.rimWarn : COLOR.rimSafe,
            lit ? 1.2 + beatPulse * 0.4 : 0.35,
          );
        } else if (st.aligned) {
          this.rims.color(idx, COLOR.rimSafe, 0.55 + 0.45 * beatPulse);
        } else {
          this.rims.color(idx, COLOR.rimSafe, 0.16);
        }
      }
    }

    for (const f of this.fenceSlots) {
      const st = G.platforms[f.platform];
      const [cx, cz, sx, sz] = EDGE_OFF[f.edge];
      const half = GRID.tile / 2;
      const x = st.anchor.x + f.x + cx * half;
      const y = st.anchor.y;
      const z = st.anchor.z + f.z + cz * half;
      this.fences.set(
        f.rail,
        x,
        y + 0.15,
        z,
        sx === 1 ? GRID.tile * 0.94 : 0.02,
        0.02,
        sz === 1 ? GRID.tile * 0.94 : 0.02,
      );
      const px = sx === 1 ? GRID.tile * 0.44 : 0;
      const pz = sz === 1 ? GRID.tile * 0.44 : 0;
      this.fences.set(f.posts[0], x - px, y + 0.08, z - pz, 0.026, 0.15, 0.026);
      this.fences.set(f.posts[1], x + px, y + 0.08, z + pz, 0.026, 0.15, 0.026);
    }

    this.ghostGroup.visible = G.ghosts;
    if (G.ghosts) {
      this.rigPattern.position.set(G.rig.x, G.rig.y + 0.016, G.rig.z);
    }

    this.updateThroat(dt, bar);
  }

  // The throat: the loop's seam, hidden in darkness — the one lesson taken
  // from folded space (research/01 §2): a seam is cheap where there is no
  // vista. Stand the raft down to the water, hold, and the well begins again.
  private updateThroat(dt: number, bar: number): void {
    const raft = G.platforms[RAFT_INDEX];
    const onRaft = G.tracked === RAFT_INDEX;
    const atWater =
      !raft.moving && Math.abs(raft.anchor.y - WELL.waterY) < 0.02;
    if (onRaft && atWater) {
      if (!G.throat.armed) {
        G.throat.armed = true;
        G.throat.sinceBar = bar;
      } else if (bar - G.throat.sinceBar > 2) {
        G.fade = Math.min(1, G.fade + dt / 1.1);
        if (G.fade >= 1) this.rebirth();
      }
    } else {
      G.throat.armed = false;
      G.fade = Math.max(0, G.fade - dt / 1.4);
    }
  }

  private rebirth(): void {
    G.laps++;
    G.throat.armed = false;
    conductor.reset();
    G.tracked = THRESHOLD_INDEX;
    G.correction.x = G.correction.y = G.correction.z = 0;
    G.correction.active = false;
    anchorAt(PLATFORMS[THRESHOLD_INDEX], 0, this.tmp);
    G.rig.x = this.tmp.x;
    G.rig.y = this.tmp.y;
    G.rig.z = this.tmp.z;
    logEvent('rebirth');
  }
}
