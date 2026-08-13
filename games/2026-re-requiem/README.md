# REQUIEM WARD — a 2026 tale (Game 11 · Resident Evil Requiem fan recreation)

First-person survival horror in St. Veronica's Ward A: twelve bullets, a
flashlight, and something tall that cannot die. On the `@tenyears/core`
cel/ink pipeline with a bespoke ward shader (quantized flashlight cone,
tube-light pools, rain gobos) — all art and audio generated in code.

## The 10-minute loop

- **0:00** Title: the rain-streaked facade, one window lit.
- **0:10** First-person inside. The flashlight (**G**) is warm; it
  *flickers when they are near*. Ward A's dark corridors hold three
  shamblers — **RMB** aim (slows your walk, tightens the cone), **LMB**
  fire; headshots stagger. Ammo is scarce: 12 + pickups.
- **2:00** The inventory (**Tab**): six slots. Mark a herb, combine with
  the other → **medkit**. Key items examine — they rotate in the light.
- **3:30** The puzzle: the **fuse** is in the exam room; the **crank** is
  in the morgue, guarded. Locked doors talk through keyhole plates
  ("DIRECTOR'S OFFICE — NEEDS CRANK").
- **6:00** Slot the fuse in the director's panel → **POWER ON** — the
  office tube hums awake… and so does **the Pursuer**. Invincible;
  bullets stagger it three seconds. It hears fast footsteps and gunfire.
- **7:30** The elevator key waits on the now-lit director's desk. Grab it.
  Run.
- **8:30** The elevator: the doors open, it charges the corridor, the
  doors shut **on its hand**.
- **9:30** **SURVIVED** — shots fired, accuracy, herbs left, time.

## Controls

| Key | Action |
|---|---|
| WASD | move (Shift = fast, loud) |
| Q/E or ←/→ | lean-turn |
| RMB | aim (slow, tight) |
| LMB | fire (aimed only) |
| F | interact / use in inventory |
| Tab | inventory |
| G | flashlight |

## Run

```bash
npm run dev        # in games/2026-re-requiem — port 5311 (strict)
npm run shoot      # captures the 9 film-test shots to shots/
node tools/e2e.mjs # scripted playthrough (needs the dev server up)
```

## Shots

`01-title` `02-ward-a-dark` `03-first-shambler` `04-inventory-combine`
`05-fuse-puzzle` `06-power-on` `07-the-pursuer` `08-elevator-chase`
`09-survived`
