# STEPWELL

**The well went dark — bring the light up from the water.** A rhythm
descent-and-return for a 2 × 2 m room — dynamic room-scale locomotion (Eye
of the Temple's frame-of-reference mechanic) on a musical grid, built on the
Immersive Web SDK (`@iwsdk/core`). The design rationale, mapped
line-by-line to the research in [`../research/`](../research/), is in
[`DESIGN.md`](DESIGN.md).

You never leave your room and you never touch a stick. Ferries, an
elevator, a mid-air relay, a two-column paternoster, a drum you walk like a
crank and a raft wind you down the trench's east side to the water; the
ember rises for a held stand, and the west side carries you home while
every storey you pass takes the light back. Corner posts count each
departure down beat by beat; a breathing circle shows the next ground;
berth brackets mark ground still on its way. Duck the low light, keep a
lane free, stand the glyph to summon the slow machines — and dock the
ember to light a brazier and begin again. The loop is geometrically
closed: the ascent ends on the anchor the descent left.

## Run it

```bash
npm install
npm run dev        # http://localhost:8081 — flat preview + Enter VR
```

- **Headset (Quest, browser):** the dev server must be reachable over https
  for WebXR — easiest is `npx vite --host` behind a tunnel, or deploy `dist/`
  to any static host. On Quest Browser the session is auto-offered.
- **Flat preview:** WASD steps your body around the simulated play area,
  drag looks, `C` crouches, `G` toggles the ghost-overlay authoring view
  (in VR: hold a squeeze for a second).
- **Emulated headset:** append `?emu` to run against IWER's emulated Quest 3.

## Verify it

```bash
npm run build
npm run probe      # headless Chromium: walks the mechanic, checks budgets
```

The probe rides the route itself: paired steps, the gated handover, the
slide correction, the sweep judge, the throat rebirth — plus draw-call and
triangle budgets, and an emulated-XR session pass. See the tail of
[`DESIGN.md`](DESIGN.md).

## Layout

```
src/config.ts        every tunable, with research citations
src/score.ts         the authored route: claims, anchors, loops, gates
src/conductor.ts     the one clock: transport + procedural audio (no assets)
src/state.ts         shared game state singleton
src/systems/         ConductorSystem · BodySystem · PlatformSystem
                     FrameOfReferenceSystem · HazardSystem
                     EnvironmentSystem · ValidationSystem · DesktopPreviewSystem
src/lib/             instanced banks + the mirror trick · canvas textures · dimmer
probe/run.mjs        the headless walkthrough
```
