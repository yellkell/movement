# VR movement mechanics — the field, and where we sit in it

Research notes. Nothing is being built yet; this is the map.

The question underneath all of it: **who owns the transform between the
player's real floor and the virtual world, and when is that transform allowed
to change?** Every locomotion scheme in VR is an answer to that one question,
and the answers sort into five families.

| # | Family | Real body | Rig transform | Comfort cost | Bounded by | Exemplar |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Artificial** | still | moves continuously | high (vection) | nothing | slide / smooth turn |
| 2 | **Discrete** | still | jumps | low | line of sight | teleport / snap turn |
| 3 | **Pure room-scale** | moves 1:1 | fixed | none | the real room | RAVE RAID |
| 4 | **Dynamic room-scale** | moves 1:1 | re-anchored per platform | low–moderate | nothing (in principle) | **Eye of the Temple** |
| 5 | **Folded space** | moves 1:1 | fixed; the *world* is non-Euclidean | none–low | nothing (in principle) | **Spellbound Spire** |

Families 1 and 2 are what every SDK ships, including the one we build on.
Families 3–5 are where the interesting design is, and 4 and 5 are the two
worth studying hardest because they are the only ones that get **unbounded
virtual travel out of a 2 × 2 m room with no vestibular lie.**

There is also a sixth trick, which we appear to have invented by accident and
which nobody else seems to run — see [Inverse locomotion](#6-inverse-locomotion-the-trick-we-already-have) below.

---

## 1. Eye of the Temple — dynamic room-scale

Rune Skovbo Johansen, 2021 (PC VR) / 2023 (Quest 2, co-developed with Salmi
Games). Road to VR's 2021 Excellence in Locomotion award. The deep dive lives
in [`03-eye-of-the-temple.md`](03-eye-of-the-temple.md); this is the mechanism
in one page.

**The claim:** you traverse a huge vertical temple entirely on your own feet,
with no teleport, no stick, no artificial locomotion of any kind, inside a
**2 m × 2 m** play space with 360° tracking.

**The mechanism — the frame of reference.** The virtual world is a grid of
platforms. Every platform has a **designated spot in the play area** —
generally one square of a notional 3 × 3 grid laid over the player's real
floor (a larger platform claims several squares). The *frame of reference* —
the slice of virtual space that the physical play area is currently mapped
to — **follows whichever platform you are standing on.** Step from platform A
to platform B and the tracking hands over: the mapping re-anchors to B, and B's
designated spot becomes where you now are in the real room.

Two consequences fall straight out of that:

- **A moving platform carries the whole world with it.** Ride a platform that
  travels 6 m across a chasm and your real body has not moved at all; the
  world moved under a frame of reference that is welded to the platform. This
  is what buys the vertical, expansive temple.
- **Level design becomes a constraint solver.** Because every platform
  declares which real-floor square it occupies, the *virtual* adjacency of two
  platforms determines the *physical* step the player must take. Authoring a
  route is authoring a walk. Johansen built a **pattern overlay** — a texture
  representing the whole play area, thick white border at the edge, thick
  circle in the centre — and stamped it on every platform, so he could see at
  a glance which real square each one claimed. The design tool is a texture.

**The roller — a boundary pump.** The signature object is the rolling
cylinder. To stay on top of a rolling log you have to **backpedal**, exactly
as you would on water. That is not flavour; it is a *drift control*. A roller
is a mechanism that consumes real-floor travel in a chosen direction while
producing virtual travel in the opposite one — the developer's way of pushing
the player back off the guardian edge without the player ever perceiving a
correction. Step left in your room to board a platform, and the sequence will
soon require you to step right. Walk backwards on a barrel and you will
shortly be asked to walk forwards. The level *is* the redirection.

**Where it strains.**

- The alignment between the outgoing and incoming platform matters at the
  handover, though it is forgiving — a slightly misaligned step does not break
  the game, it just shifts you within the play area.
- The floor is a hard 2 × 2 m + 360°. That excludes a large share of headset
  owners outright, and it is the most common criticism of the game.
- PC VR headsets position the play space optimally on their own; **Quest needs
  a manual recentre** (hold the left Meta button) if the player has drifted.
  The elegance is not fully automatic.
- Riding moving platforms is still visual motion your body is not producing.
  The vestibular system tolerates it far better than stick locomotion, but
  it is not free.
- The design's own gravity: a clockwork, almost turn-based feel. Some
  reviewers found the mechanic more compelling as a demo than as a game — the
  locomotion constraint crowds out puzzle, narrative and environmental variety.

**The lesson for us.** The trick is not "moving platforms". The trick is that
**the play-area mapping is a first-class, authored, per-object property**, and
level design is downstream of it. Anyone copying the platforms without
copying the constraint discipline gets a game that walks you into a wall.

---

## 2. Spellbound Spire — folded space

Breda University of Applied Sciences student team (~25 people, 20 weeks,
finished June 2020), free on Steam. A magical tower in 12th-century al-Andalus.

**The claim:** walk the **entire game** in one continuous physical path,
never leaving a **2 m × 2 m** play space, with no locomotion input at all.

**Two mechanisms, stacked:**

1. **Non-Euclidean portals.** Seamless portal traversal (they specifically
   solved hands and carried objects passing through), holding 90+ fps. Rooms
   overlap in physical space; the portal is the seam that hides it. Walk
   through and the world's topology has changed, but your body just kept
   walking.
2. **"Boosted room-scale" — translation gain.** The player traverses a
   **3 × 3 m virtual space using a 2 × 2 m real one**. That is a 1.5× movement
   gain: your real 1 m step becomes a virtual 1.5 m step. Applied uniformly,
   this is the cheapest redirected-walking technique there is, and at 1.5× it
   is well past the classical "imperceptible" thresholds but evidently
   acceptable in practice when the geometry backs it up.

The team also cite a UX finding that drove the whole design: **the average VR
player's play space is about 2 × 2 m.** That number is the design's axiom, and
it is the same number Eye of the Temple landed on independently.

**A supporting mechanic worth noting:** the "corruption grid" — a spreading
hazard that disables your glove powers and destroys objects it touches — is
partly a *level-design gate*: it stops you carrying items between rooms. In a
folded space where rooms physically overlap, an object carried across a portal
is a correctness problem as much as a design one. The hazard is the fence.

**The research this rests on.** Suma et al., *Impossible Spaces: Maximizing
Natural Walking in Virtual Environments with Self-Overlapping Architecture*
(IEEE TVCG 18(4), 2012) is the canonical grounding. Its headline numbers are
worth memorising:

- Reasonably small virtual rooms can **overlap by up to ~56%** before users
  begin to detect the impossibility.
- Larger rooms expanded to fill a 9.14 × 9.14 m workspace tolerate **~31%**
  overlap.
- Users judge distances into adjacent overlapping rooms **as if the space were
  uncompressed**, even at overtly noticeable overlap levels.
- The illusion is markedly stronger when users are naive to the manipulation.

That last point is a design constraint, not a footnote: telling the player
"this space is impossible" costs you the effect.

---

## 3. RAVE RAID (`dance`) — pure room-scale, taken to the limit

Our own shipped system, and the most extreme position on the board: **the rig
transform is never allowed to move during play, at all.**

`src/main.ts` boots the IWSDK world with:

```ts
features: { grabbing: false, locomotion: false, spatialUI: false }
```

The entire IWSDK locomotion stack — slide, teleport, turn, the physics
engine — is **switched off**. The comment says why: *"A stationary dodge game:
you never leave your platform, and nothing is grabbed — your body IS the
controller."*

### The core law

> **My platform IS the world origin.**

`src/game/ring.ts` is the whole trick. Up to 24 dancers stand on a ring of
platforms around a boss. Canonically, seat *i* stands at bearing φᵢ = i·2π/N on
a circle of radius R, yawed to face the centre. But each client renders its
*own* seat at the world origin facing −Z. Because every seat sits at the same
radius facing the centre, **the stage lands at exactly (0, 0, −R) in every
dancer's local frame.** The boss, the choreography and your own hazard zones
therefore need no transform at all — the head's world position is already
platform-local. Only *other* players' platforms and their network poses go
through a seat transform.

This is the same geometric trick Eye of the Temple uses (put the player at a
known spot and design around it), inverted: instead of re-anchoring the world
to keep the player centred, we *declare* the player centred and build a world
that never needs re-anchoring.

### The play space

`src/config.ts` — the octagon, inherited from Blaston's play-space footprint
via Iron Balls Boxing:

```
OCTAGON_HALF_WIDTH  0.86   →  1.72 m wide
OCTAGON_HALF_DEPTH  0.75   →  1.50 m deep
chamfer             0.375
```

**~1.72 × 1.5 m.** Comfortably inside the 2 × 2 m that both Eye of the Temple
and Spellbound Spire demand — deliberately, because it has to fit inside a
real room *and* leave the player margin at the edges.

The whole dodge game happens inside that slab. There is no travel budget to
spend, so the design spends *density* instead.

### The movement grammar

This is the part with no equivalent in either comparison game, and it is the
most transferable thing we own. Every hazard has exactly one honest answer,
and every answer is a **verb the body performs** (`src/choreo/setlist.ts`):

```ts
const VERB: Record<MoveKind, string> = {
  beam: 'lateral',   seesaw: 'lateral',  gate: 'lateral',
  cross: 'depth',    surge: 'depth',
  donut: 'radial',   duckdonut: 'radial',
  nova: 'compass',   sweep: 'duck',
  routine: 'corners', wave: 'travel',
};
```

Three laws sit on top of the verb table:

1. **Never the same move twice running.** Hard exclusion in `pickKind()`.
2. **Verb damping.** A candidate whose verb repeats the previous move's verb
   has its weight multiplied by **0.35** — same verb, new face, still a rut.
3. **THE FLOOR MANAGER.** The generator tracks a **park**: where the previous
   move's *correct* dodge leaves a dancer standing.

```ts
export type Park = { x: number; z: number } | null;
export function parkOf(kind, landings, prev): Park
export function evictsPark(landings, park): boolean
```

Any candidate move whose danger never touches the park is **re-rolled**. A
move that asks nothing of the ground you're already standing on is a move that
didn't happen. The park is a *model*, not a sensor — no telemetry, no
per-player adaptation — so every deck stays identical and deterministic across
all 24 clients, while the chart itself is guaranteed never to contain a
"stand still and win" step.

`parkOf` reads like a movement dictionary:

- `sweep` → returns `prev` (you ducked in place; nobody moved).
- `donut` / `duckdonut` → `{0, 0}` (hauled to the middle by definition).
- `nova` → `null` — the safe wedge is a shared *compass bearing*, so it lands
  somewhere different on every deck. Unknowable park ⇒ next move is
  unconstrained.
- `routine` → the last taught corner, at (±0.45, ±0.4).

And the park feeds forward into authoring: `twinSide()` aims a twin-laser's
opening volley at the side the floor is *actually* standing on, falling back to
a coin when the park is unknowable — while always consuming the RNG draw, so
the seeded stream stays byte-identical across clients either way.

Two more spatial laws, both about fairness of read:

- A lone crossfire rail never lands **behind** you. A strip at your back is a
  read nobody should be asked to make. Only whole-deck events (the trap, the
  wave) may touch rear ground.
- A gate's gap never sits over the **middle** — a doorway you are already
  standing in asks for nothing.

### The body as input

`src/systems/PlayerSystem.ts` reads head and hands and nothing else — which is
all WebXR knows about a body.

**Crouch calibration** is the sharpest bit of it:

```ts
if (_head.y > match.standingHeight) match.standingHeight = _head.y;      // instant attack
else match.standingHeight = Math.max(1.1, match.standingHeight - delta * 0.015);  // glacial release
match.ducked = _head.y < match.standingHeight * CHOREO.duckFrac;         // duckFrac = 0.78
```

Fast attack, ~15 mm/s release, hard floor at 1.1 m. **You can't fake tall, and
a whole set spent crouching never quietly lowers the bar.** Any body-driven
mechanic needs this shape of filter; a naive running average is exploitable in
both directions.

The rendered threat and the judged threat are deliberately desynchronised: the
sweep's **limbo line renders at y = 1.26 m** with a 0.12 m glowing pane, sitting
*a touch below* where the judge actually cuts. The picture may demand slightly
more crouch than the judge, never less. Generalisable rule: **when a hazard is
judged against the body, render it stricter than you score it.**

**Hands** run the groove: one up, one down, swapping on the beat. It pays a
trickle, never a multiplier — "it's the trickle that makes standing still the
wrong idea". Getting hit resets the groove streak, so a clean grade and a deep
groove are the same discipline.

### Room-scale hygiene

Two laws that any pure room-scale design has to get right, both handled in
`src/systems/ClubTeleportSystem.ts`:

- **Recentre is honoured.** The system holds a `reset` listener on the live
  reference space. `reset` fires *between* frames, before any pose uses the new
  origin, so it caches the head pose at the moment it fires and folds the new
  origin in on the next tick. In the club you stay exactly where you stood (a
  recentre redefines your *neutral*, not your *spot*); everywhere else the rig
  snaps to identity. Recentring always means "put me at my platform's centre,
  facing the board".
- **The social room never contaminates the game room.** The club is
  teleport-only. The moment a set books the floor, every club offset is dropped
  and the rig returns to identity — so the platform sits on the same physical
  spot of your room it held before you went social. Wandering a virtual club
  must never move your real dance floor.

### Height, and why we cheat with it

The rank system (`src/systems/RankSystem.ts`) is where pure room-scale gets
interesting — see below.

---

## 4. IWSDK — what the SDK actually gives us

Read from the published packages (`@iwsdk/core@0.5.3`, `@iwsdk/locomotor@0.5.3`),
not from docs. `0.4.2` (what `dance` pins) and `0.5.3` are **identical in the
locomotion module** — the defaults below hold for both.

### The three shipped styles

`LocomotionSystem` (`dist/locomotion/locomotion.js`) registers three
subsystems and owns a physics engine:

| Config | Default | Notes |
| --- | --- | --- |
| `slidingSpeed` | `5` m/s | forwarded to `SlideSystem.maxSpeed` |
| `comfortAssist` | `0.5` | peripheral vignette strength, scaled by input magnitude |
| `turningMethod` | `SnapTurn` | `SnapTurn=1`, `SmoothTurn=2` |
| `turningAngle` | `45`° | per snap |
| `turningSpeed` | `180`°/s | smooth |
| `rayGravity` | `-0.4` | parabolic teleport guide |
| `maxDropDistance` | `5.0` m | (engine's own default is 2.0) |
| `jumpHeight` | `1.5` m | `enableJumping` defaults **true** |
| `jumpCooldown` | `0.1` s | |
| `useWorker` | `true` | physics in a Web Worker |

- **Slide** reads the left thumbstick, moves relative to head yaw, applies a
  dynamic vignette, and jumps.
- **Teleport** does parabolic ray hit tests through the locomotor and **only
  accepts targets with upward normals**. Hand-tracking micro-gestures can drive
  activation and confirm.
- **Turn** draws visual turn signals on the right ray for snap turning.

### The engine underneath (`@iwsdk/locomotor`)

A real character controller, not a transform nudge. Collision is accelerated by
`three-mesh-bvh`; it runs on the main thread or in a worker.

```
capsule radius        0.5      segment y 0.5 → 1.5
gravity               9.81     (×3 multiplier above y = 10)
maxWalkSpeed          3        accel/decel 100, airDragFactor 0.3
groundDecel           8
floatHeight           0.01     floatSensorRadius 0.12
floatSpringK          30       floatDampingC 8
maxSlope              1
```

The player is a **floating capsule on a spring-damper** — the standard
"float-and-hover" character controller, which is what lets it glide over small
steps without a stair-stepping hack.

**The part relevant to Eye-of-the-Temple-shaped ideas:**

```ts
// LocomotionEnvironment.type: 'static' | 'kinematic'
GroundDetector.applyPlatformVelocity(playerVelocity, groundInfo) {
  if (env.type === KINEMATIC && env.metadata?.velocity)
    playerVelocity.add(env.metadata.velocity);
}
```

**Kinematic platforms with velocity inheritance are already in the SDK.**
Mark a mesh `LocomotionEnvironment` with `EnvironmentType.KINEMATIC`, keep its
transform updated, and a player standing on it is carried. That is the primitive
a moving-platform game needs, shipped and free.

Also available: `LocomotionSystem.setPlayerPosition(v3)` (authored teleport that
keeps the locomotor in sync), `Locomotor.teleport/slide/jump/requestHitTest`,
and `updateKinematicPlatform(handle, matrix)`.

### The input layer

Locomotion never touches raw input. It goes through
`ActionLocomotionInputProvider`, over five named actions:

```
locomotion.move   locomotion.turn   locomotion.jump
locomotion.teleportAim   locomotion.teleportCommit
```

with browser keyboard/gamepad bindings available for desktop. **A custom
movement mechanic should bind these actions rather than reading controllers**,
so it inherits desktop emulation and hand-tracking micro-gestures for free.

### The rig model

`world.player` is the **XR origin** (`xrInputManager.xrOrigin`), with the camera
attached to it. Reference space defaults to **`local-floor`**, and the session
offers `['local-floor', 'bounded-floor', 'layers']`.

`bounded-floor` is quietly the most interesting thing on that list and we use
none of it: it is the reference space that reports the **actual polygon of the
user's play area**. A dynamic room-scale system that wanted to *fit itself* to
the player's real room — rather than demanding a fixed 2 × 2 m like both
comparison games do — would start there. Scene understanding (`XRPlane`,
`XRMesh` with semantic labels, `XRAnchor`) is also wired up in the SDK.

### What `dance` does with all of it

Nothing. `locomotion: false`. The club's teleport is ~465 lines of our own
(`ClubTeleportSystem.ts`): deflect a thumbstick, ballistic arc to an **octagon
marker** (the dancer's own platform footprint — the game's visual vocabulary
reused as a landing pad), roll the stick to set your **landing facing**, release
to go; an isolated sideways flick is a snap turn. Landings are restricted to
authored floor rectangles carrying their own heights (terrace +0.45 m, bar
counter +1.09 m), arcs can't cut through walls, and you can only arc over the
bar once you're standing at counter height.

That is worth knowing precisely because it is *more* than the SDK's teleport
gives (landing-facing control, authored areas with heights, wall occlusion,
height-gated arcs) — and it cost us a system to get it.

---

## 5. Where the design space is actually empty

Cross-referencing the five families against what we've built:

**We have never used dynamic room-scale (family 4) at all**, despite owning the
two ingredients: a per-seat frame-of-reference transform (`ring.ts`) that
already proves we can re-express the world around a moving anchor, and an SDK
with kinematic platform velocity inheritance built in.

**We have never used folded space (family 5).** Our club is a conventional
Euclidean hall traversed by teleport — the exact thing Spellbound Spire's
portals exist to avoid.

Some specific unexplored combinations, all reachable from what exists:

- **Dynamic room-scale on a rhythm grid.** Eye of the Temple's platforms move
  on "a set loop"; reviewers describe it as feeling *almost turn-based*. Our
  entire choreography engine is already beat-quantized with a sacred windup.
  A platform whose travel is quantized to bars, telegraphed with the same
  amber→red fill language, is the obvious unbuilt thing: **the floor itself as
  a move.** The park model already knows where a correct dodge leaves you —
  which is exactly the input a frame-of-reference handover needs.
- **The roller as a beat instrument.** The rolling cylinder is a drift pump.
  A pump whose rate is a musical tempo is a *groove* you have to walk.
- **Portals as the club's doors.** The three-places law ("where you are is
  what you're doing") currently swaps whole interiors. A portal seam does the
  same job while letting you *walk* between places — and the corruption-grid
  lesson tells us what we'd have to solve: what happens to a carried drink.
- **Translation gain on the deck.** We insist on 1:1 because the telegraph is
  judged against the body. But Spellbound Spire ships 1.5× uniform gain in a
  puzzle game. A gain applied *only* to the dodge axis would make a 1.5 m deck
  read as a 2.25 m one. That is a real, testable, possibly terrible idea — and
  it is the cheapest way to buy floor we don't have.
- **`bounded-floor` fitting.** Both exemplars demand a fixed 2 × 2 m. Reading
  the player's actual play-area polygon and *sizing the deck to it* — rather
  than assuming — is a thing neither game does and the platform supports.

---

## 6. Inverse locomotion — the trick we already have

Worth pulling out on its own, because I can't find it named anywhere else.

RAVE RAID's rank system needs to lift the leader above the field. But the
player's own platform **is their real floor and can never move** — moving it
would be a vestibular lie of the worst kind (your feet say flat, your eyes say
rising). The VR height law also forbids anything rendering *below* the common
floor, and forbids anyone reading as short.

So when you take the lead, **the world sinks instead.**

```ts
// RankSystem.ts
championLift  0.7 m      topTenLift   0.32 m
riseLerp      0.45       // the slowest ease in the game, on purpose
climbPerSec   0.09 m/s   climbMax     4.4 m
```

THE RISE: the stage eases down by your tier, and everything anchored to it —
the giant, the light rig, the void, the board, every other deck — follows.
THE CLIMB: every second you hold rank 1 accrues more sink, up to 4.4 m on top
of the 0.7 m lift, until the boss's crown (he stands ~4.3 m) is below your eye
line. Lose the lead and it drains at double speed. Other decks ride
`tier − sunk`, so relative heights stay honest on every client.

Generalised: **when the player's transform is untouchable, express player
movement as the negative movement of everything else.** It costs nothing in
comfort (there is no self-motion cue to contradict, and the ease is
deliberately slower than the vestibular system's threshold for caring), it
scales to any axis, and it composes with pure room-scale rather than fighting
it. It is the exact dual of Eye of the Temple's frame-of-reference handover —
EotT moves the world to keep the *body* centred; we move the world to express
*rank*. Same lever, different purpose.

Obvious extensions nobody has tried: inverse *rotation* (the world yaws so you
face what matters without a snap turn), inverse *scale* (the world shrinks as
you dominate), inverse *translation on a beat*.

---

## Sources

- [The Hidden Design Behind the Ingenious Room-Scale Gameplay in 'Eye of the Temple' — Road to VR](https://www.roadtovr.com/eye-of-the-temple-design-room-scale-vr-gameplay/)
- [Behind the design of Eye of the Temple — runevision blog](https://blog.runevision.com/2023/05/behind-the-design-of-eye-of-the-temple-out-on-quest-2.html)
- [Eye of the Temple — official site](https://eyeofthetemple.com/) · [FAQ](https://eyeofthetemple.com/faq.html)
- [Eye Of The Temple Review: A Triumphant Room-Scale Adventure — UploadVR](https://www.uploadvr.com/eye-of-the-temple-review/)
- [Eye Of The Temple Is A VR Game That Requires Room Scale Locomotion To Move Around — UploadVR](https://www.uploadvr.com/eye-of-the-temple-vr-game-requires-room-scale-locomotion/)
- [One of VR's Smartest Room-scale Games Finally Comes to Quest 2 Today — Road to VR](https://www.roadtovr.com/eye-temple-vr-quest-2-release-trailer/)
- [Spellbound Spire on Steam](https://store.steampowered.com/app/1248270/Spellbound_Spire/)
- [Spellbound Spire — Timo Bron, Level Design Portfolio](https://timobron.com/spellbound-spire/)
- [Spellbound Spire — Stef Mannens](https://www.stefmannens.com/spellbound-spire/) · [The Rookies entry](https://www.therookies.co/entries/6411)
- [Impossible Spaces: Maximizing Natural Walking in Virtual Environments with Self-Overlapping Architecture — Suma et al., IEEE TVCG 2012](https://ieeexplore.ieee.org/document/6165136/) ([PDF](http://www.cs.ucf.edu/courses/cap6121/spr13/readings/Suma2012.pdf))
- [Immersive Web SDK — Locomotion Overview](https://iwsdk.dev/concepts/locomotion/) · [Locomotion Teleport](https://developers.meta.com/horizon/documentation/web/iwsdk-concept-locomotion-teleport/) · [facebook/immersive-web-sdk](https://github.com/facebook/immersive-web-sdk)
- Primary source: `@iwsdk/core@0.4.2` / `@iwsdk/core@0.5.3` and `@iwsdk/locomotor@0.5.3`, read from npm.
- Primary source: `yellkell/dance` — `src/main.ts`, `src/game/ring.ts`, `src/config.ts`, `src/choreo/setlist.ts`, `src/systems/PlayerSystem.ts`, `src/systems/RankSystem.ts`, `src/systems/ClubTeleportSystem.ts`.
