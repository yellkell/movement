import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
} from '@iwsdk/core';

const _camPos = new Vector3();
import { COLOR, ENERGY, WELL } from '../config';
import { conductor } from '../conductor';
import { Bank, mirrorOf, shadedBoxGeometry } from '../lib/banks';
import { applyDim, registerDim } from '../lib/dimmer';
import { textPanel } from '../lib/textures';
import { G } from '../state';

// THE WELL — a stepwell: a vertical temple descending to water. Built by the
// research/02 ladder, in order of return per frame-millisecond:
//   1. the mirror — the water doubles every light for one draw per bank
//   2. depth in layers — galleries, recessed alcoves, columns, the mouth
//   3. structure, not sticks — silhouette / panel / pinprick at three scales
//   4. air — two narrow shafts of light and drifting dust in the middle
// The sky above the mouth stays black (the hard-won negative rule), there is
// no post-processing, no real light exists anywhere, and everything repeated
// is an instanced bank animated through per-instance colour.
export class EnvironmentSystem extends createSystem({}) {
  private windows!: Bank;
  private windowCount = 0;
  private dust!: Points;
  private dustBase!: Float32Array;
  private waterMat!: MeshBasicMaterial;
  private flowColumn!: Mesh;
  private warnPanel?: Mesh;

  init(): void {
    const box = shadedBoxGeometry();
    const zMid = (WELL.zNear + WELL.zFar) / 2;
    const zLen = WELL.zNear - WELL.zFar;

    const structMat = new MeshBasicMaterial({ vertexColors: true });
    registerDim(structMat, 'scenery');
    const structure = new Bank(box, structMat, 300);

    const winMat = new MeshBasicMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    registerDim(winMat, 'scenery');
    this.windows = new Bank(box, winMat, 380);

    // Gallery rings every storey, down to the waterline — the lowest sits
    // half-sunk, which is what a stepwell is; below it the mirror carries the
    // architecture on.
    const ringYs: number[] = [];
    for (let y = 2.6; y > WELL.waterY - 0.3; y -= WELL.storey) ringYs.push(y);
    for (const y of ringYs) {
      // Long side galleries.
      for (const sign of [1, -1]) {
        const wx = sign * (WELL.halfX + 0.4);
        structure.add(wx, y, zMid, 0.8, 0.5, zLen + 1.4, COLOR.structure);
        // Parapet light-line along the inner edge — the panel scale.
        this.windows.add(
          sign * (WELL.halfX - 0.02),
          y + 0.28,
          zMid,
          0.05,
          0.045,
          zLen - 0.7,
          COLOR.window,
        );
        // Porthole row — the pinprick scale.
        for (let k = -6; k <= 6; k++) {
          const oz = zMid + k * 1.3;
          this.windows.add(
            sign * (WELL.halfX + 0.06),
            y - 0.02,
            oz,
            0.06,
            0.12,
            0.12,
            k % 2 === 0 ? COLOR.window : COLOR.windowWarm,
          );
        }
        // Recessed alcoves behind the wall line — the middle depth layer.
        for (let k = -2; k <= 2; k++) {
          const oz = zMid + k * 3.3;
          structure.add(
            sign * (WELL.halfX + 1.3),
            y + 1.05,
            oz,
            1.0,
            1.9,
            1.6,
            0x0b0e14,
          );
        }
      }
      // End walls.
      for (const [ze, sign] of [
        [WELL.zNear + 0.4, 1],
        [WELL.zFar - 0.4, -1],
      ] as const) {
        structure.add(0, y, ze, WELL.halfX * 2 + 1.4, 0.5, 0.8, COLOR.structure);
        this.windows.add(
          0,
          y + 0.28,
          ze - sign * 0.42,
          WELL.halfX * 2 - 0.7,
          0.045,
          0.05,
          COLOR.window,
        );
        for (let k = -3; k <= 3; k++) {
          this.windows.add(
            k * 1.15,
            y - 0.02,
            ze - sign * 0.46,
            0.12,
            0.12,
            0.06,
            k % 2 === 0 ? COLOR.window : COLOR.windowWarm,
          );
        }
      }
    }

    // Columns: full-height ribs — the silhouette scale.
    const colH = 3.4 - (WELL.waterY - 1);
    const colY = (3.4 + WELL.waterY - 1) / 2;
    for (const sign of [1, -1]) {
      for (let k = 0; k <= 5; k++) {
        const oz = WELL.zNear - 0.2 - (k * (zLen - 0.4)) / 5;
        structure.add(sign * WELL.halfX, colY, oz, 0.6, colH, 0.6, 0x171c26);
      }
    }

    // The mouth: a heavier rim at the top, and above it nothing — the sky
    // stays black, a line with a short glow, never a wall.
    for (const sign of [1, -1]) {
      structure.add(
        sign * (WELL.halfX + 0.7),
        WELL.mouthY,
        zMid,
        1.4,
        0.8,
        zLen + 2.8,
        0x1a2030,
      );
      this.windows.add(
        sign * (WELL.halfX + 0.12),
        WELL.mouthY + 0.42,
        zMid,
        0.06,
        0.05,
        zLen + 0.6,
        COLOR.window,
      );
      structure.add(
        0,
        WELL.mouthY,
        sign > 0 ? WELL.zNear + 0.7 : WELL.zFar - 0.7,
        WELL.halfX * 2 + 2.8,
        0.8,
        1.4,
        0x1a2030,
      );
    }

    this.windowCount = this.windows.count;
    this.scene.add(structure.mesh, this.windows.mesh);

    // 1. The mirror. One extra draw per bank; the reflection animates free.
    this.scene.add(
      mirrorOf(structure, WELL.waterY, 0.3),
      mirrorOf(this.windows, WELL.waterY, 0.26),
    );

    this.waterMat = new MeshBasicMaterial({
      color: COLOR.water,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    const water = new Mesh(
      new PlaneGeometry(WELL.halfX * 2 + 5, zLen + 6),
      this.waterMat,
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, WELL.waterY, zMid);
    this.scene.add(water);

    // 4. Air: two narrow shafts falling from the mouth, and dust to catch
    // them. An empty black gap reads as a wall until something drifts in it.
    const shaftMat = new MeshBasicMaterial({
      color: COLOR.shaft,
      transparent: true,
      opacity: 0.045,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    registerDim(shaftMat, 'scenery');
    for (const [sx, sz, r] of [
      [2.4, -2.2, 1.5],
      [-2.0, -8.8, 1.1],
      [1.6, -12.6, 0.9],
    ]) {
      const cone = new Mesh(new ConeGeometry(r, 26, 10, 1, true), shaftMat);
      cone.position.set(sx, WELL.mouthY - 13, sz);
      this.scene.add(cone);
    }

    let seed = 20260825;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const N = 260;
    this.dustBase = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.dustBase[i * 3] = (rnd() - 0.5) * WELL.halfX * 1.8;
      this.dustBase[i * 3 + 1] = WELL.waterY + rnd() * (WELL.mouthY - WELL.waterY);
      this.dustBase[i * 3 + 2] = WELL.zFar + 0.8 + rnd() * (zLen - 1.6);
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute(
      'position',
      new BufferAttribute(this.dustBase.slice(), 3),
    );
    const dustMat = new PointsMaterial({
      color: COLOR.dust,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    registerDim(dustMat, 'scenery');
    this.dust = new Points(dustGeo, dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    // Flow made visible: a column of light in the well's corner, one lap of
    // brightness per clean gate. Gameplay light — it never dims with energy.
    const flowMat = new MeshBasicMaterial({
      color: COLOR.flow,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    registerDim(flowMat, 'gameplay');
    this.flowColumn = new Mesh(new PlaneGeometry(0.3, 1), flowMat);
    // Ahead and below from the threshold: flow is part of the vista you
    // descend toward, not a HUD.
    this.flowColumn.position.set(3.2, WELL.waterY, -13.2);
    this.scene.add(this.flowColumn);

    // The one instruction, ~3 m out (research/02 §6). Embodied movement needs
    // no tutorial (research/03 §5); four lines cover everything learned.
    const panel = textPanel({
      title: 'STEPWELL',
      lines: [
        'THE WELL DOES THE WALKING',
        'STEP WHEN RIMS GLOW CYAN',
        'NEVER STEP ON RED',
        'DUCK THE LOW LIGHT',
      ],
      small: 'squeeze & hold — or G — to see how the well thinks',
      width: 1.9,
    });
    // Off the descent axis and angled in, so the forward vista — the well
    // you are about to walk — stays open. See far, then go (research/03 §7).
    panel.position.set(0.85, 1.5, -2.35);
    panel.rotation.y = -0.28;
    registerDim(panel.material as MeshBasicMaterial, 'gameplay');
    this.scene.add(panel);
  }

  showPlayAreaWarning(widthM: number, depthM: number): void {
    if (this.warnPanel) return;
    this.warnPanel = textPanel({
      lines: [
        'YOUR ROOM READS ' +
          widthM.toFixed(1) +
          ' × ' +
          depthM.toFixed(1) +
          ' M',
        'THE WELL ASSUMES 2 × 2 M',
        'LEAN, DON’T LUNGE',
      ],
      width: 1.35,
      color: '#ffaa22',
    });
    this.warnPanel.position.set(0, 0.82, -2.2);
    registerDim(this.warnPanel.material as MeshBasicMaterial, 'gameplay');
    this.scene.add(this.warnPanel);
  }

  update(dt: number): void {
    // Energy: the scenery ducks while a telegraph owns the deck and blooms
    // with flow (research/02 §6 — the environment obeys an energy input).
    const target = G.hazardLive
      ? ENERGY.ducked
      : Math.min(1, ENERGY.base + G.flow * ENERGY.flowBonus);
    G.energy += (target - G.energy) * Math.min(1, dt * ENERGY.ease);
    applyDim(G.energy, G.fade);

    // Pinprick pulse: portholes breathe with the beat through instance colour
    // — the whole animated light show stays one draw (research/02 §3).
    const beat = G.transport.beat;
    const phase = G.transport.barPhase * 4 - beat;
    for (let i = 0; i < this.windowCount; i++) {
      const mine = i % 4 === beat;
      const glow = mine ? 1.1 + 0.5 * (1 - phase) : 0.75;
      this.windows.color(
        i,
        i % 2 === 0 ? COLOR.window : COLOR.windowWarm,
        glow,
      );
    }

    const pos = this.dust.geometry.getAttribute('position') as BufferAttribute;
    const t = G.transport.bars * conductor.barSec;
    for (let i = 0; i < pos.count; i++) {
      const y0 = this.dustBase[i * 3 + 1];
      const range = WELL.mouthY - WELL.waterY;
      let y = y0 + ((t * 0.09 + i * 0.37) % range);
      if (y > WELL.mouthY) y -= range;
      pos.setY(i, y);
      pos.setX(i, this.dustBase[i * 3] + Math.sin(t * 0.24 + i) * 0.18);
    }
    pos.needsUpdate = true;

    this.waterMat.opacity = 0.8 + 0.05 * Math.sin(t * 0.7);

    const h = Math.min(14, 0.4 + G.flow * 0.5);
    this.flowColumn.scale.y = h;
    this.flowColumn.position.y = WELL.waterY + h / 2;
    this.flowColumn.lookAt(
      this.camera.getWorldPosition(_camPos).setY(this.flowColumn.position.y),
    );

    conductor.setDepth(Math.min(1, Math.max(0, G.rig.y / WELL.waterY)));
    conductor.setArpLevel(Math.min(1, G.flow / 8));
  }
}
