# movement

Research on VR movement mechanics and environment craft. **Nothing is being
built here yet** — this is the map before the build.

Two questions drive it:

1. **How do you move a body through a virtual world?** — with an eye on the two
   games that answer it best (*Eye of the Temple*, *Spellbound Spire*), what
   `dance` (RAVE RAID) already does, and what the Immersive Web SDK actually
   gives us.
2. **How do you build a beautiful space that costs almost nothing?** — on
   standalone Quest 3, in WebXR, at 90 Hz.

## The notes

| | |
| --- | --- |
| [`research/01-vr-movement-mechanics.md`](research/01-vr-movement-mechanics.md) | The five families of VR locomotion, what each exemplar does, what `dance` does, what IWSDK ships (read from the packages, not the docs), where the design space is empty — and **inverse locomotion**, the trick we already have and nobody has named. |
| [`research/02-environments-quest3.md`](research/02-environments-quest3.md) | The Quest 3 machine, real budgets, the techniques ladder ordered by return per frame-millisecond, batching, lighting you compute before startup, textures, VR level-design principles, what's new in 2026, and a checklist. |
| [`research/03-eye-of-the-temple.md`](research/03-eye-of-the-temple.md) | The deep dive: the frame-of-reference mechanism, the roller as a drift pump, level design as a constraint solver, the Quest port, the honest ledger of where it strains, and what transfers. |

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
off.

On the environment side the constraint is the mirror image: on a tile-based
mobile GPU you are draw-call, bandwidth and texture-memory bound, almost never
triangle bound. Fidelity comes from a mirrored floor that costs one draw, four
depth layers, detail at three scales, and air in the middle distance — all
instanced with per-instance colour so a hundred animated lights are one draw
call, all merged where nothing moves, all lit before the app starts, and with
no post-processing at all. The measured proof is already in `dance`: the whole
set world is **48 draws, ~24k triangles, 1,521 instances, mirror included.**
