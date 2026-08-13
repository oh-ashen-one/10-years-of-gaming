# 2022 — GLOOMMOOR (Elden Ring fan recreation)

A ~10-minute browser recreation of the GOTY-everything souls landmark: a
mist-mazed moor valley beneath an impossible golden tree, a fog gate, and
a king's soldier waiting on the bridge. Die. Learn. Fell him. All art and
sound are original work generated in code on the `@tenyears/core`
pipeline — cel NPR with thin grim ink, hammered-matcap armor, quantized
mist, 100% synth audio.

## The loop

Title over the gloom → **Enter**: the Site of Grace (rest = heal, flask
refill, world respawns, checkpoint) → the light-guided path north: three
soldier packs teach it — **Tab** lock-on, **LMB** light / **RMB hold**
heavy, **Space** roll i-frames, **F** guard, **RMB tap** parry, and
STAMINA rules everything (empty = panting) → the scarab in the hollow
(+1 flask) → pack three drops the hint: *"the bridge guardian fears the
riposte"* → Gatehouse grace → the fog gate → **THE BRIDGE WARDEN**:
staff sweeps and the slow, slow overhead (punish after), dagger toss at
range — parry or posture-break → **RIPOSTE** cinematic; phase 2 at half:
the gold hammer falls on your mark, the tail sweeps → die → **YOU DIED**
(ink serif, slow fade) → runback, recover your shards from your corpse →
**GREAT ENEMY FELLED**, gold shower → results: deaths, time, hits taken,
flasks left.

## Controls

| Key | Action |
|---|---|
| WASD | move (camera-relative) |
| Space | roll (i-frames) |
| Shift | sprint |
| LMB / RMB hold | light / heavy |
| RMB tap | parry |
| F (hold) | guard |
| Tab | lock-on |
| Q | flask · E | grace / interact |
| Enter | start / restart |

## Run

```bash
npm install          # at the repo root
npm run dev -w game-2022-elden-ring    # http://localhost:5307 (strictPort)
npm run build -w game-2022-elden-ring  # tsc --noEmit && vite build
npm run shoot -w game-2022-elden-ring  # film test → shots/
node games/2022-elden-ring/tools/e2e.mjs  # scripted playthrough (dev server running)
```

## Shots

Captured by `../../tools/shoot.mjs` with `shots.manifest.mjs`:

- `01-title` — the moor beneath the golden tree
- `02-grace-guidance` — gold threads at the first grace
- `03-soldier-pack` — lock-on duel
- `04-fog-gate` — the pale wall
- `05-warden-phase1` — the staff-sweep telegraph
- `06-parry-riposte` — the staggered Warden
- `07-phase2-hammer` — the gold hammer falls
- `08-you-died` — ink serif, slow fade
- `09-great-enemy-felled` — gold shower
