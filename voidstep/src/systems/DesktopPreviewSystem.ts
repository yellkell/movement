import { createSystem } from '@iwsdk/core';
import { conductor } from '../conductor';
import { G } from '../state';

// Flat preview: the keyboard drives the *body*, not a vehicle — WASD steps
// around the play area, C crouches, drag looks. The mechanic being previewed
// is real walking, so the preview simulates the walker, never a fly-cam.
export class DesktopPreviewSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private crouching = false;
  private unlocked = false;

  init(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.unlock();
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointerup', () => (this.dragging = false));
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging || G.body.presenting) return;
      this.yaw -= e.movementX * 0.004;
      this.pitch = Math.max(
        -1.4,
        Math.min(1.4, this.pitch - e.movementY * 0.004),
      );
    });
    window.addEventListener('keydown', () => this.unlock());
    this.camera.rotation.order = 'YXZ';
  }

  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    conductor.unlock();
  }

  update(dt: number): void {
    if (G.body.presenting) return;
    const kb = this.input.keyboard;
    const cam = this.camera;
    cam.rotation.set(this.pitch, this.yaw, 0);

    let mx = 0;
    let mz = 0;
    if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) mz -= 1;
    if (kb.getKeyPressed('KeyS') || kb.getKeyPressed('ArrowDown')) mz += 1;
    if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) mx -= 1;
    if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) mx += 1;
    if (mx !== 0 || mz !== 0) {
      const n = 1.4 * dt * (1 / Math.hypot(mx, mz));
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      // Step in the direction faced, but the floor is the play area: clamp
      // to a hair beyond the grid — the simulated room is 2 × 2 m too.
      cam.position.x += (mx * cos + mz * sin) * n;
      cam.position.z += (mz * cos - mx * sin) * n;
      cam.position.x = Math.max(-1.05, Math.min(1.05, cam.position.x));
      cam.position.z = Math.max(-1.05, Math.min(1.05, cam.position.z));
    }

    if (kb.getKeyDown('KeyC')) this.crouching = !this.crouching;
    const targetY = this.crouching ? 1.02 : 1.7;
    cam.position.y += (targetY - cam.position.y) * Math.min(1, dt * 10);
  }
}
