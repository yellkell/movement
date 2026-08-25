# STEPWELL — design notes

A rhythm descent for a 2 × 2 m room, built on `@iwsdk/core`. This document
traces every load-bearing decision to the research in
[`../research/`](../research/); the experience is the research notes made
walkable. Nothing here is invented that the notes didn't already argue for —
the one genuinely new thing is the *combination*, which is exactly the gap
[`01 §5`](../research/01-vr-movement-mechanics.md) said was empty:

> **Dynamic room-scale on a rhythm grid.** … a platform whose travel is
> quantized to bars and telegraphed in the amber→red fill language is the
> obvious unbuilt thing: **the floor itself as a move.**

## What it is

You stand in a 2 × 2 m play area. A stepwell — a long trench of galleried
storeys descending to water, a real architectural form — falls away ahead of
you. Ferries, an elevator, a barge and a raft run on set loops, quantized to
musical bars. You traverse the entire well by *stepping sideways, forward and
back between platforms*, never leaving your room: the platform you stand on
is pinned to your real floor, and when it travels, **the well does the
walking**. Mid-ride, gates grown from the architecture ask the two verbs
Johansen himself lists but never made rhythmic: *duck under an obstacle while
on a moving platform, dodge to the side while on a moving platform* — dance's
`sweep` and `beam`, on ground that is itself in motion
([`03 §5, §8`](../research/03-eye-of-the-temple.md)). At the water, the raft
holds, the world fades — and the well begins again.

There are **no buttons, no sticks, no locomotion interface**. One deliberate
dogma break, mirroring Johansen's menu button: holding a squeeze (or tapping
G on desktop) toggles the ghost-overlay authoring view. The set is completely
finishable without it.

## The mechanism, faithfully

From [`03 §2`](../research/03-eye-of-the-temple.md), implemented in
`src/systems/FrameOfReferenceSystem.ts`:

- **One tracked platform at a time.** Each platform claims squares of the
  3 × 3 grid over the play area (pitch 0.66 m) and owns an **anchor** — the
  rig pose that pins it to its claim. While tracked: `rig = anchor`. A moving
  tracked platform carries the whole world past a stationary body.
- **The paired step.** Consecutive platforms share an anchor at handover, so
  every traversal is a pair of opposed real steps netting to zero. The score
  (`src/score.ts`) authors this *by construction*: each platform's anchor
  chain starts where the previous one ends. The probe walks the full route
  and asserts the body ends centred.
- **Handover is gated, not immediate.** A platform may take tracking only
  when its anchor sits within 2.5 cm of the live rig. Standing on an
  *incoming* platform early does nothing — the frame holds until alignment,
  Johansen's own refinement that halved his correction cases. Ground that is
  *leaving* with you aboard forces the switch, and the correction — the rig
  offset at the instant of switch — drains over ~1 s, sliding the platform
  into place under your feet with no jump at the switch instant.
- **Yaw never changes.** His articles never describe rotational redirection
  ([`03 §10`](../research/03-eye-of-the-temple.md)); we resolve that open
  question the conservative way. Orientation is purely authored geometry.
- **Two aligned platforms at once** (his other open question): the head's
  tile owns tracking, the current platform keeps a wider skirt (hysteresis),
  and switches debounce over three frames.

## The rhythm layer — what's new here

`src/conductor.ts` owns one clock. Platform loops are authored in bars
(`keys: [{bar, anchor}]`), so departures always land on bar lines — his
platforms ran on set loops and read as *"almost turn-based"*; ours run on
**musical** loops because we are that genre
([`03 §8`](../research/03-eye-of-the-temple.md): he borrowed from Lara Croft
Go; the clockwork that limits an adventure game is a rhythm game's native
grammar). The ground itself speaks dance's telegraph language
([`01 §3`](../research/01-vr-movement-mechanics.md)):

- **cyan rim** — still and aligned: step now
- **amber rim, filling through the final dwell bar** — this ground is about
  to stop being yours
- **red rim** — riding; never step on red
- a beam's doomed lane **burns amber→red on the deck itself** — the floor is
  the instruction

Judging follows dance's laws: the sweep pane renders at 1.26 m, *below* where
the judge cuts (`duckFrac 0.78` of calibrated standing height) — render
stricter than you score. Crouch calibration is dance's filter shape-for-shape:
instant attack, ~15 mm/s release, hard floor at 1.1 m.

The audio is procedural (no assets ship, like all of dance): kick/hats on the
grid, a drone whose root **descends as the rig descends** — the audio cousin
of inverse locomotion ([`01 §6`](../research/01-vr-movement-mechanics.md)) —
chimes and an arp layer that fade in with flow, and a full-mix duck on a hit
so a miss is audible as absence.

## The cooperation layer

- **Foot fences** ([`03 §2.4`](../research/03-eye-of-the-temple.md)): every
  deck edge grows a low rail *except* where a step is authored. Purely
  visual, prevents nothing, dimmer than any telegraph — a suggestion, not a
  light. They double as the rest frame that makes riding comfortable.
- **Ghost overlays** ([`03 §3`](../research/03-eye-of-the-temple.md)): every
  platform is stamped with the play-area pattern crop of its claim — thick
  border, centre circle — at **both ends of its travel**. Correctness is a
  picture: if neighbouring patterns tile like puzzle pieces, the level works.
  Shipped as a toggle, because the authoring view *is* interesting — "see
  how the well thinks."
- **The one instruction**, ~3 m out on an angled panel, four lines. Embodied
  movement doesn't have to be learned ([`03 §5`](../research/03-eye-of-the-temple.md));
  everything else the body already knows.
- **`bounded-floor` as validation, never adaptation**
  ([`01 §4`](../research/01-vr-movement-mechanics.md), `03 §8.4`): the score
  is authored against a fixed 2 × 2 m minimum, exactly as Johansen argues.
  The one thing neither exemplar ships: on session start we read the real
  play-area polygon, and if it can't hold the grid, we *say so* — before the
  set, not when someone punches a wall.

## The environment — the 02 ladder, in order

`src/systems/EnvironmentSystem.ts`, per
[`02`](../research/02-environments-quest3.md):

1. **The mirror.** The water at the bottom is dance's mirror trick: every
   instanced bank gets a flipped clone **sharing the live instance buffers**
   — one extra draw per bank, no second camera, no render target, no
   resolve. The reflection animates for free, platforms included, and it is
   what makes the well read as continuing below the water. The mirror is
   *diegetic* — stepwells end in water.
2. **Depth in layers.** Parapet light-lines and gallery slabs every storey
   (near), recessed alcoves behind the wall line (mid), full-height columns
   and the mouth rim (far), dust and two narrow light shafts (air). The
   trench is long, so the whole descent is visible from the threshold: see
   something far away, then make your way there with your own feet — the
   family's whole prize ([`03 §7`](../research/03-eye-of-the-temple.md)).
3. **Structure, not sticks.** Silhouette / panel / pinprick: columns and
   slabs / parapet lines / porthole rows pulsing per-instance on the beat.
4. **The negative rule.** Above the mouth, the sky is black. A line with a
   short glow, never a wall.

No post-processing. No real lights — box faces carry baked vertex shading;
everything luminous is emissive colour, saturated colour is reserved for
light, and amber→red belongs to gameplay alone. Everything repeated is an
`InstancedMesh`; every animated glow is per-instance colour. The **energy**
input dims scenery while a telegraph owns the deck (danger never competes
with scenery) and blooms with flow.

**Measured by the probe, per the 02 checklist: 22 draw calls, ~10.5 k
triangles** — against budgets of ≤ 60 and ≤ 100 k. (dance's whole set world
is 48 draws; the well is leaner still.)

## The loop

The raft settles onto the water; standing it for two bars fades the world —
**the throat** — and the set restarts at bar zero on the threshold jetty.
The seam hides in darkness, the one lesson taken from folded space
([`01 §2`](../research/01-vr-movement-mechanics.md)): a seam is cheap where
there is no vista. The threshold jetty has two tiles so the raft's final
+north step is repaid by the −south step after rebirth — **the ledger closes
across the whole loop**, not just each ride.

## What was deliberately not built (and why)

- **Portals / folded space** — [`01 §2`](../research/01-vr-movement-mechanics.md)
  concludes the trade (travel for vista) is wrong for an environment built on
  distant layers. Only the hide-the-seam lesson survives, in the throat.
- **Translation gain** — flagged in `01 §5` as testable-but-possibly-terrible;
  it needs a headset A/B, not a first build.
- **Adapting to the player's room** — Johansen's argument
  ([`03 §1`](../research/03-eye-of-the-temple.md)) holds: every constraint
  would become a function of room size. Validation only.
- **The roller / drift pump** — the sharpest unbuilt idea in the notes
  ([`03 §8`](../research/03-eye-of-the-temple.md)): a cylinder converts a
  rate into a walk; give the rate a tempo and the groove moves into the feet.
  It needs continuous-tracking work the gated handover doesn't cover. Next.
- **Hands** — dance's groove trickle stays out so the first build stays a
  feet-and-head instrument. Gem arcs (with EotT's double constraint and
  procedural placement) are the natural second instrument.

## Verification

`npm run probe` boots the built app in headless Chromium and walks the
mechanic itself (the same instinct as dance's Playwright probes — invariants
checked against the live app):

- paired step onto and off the ferry, rig continuity at both handovers, net
  body displacement zero
- the gate: an incoming misaligned platform, head on its deck, refused
  tracking
- the forced switch: leaving ground takes the frame, correction drains to
  alignment with no jump at the switch instant
- sweep judged: standing = hit, ducked = clear, flow rewards
- the throat: rebirth to bar zero, threshold tracked, rig at origin
- budgets: draw calls and triangles against the 02 checklist
- an emulated-headset pass (IWER): real `immersive-vr` session, handover
  driven by walking the emulated head across the play area

26/26 checks pass at time of writing.
