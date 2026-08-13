# 2019 — VOXEL VALLEY (Minecraft fan recreation)

A ~10-minute browser recreation of the best-selling game of all time:
punch a tree, craft a table, mine the hill, build a shelter, survive the
night. First-person, 256×256 voxel valley, everything generated in code on
the `@tenyears/core` pipeline — cel-banded voxel flats, ink passes, a
painted blocky sky (square sun by day, square moon by night), 100% synth
audio.

## The loop

Poster title over the valley diorama → **Enter**: first-person in the
spawn meadow at dawn (day = 5 min) → punch oaks in the grove (**LMB**,
crack stages) → **E** crafts: planks, sticks (2×2), then a crafting table
→ place the table (**RMB**) for 3×3 recipes: wooden → stone pickaxe,
torches, door, sword → mine the stone hill: crack stages, coal and iron
ore glints, one cave with torch pools → dusk warning: **build a shelter**
(any 3-walls-and-roof around a door counts) → night: zombies shamble in,
skeletons kite and shoot, ONE creeper hisses — sword swings knock them
back, hearts hold → dawn: the undead burn → **YOU SURVIVED**: blocks
mined/placed, mobs slain, shelter orbit.

## Controls

| Key | Action |
|---|---|
| WASD | move (camera-relative) |
| Arrows / mouse (click for pointer lock) | look |
| Space | jump |
| Shift | sneak (no edge-fall) |
| LMB (hold) | break blocks · attack mobs |
| RMB | place selected block |
| E | craft menu (2×2 / 3×3 near a table) |
| 1–9 | hotbar |
| Enter | start / new world from results |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2019-minecraft     # http://localhost:5304 (strictPort)
npm run build -w game-2019-minecraft   # tsc --noEmit && vite build
npm run shoot -w game-2019-minecraft   # film test → shots/
node games/2019-minecraft/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — valley diorama, blocky clouds
- `02-first-punch` — crack stages on an oak trunk
- `03-crafting` — the craft menu
- `04-mine-torches` — torch pools + ore glints in the cave
- `05-shelter-build` — 3 walls and a roof before dusk
- `06-night-siege` — zombies out of the indigo
- `07-creeper-hiss` — swollen, ticking, too close
- `08-dawn-burn` — the undead catch fire
- `09-results` — YOU SURVIVED stats card
