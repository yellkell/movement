import {
  AdditiveBlending,
  createSystem,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { COLOR, GRID, HAZARD } from '../config';
import { conductor } from '../conductor';
import { Bank, shadedBoxGeometry } from '../lib/banks';
import { registerDim } from '../lib/dimmer';
import { PLATFORMS, resolveGates, sqOffset } from '../score';
import { G, logEvent } from '../state';

// The gates: world-fixed frames the moving ground carries you through. Two of
// the ten button-less interactions on Johansen's own list are "duck under an
// obstacle while on a moving platform" and "dodge to the side while on a
// moving platform" (research/03 §5) — dance's `sweep` and `beam` on ground
// that is itself in motion. This system is that collision, built.
//
// Judgement is geometric (distance along the travel axis), so it stays honest
// under any easing; the window telegraphs one bar of travel ahead in the
// amber→red language, and — dance's law (research/01 §3) — the sweep pane
// renders a touch below where the judge cuts: the picture may demand slightly
// more crouch than the judge, never less.
export class HazardSystem extends createSystem({}) {
  private panes: Mesh[] = [];
  private paneMats: MeshBasicMaterial[] = [];
  private lastLap = 0;

  init(): void {
    G.gates = resolveGates();
    G.gateState = G.gates.map(() => ({ phase: 'idle', hit: false }));

    const frames = new Bank(
      shadedBoxGeometry(),
      new MeshBasicMaterial({ vertexColors: true }),
      G.gates.length * 3,
    );
    registerDim(frames.mesh.material as MeshBasicMaterial, 'scenery');

    for (const gate of G.gates) {
      const spec = PLATFORMS[gate.platform];
      // A sweep spans the whole platform; a beam owns one lane.
      let cx = gate.pos.x;
      let cz = gate.pos.z;
      let width = GRID.pitch;
      if (gate.kind === 'sweep') {
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        const laneO = sqOffset(gate.lane);
        for (const sq of spec.claim) {
          const o = sqOffset(sq);
          minX = Math.min(minX, o.x);
          maxX = Math.max(maxX, o.x);
          minZ = Math.min(minZ, o.z);
          maxZ = Math.max(maxZ, o.z);
        }
        cx = gate.pos.x - laneO.x + (minX + maxX) / 2;
        cz = gate.pos.z - laneO.z + (minZ + maxZ) / 2;
        width =
          (gate.axis === 'z' ? maxX - minX : maxZ - minZ) + GRID.pitch + 0.1;
      }

      const paneH = gate.kind === 'sweep' ? 0.6 : 2.3;
      const paneY =
        gate.kind === 'sweep'
          ? gate.pos.y + HAZARD.sweepPaneHeight + paneH / 2
          : gate.pos.y + paneH / 2;
      const mat = new MeshBasicMaterial({
        color: COLOR.gateFrame,
        transparent: true,
        opacity: 0.16,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });
      const pane = new Mesh(new PlaneGeometry(width, paneH), mat);
      pane.position.set(cx, paneY, cz);
      if (gate.axis === 'x') pane.rotation.y = Math.PI / 2;
      this.scene.add(pane);
      this.panes.push(pane);
      this.paneMats.push(mat);

      // The frame: two posts and a header, a doorway the well grew. Frames
      // are scenery; the pane is the light that owns the moment.
      const across = gate.axis === 'z' ? 'x' : 'z';
      const halfW = width / 2 + 0.09;
      const postH = 2.75;
      const p0 = { x: cx, z: cz };
      const p1 = { x: cx, z: cz };
      if (across === 'x') {
        p0.x -= halfW;
        p1.x += halfW;
      } else {
        p0.z -= halfW;
        p1.z += halfW;
      }
      frames.add(p0.x, gate.pos.y + postH / 2, p0.z, 0.14, postH, 0.14, COLOR.structure);
      frames.add(p1.x, gate.pos.y + postH / 2, p1.z, 0.14, postH, 0.14, COLOR.structure);
      frames.add(
        cx,
        gate.pos.y + postH + 0.09,
        cz,
        across === 'x' ? halfW * 2 + 0.14 : 0.2,
        0.18,
        across === 'z' ? halfW * 2 + 0.14 : 0.2,
        COLOR.structure,
      );
    }
    this.scene.add(frames.mesh);
  }

  update(): void {
    if (G.laps !== this.lastLap) {
      this.lastLap = G.laps;
      for (const s of G.gateState) {
        s.phase = 'idle';
        s.hit = false;
      }
    }

    G.doom.length = 0;
    let live = false;

    for (let i = 0; i < G.gates.length; i++) {
      const gate = G.gates[i];
      const s = G.gateState[i];
      const host = G.platforms[gate.platform];
      const laneO = sqOffset(gate.lane);
      const laneAxisPos =
        gate.axis === 'z' ? host.anchor.z + laneO.z : host.anchor.x + laneO.x;
      const gateAxisPos = gate.axis === 'z' ? gate.pos.z : gate.pos.x;
      const d = Math.abs(laneAxisPos - gateAxisPos);
      const dy = Math.abs(host.anchor.y - gate.pos.y);
      const inWindow =
        host.moving && d <= gate.span * (HAZARD.windowHalf * 2) && dy < 0.6;
      const inTelegraph = host.moving && !inWindow && d <= gate.telegraph && dy < 2.2;
      const riding = G.tracked === gate.platform;

      switch (s.phase) {
        case 'idle':
          if (inWindow) s.phase = 'window';
          else if (inTelegraph) s.phase = 'telegraph';
          break;
        case 'telegraph':
          if (inWindow) s.phase = 'window';
          else if (!inTelegraph) s.phase = 'idle';
          break;
        case 'window':
          if (!inWindow) {
            // The pass resolved. Only a ridden gate grades: watching a gate
            // from a still floor asks nothing of the body.
            if (riding) {
              if (s.hit) {
                s.hit = false;
              } else {
                G.clears++;
                G.flow++;
                conductor.chime(G.flow);
                logEvent(`clear:${gate.kind}`);
              }
            }
            s.phase = 'done';
          }
          break;
        case 'done':
          if (!host.moving || d > gate.telegraph * 1.3) s.phase = 'idle';
          break;
      }

      // Judge, in the window, while riding, once per pass.
      if (s.phase === 'window' && riding && !s.hit) {
        let bad = false;
        if (gate.kind === 'sweep') {
          bad = !G.body.ducked;
        } else {
          bad =
            Math.abs(G.body.x - laneO.x) < GRID.pitch * HAZARD.laneHalf &&
            Math.abs(G.body.z - laneO.z) < GRID.pitch * HAZARD.laneHalf + 0.12;
        }
        if (bad) {
          s.hit = true;
          G.hits++;
          G.flow = 0;
          conductor.thud();
          logEvent(`hit:${gate.kind}`);
        }
      }

      // The pane speaks the whole grammar: faint doorway, amber countdown,
      // red moment, white-red sting when it caught you.
      const mat = this.paneMats[i];
      if (s.phase === 'window') {
        mat.color.setHex(s.hit ? 0xff8890 : COLOR.rimDanger);
        mat.opacity = s.hit ? 0.85 : 0.55;
      } else if (s.phase === 'telegraph') {
        const close = 1 - Math.min(1, d / gate.telegraph);
        mat.color.setHex(COLOR.rimWarn);
        mat.opacity = 0.1 + 0.4 * close * (0.7 + 0.3 * Math.sin(G.transport.barPhase * Math.PI * 8));
      } else {
        mat.color.setHex(COLOR.gateFrame);
        mat.opacity = 0.16;
      }

      // The floor is the instruction: a beam's doomed lane burns on the deck.
      if (gate.kind === 'beam' && (s.phase === 'telegraph' || s.phase === 'window')) {
        G.doom.push({
          platform: gate.platform,
          c: gate.lane[0],
          r: gate.lane[1],
          level: s.phase === 'window' ? 1 : 1 - Math.min(1, d / gate.telegraph),
          red: s.phase === 'window',
        });
      }

      if (riding && (s.phase === 'telegraph' || s.phase === 'window')) live = true;
    }

    G.hazardLive = live;
  }
}
