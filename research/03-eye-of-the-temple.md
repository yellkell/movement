# Eye of the Temple — the deep dive

Rune Skovbo Johansen (runevision), Danish, based in Turku. Core mechanic
prototyped at a **January 2016 VR game jam** as *Chrysalis Pyramid*; released
free, downloaded 3,800+ times, and that reception is what turned it into a
project. Solo and part-time from spring 2016, day job quit end of 2020, PC VR
release **October 2021**, Quest 2 / Quest Pro **27 April 2023** with **Salmi
Games**. **Well over 5,000 hours** before the Quest version. Road to VR's 2021
Excellence in Locomotion award.

It is the most complete existing answer to the question we're circling: *how do
you get an expansive, vertical, explorable world out of a 2 × 2 m room with no
artificial locomotion at all?*

> **Sourcing.** This note is now written from **Johansen's own three
> Quest-launch articles**, supplied in full:
> the Road to VR guest article on the room-scale mechanism, the Meta developer
> blog article on "embodied immersion", and the Meta Quest blog interview on
> origins — plus the LIV article on the mixed-reality integration. Everything
> below is from those unless marked otherwise. Earlier drafts of this file were
> assembled from search summaries and got one thing materially wrong; see
> [§3](#3-level-design-as-a-constraint-solver) and
> [§9](#9-what-was-wrong-in-the-first-draft).

---

## 1. The pitch, and the constraint

Born, in his words, from wanting to combine **the immersion of moving with your
own body in room-scale VR** with **the ability to explore a vast environment
with lots of verticality and large open spaces**. Those two wants are normally
in direct opposition; that opposition is the entire design problem.

**Hard requirement: 2 m × 2 m with 360° tracking.** No seated mode, no
standing-only mode, no fallback stick. And — this is the decision that makes
everything else tractable —

> *"It wasn't viable (or even desirable in my opinion) to vary the gameplay
> based on the actual size of the player's play area, so I always assume the
> minimum size and design around that."*

**He deliberately does not adapt to the player's real room.** A fixed minimum is
what lets every platform position, every whip constraint and every gem arc be
authored once and be correct for everyone. That is a direct argument against the
`bounded-floor` "fit yourself to the room" idea in
[`01`](01-vr-movement-mechanics.md) — see [§8](#8-what-transfers-to-us) for how
much weight it deserves.

---

## 2. The mechanism

### 2.1 The paired step

The clearest statement of the whole trick, and simpler than I'd assumed:

> Go from one pillar to another via a moving platform. You step **forward** onto
> the platform, it moves, you step **forward** onto the next pillar — and now
> you are outside your play area.
>
> Position the platform **to the side** instead. You **sidestep** on, it moves,
> you **sidestep** off. You took a step right and then a step left, so **you are
> back in the centre of the play area.**

That's it. Every traversal is a pair of opposed steps that nets to zero. The
game's tricks "are all about how the platforms are positioned relative to each
other" — the *platform's* travel supplies the virtual distance, and the
*player's* two steps cancel.

### 2.2 The frame of reference

> The game is **always tracking one platform at a time**. When a platform is
> tracked, that platform is **static relative to the physical play area**. The
> *frame of reference* — the part of virtual space the physical play area is
> currently mapped to — **follows the tracked platform.** Stepping onto a new
> platform switches tracking, and the frame of reference starts following the
> new one.

Every platform has a **designated spot in the play area**. For a single-tile
platform that is generally **one of nine positions** — the 3 × 3 grid — and a
larger platform corresponds to several squares.

Two consequences:

- A tracked platform that moves carries the whole virtual world with it while
  your body stays put. That is where the vast, vertical temple comes from.
- The step from platform *P* to platform *Q* is determined by the difference
  between their designated squares. **Virtual adjacency authors a real
  footstep.** And with only nine squares, the walk is bounded by construction.

### 2.3 Misalignment, and the gate that mostly removes it

This answers what was my biggest open question.

When tracking switches, the old and new platform *should* be aligned. If they
aren't — you stepped onto a platform that had already begun moving — **the
platform slides into its correct alignment under your feet.** A fifth-of-a-tile
correction is typically unnoticeable; larger ones "may feel a bit weird" but
resolve in a couple of seconds at most and are rare.

The refinement is the interesting part:

> Early on, the correction also kicked in if you stepped onto an **incoming**
> platform prematurely. Johansen realised this was superfluous: the frame of
> reference would move a little toward the platform, then come straight back
> where it was. *"Instead of moving the frame of reference a bit in one
> direction and then the opposite direction, it feels better to just keep it
> where it is until the platforms are correctly aligned."*
>
> So tracking is now simply **prevented from switching to an incoming platform
> until it is properly aligned.** This **cut the situations needing correction
> in half** and "improved the experience a lot for people who are eager to step
> onto new platforms."

So the handover rule is **gated, not immediate** — hysteresis on alignment. The
correction still exists for the other case (stepping onto a platform that is
already leaving), where there is no later moment of alignment to wait for.

### 2.4 Getting the player's cooperation

A whole layer I had no idea existed, and the most quietly clever part of the
design: the system depends on the player only stepping across **when platforms
are lined up**, so the game has to *ask*, and then *nudge*.

- **It says so outright.** A safety instruction before the game starts tells you
  not to jump over gaps. Two reasons, in his order: **safety** (jumping risks
  jumping out of the play area into a wall) and, less critically, the traversal
  logic only works when platforms line up.
- **Foot fences.** Where a moving platform arrives alongside a larger static one
  in a way that *would* let you step off early and break the tracking logic, he
  places small fences. They are **purely visual and prevent nothing** — you can
  step over or straight through them.

> *"Psychologically it feels like less effort to not step over or through a
> fence and instead step onto the static platform where there's a gap in the
> fence. In this way, a purely non-technical solution is used as part of the
> game's arsenal of tricks."*

**A visual affordance solving a systems constraint, with zero code in the
critical path.** That is the single most transferable idea in the article.

---

## 3. Level design as a constraint solver

I had the pattern overlay half right. The actual authoring mechanism is better.

He made a pattern representing the play area — **a thick white border along the
edge, a thick circle in the centre**. Every platform carries that pattern as an
overlay showing its designated spot, so you can see at a glance whether a
platform sits at the centre, an edge or a corner.

**The part I missed, and the part that does the real work:**

> Additional overlays show a **ghostly version of the pattern at both the start
> and end positions of a moving platform.** *"This is the real trick of keeping
> track of how the platforms connect together, because these ghostly overlays at
> the end positions make it trivial to see if the platforms are lined up
> correctly in the level design when they touch each other. If the adjacent
> ghostly patterns are continuous like puzzle pieces that fit together, then the
> platforms work correctly together."*

A moving platform is drawn at *both ends of its travel*, and correctness becomes
a **visual continuity check between neighbours** — do the patterns tile? The
constraint stops being arithmetic you verify and becomes a picture you look at.

He is candid that this doesn't make it easy: *"it still took a lot of ingenuity
to work out how to position all the platforms so they both fit correctly
together and also take the player where they need to go"* — the overlay kept the
**complexity manageable**, not small.

He also debugged in **mixed-reality footage with the play-area grid overlaid on
the real room** (captured via LIV — see §6).

From his earlier 2018 write-up, what was actually hard was not the platforms but
authoring a large, non-linear, interconnected 3D world *through* the constraint:
no document type he tried captured the three-dimensionality; Unity tilemaps made
multi-storey planning painful because each layer edits separately; he spent over
a year on a world redesign focused on **verticality** — the one dimension a
2 × 2 m floor gives you free, since elevators cost no floor.

---

## 4. The constraint eats the rest of the game

This is the section with no equivalent in any secondary coverage, and it is the
real cost of the design. The play area doesn't just constrain locomotion — it
constrains **everything the player does with their arms**.

### The whip

Whip movements are "quick and drastic", so the player can't be near the play-area
edge while using it. Therefore:

> **The whip can only be used when standing on a platform that corresponds to the
> centre of the play area.**

Downstream consequences, all of them design losses he accepted:

- It **ruled out** a flying-scarab fight that would have taken place while
  stepping between platforms.
- Every whip puzzle, and every breakable pot, had to be authored so the whip
  usage happens from a centre platform.
- Players would naturally whip for fun anywhere, so the whip **rolls up into an
  inactive state** whenever you're not on a platform where it's intended. *"This
  can feel like a bummer for some players, but I made the decision that safety
  simply comes first."*
- The partial workaround: platforms on tracks that **all** correspond to the
  centre square, with the whip temporarily disabled on the connecting rollers.
  Used only a few times in the whole game, because it demands a lot of player
  attention.

### The gems

Gems sit in **swirly arcs**, one arc per platform, collected by sweeping your
arms while standing there. Arcs are **doubly constrained**: a gem can't be inside
a virtual wall, and it can't be outside the play area (which might have you reach
into a *physical* wall). When both sides are blocked, the gems can only go
**above your head** — even though they're then less likely to be noticed.

> *"It would have been tedious to place all the gem arcs manually, taking all
> constraints into account, so I wrote an algorithm to automate the placement."*

**The play-area constraint got severe enough that collectible placement had to be
solved procedurally.** That is the clearest possible measure of how far this
design reaches past locomotion.

---

## 5. Embodied immersion — the dogma underneath

From the Meta developer blog article. The locomotion design is downstream of a
broader rule.

> **No buttons or interface elements come between the player and the game.**
> Eye of the Temple **doesn't use controller buttons or thumbsticks at all**,
> relying entirely on hand and body movements.

Three enabling decisions:

- You **permanently hold** a torch in one hand and a whip in the other — which
  removes the need for a pick-up button.
- You get around by stepping between moving blocks — which removes locomotion
  interfaces entirely.
- The play area is guaranteed by construction, which can reduce or eliminate
  reliance on the Guardian boundary.

### The thesis worth stealing

> Embodied immersion **doesn't have to be learned.** Nobody has to learn to look
> around with their head, or to take a step, or to swing something they're
> holding. So there is a **direct correlation between how embodied a VR game is
> and the ceiling on how intuitive it can be** — how approachable it is to
> someone with no game literacy at all.

Immersion and approachability, usually treated as a trade-off, are the *same
axis* here. That reframing is the most valuable single idea across all four
articles.

### The distinction that makes it workable

There are still levers to pull and torches to light. Those are **interfaces
within the game world**, not interfaces between the player and the game — *"just
like how there are interfaces all around us in the physical world, such as door
handles, knobs on stoves, and steering wheels."*

### The full button-less vocabulary

Worth reading as a list of verbs, because that is exactly the form our own
movement grammar takes:

```
step onto a platform
duck under an obstacle WHILE ON a moving platform
dodge to the side to avoid an obstacle WHILE ON a moving platform
step onto a barrel-shaped platform and move your feet to stay on top as it rolls
tap or hit pots with the torch, or whip them, for the gems inside
whip enemies, or hit them with the torch
light your torch by holding it near a flame
light other torches with your own
activate levers by pushing them with the torch or whip handle
use the whip to grab and switch unreachable levers from a distance
```

**Rows two and three are RAVE RAID's vocabulary — duck, dodge sideways — layered
on top of a moving platform.** That combination is the unbuilt thing; see §8.

### Knowing when to break your own rule

One controller button opens the in-game menu. He calls this a deliberate break
of the dogma and is comfortable with it: settings and quitting are
meta-communication that can't be made diegetic, and **you can finish the entire
game without ever pressing it** if you don't want to change settings. Diegetic
area-title text and optional subtitles are the other accepted compromises.

---

## 6. The Quest port, and the mixed-reality work

**Quest port** (with Salmi Games — he didn't want to attempt it without a
partner experienced on the platform):

- **They built their own manual occlusion system** on top of Unity's, disabling
  parts of the world that aren't visible according to **manually defined
  boundaries**, in order to support the expansive world.
- The large environments "put pressure on everything else", so things had to be
  optimised further than in other Quest 2 games.
- **Lighting and water effects were reimplemented from scratch** to keep the
  aesthetic on mobile.

Straight into [`02-environments-quest3.md`](02-environments-quest3.md): a big
open world's dominant cost is submitting what you can't see, and the
shipping-quality answer was hand-authored culling volumes.

**The LIV integration** — this is what the "camera framing" note in my earlier
draft was actually about, and it's capture tech, not game camera:

- **The torch lights your real body.** Manipulating LIV's foreground layer: in
  shadow, slightly opaque black pixels are drawn over the foreground and masked
  by the player cutout, so you read as being in the dark; in light, those pixels
  go fully transparent. Generalisable to any player-state feedback (flash red on
  damage).
- **The foot-clipping fix.** In a game where you move exclusively by walking,
  feet drift in front of the headset and get cut off by the foreground layer. He
  added a **clipping plane above the ground** so the ground and everything below
  it is never in the foreground, however close to the camera.
- **A custom avatar camera** that keeps itself out of walls, frames the shot, and
  **uses cuts instead of excessive motion** — cinematic capture with no work from
  the creator.

Also: *First Steps* is roughly **an eighth** of the full campaign; the full game
is ~4 hours plus a replayable speedrun mode.

---

## 7. Johansen's own comparison of room-scale approaches

He sets out four, with the trade-offs. This is the author of the most extreme
example in the field grading his own approach honestly, and it is the best short
survey of the space I've found.

| Approach | Example | Immersion | Design cost |
| --- | --- | --- | --- |
| **Small virtual space** | Job Simulator | + maximum immersion | − game must take place in small spaces |
| **Teleport + room-scale** | The Room VR | − post-teleport position often awkward relative to nearby walls and objects<br>− an interface people must learn<br>− once learned, still takes focus and reduces immersion (exception: when teleport is diegetic, as in Budget Cuts) | − moderate restrictions to accommodate jumps in position |
| **Non-Euclidean space** | **Tea for God** | + stepping with your own feet<br>+ no interface at all to learn<br>− limited ability to form a mental map, since it isn't spatial in a traditional sense | − big restriction to design around<br>− spaces tend to be **dominated by cramped corridors with limited overview of the world** |
| **Moving platforms** | Eye of the Temple | + stepping with your own feet<br>+ no interface at all to learn | − big restriction to design around<br>− combining platforms with other game elements poses **constant** design challenges |

His conclusion: moving platforms **can produce one of the strongest experiences
of immersion**, because you move physically around large open environments with
no interface — *"a great feeling of exploration to see interesting things in the
distance, and then make your way there in a way that feels like it's with your
own feet and body."* The cost is some of the biggest design restrictions
available, and some of them are visible to the player: **"there's moving
platforms everywhere, which can feel somewhat contrived."**

Two things to carry out of this table:

- **Tea for God** is the non-Euclidean exemplar he names, and belongs alongside
  Spellbound Spire in [`01`](01-vr-movement-mechanics.md). His criticism of the
  family — cramped corridors, no mental map — is a real cost that Spellbound
  Spire's own material doesn't mention.
- Moving platforms are the only family in the table that gets **own-feet
  immersion, no interface, AND a Euclidean world you can build a mental map of.**
  That combination is the actual prize.

And his closing line, which is the reason this repo exists:

> *"My impression is that most games have stopped experimenting with how to make
> the most of room-scale VR, but I think there's still a lot of untapped
> potential and creative solutions not yet discovered."*

---

## 8. What transfers to us

### The origins, because they're instructive

The core mechanic came from **side-scrolling Sonic** — the slow sections where
you ride one moving platform to reach another. **Ico** supplied the world:
atmospheric environments, huge structures that make you feel small, a strong
sense of verticality, and **extensive backtracking that loops you through earlier
areas and makes the world feel tangible and real**. Indiana Jones arrived
*emergently* — friends kept saying it felt like being Indy, so he leaned in and
built a physically simulated whip with custom physics.

And, most usefully for us: because the platforms produce "a kind of clockwork
design that can at times feel almost turn-based even though movements are in
real-time", he took inspiration for several challenges from **Lara Croft Go — a
turn-based puzzle game.** He identified the emergent rhythm of his own system and
went shopping in the genre that already has that rhythm.

**We are that genre.** The clockwork quality that reads as a limitation in an
adventure game is the native grammar of a rhythm game.

### Directly reusable

1. **The ghost-overlay continuity check.** Draw every moving element at both ends
   of its travel, stamped with its play-area claim, and make correctness a
   question of whether neighbouring patterns tile like puzzle pieces. We already
   write Playwright probes against the live app (`teleport-rules`,
   `judge-overlap`, `floor-clear`); this is the same instinct, one level earlier
   — a *visual* invariant rather than an asserted one.
2. **Foot fences.** A purely visual affordance that costs nothing and prevents
   nothing, but makes the wrong action feel like more effort. We have exactly one
   place this idea belongs today — the club's teleport arc already burns hazard-red
   on an invalid landing, which is the *stop* version. The fence is the *don't
   bother* version, and it's gentler.
3. **The gated handover.** Don't correct a transition you can simply refuse to
   start. Wait for alignment instead of moving and un-moving. Cheap, and it
   halved his correction cases.
4. **Assume the minimum play area; don't adapt.** He is explicit that adapting was
   neither viable nor desirable. This is a genuine counter-argument to the
   `bounded-floor` idea in [`01`](01-vr-movement-mechanics.md#4-iwsdk--what-the-sdk-actually-gives-us),
   and it's stronger than it first looks: adapting means every authored
   constraint becomes a *function of* play-area size, and he had constraints on
   whip usage and gem placement, not just platform positions. **Our deck is
   already fixed at 1.72 × 1.5 m for the same reason** — the telegraph geometry
   is authored against it. The honest conclusion is that `bounded-floor` is
   useful for *validation* ("your room is too small, here's what that costs")
   rather than for *adaptation*.
5. **Manual occlusion volumes**, straight into the environment playbook.

### The collision worth building

Johansen's own button-less list contains **duck under an obstacle while on a
moving platform** and **dodge to the side to avoid an obstacle while on a moving
platform**. Those are RAVE RAID's `sweep` and `beam` — performed on ground that
is itself in motion.

Everything needed already exists on both sides:

- IWSDK ships **kinematic `LocomotionEnvironment` with platform velocity
  inheritance** — a moving platform that carries the player is solved in the SDK
  we already depend on, and `dance` sets `locomotion: false` and never touches it.
- Our telegraph grammar already teaches a floor to say *this ground is about to
  stop being yours*.
- Our **floor manager already tracks a park** — where a correct dodge leaves a
  dancer. That is a play-space position model, which is precisely the input a
  frame-of-reference handover needs. Extending it from "does this move demand
  something of that ground" to "does this sequence return the dancer to centre"
  is the balanced-ledger invariant, and it is a short step from the code as it
  stands.
- His platforms run on **set loops**; ours would run on **bars**. Same
  determinism, better justified.

And the roller stays the sharpest unbuilt idea: a cylinder converts a *rate* into
a *walk*. Give the rate a tempo and you get a groove performed with the feet —
the one thing our groove system, which lives entirely in the hands, never asks of
the lower body.

---

## 9. What was wrong in the first draft

Worth recording, because it's a lesson about the sourcing rather than the game.

- **The pattern overlay.** I had "every platform is stamped with the play-area
  pattern", which is true but is the *setup*. The mechanism is the **ghostly
  overlays at both ends of a moving platform's travel** and the puzzle-piece
  continuity check between neighbours. Secondary coverage described the artefact
  and missed the method.
- **"Camera framing"** as an open question was wrong. It's the **LIV avatar
  camera**, not an in-game camera — capture tech (§6).
- **The handover rule** I listed as unknown is **gated on alignment**, with
  slide-correction only for the already-leaving case (§2.3).
- **Larger play spaces**: answered, and the answer is a deliberate *no* (§1).
- I had **no idea** the play-area constraint reached into whip usage and
  collectible placement (§4). That is the largest single gap the primary sources
  closed, and it changes the cost estimate for anything in this family.

The general lesson: search summaries reliably capture *what a system is* and
reliably miss *how it was made to work*. Every correction above is of that shape.

---

## 10. Still open

Much shorter than it was.

1. **Rotation.** Secondary coverage says the map "intelligently redirects the
   player's orientation". None of the three primary articles addresses yaw
   directly, so it remains unclear whether there is any rotational redirection or
   whether orientation is purely a consequence of authored geometry. Given how
   carefully he avoids anything the body can detect, pure geometry is the safe bet
   — but it isn't stated.
2. **The full platform taxonomy.** We have static, translating, vertical
   (elevators), rollers, minecarts and platforms-on-tracks. Whether that's the
   complete set, and how the variety is paced across a 4-hour game, is still
   unknown.
3. **What the tracked platform does about a player standing across two.** The
   gate says tracking won't switch to a *misaligned incoming* platform, but not
   what decides the switch when two are aligned simultaneously.
4. **The environment/performance articles on `developers.meta.com`** — still
   blocked by this session's egress policy, browser included (a headless Chromium
   hits the same proxy: `ERR_TUNNEL_CONNECTION_FAILED`). These are the primary
   sources for [`02`](02-environments-quest3.md), which currently rests on search
   summaries the way this file used to.

---

## Sources

**Primary — supplied in full, and the basis of this note:**

- Rune Skovbo Johansen, *The Hidden Design Behind the Ingenious Room-Scale Gameplay in 'Eye of the Temple'*, guest article, [Road to VR](https://www.roadtovr.com/eye-of-the-temple-design-room-scale-vr-gameplay/), 17 May 2023 ([page 2](https://www.roadtovr.com/eye-of-the-temple-design-room-scale-vr-gameplay/2/))
- Rune Skovbo Johansen, *Approachable and Immersive Design in 'Eye of the Temple'*, [Meta Horizon developer blog](https://developers.meta.com/horizon/blog/eye-of-the-temple-vr-immersion-game-design/)
- *The Origins and Inspirations of 'Eye of the Temple'* — interview, [Meta Quest blog](https://www.meta.com/blog/eye-of-the-temple-vr-meta-quest-2-platformer/)
- *Developing Eye of the Temple with LIV: Game Developer Insight*, [LIV blog](https://www.liv.tv/blog/developing-eye-of-the-temple-with-liv-game-developer-insight)
- [Behind the design of Eye of the Temple — runevision blog](https://blog.runevision.com/2023/05/behind-the-design-of-eye-of-the-temple-out-on-quest-2.html) (the index post linking the three)

**Secondary:**

- [Level design workflows — runevision blog](https://blog.runevision.com/2018/07/level-design-workflows.html) · [June update: Verticality, puzzles, whip](https://blog.runevision.com/2017/06/june-update-verticality-puzzles-whip.html)
- [Eye of the Temple — official site](https://eyeofthetemple.com/) · [FAQ](https://eyeofthetemple.com/faq.html)
- [Eye Of The Temple Review — UploadVR](https://www.uploadvr.com/eye-of-the-temple-review/)
- [Eye of the Temple — Adrian Hon, *Have You Played?*](https://adrianhon.substack.com/p/eye-of-the-temple) (the sharpest critical take)
- [Metacritic](https://www.metacritic.com/game/eye-of-the-temple/) · [6DOF Reviews](https://www.6dofreviews.com/reviews/eye-of-the-temple-review)
- Mentioned by Johansen as comparisons: Job Simulator, The Room VR, Budget Cuts, **Tea for God**
