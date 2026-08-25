// Scenery obeys energy; gameplay light never does (research/02 §6 — danger
// never competes with scenery). Everything obeys the throat fade. Materials
// register once; EnvironmentSystem applies the scalars each frame.

import type { MeshBasicMaterial, PointsMaterial } from '@iwsdk/core';

type Dimmable = MeshBasicMaterial | PointsMaterial;

interface Entry {
  mat: Dimmable;
  r: number;
  g: number;
  b: number;
  group: 'scenery' | 'gameplay';
}

const entries: Entry[] = [];

export function registerDim(mat: Dimmable, group: Entry['group']): void {
  entries.push({ mat, r: mat.color.r, g: mat.color.g, b: mat.color.b, group });
}

export function applyDim(energy: number, fade: number): void {
  const f = 1 - fade;
  const s = energy * f;
  for (const e of entries) {
    const k = e.group === 'scenery' ? s : f;
    e.mat.color.setRGB(e.r * k, e.g * k, e.b * k);
  }
}
