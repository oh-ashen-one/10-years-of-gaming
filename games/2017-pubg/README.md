# 2017 — DUSTFALL ISLAND (PUBG fan recreation)

A ~10-minute browser recreation of 2017's battle-royale detonation: 16 drop
on a 1 km island, one wins. Loot white-cottage compounds, outrun the blue
wall, take the buggy through the wheat, and earn the dinner. All art, names
and sounds are original work generated in code on the `@tenyears/core`
studio pipeline — cel NPR, ink passes, painted sky, 100% WebAudio synth.

## The loop

Poster title over the island from plane height → **Enter**: the plane
crosses the island, **Space** to jump, steer the dive, chute auto-opens →
boots down near one of 6 named compounds (Milltown, Fort Rust, Chapel
Hill, Depot Nine, The Silos, Beacon Point) — grab a Duster rifle / Wasp
SMG / Gatekeeper shotgun, armor, medkits off the floor (**F**) → 15 bots
loot, rotate and panic-fight; three blue-zone circles shrink on schedule
(minimap + **Tab** map show the white circle) → the buggy at the
crossroads drives (and squashes) → final circle in the wheat field: prone
(**C**), pick the last survivors → **WINNER WINNER CHICKEN DINNER** banner
→ stats card (kills, damage, survival time, placement).

## Controls

| Key | Action |
|---|---|
| WASD | move / steer the dive / drive |
| Space / LMB | jump from plane · fire |
| RMB (hold) | over-shoulder aim (FOV zoom) |
| Arrow keys | aim-nudge |
| Shift | sprint |
| C | prone (concealed in the wheat) |
| R | reload |
| F | pick up loot / enter-exit buggy |
| Tab | island map |
| Enter | start / restart from results |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2017-pubg     # http://localhost:5302 (strictPort)
npm run build -w game-2017-pubg   # tsc --noEmit && vite build
npm run shoot -w game-2017-pubg   # film test → shots/
node games/2017-pubg/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — poster over the island from plane height
- `02-plane-drop` — freefall, FOV kicked
- `03-chute-compound` — chute open over Milltown
- `04-first-loot` — rifle glow on the compound floor
- `05-blue-wall` — the quantized grid wall, just inside it
- `06-buggy-run` — cross-country at speed
- `07-final-circle` — prone in the wheat, 4 alive
- `08-chicken-dinner` — the banner
