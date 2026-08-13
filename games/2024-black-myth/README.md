# INKPEAK — a 2024 tale (Game 9 · Black Myth: Wukong fan recreation)

The Destined One walks into a temple court above the cloud sea. A tiger in
a monk's robe is waiting. A third-person staff-action slice on the
`@tenyears/core` cel/ink pipeline — all art and audio generated in code.

## The 10-minute loop

- **0:00** Title over the ink-wash mountain: red gate frames receding down
  the stone spine, petals drifting, the low gold sun in the cloud sea.
- **0:10** The incense shrine (rest / checkpoint / gourd refill). Down the
  path, the **bamboo court**: three lesser yaoguai teach the staff —
  light string (**LMB** jab → backhand → finisher), the focus heavy
  (**RMB**, spends the beads that landed lights build), and the dodge
  (**Space**) with the **perfect-dodge afterimage** (slow-mo streak + a
  focus bead refunded).
- **3:00** **Immobilize** (**Q**, cooldown) — freeze a lesser *mid-leap*;
  golden seal characters bloom over it.
- **4:00** The gate shrine, then the **fog curtain**.
- **4:30** **BOSS — THE TIGER ABBOT （虎僧）.** Phase 1: claw strings
  (punish after the 4th claw), the pounce, the blood-pool slam (telegraph
  ring; the pool lingers and burns). Phase 2 at 60%: the sword comes out —
  the **whirlwind dash** chain (perfect-dodge the passes, then **poke**
  stance (**C**) punishes the recovery) and the **roar AOE** (dodge through
  or gourd through).
- Death sends you back to the last shrine; the Abbot resets in full. The
  runback is ~20 seconds.
- **9:00** The kill: a gold seal burst, **YAOGUAI FELLED — 虎僧**, and the
  results card: deaths, perfect dodges, longest combo, time.

## Controls

| Key | Action |
|---|---|
| WASD | move (camera-relative) |
| Space | dodge (i-frames; a fresh dodge under a hit = PERFECT) |
| LMB | light string (builds focus) |
| RMB | focus heavy (stance-dependent) |
| C | stance swap: 崩 smash ↔ 戳 poke |
| Q | Immobilize (12s cooldown) |
| F | drink the gourd (4 sips) |
| Tab | lock-on |
| E | rest at a shrine |

## Run

```bash
npm run dev        # in games/2024-black-myth — port 5309 (strict)
npm run shoot      # captures the 8 film-test shots to shots/
node tools/e2e.mjs # scripted playthrough (needs the dev server up)
```

## Shots

`01-title` `02-bamboo-court` `03-staff-combo` `04-immobilize`
`05-perfect-dodge` `06-tiger-abbot` `07-phase2-whirlwind`
`08-yaoguai-felled`
