# Beautiful spaces, cheap — environment technique and level design for Quest 3

Research notes. The question: **what actually buys visual fidelity per frame
spent on standalone Quest 3 in WebXR**, and what does the level design around
it have to look like.

The short version: on a tiled mobile GPU driving 2064 × 2208 per eye at 90 Hz
through a browser, you are not triangle-bound and you are rarely
shader-bound. You are **draw-call bound, bandwidth bound, and texture-memory
bound**, and the wins come from *structure* — batching, instancing, layering,
and lighting that was computed before the app started.

---

## 1. The machine you're actually rendering on

**Quest 3** — Snapdragon XR2 Gen 2, GPU based on **Adreno 740**,
**2064 × 2208 per eye**, WebXR at **90 Hz** (so ~11.1 ms of wall clock for
everything, CPU and GPU, with the compositor already taking a bite).

The architectural fact that governs everything:

> **It is a tile-based deferred renderer.** The frame buffer is split into
> small rectangular tiles. All geometry is projected and binned to tiles up
> front; then each tile is shaded entirely in fast on-chip tile memory
> (**GMEM — ~2 MB on XR2 Gen 2, up from 1 MB on the previous generation**) and
> written out to system memory once.

Consequences you have to design around:

- **Individual draws are cheap on the GPU; issuing them is expensive on the
  CPU.** Meta's own guidance is blunt: submitting 1000 individual triangles as
  1000 draw calls will drop you below 72 fps on CPU cost alone, even though
  the GPU could render orders of magnitude more triangles.
- **Resolves are expensive.** Anything that forces a tile to be stored and
  re-loaded (render-target ping-pong, most post-processing, planar reflection
  passes) costs full-framebuffer bandwidth. **Post-processing is the single
  most disproportionate cost on a tiler.** This is why the "cheap bloom"
  answer on Quest is *additive geometry*, not a bloom pass.
- **MSAA is nearly free** because it resolves inside GMEM. Take it. IWSDK
  already asks for `antialias: true`.
- **Overdraw with transparency is a real cost** — alpha blending defeats the
  early-Z benefits of binning. Additive sprites are cheap in *count* but you
  still pay for every covered pixel, so keep them small or few.

### Budgets to design to (WebXR, Quest)

- **50k–150k triangles** total scene is the working range for mobile VR WebXR.
- **≤ 256 MB texture memory** for stable performance (Quest 2 figure; treat as
  the safe ceiling).
- **72 fps minimum, 90 fps target.** Quest 3 WebXR runs at 90.
- **Draw calls are the binding constraint.** A useful working target for
  three.js on mobile is *low hundreds at most*, and under ~100 if you want
  headroom for gameplay.
- **KTX2 / Basis Universal** is Meta's recommended texture format for WebXR:
  it stays compressed on the GPU (roughly **10× smaller in memory** than
  uncompressed PNG-decoded data) and transcodes to whatever native format the
  device wants.

### Free wins available in the browser

- **`OCULUS_multiview`** (WebGL 2 only; the upgraded `OVR_multiview2` with MSAA
  support). Renders both eyes in one pass. Benchmarks show a consistent
  **~40% improvement** for stereo. `OCULUS_multiview` is available in Quest
  Browser out of the box; `OVR_multiview2` sits behind a flag. **three.js
  supports it, and IWSDK already turns it on** — `world-initializer.js`
  constructs the renderer with `multiviewStereo: true`. Free 40%; check it's
  actually active before optimising anything else.
- **Fixed Foveated Rendering.** Peripheral pixels shaded at lower resolution;
  near-imperceptible, and pure GPU savings since VR is usually pixel-heavy.
  Use a *subsampled* layout at FFR level 2 or higher to avoid artefacts.
- **`framebufferScaleFactor`** on the WebXR layer — the crudest, most
  effective dial in WebXR. Ship at 1.0 only if you've measured that you can.
- **WebGPU is experimental in Quest Browser as of April 2026.** Not a
  production target yet, but the direction of travel: WebGPU's wins are
  precisely in draw-call-heavy scenes and compute (2–10×), which is the
  bottleneck we actually have.

---

## 2. The techniques ladder — what buys fidelity, in order

This is the ordering `dance` arrived at empirically while building THE VOID
(`src/arena/voidkit.ts`), and it holds up against everything in the wider
literature. Ordered by **return per frame-millisecond spent**.

### 1. The mirror — a polished floor that doubles every light

The single biggest signature of a "high production value" neon space, and it
needs **no render pass**. Clone the scenery upside-down under a black-glass
floor and **re-share its instance buffers**:

```
mirrorOf() → one extra draw per bank. The reflection animates for free.
No second camera (stereo WebXR would charge double). No render target.
No resolve.
```

A real planar reflection is a second camera pass — in stereo, that's four
camera passes a frame plus two full resolves. The flipped-clone trick costs
one draw and zero bandwidth. It is only correct for a flat mirror plane, which
is exactly the case that matters.

### 2. Depth in layers — four silhouette scales at four distances

A black room reads as a *vast* room only if there is something at several
distances for parallax to separate as you move your head. THE VOID ships four:

```
NEAR   r 17 · 18 towers ·  7–14 m  — portholes, shafts, full detail
MID    r 31 · 26 towers · 13–24 m  — bigger silhouettes, no fine work
FAR    r 50–88 · 58 slabs · 20–54 m — pure parallax skyline
SKY    a low horizon band at r 92, dust drifting through all of it
```

Head-motion parallax is a depth cue VR gets for free and flat screens don't.
Spending geometry on *distance variety* rather than on *detail* is the
highest-leverage art decision in a headset.

### 3. Structure, not sticks — detail at three scales

Towers carry pinstripes, panel bands, porthole rows and a lit cap; the canopy
is a real truss (concentric rings tied by radial spars with lit nodes at the
joints). **Silhouette / panel / pinprick** — three scales of detail is what
"high poly" actually looks like from inside a headset, and it costs almost
nothing when the pieces are instanced.

### 4. Air — the middle distance needs to be *something*

Narrow light shafts, drifting dust, a low horizon glow. **An empty black gap
reads as a wall until something drifts in it.** Volumetric-looking air, done
with a handful of additive cones and a Points cloud, is the cheapest possible
purchase of "depth".

### The hard-won negative rule

> **The sky stays black.**

Wide additive volumes — fog cones, zenith discs, tall horizon cylinders —
subtend most of your field of view and flatten the entire room into one
colour. The first pass at THE VOID had all three and looked *worse* than what
it replaced. **Light the structure; keep the horizon a line with a short
gradient over it, never a wall.**

This generalises: in a headset, anything covering a large solid angle is
simultaneously the most expensive thing you can draw (overdraw) and the most
destructive to contrast. Big translucent volumes are a double loss.

---

## 3. The batching discipline

Two mechanisms carry the whole thing.

### InstancedMesh + per-instance colour

Everything repeated is an `InstancedMesh`, and every animated glow is driven
through **per-instance colour** — `MeshBasicMaterial` multiplies `material.color`
by `instanceColor` — so **a hundred towers pulsing independently is one draw
call.**

That last point is the non-obvious one. Instancing is usually taught as "many
copies of a static thing". The trick that makes it carry a *lit, animated*
scene is realising that per-instance colour is a free animation channel: you
can drive a whole light show through the instance colour buffer without ever
breaking the batch.

**Measured, for the set's entire world including the mirror:**

```
48 draw calls · ~24,000 triangles · 1,521 instances
```

— roughly **half the draw calls of the twelve hand-built pylon groups it
replaced**, for an order of magnitude more scenery.

### Static merge — collapse what never moves

`src/club/merge.ts` bakes a subtree of hundreds of small meshes into one mesh
per distinct material *look*. Materials are keyed by their **visible
properties** (type, colour, emissive, roughness, metalness, side, transparency,
texture UUIDs) rather than by object identity, so meshes built with their own
material instances still merge into one batch. Anything unmergeable
(multi-material, invisible, non-mesh) is left untouched, and the caller exempts
live objects — animated parts, raycast targets, canvas panels — with a `skip`
predicate.

The club — fluted pilasters, bottles, stools, cornice runs, railing posts,
none of which ever move — **bakes down to a handful of draw calls**. Same
triangles, same materials, same pixels; a hundredth of the CPU.

The three.js equivalent to reach for when geometries differ but materials match
is **`BatchedMesh`**; `InstancedMesh` when the geometry is shared. Between the
two, plus a static merge for the long tail, there is very little that
legitimately needs its own draw call.

---

## 4. Lighting: compute it before the app starts

The rule for standalone VR is that **real-time lighting is a luxury and
real-time shadows are usually a mistake.** The options, in cost order:

- **Emissive materials** — free. The whole VOID is "near-black gloss or pure
  emission". Colour says *whose*; brightness says *it's a light*.
- **Baked lightmaps.** Standard offline; there is also an in-browser GI baker
  for three.js (`@react-three/lightmap`) that renders the scene into a very
  low-res half-cubemap per texel and averages it, each pass adding a photon
  bounce — so surfaces in shadow pick up indirect contribution, and emissive
  surfaces act as area lights.
- **Light probes** (`LightProbe`, `LightProbeGenerator`) — diffuse spherical
  harmonics, functionally equivalent to an irradiance environment map, built
  from a cube texture or render target. Near-free per object.
- **A very small number of real lights.** The club runs **four real point
  lights + a hemisphere per interior**. Everything else is emissive or a glow
  sprite.
- **WebXR Lighting Estimation** exists (SH ambient + primary light direction +
  an estimated cube map) — relevant only for passthrough/AR, which we
  deliberately don't ship.

**And no post-processing.** From `src/arena/disco.ts`:

> *"no fullscreen post — the 'bloom' is additive sprites and cones over the
> void's black, which reads shockingly disco on a Quest."*

This is the single most important perf/art trade in the codebase. A bloom pass
on a tiler costs a resolve, a downsample chain and a composite, every frame, in
stereo. Additive sprites cost overdraw on the few hundred pixels they actually
cover — and because they are *geometry*, they can be animated per-instance and
mirrored in the floor along with everything else.

---

## 5. Textures: the asset you don't ship

`dance` ships **no image assets at all**. Every surface in the club is painted
at runtime onto small tileable `<canvas>` elements (`src/club/materials.ts`),
with a deterministic per-texture RNG so rebuilds look identical, and a cache
keyed by look.

```ts
tex.wrapS = tex.wrapT = RepeatWrapping;
tex.minFilter = LinearMipmapLinearFilter;   // mips matter more than resolution
tex.anisotropy = 4;
```

The trade: zero download, zero texture-memory surprises, perfect
art-direction control, and no artist pipeline — against no photographic
detail and some startup CPU. For a neon/graphic art direction that is
straightforwardly the right call. For a photoreal one it isn't, and then the
answer is **KTX2/Basis + trim sheets**.

**When you do ship textures**, the modern environment-art consensus is:

- **Trim sheets + texture atlases** — one sheet drives many modular pieces,
  minimal UV waste, and (crucially for us) *one material for many meshes*,
  which is what makes the static merge and `BatchedMesh` batch at all.
- **Decals as the final detailing pass** — grime, leaks, damage. Trim sheets
  paired with decals is how modern environments avoid the "too clean modular
  kit" look.
- **Vertex colour / RGBA masks** for variation without new textures.
- **Consistent texel density** — common targets ~512 px/m background,
  ~1024 px/m hero surfaces. Inconsistent texel density reads as "cheap" far
  more strongly than low resolution does.

**Roughness separation is what carries an "expensive" read**, and it is free:
plaster dead matte, velvet swallowing light, oak waxed, stone honed, brass the
one thing allowed to shine. Five materials that differ mainly in *roughness*
look more expensive than fifteen that differ in colour.

---

## 6. Level design for VR spaces

Technique without composition just gets you an efficient ugly room. The
design-side findings:

**Legibility and orientation.** It is easy to become disoriented in VR;
provide plenty of reference points. Landmarks work when geometry *contrasts*
with its surroundings and is *unique* — a landmark that looks like its
neighbours isn't one. Lighting, colour, and architecture are the levers for
subtly orienting a player and indicating paths.

**Scale only exists in the headset.** Scaling problems with props and their
placement frequently do not show up in the editor. Greybox, then wear it.

**Depth cues are load-bearing.** Use a lot of them, at multiple distances —
which is the design-side statement of the four-layer rule above.

**~3 m is the comfortable distance for UI.** Far enough to be legible, close
enough not to fight the scene.

**Detail discipline that reads as "designed" rather than "modelled"** — the
club's rules, which generalise:

- **Every edge carries thickness.** Skirting, dado, picture rail, nosings,
  fluting, joints. Zero-thickness edges are the number one tell of a cheap
  space, and edges are where a headset's stereo acuity actually looks.
- **Wear where hands and feet go.** Terrazzo scuff, marble condensation rings.
- **No five adjacent modules identical.** The modular-kit tell.
- **Reserve saturated colour for *light*.** Coves, candles, signage, drinks,
  the chandelier. Everything else is material. This is what stops a neon
  vocabulary from becoming visual noise — and it also keeps the *gameplay*
  colour language (hazard amber→red) exclusive.

**Duck the scenery when the gameplay needs the eye.** THE VOID dims with the
light rig while a telegraph owns your deck: *danger never competes with
scenery*. In a game where the floor is the instruction, art direction has to
be able to get out of the way on cue. This is a systems requirement, not a
polish pass — the environment needs an `energy` input from day one.

**Occlusion is a level-design job, not just an engine feature.** The Eye of
the Temple Quest port is the cautionary tale: the team **built their own manual
occlusion system** on top of Unity's, disabling parts of the world according to
**manually defined boundaries**, because an expansive world put pressure on
everything else. They also had to **reimplement lighting and water from
scratch** to keep the aesthetic on mobile. Budget for the fact that a big
space's *real* cost is submitting the parts you can't see.

---

## 7. What's new in 2026 and worth watching

- **Gaussian splats have arrived on Quest 3 for real.** Niantic's Scaniverse
  shipped an *Into The Scaniverse* WebXR site (Quest 3 / 3S in the Horizon OS
  browser) before shipping as a store app; Gracia is on the Quest Store. VR-GS
  and follow-on research have made splats physics-aware and interactive rather
  than purely photographic, and cluster-based LOD systems
  (*Virtualized 3D Gaussians*) are making composed multi-splat scenes
  practical. For a *stylised neon* game this is not the right tool — splats are
  a capture technology and they don't light, animate or telegraph. For
  **backdrops, skyline layers and distant scenery** they are potentially an
  enormous win, because they replace exactly the geometry we currently spend on
  parallax layers.
- **WebGPU is experimental in Quest Browser (April 2026).** Its wins land
  precisely on our bottleneck (draw calls, compute). Not shippable yet; worth
  a prototype branch.
- **`BatchedMesh`** in three.js is the missing middle between `InstancedMesh`
  and a static merge, and it supports per-instance visibility and frustum
  culling that a merged mesh throws away.
- **Multiview in three.js** is real and IWSDK enables it. Verify it, don't
  assume it.

---

## 8. The checklist, condensed

**Before art:**
- [ ] Confirm multiview is actually active. It's the biggest single number.
- [ ] Pick a `framebufferScaleFactor` from measurement, not hope.
- [ ] Enable FFR (subsampled layout at level ≥ 2).
- [ ] Decide the lighting model up front: baked + emissive + ≤ 4 real lights.
- [ ] Decide "no post-processing" up front. Retrofitting *out* of a bloom pass
      means rebuilding the art.

**While building:**
- [ ] Everything repeated → `InstancedMesh`, animated via per-instance colour.
- [ ] Everything static → merged by material *look*, with a `skip` for live
      objects.
- [ ] Four depth layers minimum; detail at three scales.
- [ ] Textures: trim sheets + decals + KTX2, or painted-at-runtime canvases.
      Not a pile of unique PNGs.
- [ ] Fog only where it's cheap and bounded (indoors). Never a sky volume.
- [ ] Every edge has thickness; wear where hands and feet go; no five
      identical neighbours.

**Measure:**
- [ ] Draw calls (target: low hundreds, ideally < 100).
- [ ] Triangles (50k–150k).
- [ ] Texture memory (< 256 MB).
- [ ] Frame time at 90 Hz (11.1 ms, minus compositor).

---

## Sources

- [WebXR Performance Optimization — Meta Horizon OS Developers](https://developers.meta.com/horizon/documentation/web/webxr-perf/) · [Best Practices](https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/) · [Optimization Workflow](https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/)
- [Multiview WebGL Rendering — Meta Horizon OS Developers](https://developers.meta.com/horizon/documentation/web/web-multiview/) · [Multiview in WebXR — Fernando Serrano](https://fernandojsg.com/article/multiview-on-webxr/) · [OCULUS_multiview support in three.js — three.js forum](https://discourse.threejs.org/t/oculus-multiview-extension-support-added-to-three-for-quest-performance/80202)
- [Advanced GPU Pipelines, Loads, Stores and Passes — Meta](https://developers.meta.com/horizon/documentation/unity/po-advanced-gpu-pipelines/) · [Draw Call Cost Analysis for Meta Quest](https://developers.meta.com/horizon/documentation/unity/po-draw-call-analysis/)
- [Adreno GPU on Mobile: Best Practices — Qualcomm Game Developer Guide](https://docs.qualcomm.com/bundle/publicresource/topics/80-78185-2/mobile_best_practices.html)
- [Fixed foveated rendering (FFR) — Meta](https://developers.meta.com/horizon/documentation/unity/os-fixed-foveated-rendering/)
- [Browser specifications / Release notes — Meta Horizon OS Developers](https://developers.meta.com/horizon/documentation/web/browser-specs/)
- [KTX2Loader — three.js docs](https://threejs.org/docs/pages/KTX2Loader.html) · [Choosing texture formats for WebGL and WebGPU — Don McCurdy](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)
- [LightProbe / LightProbeGenerator — three.js docs](https://threejs.org/docs/pages/LightProbe.html) · [Simple GI lightmap baker for three.js — unframework](https://unframework.com/portfolio/simple-global-illumination-lightmap-baker-for-threejs/)
- [Trim Sheets & Texture Atlases: The Game Environment Workflow — 3D Texel](https://3dtexel.com/trim-sheets-texture-atlases-the-game-environment-workflow/) · [Crafting Modular Assets for Stylized Environments — ArtStation](https://www.artstation.com/blogs/alexnevarez/EKGPo/crafting-modular-assets-for-stylized-environments-optimized-trim-sheets-and-unique-textures)
- [Composition — The Level Design Book](https://book.leveldesignbook.com/process/blockout/massing/composition) · [Top 6 Tips for VR Level Design — 4Experience](https://4experience.co/top-6-tips-for-vr-level-design/)
- [Niantic's Gaussian Splat Scaniverse Is Now An App On Quest 3 — UploadVR](https://www.uploadvr.com/niantics-gaussian-splat-scaniverse-is-now-an-app-on-the-quest-store/) · [Gracia brings Gaussian Splats to Quest 3 — MIXED](https://mixed-news.com/en/gracia-quest-3-hands-on/) · [VR-GS (arXiv)](https://arxiv.org/pdf/2401.16663) · [Virtualized 3D Gaussians (arXiv)](https://arxiv.org/pdf/2505.06523)
- [Dodge Deadly Traps and Solve Ancient Puzzles in 'Eye of the Temple' — Meta Quest Blog](https://www.meta.com/blog/eye-of-the-temple-vr-meta-quest-2-platformer/) (Quest port occlusion + lighting rework)
- Primary source: `yellkell/dance` — `src/arena/voidkit.ts`, `src/arena/environment.ts`, `src/arena/disco.ts`, `src/club/merge.ts`, `src/club/materials.ts`, `DESIGN.md`.
