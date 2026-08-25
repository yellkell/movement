# Eye of the Temple — the deep dive

Rune Skovbo Johansen (runevision). Development began **2016**. PC VR release
**October 2021**; Quest 2 / Quest Pro **27 April 2023**, co-developed with
**Salmi Games**. A free demo, *Eye of the Temple: First Steps*, ships
separately. Road to VR's **2021 Excellence in Locomotion** award.

It is the most complete existing answer to the question we're circling: *how
do you get an expansive, vertical, explorable world out of a 2 × 2 m room with
no artificial locomotion at all?*

> **A note on sourcing.** `blog.runevision.com`, `roadtovr.com`, `uploadvr.com`
> and the Steam pages are all blocked by this session's egress policy, so
> nothing below is a direct page fetch — it is assembled from domain-scoped
> search over those same sources. Everything is attributed. **The three design
> articles Johansen wrote for the Quest 2 launch are the primary source we have
> not been able to read directly, and they are the obvious next stop** when
> there's a session that can reach them.

---

## 1. The pitch, and the constraint

The game was born, in Johansen's own framing, out of a desire to combine **the
immersion of moving with your own body in room-scale VR** with **the ability to
explore a vast environment with lots of verticality and large open spaces**.
Those two wants are normally in direct opposition — that opposition is the
entire design problem, and the entire design.

**Hard requirement: a play area of at least 2 m × 2 m, with 360° tracking.**
No seated mode, no standing-only mode, no fallback stick. This is both the
game's whole identity and its most-cited flaw: reviewers repeatedly note the
game only works with a room most people don't have.

Everything else follows from refusing to relax that requirement.

---

## 2. The mechanism

### 2.1 The world is a grid of platforms

The map exists entirely on a grid of square blocks. You move by **hopping
between them** — small physical steps. Blocks come in several kinds:

- **Static blocks.** The floor of the temple.
- **Translating platforms.** Move between two points on a set loop —
  side-to-side, or up and down (elevators, which is where the verticality
  comes from).
- **Rolling cylinders / barrels.** The signature object. Roll between two
  spots rather than translating between them, which means **you must walk on
  top of them to stay on top of them** — backwards, exactly as you would on a
  floating log.

The moving parts run on **set loops**, which is why the moment-to-moment reads
as *clockwork* — several reviewers describe it as feeling almost turn-based
even though everything is real-time. That's not an accident of implementation;
a deterministic loop is what makes the room-scale constraint solvable in
advance.

### 2.2 The frame of reference

This is the load-bearing idea, and it is worth stating precisely:

> The **frame of reference** — the part of virtual space that the physical play
> area is currently mapped to — **follows the platform you are standing on.**
> Stepping onto a new platform hands tracking over: the frame of reference
> starts following the new platform instead.

And:

> **Every platform has a designated spot in the play area**, generally
> corresponding to one square of a **3 × 3 grid** laid over the physical play
> space (or several squares, for a larger platform).

Put those two together and you have the whole engine:

- Standing on platform *P*, your real-floor position is *P*'s designated
  square. If *P* moves, the entire virtual world moves relative to you, and
  your body does not move at all. **This is where the vast temple comes from.**
- Stepping from *P* to *Q* is a *physical* step whose direction and length are
  determined by the difference between *P*'s designated square and *Q*'s. **The
  virtual adjacency of two platforms authors a real footstep.**
- Because there are only nine squares, the walk is bounded by construction. You
  can never be asked to step outside the grid, because there is nowhere outside
  the grid for a platform to claim.

At the handover, the old and new platform "should be correctly aligned in order
for everything to work out right" — but it is explicitly **not critical**; a
step onto a slightly misaligned platform just shifts you a little within the
play area rather than breaking anything. The system is a soft constraint with
slack, not a rigid lattice, which is what lets a human body with imprecise
footwork play it.

### 2.3 The roller as a drift pump

The rolling cylinders are the mechanism that makes the whole thing *close*.

A translating platform is neutral: it carries you and returns you. A **roller**
is asymmetric. To ride it you must walk in the **opposite direction to its
roll** — so it *consumes* real-floor travel in a chosen direction while
producing virtual travel in the other. In the plainest terms: **it is a
mechanism for walking the player backwards, at length, without them ever
perceiving a correction.**

Road to VR's framing is exact: the roller mechanic is used to *move the player
away from the guardian boundary, creating more space by forcing them to move
backwards without realising it.*

The whole level then reads as a balanced ledger:

> If you step to the left in your room to board a moving platform, you'll soon
> end up stepping to the right; if you're walking backwards on a rolling
> barrel, you'll soon have to walk forwards.

**Any combination of routes always keeps you inside the same real 2 × 2 m
square.** That is a level-design invariant, checked by construction, not a
runtime correction.

### 2.4 Orientation

The map is laid out to **intelligently redirect the player's orientation as
needed**, working in tandem with the rollers. This is the least documented part
of the public material and the part I'd most want the primary articles for —
but the shape is clear: yaw is managed by geometry, not by a snap turn, and the
360° tracking requirement exists because the game *will* turn you around.

### 2.5 Recentring

- **PC VR** (Index, Rift, Vive, WMR): the game space is positioned optimally
  automatically. No player action.
- **Quest**: you may need to **manually reset the position** — hold the left
  Meta/Oculus button.

That asymmetry is honest and instructive. On a headset whose play space is
defined by a user-drawn boundary that can drift, a system this tightly coupled
to real-floor coordinates cannot fully self-correct. **The elegance has a
seam, and the seam is at the platform boundary API.**

### 2.6 The other input: the whip

Not locomotion, but part of the same design logic. A whip with real physics —
crack it at enemies, grab distant levers. In a game where you cannot walk to
things, **reach has to be extended by a tool.** A room-scale game with no
locomotion needs an answer to "the thing I need is three metres away", and the
whip is it. Worth noting as a category: *the interaction budget expands to
cover what the movement budget can't.*

---

## 3. Level design as a constraint solver

The design tool is the most quotable detail in the whole story:

> Johansen made a **pattern representing the player's entire play area** — a
> thick white border along the edge, a thick circle in the centre — and
> **overlaid it on every platform**, so each platform visibly declares which
> real-floor spot it claims.

He debugged it in **mixed-reality footage with the grid overlaid on the real
room**. The verification tool for a locomotion system is a video of a person in
their living room with the virtual grid painted on the floor.

The broader level-design process (from his 2018 write-up) is instructive about
what's *hard* here, and it is not the platforms:

- The real problem was **planning a non-linear world meant to be highly
  interconnected and interdependent**. He spent a long time looking for a
  document type that would let him get ideas onto paper quickly, and concluded
  that **different document types fit different aspects of the job** — there is
  no one artefact.
- He used **Unity tilemaps** for planning multi-storey structures, and found
  moving things around painful because each layer has to be edited separately.
- **None of the document types he tried captured the three-dimensionality of
  the world well.** Whiteboxing was the next thing to try.
- He recommends **Mark Brown's dungeon-graph template** for the connectivity
  side.

He also spent **over a year on a major world redesign**, with a specific focus
on **making better use of verticality** — because experiencing the great
heights is a draw of the game. The vertical axis is the one dimension a
2 × 2 m floor gives you for free (elevators cost no floor), and he leaned into
it hard.

That is the most transferable process lesson here: **the room-scale constraint
is the easy half.** It's a solvable local problem with a visible invariant. The
hard half is authoring a large, non-linear, interdependent 3D world *through*
that constraint, and the tooling for that basically doesn't exist.

---

## 4. The Quest port

Shipped ~18 months after PC VR, co-developed with **Salmi Games**, because —
in Johansen's words — it took *"all their combined and complimentary skills"* to
hit the target framerate on Quest 2 mobile hardware.

Two specifics worth carrying:

- **They built their own manual occlusion system** to supplement Unity's
  built-in one, in order to support the expansive world. It disables parts of
  the world that aren't currently visible **according to manually defined
  boundaries.** Hand-authored visibility volumes, because automatic occlusion
  culling couldn't handle the scale.
- **Lighting and water were reimplemented from scratch** to retain the same
  aesthetic on mobile.

And the general note: *"the large environments put pressure on everything else
in the game"* — optimisations had to be pushed further than in other Quest 2
titles.

This is the direct bridge to
[`02-environments-quest3.md`](02-environments-quest3.md): **a big, open,
room-scale world's dominant cost is submitting the parts you can't see**, and
the answer at shipping quality was manual authored culling volumes, not a
clever renderer.

---

## 5. Where it strains — the honest ledger

| Strain | Detail |
| --- | --- |
| **Play space** | Hard 2 × 2 m + 360°. The most common criticism: "only works with a pretty big room, which most people don't have." |
| **Recentring on Quest** | Manual (hold the left Meta button). PC VR is automatic. |
| **Comfort is reduced, not eliminated** | Riding moving platforms is still visual motion the body isn't producing. "Your vestibular system can only be fooled so much." |
| **Handover precision** | Old and new platform should be aligned at the switch; forgiving, but real. |
| **Design crowd-out** | The strongest critique: the locomotion constraint eats the rest of the game. One reviewer — *"looks great in a demo video but is extremely limiting when it comes to game design"* — faults the lack of interesting puzzles, varied environments, story or characters. Metacritic and most VR outlets are much more positive, but the pattern in the criticism is consistent: the mechanic is the game, and a mechanic is not a full game. |
| **Pace** | Clockwork, near turn-based. That's a taste, and it's forced: platforms on set loops are what make the constraint solvable. |

**The design-crowd-out point is the one to internalise.** A movement mechanic
this strict imposes a shape on everything downstream: the platforms dictate
pacing, the pacing dictates puzzle density, the play-space budget dictates
level topology. If we build in this family, the question to answer up front is
*what is the game on top of it*, because the mechanic will not leave much room
to decide that later.

---

## 6. What transfers to us

Mapped against what `dance` already has.

**Directly reusable:**

1. **"Designated spot in the play area" as a first-class object property.**
   We have the dual of this already — `ring.ts` proves we can re-express a
   whole world around a per-client anchor. What we've never done is let that
   anchor *change during play*.
2. **The pattern overlay as a design tool.** A texture that declares a piece's
   play-space claim, visible in-editor and in mixed-reality capture. We
   already have the harness for this: `tools/` runs Playwright against the real
   app (`club-capture`, `set-capture`, `teleport-rules`, `judge-overlap`,
   `floor-clear`). A `playspace-claims.mjs` probe that drives a route and
   asserts the real-floor position never leaves the octagon is the same shape
   of tool we already write.
3. **The balanced-ledger invariant.** "Any combination of routes returns you to
   the same square" is checkable by construction. Our **floor manager** already
   does the structurally identical thing for a different property: it tracks a
   **park** (where a correct dodge leaves you) and re-rolls any move that
   doesn't demand something of that ground. *The park is already a
   play-space-position model.* Extending it from "does this move ask anything
   of you" to "does this sequence return you to the centre" is a small step
   from where the code stands.
4. **Manual occlusion volumes.** Straight into the environment playbook.

**The interesting collision — beat-quantized dynamic room-scale:**

Eye of the Temple's platforms run on **set loops**, and reviewers call it
*almost turn-based*. Our entire choreography engine is beat-quantized with a
**sacred windup** — telegraphs start on beats, landings hit bar downbeats,
i-frames measured in beats. A platform whose travel is quantized to bars and
telegraphed in the same amber→red fill language is the natural fusion: **the
floor itself as a move.** EotT's clockwork feel — a criticism there — is
*exactly what a rhythm game wants*.

The pieces already exist on both sides:

- IWSDK ships **kinematic `LocomotionEnvironment` with platform velocity
  inheritance** (see [`01`](01-vr-movement-mechanics.md#4-iwsdk--what-the-sdk-actually-gives-us)).
  A moving platform that carries the player is a solved problem in the SDK we
  already depend on — even though `dance` currently sets `locomotion: false`
  and never touches it.
- Our telegraph grammar already teaches a floor to say *"this ground is about
  to stop being yours"*.
- The **verb table** already models what a dodge asks of the body. "Ride" and
  "board" are two verbs it doesn't have yet, and both are travel verbs, which
  the grammar currently serves with exactly one entry (`wave: 'travel'`).

**And the roller is a metronome waiting to happen.** A cylinder is a device
that converts a *rate* into a *walk*. Give the rate a tempo and you have a
groove the player performs with their feet rather than their hands — which is
the one thing our groove system (hands, one up one down, swapping on the beat)
notably doesn't ask of the lower body.

---

## 7. Open questions / next research

1. **Read the three Quest-launch design articles.** Not reachable from this
   session's network. They are the deepest primary source and almost certainly
   answer §2.4 (orientation management) properly.
2. **The behind-the-scenes video.** The official site notes that *"a short
   video or more detailed article convey this topic best"* — there's a
   mixed-reality explainer with the grid overlay that would settle several
   details.
3. **What is the actual handover rule?** Is it "the platform under your feet",
   "the platform you last stepped onto", or something hysteretic? The
   difference matters enormously if you stand across two platforms.
4. **How does it handle a play space *larger* than 2 × 2?** Does it use the
   extra room, or clamp? `bounded-floor` in WebXR would let *us* answer this
   differently than Unity's API let him.
5. **Rotation gain — is there any?** The "intelligently redirect the player's
   orientation" language could mean pure geometric authoring or actual
   rotational redirection. Different answers imply very different comfort
   profiles.
6. **How many distinct platform behaviours ship in the final game?** The public
   material names static / translating / vertical / rolling. A fuller taxonomy
   would tell us how much variety a frame-of-reference system actually needs to
   stay interesting for a full game.

---

## Sources

- [The Hidden Design Behind the Ingenious Room-Scale Gameplay in 'Eye of the Temple' — Road to VR](https://www.roadtovr.com/eye-of-the-temple-design-room-scale-vr-gameplay/) ([page 2](https://www.roadtovr.com/eye-of-the-temple-design-room-scale-vr-gameplay/2/))
- [Behind the design of Eye of the Temple (out on Quest 2) — runevision blog](https://blog.runevision.com/2023/05/behind-the-design-of-eye-of-the-temple-out-on-quest-2.html)
- [Level design workflows — runevision blog](https://blog.runevision.com/2018/07/level-design-workflows.html)
- [June update: Verticality, puzzles, whip — runevision blog](https://blog.runevision.com/2017/06/june-update-verticality-puzzles-whip.html)
- [Eye of the Temple — official site](https://eyeofthetemple.com/) · [FAQ](https://eyeofthetemple.com/faq.html) · [press kit](https://eyeofthetemple.com/press/sheet.php?p=eye_of_the_temple)
- [Eye of the Temple — runevision project page](https://runevision.com/multimedia/eyeofthetemple/)
- [Eye Of The Temple Review: A Triumphant Room-Scale Adventure — UploadVR](https://www.uploadvr.com/eye-of-the-temple-review/) · [Requires Room Scale Locomotion To Move Around — UploadVR](https://www.uploadvr.com/eye-of-the-temple-vr-game-requires-room-scale-locomotion/) · [Releases April 27 on Quest 2 — UploadVR](https://www.uploadvr.com/eye-of-the-temple-release-date-3/)
- [One of VR's Smartest Room-scale Games Finally Comes to Quest 2 Today — Road to VR](https://www.roadtovr.com/eye-temple-vr-quest-2-release-trailer/) · [Road to VR's 2021 Game of the Year Awards](https://roadtovr.com/road-to-vrs-2021-game-year-awards/)
- [Dodge Deadly Traps and Solve Ancient Puzzles in 'Eye of the Temple' — Meta Quest Blog](https://www.meta.com/blog/eye-of-the-temple-vr-meta-quest-2-platformer/)
- [Eye of the Temple — Adrian Hon, *Have You Played?*](https://adrianhon.substack.com/p/eye-of-the-temple) (the sharpest critical take)
- [Eye of the Temple — Metacritic](https://www.metacritic.com/game/eye-of-the-temple/) · [6DOF Reviews](https://www.6dofreviews.com/reviews/eye-of-the-temple-review) · [Worthplaying PC VR review](https://worthplaying.com/article/2021/12/13/reviews/129890-pc-vr-review-eye-of-the-temple/)
