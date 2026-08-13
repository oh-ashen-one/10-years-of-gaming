# 2020 — SUSPECTED (Among Us fan recreation)

A ~10-minute browser recreation of the pandemic's party phenomenon: 10
beans on a ship, one is wrong. Do your tasks, watch the corridors, find
the body, win the vote. All art, names and sounds are original work
generated in code on the `@tenyears/core` pipeline — cel NPR with thick
ink, real line-of-sight fog, 100% synth audio.

## The loop

Poster title over the ship drifting the void → **Enter**: Cafeteria spawn
with the crew → walk the Skeld-lite (8 rooms: Cafeteria, Weapons,
Navigation, Shields, Electrical, MedBay, Storage, Reactor) doing 5 tasks
as keyboard minigames — **wires** by color, **asteroids** aim-shoot,
**fuel** hold-fill, **download**, **divert** arrow sequence → the
impostor AI roams, fakes tasks, and kills isolated crew (it vents when
you're close — catch it!) → lights sabotage shrinks your vision — fix at
Electrical (hold **E**) → **R** reports a body (or **F** hits the
Cafeteria emergency button) → meeting: chat-log testimony, then the vote
— eject = the airlock drift → win by finishing all tasks or voting the
impostor out. Lose: killed alone (ghost cam) or outnumbered.

## Controls

| Key | Action |
|---|---|
| WASD | move |
| E | use station / hold to fix lights |
| R | report body |
| F | emergency meeting (Cafeteria button) |
| Arrows + Space | minigames · vote selection |
| Enter | start / restart |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2020-among-us     # http://localhost:5305 (strictPort)
npm run build -w game-2020-among-us   # tsc --noEmit && vite build
npm run shoot -w game-2020-among-us   # film test → shots/
node games/2020-among-us/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — the ship in the void
- `02-cafeteria-spawn` — beans under the skylight
- `03-wires-task` — the wiring minigame
- `04-asteroids-task` — crosshair + drifting rocks
- `05-lights-out` — the shrunk vision bubble
- `06-body-reported` — a body in Storage
- `07-meeting-vote` — testimony + vote beans
- `08-airlock-eject` — tumbling into the black
- `09-results` — the impostor reveal
