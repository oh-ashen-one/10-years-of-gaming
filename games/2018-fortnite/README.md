# 2018 — BUILD ROYALE (Fortnite fan recreation)

A ~10-minute browser recreation of 2018's defining phenomenon: ride the
balloon bus, glide into a toy island, harvest everything, BUILD, and win
the storm. All art, names and sounds are original work generated in code
on the `@tenyears/core` studio pipeline — cel NPR, ink passes, painted
sky, 100% WebAudio synth.

## The loop

Poster title over the floating toy island, bus drifting past → **Enter**:
bus flyover, **Space** to jump, **Space** again to redeploy the glider →
land at TILTED (five chunky towers) or the Farm → **LMB** swings the
pickaxe: trees → wood, cars → metal, tower walls → brick → chests glow
and jingle (**E**): Popper pistol / Ratchet AR / Doorknob pump → **Q**
enters build mode: ghost-blueprint wall/ramp/floor/cone, **LMB** places
(builds have HP), **G** edits your walls (door/window) → purple storm
circles close on schedule → 11 bots loot, rotate, panic-wall and
panic-ramp — shoot out a bot's ramp and it falls → final circle on Hero
Hill: a 1v1 build-off → **#1 VICTORY ROYALE** banner + dance + stats.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | move / steer the drop |
| Space | jump from bus · glider deploy/cut |
| LMB | swing pickaxe · fire · place piece |
| RMB (hold) | aim |
| Q | build mode / cycle wall→ramp→floor→cone→exit |
| G | edit own wall (door/window) |
| E | open chest |
| R | reload · Shift | sprint |
| Enter | start / restart |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2018-fortnite     # http://localhost:5303 (strictPort)
npm run build -w game-2018-fortnite   # tsc --noEmit && vite build
npm run shoot -w game-2018-fortnite   # film test → shots/
node games/2018-fortnite/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — toy island diorama, bus drifting
- `02-bus-jump` — out the door, freefall
- `03-glider-over-tilted` — glider over the five towers
- `04-harvest-whack` — pickaxe chips flying
- `05-build-ramp` — ghost preview + fresh ramp and wall
- `06-storm-wall` — the purple grid closing
- `07-build-fight` — the endgame build-off
- `08-victory-royale` — banner + dance
