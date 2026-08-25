import {
  AdditiveBlending,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { COLOR, GRID } from '../config';
import { conductor } from '../conductor';
import { registerDim } from '../lib/dimmer';
import { glyphTexture } from '../lib/textures';
import { INDEX, PLATFORMS, sqOffset } from '../score';
import { G, logEvent } from '../state';

interface Plate {
  host: number;
  target: number;
  targetKeyBar: number;
  sq: { x: number; z: number };
  mesh: Mesh;
  mat: MeshBasicMaterial;
  held: number; // beats accumulated standing the glyph
}

// Call plates: the big, slow machines answer a summons. Stand the glyph for
// two beats and the target's loop rephases so its boarding dwell begins on
// the next bar. This is an interface INSIDE the world — a pressure plate the
// feet work, like Johansen's levers and torches (research/03 §5) — and it
// exists because waiting out a 28-bar loop is patience, not gameplay.
export class CallPlateSystem extends createSystem({}) {
  private plates: Plate[] = [];

  init(): void {
    const tex = glyphTexture();
    PLATFORMS.forEach((spec, i) => {
      if (!spec.plate) return;
      const mat = new MeshBasicMaterial({
        map: tex,
        color: COLOR.rimWarn,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      registerDim(mat, 'gameplay');
      const mesh = new Mesh(
        new PlaneGeometry(GRID.tile * 0.8, GRID.tile * 0.8),
        mat,
      );
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.plates.push({
        host: i,
        target: INDEX[spec.plate.target],
        targetKeyBar: spec.plate.targetKeyBar,
        sq: sqOffset(spec.plate.sq),
        mesh,
        mat,
        held: 0,
      });
    });
  }

  update(dt: number): void {
    const bar = G.transport.bars;
    for (const plate of this.plates) {
      const host = G.platforms[plate.host];
      const target = G.platforms[plate.target];
      plate.mesh.position.set(
        host.anchor.x + plate.sq.x,
        host.anchor.y + 0.03,
        host.anchor.z + plate.sq.z,
      );

      // The plate matters only while its machine is elsewhere.
      const useful = !target.aligned;
      const standing =
        useful &&
        G.tracked === plate.host &&
        Math.abs(G.body.x - plate.sq.x) < GRID.tile / 2 &&
        Math.abs(G.body.z - plate.sq.z) < GRID.tile / 2;

      if (standing) {
        plate.held += (dt / conductor.barSec) * 4;
        if (plate.held >= 2) {
          plate.held = -8; // refractory: the machine is already answering
          const spec = PLATFORMS[plate.target];
          const loop = spec.loopBars!;
          // Rephase so the summoned dwell begins at the next whole bar.
          let shift = (Math.floor(bar) + 1 - plate.targetKeyBar) % loop;
          if (shift < 0) shift += loop;
          target.phaseShift = shift;
          conductor.horn();
          logEvent(`plate:${PLATFORMS[plate.host].id}->${spec.id}`);
        }
      } else if (plate.held > 0) {
        plate.held = Math.max(0, plate.held - dt * 4);
      } else if (plate.held < 0) {
        plate.held = Math.min(0, plate.held + dt);
      }

      const fill = Math.max(0, Math.min(1, plate.held / 2));
      const breath = 0.8 + 0.2 * Math.sin(bar * Math.PI * 2);
      plate.mat.opacity = useful ? (0.25 + 0.55 * fill) * breath : 0.06;
      plate.mat.color.setHex(
        plate.held < 0 ? COLOR.rimSafe : useful ? COLOR.rimWarn : COLOR.rimSafe,
      );
    }
  }
}
