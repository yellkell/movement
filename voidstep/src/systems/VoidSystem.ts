import { createSystem, Group, type Mesh, type MeshBasicMaterial, type Points } from '@iwsdk/core';
import { ENERGY, hueToColor, LASER_HUES } from '../config';
import { applyDim } from '../lib/dimmer';
import { textPanel } from '../lib/textures';
import {
  buildArcs,
  buildCanopy,
  buildDust,
  buildHorizon,
  buildShardField,
  buildSkyline,
  buildTowerRing,
  buildVoidFloor,
  mirrorOf,
  type Canopy,
  type GlowBank,
  type ShardField,
  type TowerRing,
  type VoidFloor,
} from '../lib/voidkit';
import { G } from '../state';

/** The black glass the whole world doubles in. */
export const FLOOR_Y = -0.06;

/** Where the scenery starts — comfortably outside the circuit's widest reach. */
const INNER = 13;

// THE VOID — dance's set environment, cloned and rehung around a circuit
// instead of a ring of dancers. Same recipe, same discipline, same
// bloodline (Beat-Saber-background ambition, radial):
//
//   NEAR   r 20 · 16 towers ·  7–14 m — portholes, shafts, full detail
//   MID    r 34 · 24 towers · 13–24 m — bigger silhouettes, no fine work
//   FAR    r 52–88 · 48 slabs · 20–54 m — pure parallax skyline
//   SKY    a low horizon band at r 92, dust drifting through all of it
//
// Overhead: the four-ring TRUSS (lifted clear of the skywalk) and six great
// ARCS springing over the whole circuit — architecture for a route you RIDE
// through, which is what arcs are for. Underfoot: black gloss, a two-scale
// grid, 28 radial rays, five concentric rings — and THE MIRROR, flipped
// copies sharing live instance buffers, one extra draw per bank. The route's
// own decks mirror too (PlatformSystem), so the circuit hangs over its own
// reflection the whole way round.
//
// The palette is the disco vocabulary (LASER_HUES, snapping per bar) and the
// world DUCKS while a telegraph owns your deck — energy is eased here from
// the hazard flag, dance's law: danger never competes with scenery.
export class VoidSystem extends createSystem({}) {
  private near!: TowerRing;
  private mid!: TowerRing;
  private skyEdges!: GlowBank;
  private skyCount = 0;
  private canopy!: Canopy;
  private arcs!: GlowBank;
  private arcCount = 0;
  private shards!: ShardField;
  private floor!: VoidFloor;
  private horizonNear!: MeshBasicMaterial;
  private horizonFar!: MeshBasicMaterial;
  private dust!: Points;
  private hueCursor = 0;
  private lastBar = -1;
  private clock = 0;
  private warning: Mesh | undefined;

  init(): void {
    const root = new Group();
    root.name = 'void';

    // ── underfoot ────────────────────────────────────────────────────────
    this.floor = buildVoidFloor(46, INNER, hueToColor(LASER_HUES[1], 0.5), 1.4, 0.13);
    this.floor.group.position.y = FLOOR_Y;
    root.add(this.floor.group);
    // (dance's floor sheen stayed home: at this budget its draw call buys
    // more as telegraph headroom than as a 5%-opacity polish wash.)

    // ── the reflectable world: silhouettes and their light ───────────────
    // One group so the mirror is a single clone. The near ring keeps its
    // portholes and shafts out of the build entirely (dance's near ring
    // carries them; here they'd cost the mirror five more draws for detail
    // no reflection at these distances can resolve — the budget spends
    // those calls on the attack telegraphs instead).
    const reflectable = new Group();
    reflectable.name = 'void-reflectable';

    this.near = buildTowerRing({
      count: 16,
      radius: 20,
      baseY: FLOOR_Y,
      minH: 7,
      maxH: 14,
      width: 1.15,
      seed: 0x51,
      scatter: 1.8,
    });
    reflectable.add(this.near.group);

    this.mid = buildTowerRing({
      count: 24,
      radius: 34,
      baseY: FLOOR_Y,
      minH: 13,
      maxH: 24,
      width: 1.9,
      seed: 0x9c,
      scatter: 4,
    });
    reflectable.add(this.mid.group);

    const sky = buildSkyline(48, 52, 88, 20, 54, 0x2f);
    reflectable.add(sky.group);
    this.skyEdges = sky.edges;
    this.skyCount = sky.count;

    root.add(reflectable);
    // The mirror: same buffers, dimmer materials, upside down.
    root.add(mirrorOf(reflectable, 0.4, FLOOR_Y));

    // ── overhead ─────────────────────────────────────────────────────────
    // The truss sits clear above the skywalk's headroom (3.8 m deck + a
    // standing body), so the ride threads UNDER the structure. Two rings —
    // the foyer's scale, because the budget's last calls belong to the
    // attack telegraphs, and a truss reads as a truss from the second ring.
    this.canopy = buildCanopy(2, 9.2, 3.4, 12.5, 1.8, 16);
    root.add(this.canopy.group);

    const arcs = buildArcs(6, 26, 0.26, 0x77);
    root.add(arcs.group);
    this.arcs = arcs.bank;
    this.arcCount = 6;

    // ── the air ──────────────────────────────────────────────────────────
    this.shards = buildShardField(22, 14, 26, 4, 16, 0xd4);
    root.add(this.shards.group);

    const dust = buildDust(1200, 10, 60, -1, 30, hueToColor(LASER_HUES[1], 0.4), 0x33);
    root.add(dust.points);
    this.dust = dust.points;

    const horizon = buildHorizon(92, 9, hueToColor(LASER_HUES[3], 0.5), 0.24);
    root.add(horizon.group);
    this.horizonNear = horizon.near;
    this.horizonFar = horizon.far;

    // The one instruction, ~3 m out on an angled panel (research/03 §5:
    // embodied movement doesn't have to be learned; four lines cover the
    // rest). It faces the home pad from beyond the route's first step.
    const panel = textPanel({
      title: 'VOIDSTEP',
      lines: [
        'step between the platforms — the void does the walking',
        'amber fills to red: that ground is leaving',
        'a marked lane says move · a hanging blade says duck',
        'ride the circuit up, across, and home',
      ],
      small: 'squeeze (or G) — see how the circuit thinks',
      width: 2.6,
    });
    panel.position.set(-2.2, 1.7, 2.4);
    panel.rotation.y = Math.PI + Math.PI / 8;
    root.add(panel);

    this.scene.add(root);
  }

  /** The play-area courtesy (research/01 §4): say so, before the set. */
  showPlayAreaWarning(w: number, d: number): void {
    if (this.warning) return;
    this.warning = textPanel({
      title: 'ROOM CHECK',
      lines: [
        `this play area reads ${w.toFixed(1)} × ${d.toFixed(1)} m`,
        'the circuit is authored for 2 × 2 m',
        'steps may land past your boundary',
      ],
      small: 'clear more floor, or ride with care',
      width: 1.7,
      color: '#ffaa22',
    });
    this.warning.position.set(0.9, 1.45, 1.9);
    this.warning.rotation.y = Math.PI - Math.PI / 10;
    this.scene.add(this.warning);
  }

  update(dt: number): void {
    this.clock += dt;

    // Energy: the world ducks while a telegraph owns the ridden deck and
    // blooms with flow — dance's law, stepwell's implementation.
    const target = G.hazardLive
      ? ENERGY.ducked
      : Math.min(1, ENERGY.base + G.flow * ENERGY.flowBonus);
    G.energy += (target - G.energy) * Math.min(1, dt * ENERGY.ease);
    applyDim(G.energy, 0);

    const beat = G.transport.bars * 4;
    const energy = G.energy;
    const beatFrac = beat - Math.floor(beat);
    const pulse = Math.max(0, 1 - beatFrac * 2.2);

    // Hue snaps per bar, marching around the wheel with the light rig.
    const bar = Math.floor(G.transport.bars);
    if (bar !== this.lastBar && beat > 0) {
      this.lastBar = bar;
      this.hueCursor = (this.hueCursor + 1) % LASER_HUES.length;
    }
    const hueAt = (n: number): number =>
      hueToColor(LASER_HUES[(this.hueCursor + n) % LASER_HUES.length], 0.55);

    // Towers breathe on the kick as a travelling wave, so the rings ROLL
    // around the arena instead of flashing as one.
    for (let i = 0; i < this.near.count; i++) {
      const wave = Math.sin(beat * Math.PI * 0.5 + (i / this.near.count) * Math.PI * 2);
      this.near.setGlow(i, hueAt(i), 0.42 + energy * (0.4 + pulse * 0.85 + Math.max(0, wave) * 0.4));
    }
    this.near.commit();
    for (let i = 0; i < this.mid.count; i++) {
      const wave = Math.sin(beat * Math.PI * 0.5 - 1.2 + (i / this.mid.count) * Math.PI * 2);
      this.mid.setGlow(i, hueAt(i * 2 + 1), 0.3 + energy * (0.3 + pulse * 0.5 + Math.max(0, wave) * 0.3));
    }
    this.mid.commit();

    // The skyline barely moves — a slow swell, so the far edge of the world
    // feels alive without ever pulling the eye off the floor.
    const far = 0.28 + energy * 0.18 + Math.sin(this.clock * 0.5) * 0.05;
    for (let i = 0; i < this.skyCount; i++) this.skyEdges.tint(i, hueAt(3), far);
    this.skyEdges.commit();

    // The canopy turns and its joints take the kick; laps spin it up.
    this.canopy.spin(dt, 0.12 * (1 + Math.min(G.laps, 3) * 0.4));
    this.canopy.setGlow(hueAt(1), 0.5 + energy * (0.35 + pulse * 0.6));
    this.canopy.commit();

    for (let i = 0; i < this.arcCount; i++) {
      const wave = Math.sin(beat * Math.PI * 0.25 + (i / this.arcCount) * Math.PI * 2);
      this.arcs.tint(i, hueAt(i + 2), 0.3 + energy * (0.25 + Math.max(0, wave) * 0.5));
    }
    this.arcs.commit();

    // The floor: rays chase around the ring on the beat, the concentric
    // lines swell outward from the middle a bar at a time.
    for (let i = 0; i < this.floor.rayCount; i++) {
      const chase = Math.sin(beat * Math.PI - (i / this.floor.rayCount) * Math.PI * 4);
      this.floor.rays.tint(i, hueAt(2), 0.18 + energy * (0.2 + Math.max(0, chase) * 0.7));
    }
    this.floor.rays.commit();
    for (let i = 0; i < this.floor.ringCount; i++) {
      const swell = Math.max(0, Math.sin(beat * Math.PI * 0.5 - i * 0.7));
      this.floor.rings.tint(i, hueAt(i), 0.25 + energy * (0.25 + swell * 0.65));
    }
    this.floor.rings.commit();
    this.floor.gridMat.opacity = 0.08 + energy * (0.06 + pulse * 0.05);

    // Shards tumble; dust turns the whole room a hair each second so the
    // middle distance is never static.
    this.shards.drift(this.clock, dt);
    this.shards.setGlow(hueAt(4), 0.3 + energy * (0.25 + pulse * 0.4));
    this.shards.commit();
    this.dust.rotation.y += dt * 0.008;

    this.horizonNear.opacity = 0.16 + energy * 0.12;
    this.horizonFar.opacity = 0.08 + energy * 0.06;
  }
}
