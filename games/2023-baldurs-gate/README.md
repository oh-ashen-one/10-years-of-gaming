# 2023 — TOLLHOUSE (Baldur's Gate 3 fan recreation)

A ~10-minute browser recreation of the CRPG landmark: one bridge, one
gaunt tollkeeper who wants 500 gold (you have 60), and a physical
tumbling d20 that decides your story. All art and sound are original work
generated in code on the `@tenyears/core` pipeline — cel NPR, ink
outlines, painterly haze, 100% synth audio.

## The loop

Title over a candle-lit tavern corner, the die rolling slowly →
**Enter**: isometric approach (QE rotates 45°) to the tollhouse bridge →
the tollkeeper blocks the bridge foot → THE DIALOGUE: **[Deception 12] /
[Intimidation 14] / [Persuasion 12] / [Attack] / [Pay 60]** — skill picks
hurl the chunky gold-inked d20 across the screen; modifiers tally,
crits/fails sting; outcomes genuinely branch (talk through free / politely
robbed / a surprised-tollkeeper fight) → THE FIGHT: turn-based,
initiative ribbon, move ring, action + bonus action — melee strike,
**SHOVE** (the bridge has no rails; the river is instant death, ragdoll
and splash), dip blade in candle fire, throw the barrel; the mage
companion takes her own turns (spark bolt line, grease puddle — ignite it
for the combo) → loot the toll chest (500 gold + a cloak) → the mage
barks about your earlier choice → results: the FULL rolls history, bodies
in the river, gold.

## Controls

| Key | Action |
|---|---|
| 1–5 | dialogue choices |
| WASD | move (camera-relative) |
| Q / E | rotate the isometric camera |
| Tab | cycle targets |
| 1–4 | strike / shove / dip blade / throw barrel |
| Enter | end turn · E loots the chest |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2023-baldurs-gate   # http://localhost:5308 (strictPort)
npm run build -w game-2023-baldurs-gate # tsc --noEmit && vite build
npm run shoot -w game-2023-baldurs-gate # film test → shots/
node games/2023-baldurs-gate/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — the tavern corner, die at rest
- `02-tollhouse-approach` — the bridge foot
- `03-dialogue-roll` — choices + the tumble
- `04-crit-success` — the die settles on 20
- `05-initiative` — the ribbon, the move ring
- `06-shove-into-river` — the ragdoll splash
- `07-grease-fire` — the pool ignites
- `08-loot` — the toll chest
- `09-results` — the rolls history
