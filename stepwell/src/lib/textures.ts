// No image assets ship (research/02 §5): every texture is painted at runtime
// onto a canvas. Deterministic — no RNG in any of these.

import {
  CanvasTexture,
  DoubleSide,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';

// The play-area pattern, exactly as Eye of the Temple draws it: a thick
// border along the play-area edge and a thick circle at the centre
// (research/03 §3). Platforms show the crop of the square they claim; the
// ghost overlays make level-design correctness a picture you look at.
export function patternTexture(): CanvasTexture {
  const size = 768;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  const stroke = size * 0.035;
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = stroke;
  g.strokeRect(stroke * 0.75, stroke * 0.75, size - stroke * 1.5, size - stroke * 1.5);
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.13, 0, Math.PI * 2);
  g.stroke();
  // Faint seams marking the nine squares, so a single-square crop still reads.
  g.lineWidth = size * 0.006;
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  for (let i = 1; i < 3; i++) {
    g.beginPath();
    g.moveTo((size / 3) * i, 0);
    g.lineTo((size / 3) * i, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, (size / 3) * i);
    g.lineTo(size, (size / 3) * i);
    g.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export interface PanelSpec {
  title?: string;
  lines: string[];
  small?: string;
  width: number; // metres
  color?: string;
}

// Text panels are canvas-painted planes; UI sits ~3 m away (research/02 §6).
export function textPanel(spec: PanelSpec): Mesh {
  const W = 1024;
  const pad = 64;
  const titleSize = 110;
  const lineSize = 54;
  const smallSize = 34;
  const lineGap = 26;
  let h = pad * 2;
  if (spec.title) h += titleSize + 40;
  h += spec.lines.length * (lineSize + lineGap);
  if (spec.small) h += smallSize + 30;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, h);
  g.fillStyle = 'rgba(3,10,14,0.72)';
  g.fillRect(0, 0, W, h);
  g.strokeStyle = 'rgba(42,255,212,0.5)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, h - 6);

  const color = spec.color ?? '#9adfe8';
  let y = pad;
  g.textAlign = 'center';
  if (spec.title) {
    g.fillStyle = '#2affd4';
    g.font = `bold ${titleSize}px "Segoe UI", system-ui, sans-serif`;
    g.fillText(spec.title, W / 2, y + titleSize * 0.8);
    y += titleSize + 40;
  }
  g.fillStyle = color;
  g.font = `${lineSize}px "Segoe UI", system-ui, sans-serif`;
  for (const line of spec.lines) {
    g.fillText(line, W / 2, y + lineSize * 0.8);
    y += lineSize + lineGap;
  }
  if (spec.small) {
    g.fillStyle = 'rgba(154,223,232,0.6)';
    g.font = `${smallSize}px "Segoe UI", system-ui, sans-serif`;
    g.fillText(spec.small, W / 2, y + smallSize * 0.9);
  }

  const tex = new CanvasTexture(c);
  tex.anisotropy = 4;
  const mesh = new Mesh(
    new PlaneGeometry(spec.width, (spec.width * h) / W),
    new MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  return mesh;
}
