import {
  AdditiveBlending,
  createSystem,
  Sprite,
  SpriteMaterial,
} from '@iwsdk/core';
import { EMBER, GRID, WELL } from '../config';
import { conductor } from '../conductor';
import { glowTexture } from '../lib/textures';
import {
  PLATFORMS,
  RAFT_INDEX,
  sqOffset,
  THRESHOLD_INDEX,
  WATER_ANCHOR,
} from '../score';
import { G, logEvent } from '../state';
import { EnvironmentSystem } from './EnvironmentSystem';

// The purpose: the well went dark — bring the light up from the water.
// Stand the raft at the bottom and the ember rises to travel with you;
// every storey you carry it past takes the light back (Ico's backtracking
// made luminous: the same architecture twice, changed by what you did —
// research/03 §8). Docking it at the threshold lights one of the mouth
// braziers, and the well begins again. The loop is geometrically closed by
// the score, so rebirth resets only the clock, never the body.
export class EmberSystem extends createSystem({}) {
  private core!: Sprite;
  private halo!: Sprite;
  private ringYs: number[] = [];
  private brazierTarget = { x: 0, y: WELL.mouthY + 0.6, z: WELL.zFar };

  init(): void {
    const tex = glowTexture();
    this.core = new Sprite(
      new SpriteMaterial({
        map: tex,
        color: 0xffc06a,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.core.scale.setScalar(0.26);
    this.halo = new Sprite(
      new SpriteMaterial({
        map: tex,
        color: 0xff8c3a,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.scale.setScalar(0.85);
    this.core.visible = this.halo.visible = false;
    this.scene.add(this.core, this.halo);
  }

  private placeOrb(x: number, y: number, z: number, glow: number): void {
    this.core.position.set(x, y, z);
    this.halo.position.set(x, y, z);
    this.core.visible = this.halo.visible = true;
    const s = 0.22 + 0.08 * Math.sin(G.transport.bars * Math.PI * 2) + glow * 0.1;
    this.core.scale.setScalar(s);
    this.halo.scale.setScalar(s * 3.2 + glow * 0.4);
  }

  update(dt: number): void {
    const bar = G.transport.bars;
    const ember = G.ember;
    const env = this.world.getSystem(EnvironmentSystem);
    if (this.ringYs.length === 0 && env) {
      this.ringYs = env.ringYs;
      G.storeysLit = this.ringYs.map(() => false);
      const b = env.brazierAnchor();
      if (b) this.brazierTarget = b;
    }

    const raft = G.platforms[RAFT_INDEX];
    const atWater =
      !raft.moving && Math.abs(raft.anchor.y - WATER_ANCHOR.y) < 0.05;

    switch (ember.phase) {
      case 'water': {
        // Waiting under the surface. Stand the raft's centre lane at the
        // water for two bars and it answers.
        const onRaft = G.tracked === RAFT_INDEX;
        const nc = sqOffset(PLATFORMS[RAFT_INDEX].claim[1]);
        const near =
          Math.abs(G.body.x - nc.x) < GRID.pitch &&
          Math.abs(G.body.z - nc.z) < GRID.pitch;
        if (onRaft && atWater && near) {
          if (ember.sinceBar === 0) ember.sinceBar = bar;
          if (bar - ember.sinceBar >= EMBER.standBars) {
            ember.phase = 'rising';
            ember.sinceBar = bar;
            conductor.swell();
            logEvent('ember-rising');
          }
        } else {
          ember.sinceBar = 0;
        }
        // A glint under the water while the raft is down, so the water
        // itself says what it is holding.
        if (atWater) {
          this.placeOrb(
            raft.anchor.x + nc.x,
            WATER_ANCHOR.y - 0.35,
            raft.anchor.z + nc.z,
            0,
          );
          (this.core.material as SpriteMaterial).opacity = 0.5;
          (this.halo.material as SpriteMaterial).opacity = 0.18;
        } else {
          this.core.visible = this.halo.visible = false;
        }
        break;
      }
      case 'rising': {
        const f = Math.min(1, (bar - ember.sinceBar) / EMBER.riseBars);
        const nc = sqOffset(PLATFORMS[RAFT_INDEX].claim[1]);
        const y =
          WATER_ANCHOR.y - 0.35 + (EMBER.hover + 0.35) * (f * f * (3 - 2 * f));
        this.placeOrb(raft.anchor.x + nc.x, y, raft.anchor.z + nc.z, f);
        (this.core.material as SpriteMaterial).opacity = 0.5 + 0.5 * f;
        (this.halo.material as SpriteMaterial).opacity = 0.18 + 0.25 * f;
        if (f >= 1) {
          ember.phase = 'held';
          ember.held = true;
          conductor.emberHeld = true;
          logEvent('ember-held');
        }
        break;
      }
      case 'held': {
        // The ember rides above whatever ground owns the frame, and every
        // storey the rig reaches takes the light back for this lap.
        const t = G.platforms[G.tracked];
        let cx = 0;
        let cz = 0;
        const claim = PLATFORMS[G.tracked].claim;
        for (const sq of claim) {
          const o = sqOffset(sq);
          cx += o.x / claim.length;
          cz += o.z / claim.length;
        }
        this.placeOrb(
          t.anchor.x + t.claimShift.x + cx,
          t.anchor.y + EMBER.hover + 0.08 * Math.sin(bar * Math.PI * 2),
          t.anchor.z + t.claimShift.z + cz,
          0.6,
        );
        (this.core.material as SpriteMaterial).opacity = 1;
        (this.halo.material as SpriteMaterial).opacity = 0.45;
        this.ringYs.forEach((y, i) => {
          if (!G.storeysLit[i] && G.rig.y >= y - 0.6) {
            G.storeysLit[i] = true;
            conductor.bell(i);
            logEvent(`storey-lit:${i}`);
          }
        });
        if (G.tracked === THRESHOLD_INDEX) {
          ember.phase = 'docking';
          ember.sinceBar = bar;
          conductor.swell();
          logEvent('ember-docking');
        }
        break;
      }
      case 'docking': {
        // Home: the ember leaves you for the mouth, lights a brazier, and
        // the throat closes the lap. The seam hides in darkness — the one
        // lesson taken from folded space (research/01 §2).
        const f = Math.min(1, (bar - ember.sinceBar) / EMBER.dockBars);
        const s = f * f * (3 - 2 * f);
        const from = { x: G.rig.x, y: G.rig.y + EMBER.hover, z: G.rig.z };
        this.placeOrb(
          from.x + (this.brazierTarget.x - from.x) * s,
          from.y + (this.brazierTarget.y - from.y) * s + Math.sin(s * Math.PI) * 1.2,
          from.z + (this.brazierTarget.z - from.z) * s,
          1,
        );
        if (f >= 1) {
          G.fade = Math.min(1, G.fade + dt / 1.1);
          if (G.fade >= 1) this.rebirth();
        }
        break;
      }
    }

    if (ember.phase !== 'docking') {
      G.fade = Math.max(0, G.fade - dt / 1.4);
    }
  }

  private rebirth(): void {
    G.laps++;
    conductor.reset();
    conductor.emberHeld = false;
    G.ember.phase = 'water';
    G.ember.held = false;
    G.ember.sinceBar = 0;
    G.storeysLit = G.storeysLit.map(() => false);
    G.mill.progress = 0;
    G.mill.maxProgress = 0;
    for (const st of G.platforms) st.phaseShift = 0;
    this.core.visible = this.halo.visible = false;
    logEvent('rebirth');
  }
}
