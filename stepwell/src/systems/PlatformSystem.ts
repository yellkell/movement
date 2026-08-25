import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  createSystem,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { COLOR, COUNTDOWN, GRID, MILL, WELL } from '../config';
import { conductor } from '../conductor';
import { Bank, mirrorOf, shadedBoxGeometry } from '../lib/banks';
import { registerDim } from '../lib/dimmer';
import { patternTexture } from '../lib/textures';
import {
  anchorAt,
  dwellInfo,
  endpointsOf,
  fencesOf,
  INDEX,
  MILL_INDEX,
  PLATFORMS,
  sqOffset,
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

// Owns everything the platforms are: quantized travel, decks, and the whole
// telegraph grammar rebuilt for legibility after headset testing — the
// countdown now lives in three places at once so no angle can hide it:
//   1. corner posts, one extinguished per beat (vertical: read edge-on,
//      from below, and over the fences)
//   2. rims that wrap the deck edge instead of sitting on top of it
//   3. the deck face itself washing amber — the floor is the instruction
//      on the surface you actually look at (research/01 §3)
// Plus the mill: the drum that grinds only while you walk it, converting a
// real two-square walk into travel and lifting the water gate — the
// research's "roller as an instrument" (research/03 §8), made a crank.
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
  private drum!: Mesh;
  private portcullis!: Bank;
  private portBase: { x: number; y: number; z: number }[] = [];
  private lastBeat = -1;
  private millNotch = 0;
  private millDone = false;

  init(): void {
    G.platforms = PLATFORMS.map(() => ({
      anchor: { x: 0, y: 0, z: 0 },
      moving: false,
      departIn: Infinity,
      aligned: false,
      phaseShift: 0,
      claimShift: { x: 0, z: 0 },
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
    // The platforms ride the water too: the mirror shares their live buffers,
    // so the reflection animates for free (research/02 §2).
    this.scene.add(
      mirrorOf(this.decks, WELL.waterY),
      mirrorOf(this.rims, WELL.waterY, 0.22),
    );

    this.buildMill();
    this.buildGhosts();
  }

  // The drum under the mill tile, and the portcullis its walking raises —
  // work made visible: the gate ahead of you climbs as you climb the roll.
  private buildMill(): void {
    const drumMat = new MeshBasicMaterial({ color: 0x232c3c });
    registerDim(drumMat, 'scenery');
    const geo = new CylinderGeometry(0.34, 0.34, GRID.tile * 1.15, 18, 1);
    geo.rotateZ(Math.PI / 2); // axis east-west: the surface rolls along z
    this.drum = new Mesh(geo, drumMat);
    this.scene.add(this.drum);

    const portMat = new MeshBasicMaterial({ color: 0x2a3648 });
    registerDim(portMat, 'scenery');
    this.portcullis = new Bank(shadedBoxGeometry(), portMat, 8);
    const bay = PLATFORMS[INDEX['raft-bay']];
    const a = bay.keys[0].a;
    const gz = a.z - GRID.tile / 2 - 0.05;
    for (let i = 0; i < 6; i++) {
      const x = a.x - 0.3 + i * 0.12;
      this.portBase.push({ x, y: a.y, z: gz });
      this.portcullis.add(x, a.y + 0.75, gz, 0.035, 1.5, 0.035, 0xffffff);
    }
    this.portBase.push({ x: a.x, y: a.y, z: gz });
    this.portcullis.add(a.x, a.y + 1.5, gz, 0.78, 0.06, 0.06, 0xffffff);
    this.scene.add(this.portcullis.mesh);
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
      if (spec.extraGhosts) {
        for (const g of spec.extraGhosts) stamp(g.a, g.sq);
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

  // The mill grinds only while you walk it. Drift accrues from time spent
  // with the head on the tile, never from the clock — the walk is the crank.
  private updateMill(dt: number): void {
    const spec = PLATFORMS[MILL_INDEX];
    const st = G.platforms[MILL_INDEX];
    const mill = spec.mill!;
    const m = G.mill;
    const base = spec.keys[0].a;
    const rate = 1 / (mill.bars * conductor.barSec);

    if (G.tracked === MILL_INDEX) {
      const tileX = st.claimShift.x + sqOffset(spec.claim[0]).x;
      const tileZ = st.claimShift.z + sqOffset(spec.claim[0]).z;
      const half = GRID.tile / 2 + 0.1;
      m.walking =
        m.progress < 1 &&
        Math.abs(G.body.x - tileX) <= half &&
        Math.abs(G.body.z - tileZ) <= half;
      if (m.walking) m.progress = Math.min(1, m.progress + dt * rate);
    } else {
      m.walking = false;
      if (m.progress > 0 && m.progress < 1) {
        m.progress = Math.max(0, m.progress - dt * rate * MILL.rewind);
      }
    }
    m.maxProgress = Math.max(m.maxProgress, m.progress);

    const notch = Math.floor(m.progress * 8);
    if (notch !== this.millNotch) {
      if (notch > this.millNotch) conductor.millTick(notch);
      this.millNotch = notch;
    }
    if (m.progress >= 1 && !this.millDone) {
      this.millDone = true;
      conductor.horn();
      logEvent('mill-complete');
    }
    if (m.progress === 0) this.millDone = false;

    st.anchor.x = base.x + mill.travel.x * m.progress;
    st.anchor.y = base.y + mill.travel.y * m.progress;
    st.anchor.z = base.z + mill.travel.z * m.progress;
    st.claimShift.x = 0;
    st.claimShift.z = -mill.driftSquares * GRID.pitch * m.progress;
    st.moving = false;
    st.departIn = Infinity;

    // The drum rolls with the walk; the gate rises with the best walk so far.
    const o = sqOffset(spec.claim[0]);
    this.drum.position.set(
      st.anchor.x + o.x + st.claimShift.x,
      st.anchor.y - 0.35,
      st.anchor.z + o.z + st.claimShift.z,
    );
    const rolled = m.progress * (mill.driftSquares * GRID.pitch + Math.abs(mill.travel.z));
    this.drum.rotation.x = -rolled / 0.34;
    const lift = m.maxProgress * 1.42;
    this.portBase.forEach((b, i) => {
      const isHeader = i === this.portBase.length - 1;
      this.portcullis.set(
        i,
        b.x,
        (isHeader ? b.y + 1.5 : b.y + 0.75) + lift,
        b.z,
        isHeader ? 0.78 : 0.035,
        isHeader ? 0.06 : 1.5,
        isHeader ? 0.06 : 0.035,
      );
    });
  }

  update(dt: number): void {
    const bar = G.transport.bars;
    const beatPulse = 0.75 + 0.25 * Math.cos(G.transport.barPhase * Math.PI * 8);

    for (let i = 0; i < PLATFORMS.length; i++) {
      if (i === MILL_INDEX) continue;
      const st = G.platforms[i];
      anchorAt(PLATFORMS[i], bar, st.anchor, st.phaseShift);
      const d = dwellInfo(PLATFORMS[i], bar, st.phaseShift);
      st.moving = d.moving;
      st.departIn = d.departIn;
    }
    this.updateMill(dt);

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
      const isMill = t.platform === MILL_INDEX;
      const x = st.anchor.x + t.ox + st.claimShift.x;
      const y = st.anchor.y;
      const z = st.anchor.z + t.oz + st.claimShift.z;
      this.decks.set(t.deck, x, y - 0.05, z, GRID.tile, 0.1, GRID.tile);

      const warn = st.departIn <= 1;
      const fill = warn ? 1 - st.departIn : 0;

      // Deck wash — the countdown on the face you actually look at.
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
      } else if (isMill) {
        this.decks.color(t.deck, COLOR.rimSafe, 0.14 + 0.3 * G.mill.progress);
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
        if (isMill) {
          const lit = (e + 1) / 4 <= G.mill.progress + 0.001;
          this.rims.color(idx, COLOR.rimSafe, lit ? 1.1 : 0.3 + (G.mill.walking ? 0.25 * beatPulse : 0));
        } else if (st.moving) {
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
      const x = st.anchor.x + f.x + st.claimShift.x + cx * half;
      const y = st.anchor.y;
      const z = st.anchor.z + f.z + st.claimShift.z + cz * half;
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
