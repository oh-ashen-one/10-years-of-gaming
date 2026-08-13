# 2021 — GALE MEADOW (Genshin Impact fan recreation)

A ~10-minute browser recreation of the anime open-field phenomenon: wind
in luminous grass, two elements, one big ruin automaton to fell. All art,
names and sounds are original work generated in code on the
`@tenyears/core` pipeline — cel NPR, ink passes, painted sky, 100% synth
audio.

## The loop

Poster title over the windswept meadow → **Enter**: third-person run
through the waving grass (stamina governs glide/climb) → the mosslunk
camp: **LMB** combos, swap stances (**1** wind blade: fast slashes +
pull-vortex **E**; **2** flame: slower arcs + burst ring) — flame tags,
wind detonates: **SWIRL** blooms → energy fills → **Q** burst: camera
snap, banner card, tornado → climb the gold-striped cliff (hold **Space**)
→ glide the updraft rings across the valley → the RUIN WARDEN: spin
attack (**Shift** dodge through — perfect dodge = slow-mo flash), missile
volley (pillars or perfect dodge), core exposed after the spin (×3
damage) → it falls → the victory chest → results: time, damage, chests,
biggest swirl.

## Controls

| Key | Action |
|---|---|
| WASD | move / steer the glide |
| Space | jump · hold: glide / climb the marked face |
| LMB | combo (3-hit chain) |
| 1 / 2 | wind / flame stance |
| E | skill · open the chest |
| Q | elemental burst (full energy) |
| Shift | dodge (i-frames; perfect dodge = slow-mo) |
| Enter | start / restart |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2021-genshin      # http://localhost:5306 (strictPort)
npm run build -w game-2021-genshin    # tsc --noEmit && vite build
npm run shoot -w game-2021-genshin    # film test → shots/
node games/2021-genshin/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — the meadow diorama, spired city far
- `02-meadow-run` — running the luminous waves
- `03-camp-fight` — combo into the mosslunks
- `04-burst-banner` — camera snap + banner + numbers
- `05-glide-valley` — updraft rings
- `06-boss-spin-dodge` — the tornado, dodged
- `07-core-exposed` — the pink core, ×3 damage
- `08-victory-chest` — the chest on the arena seal
