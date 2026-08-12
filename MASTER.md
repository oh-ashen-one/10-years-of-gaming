# 10 YEARS OF GAMING — Master Production Bible

**Project:** Recreate the top trending game of each year 2016–2026 as a fully
playable, high-quality ~10-minute browser game — for a YouTube video series.
**Repo:** `/Users/midir/10-years-of-gaming` → https://github.com/oh-ashen-one/10-years-of-gaming
**This file is the source of truth.** Every game build reads it first.

---

## §1. Mission and the bar

Eleven games. One per year, 2016 through 2026. Each is a **fan recreation** of
that year's defining title — real mechanics, real fantasy, everything rebuilt
from scratch in code. No ripped assets, no ROMs, no emulation: every mesh,
texture, and sound is generated procedurally by us.

**The bar:** a paused screenshot of any of the eleven could sit on a Steam
page. The reference for what that means is the Dusk standard — two sibling
browser games built on this machine:

| Reference | Local | What it is |
|---|---|---|
| **Dusk Riders** (motocross) | `~/Qwen-3.8-motorcycle` | Cel-shaded sunset grand prix. The craft bible. |
| **Dusk Skaters** (rollerskating) | `~/Qwen-3.8-project` | Same pipeline retargeted to a different sport. |

Do not copy their files. Do not copy their desert-sunset look. Copy their
**craft**: the discipline that makes a generated-in-code game look authored.

**Same studio, eleven different movies.** All eleven games share one rendering
soul (§2–§4). Each gets its own palette accents, its own world, its own sky,
its own hero light. A viewer should be able to say "these are all from the
same team" and "each one instantly reads as THAT game" at the same time.

**The 10-minute promise:** title screen → complete game loop → results beat,
finishable by a stranger in 8–12 minutes, playable entirely on keyboard.

---

## §2. The Dusk study — craft bible

Distilled from reading both Dusk repos end to end. This is what "quality"
mechanically consists of. Every game must implement every line.

### 2.1 Stack

- Vite 5 + TypeScript (strict, ES2022, bundler resolution) + **Three.js 0.169
  as the only runtime dependency**.
- Playwright (devDependency) for the film test only.
- **Zero external assets.** No textures, no models, no audio files, no fonts
  beyond system stacks. Everything is generated in code.
- `npm run dev` (unique port per game, strictPort), `npm run build`
  (`tsc --noEmit && vite build`), `npm run shoot` (film test).

### 2.2 The NPR rendering recipe (the look)

1. **4-band quantized diffuse.** A 4×1 `DataTexture` ramp (bands ≈
   0.30/0.52/0.76/1.0), `NearestFilter` — hard bands, sampled at `ndl*0.5+0.5`.
   Never smooth Lambert.
2. **Two-temperature lighting.** Warm key tint × ramp over a cool ambient
   floor color. Every scene has a warm side and a cool side, decided by the
   game's hero light.
3. **Two-tone fresnel rim** (`pow(1-N·V, 3)`): hot rim on the key side, cool
   rim on the shadow side, switched by a `step` on ndl.
4. **Banded specular** — `step(0.5, pow(N·H, k))`. Hard-edged highlight
   shapes, never a soft blob.
5. **Painted matcap for "metal"** — a small canvas-painted gradient sphere
   with a glint, mixed by a banded factor. Never a real env probe.
6. **Quantized distance haze** — `smoothstep` then `floor(f*5+0.5)/5`. Stepped
   haze bands into the horizon color, never fog soup.
7. **Ink, two passes:**
   - *Hull outlines* — back-face-extrusion shells pushed along normals by
     `widthPx * pixScale * depth-term` for **constant screen-space width**;
     geometry must be `mergeVertices`-smoothed or boxes split.
   - *Interior ink* — post pass: 3×3 Sobel on linear depth **and** normals
     reconstructed from cross-derivatives of view-space positions. Skip sky
     pixels. Fade with distance.
8. **Finishing:** ink-flavored vignette, ±1/255 output dither (keeps 8-bit
   band boundaries clean), 4× MSAA on the render target, `antialias:false`,
   `SRGBColorSpace` output, **`NoToneMapping`** — graphic, not filmic.
9. **Shared environment uniforms** (`sunDir`, tints, haze, time, origin-shift)
   referenced by every material — one object recolors/times the whole world.

### 2.3 Sky = painting

Never a clear color. A BackSide sphere pinned to the far plane that follows
the camera XZ:

- Hard cel band ladder by elevation (per-game colors).
- One **hero light**: graphic sun/moon/ Erdtree-glow / spaceship-streak —
  hard disc, stepped glow rings, optional chunky rotating rays.
- Flat cel clouds: periodic-azimuth fbm, stepped bodies, hot underlit rims
  weighted toward the hero light.
- 2–3 depth planes of **silhouette rings** (quantized fbm shapes, flat
  material, lerped toward haze by distance): mesas, city blocks, ship ribs,
  castle spires — per game, never reused shapes.

### 2.4 Code organization (the studio shape)

~4.5k lines per game. Small single-responsibility files, one directory per
system named after the domain. **Every file opens with a block comment
stating its responsibility and design intent.**

- `game.ts` is **render-free**: phases, scoring, events. It never imports a
  renderable. `main.ts` subscribes to `game.events` and maps them to
  HUD/audio/camera/FX. One direction only: game → events → presentation.
- **One spatial truth**: a single `heightAt()` (or navmesh/SDF equivalent)
  consumed by BOTH renderer and physics. Bake, never displace-in-shader.
- Builder functions return rigs: `{ group, update(dt, state) }`.
- Constants blocks at file tops, tuned by eye.
- Palette architecture: one `palette.ts` with semantic groups
  (ink / sky ladder / terrain bands / accents / haze+silhouettes /
  character pairs) and a cached `col()` helper. No rogue hexes anywhere.

### 2.5 Feel systems

- **Physics:** custom arcade, semi-implicit Euler, dt clamped. Tunable
  constants + explicit state machines (ground/air/slide, clean/sketchy/bail).
  Visual-only outputs (suspension squash, chatter) separated from sim state.
- **Camera:** spring chase — exponential lerp `1-exp(-dt*k)`, speed-scaled
  stiffness/distance/look-ahead, FOV kick with speed, mode machine
  (chase/orbit/ceremony), **beauty-shot bias** (on big moments, slide so the
  hero light sits behind the subject), decaying multi-sine shake.
- **Audio:** 100% WebAudio synthesis. Master = Gain → DynamicsCompressor →
  destination. Persistent voices (engine/wheels/ambience) tracked to gameplay
  scalars with `setTargetAtTime` smoothing. One-shots from two primitives:
  `tone(freq,dur,type,gain,glideTo)` and `noiseShot(dur,filter,f0,f1,gain)`.
  No 220 Hz test tones, no silence.
- **HUD:** DOM + canvas2d, no framework. House CSS: dark translucent fill,
  3px ink border, 5px hard offset shadow, slight `skewX`, italic 900 weight,
  palette hexes only, deliberately choppy `steps(2)` pulses. Instruments, not
  strings: arcs, cells, real minimap polylines. ~30 Hz updates.
- **FX that explain the game:** dust/roost/sparks/petals/ember particles that
  sell speed and impact; persistent ground marks where the fiction allows.

### 2.6 The film test (non-negotiable discipline)

Every game exposes `window.__game` with scenario hooks and ships
`tools/shoot.mjs` (headless Chromium, 1280×800 @2x) that waits on
`__game.frames`, drives real keyboard input, and captures **named shots** to
`shots/`. Harness contract:

```
__game.autostart()                 skip title into gameplay
__game.cam(mode)                   chase | orbit | ceremony ...
__game.phase / .time / .frames     state for waitForFunction
__game.debugFinish()               jump to results with plausible state
__game.debug()                     cam/player positions for assertions
+ per-game scenario hooks: teleport(...), debugAir(), spawnBoss(), ...
```

Every shot is an **authored scenario, not luck**. If a shot looks wrong, fix
the game — never mock the screenshot. A human comparing any game's `shots/`
to Dusk's should say: same production value, different world.

---

## §3. The 12 quality tells

Each game must have an **equivalent** of each — not a copy:

1. One palette file. No rogue hexes. Poster colors, not PBR dirt.
2. A real NPR lighting model (§2.2), not MeshStandardMaterial defaults.
3. Ink: hull outlines + interior line pass. Thin, selective, never doubled.
4. A sky that is a painting, with a per-game hero light.
5. Characters/vehicles with graphic proportions that **read as posters**,
   and rigs that **pose** (pose-as-behavior: lean, crouch, celebrate, hit).
6. Worlds designed as **sequences of named beats** (commented in code), not
   `radius + sin(t*3)`.
7. HUD as graphic design — skewed ink panels, hard shadows, instruments.
8. Title as a **poster over a living 3D backdrop**, not a GUI box.
9. Synth audio with a voice: persistent tracked loops + one-shot stingers +
   a real musical sting for the title and the win.
10. A camera that hunts beauty shots (hero-light bias, FOV punch, land dip).
11. FX that explain speed, impact, and state changes.
12. A `shots/` folder of named iconic moments, captured by the film test.

---

## §4. Shared core + retarget contract

Monorepo layout:

```
10-years-of-gaming/
  MASTER.md                 (this file)
  core/                     @tenyears/core — the studio package (TypeScript)
    render/   cel.ts  post.ts  sky.ts
    world/    noise.ts  heightfield.ts  palette.ts (base + per-game extend)
    camera/   chase.ts (spring, modes, hero-light bias, shake)
    audio/    synth.ts (master chain, tone, noiseShot, loop voices)
    hud/      hud.css.ts (house style)  widgets.ts (arc, cells, minimap, cards)
    harness/  game.ts (Harness type)  frame.ts (loop, adaptive DPR, recenter)
  tools/      shoot.mjs (parameterized film test)
  games/
    2016-pokemon-go/   2017-pubg/   2018-fortnite/   2019-minecraft/
    2020-among-us/     2021-genshin/  2022-elden-ring/ 2023-baldurs-gate/
    2024-black-myth/   2025-clair-obscur/  2026-re-requiem/
```

npm workspaces. `core/` is built **once** (game 1's first task) by
re-implementing the proven Dusk shared files against §2 — cel, post, sky,
noise, chase camera, synth, HUD language, frame loop, harness, shoot tool.
**Do not copy files from the Dusk repos; re-implement from this spec.**

**Fixed by the franchise (never re-decided per game):** the NPR recipe, ink
passes, HUD CSS language, audio master chain + primitives, camera spring
core, frame-loop invariants (dt clamp, adaptive pixel ratio EMA 0.72→dpr,
origin recentering), harness contract, shoot mechanics.

**Swapped per game:** palette values (keep the ink/sky-ladder *structure*,
change the movie), world module, physics + character rig, game mode +
scoring, AI, HUD widgets, terrain/world shader flourishes, sky ladder colors
+ hero light + silhouette shapes, shot list.

**Ports:** `games/YYYY-slug` uses port `5300 + N` (game 1 = 5301 … 11 = 5311),
strictPort, so all eleven can coexist with other sessions on this machine.

**Per-game README:** what it is, controls, how to run, the shot list.

---

## §5. The eleven games

Each chapter: the fantasy, the 0:00→10:00 beat sheet, controls, art lock,
signature systems, named shots, scope guards. Build exactly the slice —
respect the "do NOT build" lines; they are what keeps each game shippable.

Difficulty/tuning target everywhere: a first-time player finishes the loop in
8–12 minutes, dies or retries at most 2–3 times, and hits one "clip that"
moment per game.

---

### Game 1 — 2016 · POKÉMON GO (`games/2016-pokemon-go`, port 5301)

**Fantasy:** walk your neighborhood, creatures pop up, flick balls, fill the
dex, take the gym on the corner.

**Beat sheet:**
- 0:00 Poster title over a living map diorama (tiny streets, drifting
  creatures, confetti-leaf wind). "PRESS ENTER".
- 0:10 Third-person walk on a procedural neighborhood grid (2 parks, a
  pond, a plaza with a gym tower). Step counter, phone-trainer HUD frame.
- 1:00 Encounters spawn around the player (rustle rings → creature pops).
  Tap/E to enter the catch scene.
- Catch scene: creature idle-hops on a spotlit pad, AR-ish ring shrinks —
  flick (hold Space, release) to throw. Ring color = difficulty; curve by
  releasing during A/D lean; berry (B) calms. Wobble ×3 → GOTCHA burst or
  break-out.
- 6:00 Dex fills (6 species: mouse, bird, turtle, lizard, bat, one rare
  gold duck that flees twice). Rare spawns at the pond at ~7:00.
- 8:00 Gym beat: walk into the plaza → one auto-battle (tap to attack,
  swipe/A-D to dodge telegraphed slams) vs a big defender. Win → your
  creature sits on the gym, confetti.
- 10:00 Results: dex page, catches, steps, "GYM LEADER" card.

**Controls:** WASD walk, E interact, Space hold/release throw, A/D curve,
B berry, Enter confirm.

**Art lock:** cheerful morning movie — teal sky ladder, big warm sun, flat
park greens, sidewalk grid inked, creature kitbash (spheres+capsules with
poster proportions, big eyes), purple gym tower with spinning gold creature.
Silhouettes: city rooftops + water tower. HUD = phone frame: ink panels,
dex cells, throw meter arc.

**Signature systems:** shrinking catch ring + wobble anticipation; creature
AI that idles/attacks/flees; spawn director tied to biomes (grass/water/
plaza).

**Shots:** `01-title` `02-neighborhood-walk` `03-encounter-ring`
`04-gotcha-burst` `05-pond-rare` `06-gym-battle` `07-dex-results`

**Do NOT build:** real map data, GPS, AR camera, evolution, items beyond
ball+berry, multiplayer, more than 6 species.

---

### Game 2 — 2017 · PLAYERUNKNOWN'S BATTLEGROUNDS (`games/2017-pubg`, port 5302)

**Fantasy:** 16 drop, one wins. Loot, shrink, survive.

**Beat sheet:**
- 0:00 Title over the island from plane height.
- 0:10 Plane ride — jump when ready (Space), skydive steer, chute at low
  altitude. Bots scatter to their own compounds.
- 1:30 Loot phase: 6 named compounds (houses with floor loot) — rifle /
  SMG / shotgun, armor, medkit, scopes as stat pips. Footstep audio.
- 3:00 Circle 1 closes (blue wall of quantized energy). Map shows next
  circle. Buggy parked mid-island: drivable, squashes bots.
- 5:30 Circle 2. Bot encounters: they peek, strafe, panic-fire. Hit-markers,
  damage numbers off — blood puffs + knock.
- 7:30 Final circle (~40m) in a wheat field or rock cluster. 3–4 alive.
  Prone (C) in grass, zone ticks hurt.
- ~9:30 Last kill → **"WINNER WINNER CHICKEN DINNER"** banner, slow orbit,
  stats card (kills, damage, survival time).

**Controls:** WASD, mouse-free aim (hold RMB over-shoulder, LMB fire — or
keyboard: arrows aim-nudge), R reload, F interact/vehicle, C prone, Shift
sprint, Tab map.

**Art lock:** dusty late-afternoon movie — pale wheat, olive grass, white
cottage compounds, azure sky ladder with high sun, haze to lilac. Silhouette
rings: radar station, treelines, distant ridge. The blue zone = glowing
quantized grid wall. Ink heavy on weapons/characters. HUD: compass strip,
kill feed, alive counter, minimap with circles.

**Signature systems:** shrink director (3 circles, damage ramp), 15 bot
brains (loot → rotate → fight, accuracy by range), 3-weapon recoil/TTK
table, vehicle with arcade squash physics.

**Shots:** `01-title` `02-plane-drop` `03-chute-compound` `04-first-loot`
`05-blue-wall` `06-buggy-run` `07-final-circle` `08-chicken-dinner`

**Do NOT build:** 100 players, squads, attachments UI, red zone, replays,
more than one island, swimming.

---

### Game 3 — 2018 · FORTNITE (`games/2018-fortnite`, port 5303)

**Fantasy:** dive from the bus, harvest, BUILD, win the storm fight.

**Beat sheet:**
- 0:00 Title over a floating-island diorama with the bus drifting past.
- 0:10 Battle bus flyover (held aloft by a balloon) — jump, glider redeploy
  at low altitude (Space).
- 1:00 Land at **Tilted-lite** (5 cartoon buildings) or the farm. Pickaxe
  (LMB) harvests: trees→wood, cars→metal, walls→brick. Mats HUD.
- 3:00 Build mode (Q cycles wall/ramp/floor/cone ghost-blueprint, LMB
  place, G edit door/window on own walls). Bots build panic-ramps too.
- 4:30 Storm circle 1 (purple quantified wall). Pump shotgun / AR / pistol
  loot from floor + chests (chest glow + jingle).
- 6:30 Mid-fight: a bot ramps over you — shoot out their ramp (builds have
  HP), they fall.
- 8:00 Final circle on a hill: encourage a 1v1 build-off vs the last bot —
  ramp rush, shotgun trade.
- ~9:30 **#1 VICTORY ROYALE** banner, emote beat (character dances),
  stats.

**Controls:** WASD, Space jump/glider, LMB swing/fire, RMB aim, Q build
cycle, LMB-in-build place, E interact, Shift sprint, Tab map.

**Art lock:** toy-saturday-morning movie — saturated grass green, bubblegum
accents, big puffy cel clouds, purple-pink storm, chunky proportions
everywhere (pickaxe oversized, chests glossy). Sky hero: the balloon-bus
sun-side. Silhouettes: rolling hills + a tilted water tower. HUD: chunky
rounded ink panels, mats counters, build ghost preview.

**Signature systems:** grid-snapped building with HP + edit, harvest
economy, glider physics, 11 bots with build reflexes, storm director.

**Shots:** `01-title` `02-bus-jump` `03-glider-over-tilted`
`04-harvest-whack` `05-build-ramp` `06-storm-wall` `07-build-fight`
`08-victory-royale`

**Do NOT build:** 100 players, traps, vehicles, crafting, more than 4 build
pieces, weapon rarity beyond 2 tiers.

---

### Game 4 — 2019 · MINECRAFT (`games/2019-minecraft`, port 5304)

**Fantasy:** punch tree, craft, build, survive the night.

**Beat sheet:**
- 0:00 Title over a voxel valley, blocky clouds drifting.
- 0:10 First-person spawn at dawn in a 256×256 chunk valley (plains, oak
  grove, stone hill with coal/iron veins, a cave mouth). Day clock = 5 min.
- 0:30 Punch (hold LMB) → logs. Inventory hotbar. Craft (E): 2×2 then
  crafting table 3×3 — planks, sticks, wooden→stone tools, torches, door.
- 3:00 Mine the hill: stone pick, coal torches, iron for a sword. Block
  crack stages, ore glint.
- 5:00 Build shelter beat: prompt "night is coming" — place blocks (RMB),
  a door, torches. (Any 3-walls-and-roof counts.)
- 6:30 **Night:** zombies + skeletons + one creeper spawn at darkness
  edges, pathfind to player. Sword (craft or found), knockback, hearts HUD.
- 9:00 Dawn: undead burn in sunlight. Survive → **"YOU SURVIVED"** results:
  blocks mined/placed, mobs slain, shelter photo orbit.

**Controls:** WASD, Space jump, LMB break/attack, RMB place, E inventory/
craft, 1-9 hotbar, Shift sneak (no edge-fall).

**Art lock:** the blocky movie — crisp voxel AO-less flats but with OUR cel
bands per face direction, saturated grass tops/dirt sides, torch-warm pools
vs indigo night, square sun/moon hero light, blocky cloud slabs.
Silhouettes: distant blocky mountains. HUD: hotbar ink panels, hearts as
inked icons, crosshair dot. Keep the voxel read instantly recognizable.

**Signature systems:** voxel chunk meshing (greedy-ish, face culling), one
height truth from block data, day/night director, 3 mob AIs, crafting tree
(wood→stone→iron), block crack feedback.

**Shots:** `01-title` `02-first-punch` `03-crafting` `04-mine-torches`
`05-shelter-build` `06-night-siege` `07-creeper-hiss` `08-dawn-burn`
`09-results`

**Do NOT build:** infinite terrain, redstone, enchanting, hunger, more mobs,
caves beyond one, multiplayer.

---

### Game 5 — 2020 · AMONG US (`games/2020-among-us`, port 5305)

**Fantasy:** 10 crew, 1 impostor (the AI). Do your tasks, find the body,
vote them out — or get vented.

**Beat sheet:**
- 0:00 Title over the Skeld drifting past a starfield, a crewmate floating
  by the window.
- 0:10 Top-down (slight 2.5D tilt) Skeld-lite: 8 named rooms (Cafeteria,
  Weapons, Navigation, Shields, Electrical, MedBay, Storage, Reactor).
  You're crew with 5 tasks (wires, asteroids, fuel, download, divert).
  Task minigames: 10-second interactions (drag wires by color, aim-shoot
  asteroids, hold-fill fuel).
- 2:00 The impostor AI roams, fakes tasks, kills isolated crewmates, vents
  (visible only if you catch it). Lights sabotage → vision radius shrinks;
  fix at Electrical.
- 4:00 First body found (by you or a bot) → **DEAD BODY REPORTED** →
  meeting table: chat-log style accusations, bots vote based on who was
  seen near whom. You vote too. Eject = airlock drift shot.
- 6:30 Second round: fewer crew, impostor bolder. You can call one
  emergency meeting (button at Cafeteria).
- Win: finish all tasks → crew wins; or vote the impostor out → crew wins.
  Lose: killed alone → ghost cam watches the impostor win.
- ~9:30 Results: "CREWMATE VICTORY / DEFEAT", task list, eject tally,
  who-was-impostor reveal card.

**Controls:** WASD move, E use/task, R report, Q kill-vision-only NO — you
are crew: no kill. F emergency at button, mouse-lite task interactions via
keys (arrows + Space).

**Art lock:** the bean movie — flat ship grays with per-room accent floors,
chunky bean crewmates in 8 candy colors with visor shine (banded spec!),
warm interior lights vs cold space seen through windows, stars drifting.
Hero light: a low sun through the Cafeteria skylight. Ink: thick hull
outlines, everything rounded. HUD: task list ink panel, room-name banners,
meeting = full-screen ink card with vote beans.

**Signature systems:** line-of-sight fog (vision radius, wall occlusion),
task minigames, impostor brain (isolation scoring, vent graph, alibi
faking), meeting/vote simulation with testimony strings, sabotage.

**Shots:** `01-title` `02-cafeteria-spawn` `03-wires-task`
`04-asteroids-task` `05-lights-out` `06-body-reported` `07-meeting-vote`
`08-airlock-eject` `09-results`

**Do NOT build:** playing as impostor, multiplayer, more maps, roles, pets,
hats shop, vents for crew.

---

### Game 6 — 2021 · GENSHIN IMPACT (`games/2021-genshin`, port 5306)

**Fantasy:** anime open field, wind in the grass, glide off the cliff, two
elements, one big ruin guard to fell.

**Beat sheet:**
- 0:00 Title over a windswept cel plain, grass waves, distant spired city.
- 0:10 Third-person run through the meadow — stamina sprint, grass parts,
  butterflies. A pinned quest ribbon points to 3 beats.
- 1:00 Combat camp: 4 hillichurl-like mobs. Swap two stances (1 = wind
  blade: fast slashes + pull vortex skill; 2 = flame: slower arcs + burst
  ring). Elemental burst (Q) after energy fills: camera snap + banner card
  + vortex/fire tornado. Swirl reaction when flame meets wind = damage
  numbers bloom.
- 4:00 Glide beat: climb the cliff (hold Space on marked wall), leap —
  glider opens, ride the updraft rings across the valley to the arena.
- 6:30 **World boss: the Ruin Warden** — big automaton, spin attack
  (dodge through), missile volley (hide behind pillars / perfect dodge
  slow-mo flash), core exposed after spin (hit for bonus). Two HP bars
  worth.
- 9:00 Boss falls → chest + sunset sting → results: time, damage, chests,
  biggest reaction number.

**Controls:** WASD, Space jump/glide/climb, LMB combo, 1/2 stance swap,
E skill, Q burst, Shift dodge (i-frames).

**Art lock:** the anime-meadow movie — luminous teal-green grass with
painted wave shader, huge white cel clouds, cyan sky ladder, hero sun low
gold. Characters: chibi-proportioned anime rig with twin-tone outfit,
ribbon physics. Damage numbers = chunky italic ink pops. Silhouettes:
spired city + windmill ridge. HUD: element diamonds, energy ring around
burst icon, boss bar with ink frame.

**Signature systems:** two-element combat with one reaction (swirl),
stamina (sprint/climb/glide), glider + updrafts, boss with 3 tells +
vulnerability windows, slow-mo perfect dodge.

**Shots:** `01-title` `02-meadow-run` `03-camp-fight` `04-burst-banner`
`05-glide-valley` `06-boss-spin-dodge` `07-core-exposed` `08-victory-chest`

**Do NOT build:** gacha, party of 4, more elements/reactions, quests,
dialogue, city interiors, co-op.

---

### Game 7 — 2022 · ELDEN RING (`games/2022-elden-ring`, port 5307)

**Fantasy:** tarnished, a fog gate, and a king's soldier waiting on the
bridge. Die. Learn. Fell him.

**Beat sheet:**
- 0:00 Title over a misted valley beneath an impossible golden tree.
- 0:10 Third-person: spawn at a Site of Grace (rest = heal + respawn world
  + refill flasks). Light-guidance trail points down the path.
- 1:00 The approach: 6 soldiers in 3 packs — teach lock-on (Tab), light/
  heavy (LMB/RMB), roll (Space, i-frames), guard (hold F), stamina bar
  rules everything. One drops a hint: "the bridge guardian fears the
  riposte."
- 4:00 Side beat: a scarab (kill = +1 flask) and a grace at the fog gate.
- 5:00 **BOSS — the Bridge Warden** (Margit-shaped, ours): Phase 1 —
  staff sweeps, dagger toss, delayed overhead. Punish windows after the
  sweep combo. Posture-style crit: parry (RMB-tap with dagger timing) or
  3 guard-breaks → riposte cinematic. Phase 2 at 50%: glowing hammer
  summons, tail sweep added, arena edge wind.
- Death → **YOU DIED** (ink serif, slow fade) → grace, runback, keep your
  collected "grace shards" only if you recover them from your corpse.
- 9:00 Kill → **GREAT ENEMY FELLED**, gold shower, results: deaths, time,
  hits taken, flasks left.

**Controls:** WASD, Space roll, Shift sprint, LMB/RMB light/heavy,
RMB-tap parry, F guard, Tab lock-on, Q flask (3 charges), E interact.

**Art lock:** the golden-gloom movie — desaturated moor greens and slate,
one overexposed gold tree dominating the sky ladder (hero light = its
glow), mist bands quantized, ruined arches silhouettes. Armor reads as
hammered metal via painted matcap; cloth = 2-tone. Ink thin and grim.
HUD: minimal — one ink-edged HP/stamina bar pair, flask pips, boss bar
with nameplate serif. Everything else banned from screen.

**Signature systems:** stamina discipline, roll i-frames, lock-on camera
(soft orbit), parry→riposte, boss two-phase AI with readable tells,
death/runback/corpse-recover economy.

**Shots:** `01-title` `02-grace-guidance` `03-soldier-pack` `04-fog-gate`
`05-warden-phase1` `06-parry-riposte` `07-phase2-hammer` `08-you-died`
`09-great-enemy-felled`

**Do NOT build:** open world, horseback, more bosses, magic builds, stats/
leveling UI, multiplayer messages, crafting.

---

### Game 8 — 2023 · BALDUR'S GATE 3 (`games/2023-baldurs-gate`, port 5308)

**Fantasy:** one conversation that can go wrong, one fight that can go
sideways, and the d20 decides your story.

**Beat sheet:**
- 0:00 Title over a candle-lit tavern diorama, dice rolling slowly.
- 0:10 Isometric (fixed-angle rotatable 45°) scene: the tollhouse bridge.
  Party = you (a sell-sword) + one companion AI (a spark mage).
- 0:30 **The dialogue:** a gaunt tollkeeper demands 500 gold. Branching
  choices with visible skill tags: [Deception 12] [Intimidation 14]
  [Persuasion 12] [Attack] [Pay (you have 60)]. Roll = physical d20
  tumbles across the screen, modifiers tally, success/crit/fail stingers.
  Outcomes genuinely branch: talk through free, get robbed- politely,
  or start the fight with the tollkeeper surprised.
- 3:30 **The fight:** turn-based, initiative order ribbon. Grid-lite
  movement (move range ring), action/bonus action. Your kit: melee strike,
  shove (the bridge! physics ragdoll into the river = instant), dip blade
  in candle fire, throw a barrel. Mage companion: spark bolt (AoE line),
  grease puddle (slip + ignite combo). 4 enemies with simple intents.
- 7:30 Loot the toll chest (the 500 gold + a cloak), companion barks one
  line about your choice earlier.
- 9:00 Results: "THE TOLLHOUSE — CLEARED", rolls history, bodies in the
  river count, gold.

**Controls:** WASD pan / QE rotate camera, click-free keyboard: Tab cycle
targets, 1-4 abilities, Space confirm, Enter end turn, dialogue = number
keys.

**Art lock:** the candle-and-ink movie — warm tavern ambers against
cool river blues, painterly quantized haze, chunky d20 gold-inked.
Characters: 3/4-chibi tabletop proportions with dramatic rim. Dice UI =
the star: every roll is a physical tumbling d20 with inked faces.
Silhouettes: rooflines + gallows. HUD: bottom hotbar ribbon, initiative
portrait strip, advantage = two dice.

**Signature systems:** real d20 roll resolution with modifiers + crits,
branching dialogue with 3+ outcomes, turn-based combat (move ring, action
economy, shove physics, surface combos: grease+fire), companion AI turn.

**Shots:** `01-title` `02-tollhouse-approach` `03-dialogue-roll`
`04-crit-success` `05-initiative` `06-shove-into-river` `07-grease-fire`
`08-loot` `09-results`

**Do NOT build:** character creator, spells beyond 2, more scenes, party
of 4, camp, romance, save system.

---

### Game 9 — 2024 · BLACK MYTH: WUKONG (`games/2024-black-myth`, port 5309)

**Fantasy:** the Destined One walks into a temple court. A tiger in a
monk's robe is waiting.

**Beat sheet:**
- 0:00 Title over an ink-wash mountain, one temple roof in cloud.
- 0:10 Third-person: incense shrine (= rest/checkpoint, refill gourd).
  Path through a bamboo court — 3 lesser yaoguai teach the staff: light
  combo (LMB×3), heavy focus slam (RMB, spends focus points built by
  lights), dodge (Space) with **perfect-dodge afterimage** (slow-mo
  streak + focus refund).
- 3:00 Spell beat: **Immobilize** (Q) — freeze a lesser mid-leap, golden
  seal characters bloom; cloud-step not included (scope).
- 4:00 Shrine → fog-curtain gate.
- 4:30 **BOSS — the Tiger Abbot:** Phase 1 — claw strings, pounce, blood-
  pool slam; punish after the 4th claw. Phase 2 at 60% — sword drawn,
  whirlwind dash (perfect-dodge chain or die), roar AOE (jump or gourd
  through). Stance swap (C: smash ↔ poke) changes heavy timing — poke
  punishes the dash recovery.
- Death → shrine, boss keeps ~10% less max posture... no — full reset,
  classic. Runback 20s.
- 9:00 Kill → gold seal burst, "YAOGUAI FELLED — 虎僧", results: deaths,
  perfect dodges, longest combo.

**Controls:** WASD, Space dodge, LMB light, RMB heavy, C stance, Q
Immobilize (cooldown), F gourd (4 sips), Tab lock-on.

**Art lock:** the ink-and-gold movie — black bamboo courts, red lacquer
temple beams, snow or petals drifting (pick petals), hero light = low
gold sun through cloud sea. Ink-wash sky ladder (near-black zenith to
rice-paper horizon). Gold seal VFX for spells. Character = staff monk
with ribboned staff (trail arcs quantized). HUD: near-invisible — one
gourd pip row, focus beads, boss bar with brush-calligraphy plate.

**Signature systems:** focus-point combo economy, perfect-dodge
afterimage + slow-mo, Immobilize with golden seal, two-phase boss with
readable chains, shrine checkpoint.

**Shots:** `01-title` `02-bamboo-court` `03-staff-combo` `04-immobilize`
`05-perfect-dodge` `06-tiger-abbot` `07-phase2-whirlwind`
`08-yaoguai-felled`

**Do NOT build:** transformations, more spells, skill tree, open zones,
multiple bosses, spirits/relics.

---

### Game 10 — 2025 · CLAIR OBSCUR: EXPEDITION 33 (`games/2025-clair-obscur`, port 5310)

**Fantasy:** a painted valley where the Paintress's number hangs in the
sky. Turn-based, but your hands still matter — dodge the brushstroke.

**Beat sheet:**
- 0:00 Title over an impossible Belle Époque valley: floating rock
  shards, a giant canvas-sky with "34" painted in gold.
- 0:10 Third-person walk the painted path: petals and paint motes, 2
  picto pickups (stat stickers), expedition flag checkpoint.
- 1:00 **Fight 1 (2 brushlings):** teaches the hybrid — your turn:
  menu attacks (strike / aimed free-aim shot at a weak point / skill:
  ink lance). Enemy turn: **real-time dodge (Space) or parry (F, tight
  window)** against telegraphed brushstrokes — parry = counter paint
  splash. Jump attack (timed Space on marker).
- 4:00 **Fight 2 (shielded mime-lite):** teaches gradient — break the
  shield with 3 parries, then unload.
- 6:00 **BOSS — the Curator's Marionette:** big painted puppet in a
  gilt frame arena. 3 attack patterns (sweep = dodge, jab-jab-slam =
  parry chain, gradient cannon = jump marker). Your burst: "Overpaint"
  (Q when meter full) = repaint the boss's face, big damage + stagger.
- 9:00 Boss dissolves into petals → **"FOR THOSE WHO COME AFTER"** card,
  results: parries landed %, damage, turns.

**Controls:** WASD explore, battle = 1-3 menu, Space dodge/jump-confirm,
F parry, Q overpaint, Enter confirm.

**Art lock:** the painted-impossible movie — rose-gold and ink-navy,
gilded frames floating, brushstroke VFX (attacks smear quantized paint),
sky = a canvas with gold leaf number. Belle Époque costumes, ribbon
hair, petals everywhere. HUD: ornate ink-gold plates, AP pips as paint
daubs, parry flash ring. The most beautiful game of the eleven — spend
the budget here.

**Signature systems:** turn-based core + real-time dodge/parry/jump
windows, free-aim weak points, gradient/break, overpaint burst, painted
dissolve deaths.

**Shots:** `01-title` `02-painted-valley` `03-first-stroke`
`04-parry-counter` `05-free-aim` `06-marionette` `07-overpaint`
`08-petal-dissolve` `09-those-who-come-after`

**Do NOT build:** party management, skill trees, more areas, the world
map, story cutscenes beyond title cards, NG+.

---

### Game 11 — 2026 · RESIDENT EVIL REQUIEM (`games/2026-re-requiem`, port 5311)

**Fantasy:** a flashlight, twelve bullets, a locked hospital ward, and
something dragging itself behind you.

**Beat sheet:**
- 0:00 Title over a rain-streaked hospital facade, one window lit.
- 0:10 First-person, flashlight cone (it flickers when THEY are near).
  Ward A: dark corridors, 3 shamblers. Aim (RMB) slows walk, headshots
  stagger. Ammo is scarce: 12 + pickups.
- 2:00 Inventory beat: 6-slot grid, combine herb+herb = medkit, examine
  key items (rotate in light). Classic ink inventory screen.
- 3:30 **The puzzle:** the director's office — find the fuse (exam room),
  the crank (morgue, guarded), restore power to the elevator. Locked
  doors show their keyhole plate ("Ward B — Needs Crank").
- 6:00 Power on → lights hum, and **it** wakes: the Pursuer — a tall
  thing that cannot die (bullets stagger 3s). Final sequence: it stalks
  corridors while you ride power back, grab the elevator key from the
  now-lit director's desk, and run.
- 8:30 Elevator chase: door close timing vs its lunge — barely make it.
  Doors shut on its hand.
- 9:30 Results: "SURVIVED", shots fired, accuracy, herbs left, time.

**Controls:** WASD, mouse-free: arrows fine-aim or Q/E lean-turn, RMB aim,
LMB fire, F interact, Tab inventory, Shift walk-fast (never sprint-silent:
noise draws them), G flashlight toggle (some rooms safer dark).

**Art lock:** the flashlight-horror movie — near-black value structure,
one sickly green-white tube light per corridor, rain shadows on blinds
(animated gobos), flashlight = warm cone with quantized falloff. Ink
turned UP — horror reads in silhouettes. Hero light: cold moon through
skylights. Blood = ink-red banded pools. HUD: near-none — ECG-style
health corner, ammo count in ink serif, item-get cards.

**Signature systems:** flashlight cone gameplay + flicker proximity tell,
scarce-ammo shambler combat, 6-slot combine inventory, key-item puzzle
chain, invincible pursuer with stalk AI (sound-attracted), chase finale.

**Shots:** `01-title` `02-ward-a-dark` `03-first-shambler`
`04-inventory-combine` `05-fuse-puzzle` `06-power-on` `07-the-pursuer`
`08-elevator-chase` `09-survived`

**Do NOT build:** multiple floors, crafting beyond herb combine, more
than 2 enemy types, cutscene dialogue, saves, difficulty modes.

---

## §6. Engineering rules (every game, every run)

1. Work only in `/Users/midir/10-years-of-gaming`, on `main`. Commit early
   and often. No force-push, no `reset --hard`, no `clean -fd` — parallel
   agent sessions share this machine.
2. `npm run build` = `tsc --noEmit && vite build`, must stay green. Strict
   TS, no `any` leaks in shared core.
3. No external assets, ever. No CDN runtime deps. `three` is the only
   runtime dependency per game (+ `@tenyears/core`).
4. Game logic is render-free and event-driven (§2.4). One spatial truth.
5. Per-file intent header comments. Small files. Constants at top.
6. The film test gates completion: shots must exist, be non-trivial
   (not black frames), and look like the chapter's promise.
7. Root README table row flips to ✅ when a game passes acceptance.
8. Each game gets its own port (5300+N), strictPort — never collide with
   another session's server.
9. Fan-recreation etiquette: inspired-by names allowed in HUD/title for
   the video's sake, but all art/audio is original generated work. No
   ripped sprites, models, or music.
10. Do not modify `core/` APIs mid-run without updating every shipped game
    that imports them. Prefer additive changes.

## §7. The /goal prompt (verbatim template)

Fill `{{N}}` (1–11), `{{YEAR}}`, `{{TITLE}}`, `{{SLUG}}` from §5 and feed
as a `/goal`. One game per run. Total length < 4000 characters (verified).

```
Read /Users/midir/10-years-of-gaming/MASTER.md fully — it is the source of truth.
Build game {{N}} of 11: {{YEAR}} — {{TITLE}} (chapter in MASTER.md §5), a fully
playable ~10-minute browser fan-recreation for the "10 Years of Gaming" YouTube
series.

Repo: /Users/midir/10-years-of-gaming (github.com/oh-ashen-one/10-years-of-gaming).
Work only here, on main. Commit early and often. No force-push, no reset --hard,
no clean -fd — parallel agent sessions share this machine. Port 53{{NN}} strict.

Stack (locked): npm workspaces; Vite + strict TypeScript + Three.js as the only
runtime dep; zero external assets — every mesh, texture and sound generated in
code. Shared studio core lives in core/ (@tenyears/core): cel NPR, ink post,
painted sky, chase camera, synth audio, HUD language, frame loop, __game harness,
tools/shoot.mjs. If this is game 1 (or core/ is incomplete), build core/ FIRST by
re-implementing MASTER.md §2/§4 — do NOT copy files from ~/Qwen-3.8-motorcycle or
~/Qwen-3.8-project (read-only reference, do not modify).

Quality bar: the Dusk standard (MASTER.md §2–§3). A paused screenshot could sit
on a Steam page. One palette file, real cel shading + ink, painted sky with a
hero light, poster title over living 3D, kitbash characters that pose, world
built as named beats, HUD as graphic design, 100% synthesized audio with a
voice, camera that hunts beauty shots, FX that explain speed/impact. Same
studio, this game's movie: evoke the original game's iconic look through our
pipeline with original generated assets only — no ripped art, no samples.

Build exactly the slice in the {{YEAR}} chapter: the 0:00→10:00 beat sheet,
controls, art lock, signature systems. Fully playable keyboard start→finish:
poster title → complete loop → win/lose beat → results. Respect every
"do NOT build" line — they keep the game shippable.

Discipline: game logic render-free, events only; one spatial truth shared by
render + physics; per-file intent comments; small single-responsibility files.

Film test (non-negotiable): expose window.__game (autostart / scenario hooks /
cam / phase / time / frames / debugFinish) and ship tools/shoot.mjs capturing
the chapter's named shots to games/{{SLUG}}/shots/. Every shot a real captured
frame. If a shot looks wrong, fix the game, never mock the image.

Acceptance — verify ALL before finishing:
1. npm run build passes (tsc --noEmit clean) at repo root and in the game.
2. Dev server boots on port 53{{NN}}; full loop plays title→results with zero
   console errors.
3. Every named shot exists in shots/ and is a non-trivial frame.
4. games/{{SLUG}}/README.md: premise, controls, how to run, shot list.
5. Root README row for {{YEAR}} flips to done.
6. Commit and push to origin/main when green.

Stop rule: stop when acceptance passes. No gold-plating beyond the chapter.
Final reply: what was built, the 10-minute loop in words, shot paths, commit
SHAs, honest leftover defects.
```

Fill table:

| {{N}} | {{YEAR}} | {{TITLE}} | {{SLUG}} | port 53{{NN}} |
|---|---|---|---|---|
| 1 | 2016 | Pokémon GO | 2016-pokemon-go | 5301 |
| 2 | 2017 | PUBG | 2017-pubg | 5302 |
| 3 | 2018 | Fortnite | 2018-fortnite | 5303 |
| 4 | 2019 | Minecraft | 2019-minecraft | 5304 |
| 5 | 2020 | Among Us | 2020-among-us | 5305 |
| 6 | 2021 | Genshin Impact | 2021-genshin | 5306 |
| 7 | 2022 | Elden Ring | 2022-elden-ring | 5307 |
| 8 | 2023 | Baldur's Gate 3 | 2023-baldurs-gate | 5308 |
| 9 | 2024 | Black Myth: Wukong | 2024-black-myth | 5309 |
| 10 | 2025 | Clair Obscur: Expedition 33 | 2025-clair-obscur | 5310 |
| 11 | 2026 | Resident Evil Requiem | 2026-re-requiem | 5311 |

## §8. Verification & acceptance discipline

A game is done only when:

1. `npm run build` green at root and in the game workspace.
2. Manual play-through: title → results, no console errors, 8–12 min.
3. All named shots captured by `npm run shoot` and eyeballed — not black,
   not broken, actually the moment the name promises.
4. Per-game README + root README row updated. Committed and pushed.
5. The human test: a stranger could play it without instructions and hit
   the "clip that" moment.

When all eleven pass: final episode assembly = root `shots/` contact sheet
(one hero shot per game) + series README section. Not before.
