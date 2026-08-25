# VOIDSTEP

A **parkour circuit through the void**, for a 2 × 2 m room, built on
`@iwsdk/core`. The consolidation the two repos kept pointing at, made one
experience:

- **The movement is [stepwell](../stepwell/)'s** — Eye of the Temple's
  frame-of-reference mechanic on a rhythm grid: one tracked platform pins
  your real floor to the world, machines run on bar-quantized loops, and
  every traversal is a pair of opposed real steps netting to zero —
  **simplified**. The sliding parts are gone: handover is clean or it is a
  slip, and the world never moves under your feet except by riding.
- **The world is [dance](https://github.com/yellkell/dance)'s** — RAVE
  RAID's VOID, cloned: near-black gloss and pure emission, tower rings
  breathing on the kick, a parallax skyline, a truss and six great arcs
  overhead, dust, a horizon with no land under it — and THE MIRROR, every
  light doubled in black glass for one extra draw per bank. The route's own
  decks mirror too: the circuit hangs over its own reflection all the way
  round.
- **The attacks are dance's too** — six moves stolen from the GOOPLIATH's
  vocabulary and thrown at your deck mid-ride, in the same amber→red
  telegraph language, to keep the body moving: the two games share one
  grammar, and a night in either trains you for the other.

## The circuit

You stand on the home pad at the arena's heart. The route rides **out**
east on a runner, **up** the lift (duck its sweep on the way), **across
THE SKYWALK** — a wide deck traversing the void at height, where the volley
lands — then **down** the drop and **home** on the west runner. The lap is
geometrically closed: the last step east repays the first, and the body
ends the circuit exactly where it began. There are **no buttons, no
sticks, no locomotion interface** — stepping between platforms is the
entire game. (One dogma break, inherited: squeeze, or G on desktop,
toggles the ghost-overlay authoring view.)

## The moves (and their answers)

All six are dance's, resized for a 2 × 2 deck; charges are dance's own
beat counts, landings always hit bar downbeats, and no verb repeats back
to back:

| Move | The tell | Your answer |
| --- | --- | --- |
| **BEAM** | a strip fills down one column of your deck | **sidestep** off the lane |
| **RAIL** | the crossfire cousin: a strip across one row | **step forward or back** off it |
| **SEESAW** | one half floods, a hard rail burns on the centreline | **cross** the centreline |
| **SURGE** | the seesaw's front/back cousin | **cross**, the other way |
| **GATE** | the whole deck floods except one clear band, doorposts + chevrons pointing in | **stand in the gap** |
| **SWEEP** | a blade hangs at chest height, chevrons cascading downward — and the floor stays dark | **duck** — and hold it |

The telegraph is the whole instruction: whatever fills amber→red, don't be
in it. The sweep is the one deliberate exception and hangs its threat in
the AIR — floor paint means "move your feet" everywhere else, so the move
whose answer is *stay put and drop* never paints the ground you should
stay on. All of it lands on ground that is itself in motion: Johansen's
two unbuilt verbs — duck and dodge on a moving platform — extended to
dance's whole verb table.

Only a **ridden** deck judges. A clean dodge feeds your **flow** (the
world blooms with it, an arp layer fades in); a clip kills it and ducks
the whole mix dark for a beat. Standing on ground that departs without
you being tracked on it is a **slip** — a miss, never a slide.

## What "simplified" means, precisely

Stepwell implements Johansen's full handover law, including the forced
switch: ground already leaving takes the frame with it, and a correction
term drains over ~1 s, visibly *sliding* the platform back into place
under your feet. That slide is the one moment stepwell's world moves on
its own — and it's the part we didn't like. VOIDSTEP deletes it:

- `rig = anchor(tracked)`. No correction term exists in the state at all.
- Handover happens **only** when a platform's anchor agrees with the live
  rig (within 2.5 cm) — the clean case, where the switch instant moves
  nothing.
- Ground departing under an untracked body is a **slip**: flow dies, the
  thud lands, the frame holds. The score authors every legal step onto
  aligned ground, so the slip is always a missed step, and it reads as one.

Everything else survives whole: the gated handover for incoming ground,
the head-tile ownership with hysteresis and debounce, yaw never changing,
the paired step, `bounded-floor` as validation-never-adaptation, and the
whole countdown grammar (corner posts dying one per beat, wrapping rims,
the deck wash, the audible ticks).

## Quick start

```bash
npm install
npm run dev          # → http://localhost:8082
```

- **Quest browser**: open the page, tap **ENTER THE VOID** → full VR. Your
  home pad appears under your feet with the void all around.
- **Desktop**: WASD steps the body around the play area, drag looks, C
  ducks, G shows the ghost overlays.

## Verification

`npm run probe` boots the built app in headless Chromium and rides the
whole circuit itself (stepwell's discipline; dance's Playwright instinct):

- the paired step, clean handovers moving nothing, the incoming gate held
- **the slip**: ground departing under an untracked body never takes the
  frame, the rig holds still to the millimetre, the miss is charged —
  and no `switch:*:slide` event can ever appear
- the lift's sweep ducked; the skywalk's six-move volley dodged clean with
  flow carried; the drop's sweep taken standing and charged as a clip
- energy ducking the scenery while a telegraph owns the ridden deck
- the circuit closing at centre with the body centred — the ledger
- draw calls and triangles against the research/02 budgets, mid-show too
- an emulated-headset pass (IWER): real `immersive-vr` session, handover
  driven by walking the emulated head

**38/38 checks pass; 56 draw calls, ~29 k triangles** (budgets ≤ 60 and
≤ 100 k, research/02 §8).

## Project map

```
src/
  config.ts            every tunable: grid, rig, attacks, hues, energy
  score.ts             THE CIRCUIT: platforms, loops, claims + THE VOLLEY
  state.ts             the one mutable singleton
  conductor.ts         the clock + the procedural kit (drone climbs as you do)
  lib/banks.ts         instancing + the buffer-sharing mirror (stepwell)
  lib/voidkit.ts       THE VOID's build language (dance, cloned whole)
  lib/telegraphs.ts    the attack shader kit (dance, trimmed to six moves)
  lib/dimmer.ts        scenery obeys energy; gameplay light never does
  lib/textures.ts      canvas-painted textures; no assets ship
  systems/             Conductor · Body · Platform · FrameOfReference ·
                       Attack · Wayfind · Void · Validation · DesktopPreview
probe/run.mjs          the headless ride-through
```

`DESIGN.md` traces every decision to its source — stepwell, dance, or the
research notes in [`../research/`](../research/).
