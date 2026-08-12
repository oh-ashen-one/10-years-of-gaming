# 2016 — POCKET GO (Pokémon GO fan recreation)

A ~10-minute browser recreation of 2016's defining phenomenon: walk your
neighborhood, creatures pop up, flick capsule-balls, fill the dex, take the
gym on the corner. All art, names and sounds are original work generated in
code on the `@tenyears/core` studio pipeline — cel NPR, ink passes, painted
morning sky, 100% WebAudio synth.

## The loop

Poster title over a living diorama → third-person walk around Maple Ward
(Whistle Park, Dandelion Green, Mirror Pond, Crown Plaza) → rustle rings
spawn six original species (Nibbit, Plumeck, Basker, Slinko, Vesper, and
the rare gold duck Gildquack — pond-only, flees twice) → **E** enters the
catch scene: shrinking difficulty ring, hold/release **Space** to throw,
lean **A/D** to curve, **B** for a berry, wobble ×3 → GOTCHA or break-out →
with 2+ pals, enter Crown Plaza for the auto-battle vs GYMHORN (**Space**
attack, **A/D** dodge the telegraphed slam) → win → your buddy sits on the
gym under confetti → results card (dex, catches, steps, GYM LEADER).

## Controls

| Key | Action |
|---|---|
| WASD / arrows | walk |
| E | interact / enter catch scene |
| Space (hold/release) | charge & throw the ball · attack at the gym |
| A / D | curve the throw · dodge lanes at the gym |
| B | toss a berry (calms the ring, better odds) |
| Enter | start / confirm / restart from results |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2016-pokemon-go     # http://localhost:5301 (strictPort)
npm run build -w game-2016-pokemon-go   # tsc --noEmit && vite build
npm run shoot -w game-2016-pokemon-go   # film test → shots/
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — poster over the living diorama
- `02-neighborhood-walk` — phone HUD, inked sidewalks, park greens
- `03-encounter-ring` — catch scene, ring mid-shrink
- `04-gotcha-burst` — the GOTCHA star burst
- `05-pond-rare` — Gildquack on the Mirror Pond shore
- `06-gym-battle` — GYMHORN mid-fight at Crown Plaza
- `07-dex-results` — dex page + GYM LEADER card
