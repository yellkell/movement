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
import { COLOR, COUNTDOWN, GRID } from '../config';
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
  sqOffset,
} from '../score';
import { G } from '../state';
import { FLOOR_Y } from './VoidSystem';

const EDGE_OFF: Record<string, [number, number, number, number]> = {
  // cx, cz, sx, sz for a rim strip on each edge of a tile
  N: [0, -1, 1, 0],
  S: [0, 1, 1, 0],
  E: [1, 0, 0, 1],
  W: [-1, 0, 0, 1],
};
const FILL_ORDER = ['N', 'E', 'S', 'W'] as const;
const POST_CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

interface TileSlot {
  platform: number;
  c: number;
  r: number;
  ox: number;
  oz: number;
  deck: number;
  rims: Record<string, number>;
  posts: number[];
}

interface FenceSlot {
  platform: number;
  x: number;
  z: number;
  edge: string;
  rail: number;
  posts: [number, number];
}

// Owns everything the platforms are: quantized travel, decks, and stepwell's
// whole countdown grammar, kept intact — it survived headset testing there
// and it is the half of the telegraph language the ATTACKS don't cover:
//   1. corner posts, one extinguished per beat (vertical: read edge-on,
//      from below, and over the fences)
//   2. rims that wrap the deck edge instead of sitting on top of it
//   3. the deck face itself washing amber — the floor is the instruction
//      on the surface you actually look at (research/01 §3)
// The decks ride the void's black glass: their mirror shares the live
// instance buffers, dance's trick, so the route's reflection animates free.
export class PlatformSystem extends createSystem({}) {
  private decks!: Bank;
  private rims!: Bank;
  private posts!: Bank;
  private fences!: Bank;
  private tiles: TileSlot[] = [];
  private fenceSlots: FenceSlot[] = [];
  private fenceLists: ReturnType<typeof fencesOf>[] = [];
  private ghostGroup!: Group;
  private rigPattern!: Mesh;
  private lastBeat = -1;

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
    const postMat = new MeshBasicMaterial({});
    const fenceMat = new MeshBasicMaterial({});
    registerDim(deckMat, 'scenery');
    registerDim(rimMat, 'gameplay');
    registerDim(postMat, 'gameplay');
    registerDim(fenceMat, 'gameplay');

    let tileCount = 0;
    for (const p of PLATFORMS) tileCount += p.claim.length;

    this.decks = new Bank(box, deckMat, tileCount, true);
    this.rims = new Bank(box, rimMat, tileCount * 4, true);
    this.posts = new Bank(box, postMat, tileCount * 4, true);

    this.fenceLists = PLATFORMS.map((p) => fencesOf(p));
    let fenceCount = 0;
    for (const l of this.fenceLists) fenceCount += l.length;
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
          posts: [],
        };
        for (const e of FILL_ORDER) {
          slot.rims[e] = this.rims.add(0, 0, 0, 0.05, 0.09, 0.05, COLOR.rimSafe);
        }
        for (let k = 0; k < 4; k++) {
          slot.posts.push(
            this.posts.add(0, 0, 0, COUNTDOWN.postSize, COUNTDOWN.postIdle, COUNTDOWN.postSize, COLOR.rimSafe),
          );
        }
        this.tiles.push(slot);
      }
      for (const f of this.fenceLists[pi]) {
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

    this.scene.add(this.decks.mesh, this.rims.mesh, this.posts.mesh, this.fences.mesh);
    // The route rides the black glass: the mirror shares the live buffers,
    // so the reflection animates for free (research/02 §2, dance's trick).
    this.scene.add(
      mirrorOf(this.decks, FLOOR_Y),
      mirrorOf(this.rims, FLOOR_Y, 0.22),
    );

    this.buildGhosts();
  }

  // The ghost overlays (research/03 §3): every platform stamped with the
  // play-area pattern crop of its claim, at every stop of its travel,
  // deduplicated where machines share a berth. Toggle in play.
  private buildGhosts(): void {
    const tex = patternTexture();
    const positions: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    let vi = 0;
    const half = GRID.pitch / 2;
    const seen = new Set<string>();
    const stamp = (a: { x: number; y: number; z: number }, sq: readonly [number, number]) => {
      const key = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}:${sq[0]},${sq[1]}`;
      if (seen.has(key)) return;
      seen.add(key);
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
    };
    for (const spec of PLATFORMS) {
      for (const a of endpointsOf(spec)) {
        for (const sq of spec.claim) stamp(a, sq);
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

  update(): void {
    const bar = G.transport.bars;
    const beatPulse = 0.75 + 0.25 * Math.cos(G.transport.barPhase * Math.PI * 8);

    for (let i = 0; i < PLATFORMS.length; i++) {
      const st = G.platforms[i];
      anchorAt(PLATFORMS[i], bar, st.anchor);
      const d = dwellInfo(PLATFORMS[i], bar);
      st.moving = d.moving;
      st.departIn = d.departIn;
    }

    // The countdown is audible too: ticks on each beat of the final dwell
    // bar, for the ground you own or the ground you're being invited onto.
    const beatNow = Math.floor(bar * 4);
    if (beatNow !== this.lastBeat) {
      this.lastBeat = beatNow;
      for (const idx of [G.tracked, G.wayfind.targetIndex]) {
        if (idx < 0) continue;
        const st = G.platforms[idx];
        if (st.departIn <= 1) {
          conductor.tick(Math.ceil(st.departIn * 4));
          break;
        }
      }
    }

    for (const t of this.tiles) {
      const st = G.platforms[t.platform];
      const x = st.anchor.x + t.ox;
      const y = st.anchor.y;
      const z = st.anchor.z + t.oz;
      this.decks.set(t.deck, x, y - 0.05, z, GRID.tile, 0.1, GRID.tile);

      const warn = st.departIn <= 1;
      const fill = warn ? 1 - st.departIn : 0;

      // Deck wash — the countdown on the face you actually look at, and the
      // attacks' floor paint: a doomed tile burns with its telegraph.
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
      } else if (warn) {
        this.decks.color(t.deck, COLOR.rimWarn, (0.1 + 0.5 * fill) * (0.7 + 0.45 * beatPulse));
      } else if (st.moving) {
        this.decks.color(t.deck, COLOR.rimDanger, 0.16);
      } else {
        this.decks.color(t.deck, COLOR.deckTop);
      }

      // Rims wrap the deck edge — visible from the side and from below.
      for (let e = 0; e < FILL_ORDER.length; e++) {
        const edge = FILL_ORDER[e];
        const [cx, cz, sx, sz] = EDGE_OFF[edge];
        const half = GRID.tile / 2 + 0.012;
        const idx = t.rims[edge];
        this.rims.set(
          idx,
          x + cx * half,
          y - 0.01,
          z + cz * half,
          sx === 1 ? GRID.tile + 0.05 : 0.045,
          0.09,
          sz === 1 ? GRID.tile + 0.05 : 0.045,
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

      // Corner posts — the beat countdown no angle can hide. One dies per
      // beat of the final bar; departure is four dead posts.
      const beatsLeft = warn ? Math.max(1, Math.ceil(st.departIn * 4)) : 0;
      for (let k = 0; k < 4; k++) {
        const [pcx, pcz] = POST_CORNERS[k];
        const inset = GRID.tile / 2 - 0.04;
        const h = warn ? COUNTDOWN.postWarn : st.moving ? 0.1 : COUNTDOWN.postIdle;
        this.posts.set(
          t.posts[k],
          x + pcx * inset,
          y + h / 2 + 0.03,
          z + pcz * inset,
          COUNTDOWN.postSize,
          h,
          COUNTDOWN.postSize,
        );
        if (warn) {
          const lit = k < beatsLeft;
          this.posts.color(
            t.posts[k],
            COLOR.rimWarn,
            lit ? 1.35 + 0.5 * beatPulse : 0.08,
          );
        } else if (st.moving) {
          this.posts.color(t.posts[k], COLOR.rimDanger, 0.5);
        } else if (st.aligned) {
          this.posts.color(t.posts[k], COLOR.rimSafe, 0.5 + 0.3 * beatPulse);
        } else {
          this.posts.color(t.posts[k], COLOR.rimSafe, 0.12);
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
  }
}
