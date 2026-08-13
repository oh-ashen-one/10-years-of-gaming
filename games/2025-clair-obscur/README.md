# OVERPAINT — a 2025 tale (Game 10 · Clair Obscur: Expedition 33 fan recreation)

A painted valley where a gold-leaf "34" hangs in the canvas sky. The
expedition walks the path — and when the paint fights back, your turn is a
menu but *their* turn is in your hands. Hybrid turn-based/real-time combat
on the `@tenyears/core` cel/ink pipeline — all art and audio generated in
code.

## The 10-minute loop

- **0:00** Title over the impossible valley: floating rock shards with
  gold veins, gilded frames adrift, the Number in the sky.
- **0:10** Third-person walk the painted path: petals and paint motes,
  two **picto pickups** (stat stickers), the expedition flag checkpoint.
- **1:00** **Fight 1 (2 brushlings):** your turn — **1** strike,
  **2** free-aim at the weak point (fire when the dot crosses the gold),
  **3** ink lance; AP as paint daubs. Their turn — telegraphed
  brushstrokes you **dodge (Space)** or **parry (F, the tight window)**;
  a parry answers with a counter splash.
- **4:00** **Fight 2 (the fenced mime):** shielded — your hits chip at
  10%. Three **parries** break the gradient shield. Then unload.
- **6:00** **BOSS — the Curator's Marionette** in the gilt-frame arena:
  the sweep (dodge it), jab-jab-slam (parry the chain), the gradient
  cannon (Space on the marker flash). Parries and hits fill the gauge —
  **Q OVERPAINT** repaints its face: huge damage + stagger.
- **9:00** The boss dissolves into petals → **FOR THOSE WHO COME AFTER**
  → results: parry %, damage, turns.

## Controls

| Key | Explore | Battle |
|---|---|---|
| WASD | walk | — |
| 1 / 2 / 3 | — | strike / free aim / ink lance |
| Enter | — | fire (aiming) / end turn |
| Space | — | dodge · jump marker |
| F | — | parry (tight) |
| Q | — | OVERPAINT (gauge full) |
| Tab | — | cycle target |

## Run

```bash
npm run dev        # in games/2025-clair-obscur — port 5310 (strict)
npm run shoot      # captures the 9 film-test shots to shots/
node tools/e2e.mjs # scripted playthrough (needs the dev server up)
```

## Shots

`01-title` `02-painted-valley` `03-first-stroke` `04-parry-counter`
`05-free-aim` `06-marionette` `07-overpaint` `08-petal-dissolve`
`09-those-who-come-after`
