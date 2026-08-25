# VOIDSTEP — design notes

The brief, in one line: **take stepwell's mechanics (simplified — the
sliding parts go), clone dance's abstract environment, add a parkour mode
built on the moving-platforms mechanic, and steal dance's attacks to keep
people moving — so the two experiences align.** This document traces every
load-bearing decision to where it came from: [stepwell](../stepwell/), the
dance repo (RAVE RAID), or the research notes in
[`../research/`](../research/).

## What was taken from stepwell, and what was cut

**Taken whole** — the frame-of-reference mechanic (research/03 §2): one
tracked platform at a time, `rig = anchor(tracked)`, anchors authored so
consecutive platforms share a stop and every traversal is a paired step
netting to zero; the gated handover for incoming ground (a platform may
take tracking only within 2.5 cm of the live rig); head-tile ownership
with the tracked platform's wider skirt and a three-frame debounce; yaw
never changing; the bar-quantized loop authoring (`keys: [{bar, anchor}]`)
with dwell seams placed so no false amber fires at a loop's wrap; the
whole v2 countdown grammar (corner posts, wrapping rims, deck wash,
audible ticks) and wayfinding (invitation + berth); crouch calibration;
`bounded-floor` as validation, never adaptation; `validateScore()` — the
ghost-overlay discipline, executable, extended here to also refuse a score
whose attacks land off a downbeat, outside their host's travel, or with a
verb repeated back to back; the ghost overlays themselves; the probe
discipline; the ban on locomotion interfaces.

**Cut: the sliding parts.** Stepwell's forced switch — ground already
leaving takes the frame, and the correction drains over ~1 s, sliding the
platform into place underfoot (stepwell's `FrameOfReferenceSystem`,
research/03 §2.3). It was the faithful reading of Johansen's recovery
case, and headset time taught us it is also the one moment the world moves
by itself. VOIDSTEP's law is one clause: **handover is clean, or it is a
slip.** The correction term does not exist in the state; the probe asserts
it can't come back (`the correction term does not exist`, `no forced
switch ever fired`). The cost is honest: a player who stands on departing
ground they aren't tracked on watches it pull away — a miss (`slip`), a
thud, dead flow — instead of being carried. The score makes that case
rare by construction: every routed step is authored onto a shared-anchor
dwell, so the slip only ever means "you missed the step", which is
exactly what a miss should feel like.

**Also cut** (scope, not doctrine): the mill, the ember, call plates, the
throat/rebirth (this loop closes geometrically, so a lap needs no reset at
all — the stronger version of stepwell's own "rebirth resets only the
clock"), and stepwell's world-fixed gate frames — the attacks generalize
them.

## What was cloned from dance

**The void, whole.** `lib/voidkit.ts` is RAVE RAID's
`src/arena/voidkit.ts` verbatim but for the import line: the glow-bank
instancing (a hundred lights, one draw), the buffer-sharing mirror, the
two-scale floor grid with rays and rings, tower rings with pinstripes,
panel bands and lit caps, the parallax skyline, the truss canopy, the
arcs, the dust, the horizon-as-a-line, the octagon shards. The assembly
(`systems/VoidSystem.ts`) is their `SetEnvironment` re-hung around a
circuit instead of a seated ring: NEAR 16 towers at r 20, MID 24 at r 34,
FAR 48 slabs at r 52–88, horizon at 92, truss lifted to 12.5 m so the
skywalk threads under it, arcs springing at r 26 over ground you RIDE
through (dance's own rule for when arcs are earned). Differences are
budget, and stated: the near ring drops its portholes/shafts, the sheen
stays home, the canopy runs two rings — the calls they'd cost belong to
the attack telegraphs (measured: 56 draws against the ≤ 60 budget,
telegraphs up).

**The palette and its laws.** `LASER_HUES` and `hueToColor` are dance's,
snapping around the wheel per bar; saturated colour is reserved for light
(research/02 §6); amber→red belongs to gameplay alone; and **energy** —
the world ducks while a telegraph owns your deck and blooms with flow —
is dance's law through stepwell's dimmer implementation.

**The attacks.** `lib/telegraphs.ts` is dance's shader kit trimmed to the
moves a 2 × 2 deck can host — strip (beam/rail), half-flood
(seesaw/surge), gate, and the sweep's air-borne stack (danger roofs at
two heights, twin limbo rails pushed off the eye line, the duck cascade).
The laws ride along: the fill is the countdown; windups are sacred
(charges are dance's own beat counts per move); landings hit bar
downbeats; **the sweep never paints the floor** — floor paint means "move
your feet" everywhere else, so the stay-put move keeps the ground dark;
a gate's gap is never placed where the previous dodge parks you; no verb
twice running; the final move of the volley parks you on the exit row —
the floor manager's instinct, authored. One departure from dance,
deliberate: their set-list is a seeded generator, ours is **authored in
the score** — this game's spine is a fixed circuit, so its choreography
is a fixed text the probe can walk and a player can learn, exactly like
the machines' own loops. Judging renders stricter than it scores
(research/01 §3), judges at the landing instant, and judges **only the
ridden deck** — stepwell's rule that watching a gate from still ground
asks nothing of the body.

## The circuit

Five anchors ring the arena's heart, taking the free vertical dimension
(research/03 §3): home (0,0,0) → east landing (2.6, 0, −1.2) → high berth
(2.6, 3.8, −4.4) → west high berth (−3.0, 3.8, −4.4) → west landing
(−3.0, 0, −1.2) → home. Ten platforms: two runners, the lift, the drop,
the four-tile skywalk, and four static landings. The walk in play-area
squares nets to zero over the lap — including the east-step's internal
+N, repaid by the −N off the lift at the top, a repayment spanning the
whole climb (stepwell's mill discipline, reused). The first lap chains
with waits of ≤ 3 bars; later laps drift apart (16- against 32-bar loops)
and the berth markers carry the waiting, as they did in the well.

THE SKYWALK is the set piece and the reason this is a *parkour* game and
not a commute: a 2 × 2 claim — four squares of your real room — riding
5.6 m across the void at 3.8 m, with all six moves landing at two-bar
spacing while the ground travels. Dodging on moving ground is the
combination both source games circled (Johansen's two unbuilt verbs;
dance's whole verb table on a floor that never moves) and neither built.

## The sound

Stepwell's conductor, one inversion: the drone root **climbs** +7
semitones as the rig climbs (their well descends; research/01 §6 —
inverse locomotion's audio cousin, played the other way up). Hats brighten
with altitude; the arp fades in with flow; every landing is audible as an
impact whether dodged or not (dance: the event, not a warning of it); a
clip ducks the whole mix dark for a beat; a closed lap rings a bell.

## Verification

The probe rides the entire circuit and holds every law to account —
mechanism, slip, volley, energy duck, ledger, budgets, and an IWER
`immersive-vr` pass. **38/38 checks; 56 draw calls, ~29 k triangles**
(budgets ≤ 60 / ≤ 100 k, research/02 §8; dance's whole set world is 48
draws — the circuit rides one storey above that with its telegraphs up).

## What was deliberately not built (and why)

- **A seeded choreographer** — dance rolls its set-list from a match seed
  because 24 dancers need infinite nights; a fixed circuit wants a fixed
  text. When the circuit grows alternate routes, the generator (and its
  floor-manager re-roll) is the known next step.
- **Grades, chains, boards** — dance's scoring superstructure. Flow and
  the lap bell are this build's whole economy; import the rest only when
  laps mean something socially.
- **The forced switch, behind a comfort toggle** — considered and
  refused: two handover laws is two games. The slip is the design.
- **Attacks on single-tile decks beyond the sweep** — a lane dodge on one
  tile is a coin-flip, not a move (dance: a dodge is a move, never a
  coin-flip). Singles duck; only the skywalk hosts the full table.
