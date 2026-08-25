import { createSystem, InputComponent } from '@iwsdk/core';
import { BODY } from '../config';
import { G } from '../state';

// The body is the controller: head position and nothing else decides
// standing, stepping and ducking. The camera under `world.player` reports
// play-area coordinates in XR and out of it, so one read serves both.
export class BodySystem extends createSystem({}) {
  private squeezeHeld = 0;

  update(dt: number): void {
    const b = G.body;
    b.presenting = this.world.session !== undefined;
    const cam = this.camera;
    b.x = cam.position.x;
    b.z = cam.position.z;
    b.y = cam.position.y;

    // Crouch calibration, shape-for-shape from dance (research/01 §3):
    // instant attack, glacial release, hard floor. You can't fake tall, and a
    // set spent crouching never quietly lowers the bar.
    if (b.y > b.standingHeight) b.standingHeight = b.y;
    else
      b.standingHeight = Math.max(
        BODY.standingFloor,
        b.standingHeight - dt * BODY.standingRelease,
      );
    b.ducked = b.y < b.standingHeight * BODY.duckFrac;

    // The ghost-overlay toggle is the one deliberate break of the no-buttons
    // dogma, like Johansen's menu button (research/03 §5): hold a squeeze for
    // a second (or tap G on a keyboard). The set is finishable without it.
    const pad = this.input.xr.gamepads.left ?? this.input.xr.gamepads.right;
    if (pad?.getButtonPressed(InputComponent.Squeeze)) {
      this.squeezeHeld += dt;
      if (this.squeezeHeld > 1) {
        this.squeezeHeld = -0.6; // require release-ish gap before re-toggle
        G.ghosts = !G.ghosts;
      }
    } else {
      this.squeezeHeld = Math.max(0, this.squeezeHeld - dt * 4);
    }
    if (this.input.keyboard.getKeyDown('KeyG')) G.ghosts = !G.ghosts;
  }
}
