// STEPWELL — a rhythm descent for a 2 × 2 m room.
//
// The rig transform is owned by one system and driven by one idea: the
// tracked platform is static relative to the physical play area, and the
// well does the walking. Locomotion, grabbing and physics are all off — the
// SDK's own locomotion answers a question this experience refuses to ask.

import { Color, SessionMode, World } from '@iwsdk/core';
import { conductor } from './conductor';
import { PLATFORMS, validateScore } from './score';
import { G } from './state';
import { BodySystem } from './systems/BodySystem';
import { CallPlateSystem } from './systems/CallPlateSystem';
import { ConductorSystem } from './systems/ConductorSystem';
import { DesktopPreviewSystem } from './systems/DesktopPreviewSystem';
import { EmberSystem } from './systems/EmberSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { FrameOfReferenceSystem } from './systems/FrameOfReferenceSystem';
import { HazardSystem } from './systems/HazardSystem';
import { PlatformSystem } from './systems/PlatformSystem';
import { ValidationSystem } from './systems/ValidationSystem';
import { WayfindSystem } from './systems/WayfindSystem';

const params = new URLSearchParams(location.search);
const PROBE = params.has('probe');
const EMU = params.has('emu');

async function boot(): Promise<void> {
  if (EMU) {
    // Emulated headset (IWER) for desktop XR smoke tests: ?emu
    const { XRDevice, metaQuest3 } = await import('iwer');
    const device = new XRDevice(metaQuest3);
    device.installRuntime({ forceInstall: true });
    (window as unknown as Record<string, unknown>).__XRDEVICE = device;
  }

  const world = await World.create(
    document.getElementById('scene-container') as HTMLDivElement,
    {
      xr: {
        sessionMode: SessionMode.ImmersiveVR,
        offer: PROBE || EMU ? 'none' : 'once',
        features: { handTracking: true },
      },
      features: {
        locomotion: false,
        grabbing: false,
        physics: false,
        sceneUnderstanding: false,
        spatialUI: false,
      },
    },
  );

  world.scene.background = new Color(0x000000);

  validateScore();
  world
    .registerSystem(ConductorSystem, { priority: 10 })
    .registerSystem(BodySystem, { priority: 11 })
    .registerSystem(PlatformSystem, { priority: 12 })
    .registerSystem(FrameOfReferenceSystem, { priority: 13 })
    .registerSystem(HazardSystem, { priority: 14 })
    .registerSystem(CallPlateSystem, { priority: 15 })
    .registerSystem(WayfindSystem, { priority: 16 })
    .registerSystem(EmberSystem, { priority: 17 })
    .registerSystem(EnvironmentSystem, { priority: 18 })
    .registerSystem(ValidationSystem, { priority: 19 });
  if (!PROBE) world.registerSystem(DesktopPreviewSystem, { priority: 9 });

  wireDom(world);
  if (PROBE) exposeProbe(world);
  (window as unknown as Record<string, unknown>).__STEPWELL_XR = {
    tracked: () => G.tracked,
    presenting: () => G.body.presenting,
  };
}

function wireDom(world: World): void {
  const button = document.getElementById('enter-vr') as HTMLButtonElement;
  const hint = document.getElementById('hint')!;
  hint.textContent =
    'flat preview — WASD step · drag to look · C duck · G shows how the well thinks';
  navigator.xr
    ?.isSessionSupported('immersive-vr')
    .then((ok) => {
      if (ok) button.hidden = false;
    })
    .catch(() => {});
  button.addEventListener('click', () => {
    conductor.unlock();
    world.launchXR();
  });
}

// The probe (headless Chromium) steps the world by hand: deterministic bars,
// deterministic platforms, real handover logic — and renderer.info to hold
// the research/02 budgets to account.
function exposeProbe(world: World): void {
  world.renderer.setAnimationLoop(null);
  let time = 0;
  const debug = {
    world,
    G,
    conductor,
    ids: PLATFORMS.map((p) => p.id),
    claims: PLATFORMS.map((p) => p.claim.map((sq) => [sq[0], sq[1]])),
    step(n = 1, dt = 1 / 72): void {
      for (let i = 0; i < n; i++) {
        time += dt;
        world.update(dt, time);
      }
    },
    render(): { calls: number; triangles: number } {
      world.renderer.render(world.scene, world.camera);
      const r = world.renderer.info.render;
      return { calls: r.calls, triangles: r.triangles };
    },
    setBody(x: number, z: number, y = 1.7): void {
      world.camera.position.set(x, y, z);
    },
    events(): string[] {
      return G.events.slice();
    },
    warp(bars: number): void {
      conductor.warp(bars);
    },
  };
  (window as unknown as Record<string, unknown>).__STEPWELL = debug;
}

void boot();
