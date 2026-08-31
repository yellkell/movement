# movement

Research on VR movement mechanics and environment craft — and the builds
the map was drawn for: **[STEPWELL](stepwell/)**, a rhythm descent for a
2 × 2 m room, built on the Immersive Web SDK — and now
**[VOIDSTEP](voidstep/)**, the consolidation with `dance`: a parkour
circuit through RAVE RAID's void.

Two questions drive the research:

1. **How do you move a body through a virtual world?** — with an eye on the two
   games that answer it best (*Eye of the Temple*, *Spellbound Spire*), what
   `dance` (RAVE RAID) already does, and what the Immersive Web SDK actually
   gives us.
2. **How do you build a beautiful space that costs almost nothing?** — on
   standalone Quest 3, in WebXR, at 90 Hz.

## The build

[`stepwell/`](stepwell/) is the experience the notes kept pointing at — the
combination `01 §5` names as the empty design space: **dynamic room-scale on
a rhythm grid, the floor itself as a move.** One tracked platform pins the
play area to the world; platforms run on bar-quantized loops; every traversal
is a pair of opposed steps netting to zero; gates mid-ride ask for duck and
dodge on moving ground — Johansen's own two unbuilt verbs, in dance's
telegraph language. The environment is the `02` techniques ladder made
diegetic: a stepwell is a vertical temple that ends in water, so the mirror
floor and the free vertical dimension are the building itself. Every design
decision is traced back to these notes in
[`stepwell/DESIGN.md`](stepwell/DESIGN.md), and a headless probe walks the
mechanic and holds the frame to the `02` budgets (37/37 checks; 31 draw
calls, ~20 k triangles). Now wound into a full descent-and-return: the
relay, the paternoster, the mill you walk like a crank, call plates, the
gauntlet — and the ember, carried up from the water, relighting the well
storey by storey.

**And the consolidation has now gone home.** VOIDSTEP's circuit is built
into `dance` itself, as a place you walk to: RAVE RAID's club has a door in
its south-west corner — THE STEP, the arcade's opposite number across the
way in — and stepping into the frame standing in that room takes the hall
away and puts you on the home pad, with the club's teleport switched off and
the frame-of-reference mechanic in its place. Close the lap and it hands you
back out through the same doorway. **The attacks did not go with it**: the
six moves are the GOOPLIATH's vocabulary and they belong to the raid, so
inside `dance` the course is the floor and the step and nothing else. This
repo stays the research house and the standalone build; the notes below are
still where the mechanic is argued.

[`voidstep/`](voidstep/) consolidates the two houses into one experience:
stepwell's tracked-platform mechanic **simplified** — the forced-switch
slide correction is deleted outright; handover is clean or it is a slip,
and the world never moves under your feet except by riding — inside
**dance's abstract environment**, cloned whole (`voidkit`: the mirror
floor, the tower rings, the skyline, the truss, the arcs, the dust, the
horizon). A **parkour circuit** of moving platforms rides out, up and
across the void and home, ledger closed — and **dance's attacks** (beam,
rail, seesaw, surge, gate, sweep, in the same amber→red telegraph
language, same charge times, same laws) land on the decks mid-ride to
keep the body moving: Johansen's two unbuilt verbs, extended to dance's
whole verb table, on ground that is itself in motion. The two games now
share one grammar. Its probe rides the entire circuit — the slip law,
the six-move volley, the closed ledger, the budgets — 38/38 checks; 56
draw calls, ~29 k triangles. The story is traced decision-by-decision in
[`voidstep/DESIGN.md`](voidstep/DESIGN.md).

## The notes

| | |
| --- | --- |
| [`research/01-vr-movement-mechanics.md`](research/01-vr-movement-mechanics.md) | The five families of VR locomotion, what each exemplar does, what `dance` does, what IWSDK ships (read from the packages, not the docs), where the design space is empty — and **inverse locomotion**, the trick we already have and nobody has named. |
| [`research/02-environments-quest3.md`](research/02-environments-quest3.md) | The Quest 3 machine, real budgets, the techniques ladder ordered by return per frame-millisecond, batching, lighting you compute before startup, textures, VR level-design principles, what's new in 2026, and a checklist. |
| [`research/03-eye-of-the-temple.md`](research/03-eye-of-the-temple.md) | The deep dive, **written from Johansen's own three Quest-launch articles**: the paired step, the gated frame-of-reference handover, foot fences, the ghost-overlay authoring trick, how the play-area constraint reached into whip usage and gem placement, the embodied-immersion dogma, his own comparison of room-scale approaches, and what the first draft got wrong. |

## The one-paragraph version

Every VR locomotion scheme answers one question: **who owns the transform
between the player's real floor and the virtual world, and when may it
change?** Artificial and discrete locomotion move that transform and pay in
comfort. Pure room-scale refuses to move it and pays in floor space — that's
RAVE RAID, which takes the position to its limit (`locomotion: false`, *my
platform IS the world origin*) and buys back expressiveness through a
telegraph grammar, a verb table and a floor manager rather than through
travel. *Eye of the Temple* re-anchors the transform to whichever platform
you're standing on, and turns level design into a constraint solver over a
3 × 3 grid of real-floor squares. *Spellbound Spire* leaves the transform
alone and folds the world instead, with portals plus a 1.5× translation gain
that fits a 3 × 3 m virtual space into a 2 × 2 m real one. We have never built
either of the last two, we own most of the pieces for both, and IWSDK already
ships kinematic platforms with velocity inheritance that we currently switch
off. There is a second axis under all of it that comfort doesn't capture:
embodied movement **doesn't have to be learned**, so how embodied a scheme is
sets the ceiling on how approachable the game can be, which makes immersion and
approachability the same quantity rather than a trade-off. And two of the ten
button-less interactions on Johansen's own list are *duck under an obstacle
while on a moving platform* and *dodge to the side while on a moving platform* —
our `sweep` and `beam`, performed on ground that is itself in motion.

On the environment side the constraint is the mirror image: on a tile-based
mobile GPU you are draw-call, bandwidth and texture-memory bound, almost never
triangle bound. Fidelity comes from a mirrored floor that costs one draw, four
depth layers, detail at three scales, and air in the middle distance — all
instanced with per-instance colour so a hundred animated lights are one draw
call, all merged where nothing moves, all lit before the app starts, and with
no post-processing at all. The measured proof is already in `dance`: the whole
set world is **48 draws, ~24k triangles, 1,521 instances, mirror included.**
