/**
 * Attack telegraphs — cloned from dance (RAVE RAID, src/choreo/telegraphs.ts)
 * and trimmed to the moves VOIDSTEP steals: the strip (beam and its
 * quarter-turned crossfire rail), the half-flood (seesaw and surge), the
 * gate, and the sweep's whole air-borne stack. The souls-like readability
 * contract comes with them, word for word: hazard-amber shapes fill up and
 * shift to danger-red as the strike arrives — THE FILL IS THE COUNTDOWN.
 * All shader-driven planes; cheap, additive, no textures. Deck shapes here
 * are rectangles (a 3×3-grid deck, not dance's octagon), so the octagon
 * mask stayed home; everything else is the same light.
 */

import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from '@iwsdk/core';

export interface Telegraph {
  /** Position/rotate this; the shapes live inside. */
  group: Group;
  /** fill: 0..1 charge progress; time: seconds for the pulse. */
  update(fill: number, time: number): void;
  dispose(): void;
}

/** Shared vertex shader — pass UVs through. */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Hazard amber → danger red as the charge completes, pulsing faster. */
const COMMON = /* glsl */ `
  uniform float uFill, uTime;
  varying vec2 vUv;
  vec3 warnColor(){
    return mix(vec3(1.0, 0.69, 0.0), vec3(0.91, 0.21, 0.16), smoothstep(0.55, 0.95, uFill));
  }
  float pulse(){
    float rate = mix(3.0, 14.0, uFill);
    return 0.82 + 0.18 * sin(uTime * rate);
  }
`;

/** Strip: edge rails + a fill front that advances down the line (v: 1 → 0). */
const STRIP_FRAG = /* glsl */ `
  ${COMMON}
  void main(){
    vec3 col = warnColor();
    float a = 0.0;
    // Side rails.
    float edge = min(vUv.x, 1.0 - vUv.x);
    a += (1.0 - smoothstep(0.04, 0.1, edge)) * 0.9;
    // Chevron dashes marching along the lane while it charges.
    float dash = step(0.5, fract(vUv.y * 9.0 + uTime * 2.2));
    a += dash * 0.18;
    // The advance front: fills from the far end toward you.
    a += step(1.0 - uFill, vUv.y) * 0.34;
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * Half-deck flood (dance's seesaw): one side fills with warning while a hard
 * rail burns along the centreline — the honest border — and chevrons march
 * toward the SAFE half: cross. The mesh is authored with u = 0 on the
 * centreline, u = 1 at the doomed rim.
 */
const HALF_FRAG = /* glsl */ `
  ${COMMON}
  void main(){
    vec3 col = warnColor();
    float a = 0.0;
    a += 0.05 + 0.55 * uFill;
    // The centreline rail — the honest border you must be across.
    a += (1.0 - smoothstep(0.0, 0.06, vUv.x)) * (0.25 + 0.75 * uFill);
    // Bands marching toward the centreline — CROSS HERE, the other half lives.
    float lane = fract(vUv.x * 5.0 + uTime * 2.4);
    float band = step(0.72, lane) * step(abs(fract(vUv.y * 3.0) - 0.5), 0.32);
    a += band * (0.1 + 0.25 * uFill);
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * Gate: the WHOLE deck floods EXCEPT one clear column — doorpost rails burn
 * at its edges and chevron streams march INTO it from both sides. The one
 * telegraph that says "stand HERE" on a line. uGap = column centre (u),
 * uHalf = half-width (u).
 */
const GATE_FRAG = /* glsl */ `
  ${COMMON}
  uniform float uGap, uHalf;
  void main(){
    vec3 col = warnColor();
    float d = vUv.x - uGap;
    float inGap = step(abs(d), uHalf);
    float a = 0.0;
    // The flood: everything OUTSIDE the column fills with the charge.
    a += (1.0 - inGap) * (0.1 + 0.5 * uFill);
    // Doorpost rails — the honest edges of the safe ground.
    a += smoothstep(0.045, 0.0, abs(abs(d) - uHalf)) * (0.35 + 0.65 * uFill);
    // Chevron streams marching INTO the gap from both sides.
    float band = step(0.68, fract(abs(d) * 9.0 + uTime * 2.3));
    a += band * (1.0 - inGap) * step(abs(fract(vUv.y * 4.0) - 0.5), 0.34) * 0.22;
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * Danger roof: a horizontal pane hung at the sweep line — the threat reads
 * as a CEILING over the whole deck, never as a wall about to bisect it.
 */
const ROOF_FRAG = /* glsl */ `
  ${COMMON}
  void main(){
    vec3 col = warnColor();
    float a = 0.10 + 0.40 * uFill;
    // Drift bands carry the swing's travel direction across the roof.
    float band = step(0.72, fract(vUv.x * 5.0 - uTime * 1.4));
    a += band * 0.13;
    a *= smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
    a *= smoothstep(0.0, 0.10, vUv.y) * smoothstep(1.0, 0.90, vUv.y);
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * Duck cascade: rows of downward-pointing chevrons pouring toward the floor
 * beneath a sweep blade — the shape ITSELF says "get under".
 */
const DUCK_FRAG = /* glsl */ `
  ${COMMON}
  void main(){
    vec3 col = warnColor();
    float vee = vUv.y * 5.0 + abs(vUv.x - 0.5) * 2.2 + uTime * 1.8;
    float row = smoothstep(0.42, 0.5, fract(vee)) * (1.0 - smoothstep(0.5, 0.58, fract(vee)));
    float a = row * (0.16 + 0.38 * uFill);
    a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

/** Blade: a horizontal slice hanging in the air — bright core line, soft body. */
const BLADE_FRAG = /* glsl */ `
  ${COMMON}
  void main(){
    vec3 col = warnColor();
    float mid = 1.0 - abs(vUv.y * 2.0 - 1.0); // 1 at the slice centre line
    float a = pow(mid, 3.0) * 0.75 + mid * 0.12;
    a *= 0.35 + 0.65 * step(vUv.x, uFill);
    a *= pulse();
    gl_FragColor = vec4(col, a);
  }
`;

function warnMat(frag: string, extra: Record<string, { value: number }> = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uFill: { value: 0 }, uTime: { value: 0 }, ...extra },
    vertexShader: VERT,
    fragmentShader: frag,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}

function makeTelegraph(meshes: Mesh[], mats: ShaderMaterial[]): Telegraph {
  const group = new Group();
  for (const m of meshes) {
    // Draw after the deck furniture — a warning that loses the depth fight
    // to a rim bolt is a warning nobody saw.
    m.renderOrder = 20;
    group.add(m);
  }
  return {
    group,
    update(fill, time) {
      for (const mat of mats) {
        mat.uniforms.uFill.value = fill;
        mat.uniforms.uTime.value = time;
      }
    },
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      for (const mat of mats) mat.dispose();
      group.removeFromParent();
    },
  };
}

/**
 * A strip flat on the deck: the BEAM's lane down a column (axis 'x' means
 * the lane is at a fixed x, running the deck's depth) or the crossfire
 * RAIL across a row. Place the group at the deck centre on the floor;
 * `at` is deck-local. The strip is drawn a touch wider than the judge cuts.
 */
export function stripTelegraph(
  axis: 'x' | 'z',
  at: number,
  laneWidth: number,
  runLength: number,
): Telegraph {
  const mat = warnMat(STRIP_FRAG);
  const strip = new Mesh(new PlaneGeometry(laneWidth, runLength), mat);
  if (axis === 'x') {
    // Lane at fixed x, running along z.
    strip.rotation.set(-Math.PI / 2, 0, 0);
    strip.position.x = at;
  } else {
    // Lane at fixed z, running along x (the rail's quarter turn, in-plane).
    strip.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    strip.position.z = at;
  }
  return makeTelegraph([strip], [mat]);
}

/**
 * Seesaw/surge: ONE HALF of the deck floods. `axis` picks the split
 * ('x' = east/west halves, 'z' = north/south), `side` the doomed half's
 * sign along that axis. `span` is the deck's full width across the split,
 * `run` its full length along it. Group at the deck centre on the floor.
 */
export function halfTelegraph(
  axis: 'x' | 'z',
  side: -1 | 1,
  span: number,
  run: number,
): Telegraph {
  const mat = warnMat(HALF_FRAG);
  const pane = new Mesh(new PlaneGeometry(span / 2, run), mat);
  pane.rotation.x = -Math.PI / 2;
  // Authored for +x (u = 0 at the centreline); mirror for −x, spin for z.
  if (axis === 'x') {
    pane.position.x = (side * span) / 4;
    pane.scale.x = side;
  } else {
    pane.rotation.z = Math.PI / 2;
    pane.position.z = (side * span) / 4;
    pane.scale.x = -side; // in-plane spin flips the u axis relative to +z
  }
  return makeTelegraph([pane], [mat]);
}

/**
 * The gate: a full-deck pane where everything fills EXCEPT one clear band
 * centred at `gapAt` (deck-local x), `gapHalfW` wide each side. Group at
 * the deck centre on the floor.
 */
export function gateTelegraph(
  halfWidth: number,
  halfDepth: number,
  gapAt: number,
  gapHalfW: number,
): Telegraph {
  const w = halfWidth * 2 + 0.3;
  const d = halfDepth * 2 + 0.2;
  const mat = warnMat(GATE_FRAG, {
    uGap: { value: (gapAt + w / 2) / w },
    uHalf: { value: gapHalfW / w },
  });
  const pane = new Mesh(new PlaneGeometry(w, d), mat);
  pane.rotation.x = -Math.PI / 2;
  return makeTelegraph([pane], [mat]);
}

/**
 * The sweep: danger lives IN THE AIR, never on the floor (floor paint means
 * "move your feet" in every other move; the sweep's answer is stay put and
 * DROP, so nothing on the ground contradicts it — dance's one sacred
 * exception, kept). A sandwich of danger roofs at the line and above head
 * height, two limbo rails pushed to the deck's front and back thirds, and a
 * chevron fringe dripping under each: get under HERE.
 */
export function sweepTelegraph(
  width: number,
  depth: number,
  bladeY: number,
  thickness: number,
  fromSide: 1 | -1,
): Telegraph {
  const meshes: Mesh[] = [];
  const mats: ShaderMaterial[] = [];
  for (const dy of [0, 0.55]) {
    const roofMat = warnMat(ROOF_FRAG);
    const roof = new Mesh(new PlaneGeometry(width, depth), roofMat);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = bladeY + dy;
    roof.scale.x = -fromSide;
    meshes.push(roof);
    mats.push(roofMat);
  }
  const zOff = depth * 0.28;
  const duckH = 0.42;
  for (const dz of [-zOff, zOff]) {
    const bladeMat = warnMat(BLADE_FRAG);
    const blade = new Mesh(new PlaneGeometry(width, thickness * 2), bladeMat);
    blade.position.set(0, bladeY, dz);
    blade.scale.x = -fromSide;
    const duckMat = warnMat(DUCK_FRAG);
    const duck = new Mesh(new PlaneGeometry(width * 0.85, duckH), duckMat);
    duck.position.set(0, bladeY - duckH / 2, dz);
    meshes.push(blade, duck);
    mats.push(bladeMat, duckMat);
  }
  return makeTelegraph(meshes, mats);
}
