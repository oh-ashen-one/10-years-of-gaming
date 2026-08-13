# 10 Years of Gaming

Recreating the top trending game of each year (2016–2026) as a high-quality
**10-minute playable version** — for a YouTube video series.

## The List: Top Trending Game of Each Year

Picked on a blend of global sales, player counts, streaming/cultural impact,
across all platforms (PC, console, mobile) and regions (US, Europe, Japan, China).

| Year | Game | Platform(s) | Why it defined the year |
|------|------|-------------|-------------------------|
| 2016 | **Pokémon GO** | Mobile | Biggest global phenomenon of the year — ~500M downloads in 2016, mainstream AR craze. Runner-up: Overwatch (GOTY). |
| 2017 | **PlayerUnknown's Battlegrounds (PUBG)** | PC/Xbox | Invented the battle-royale wave; ~30M+ copies, record Steam concurrents. Runner-up: Zelda: Breath of the Wild (GOTY). |
| 2018 | **Fortnite** | All | Peak cultural dominance — dances, concerts, 125M+ players. Best-selling premium: Red Dead Redemption 2. |
| 2019 | **Minecraft (resurgence)** | All | Massive comeback; became best-selling game of all time era. Runners-up: Apex Legends, CoD: Modern Warfare (best-seller). |
| 2020 | **Among Us** | Mobile/PC | Pandemic-party phenomenon, 500M+ players, meme of the year. Runner-up: Animal Crossing: New Horizons (35M+ copies). |
| 2021 | **Genshin Impact** | Mobile/PC/PS | Global (esp. China/Japan) gacha juggernaut, highest-grossing of the era. Runner-up: It Takes Two (GOTY). |
| 2022 | **Elden Ring** | PC/PS/Xbox | GOTY everywhere, 25M+ copies, open-world Souls craze. Runner-up: God of War Ragnarök. |
| 2023 | **Baldur's Gate 3** | PC/PS/Xbox | GOTY sweep, CRPG revival. Best-seller of the year: Hogwarts Legacy. |
| 2024 | **Black Myth: Wukong** | PC/PS5 | 20M+ copies in weeks, record Steam concurrents, massive in China. Runners-up: Palworld, Helldivers 2. |
| 2025 | **Clair Obscur: Expedition 33** | PC/PS/Xbox | Breakout hit + GOTY sweep. Runners-up: Monster Hunter Wilds (best-seller), Minecraft Movie bump, GTA VI hype. |
| 2026 | **Resident Evil Requiem** | PC/PS5/Xbox | YTD best-seller and most-watched launch so far. Runner-up: Crimson Desert. |

Notes:
- "Trending" ≠ strictly best-selling: Call of Duty / EA Sports FC top the sales
  charts nearly every year in the US/EU, but one CoD-style shooter stands in for
  that slot in a 10-minute recreation format.
- 2016–2025 is the core 10 years; 2026 is included as a bonus "this year" episode.

## Format

Each year gets one game, rebuilt as a polished ~10-minute playable browser slice.
Stack (locked): **Vite + strict TypeScript + Three.js, zero external assets** —
every mesh, texture and sound generated in code. One shared studio core, eleven
different movies.

- **`MASTER.md` — the production bible.** Craft standard (the Dusk bar),
  shared-core spec, per-game chapters (beat sheets, controls, art locks, shot
  lists, scope guards), engineering rules, and the ready-to-use `/goal` prompt.
- `core/` — `@tenyears/core`, the shared studio package (cel NPR, ink post,
  painted sky, chase camera, synth audio, HUD language, film-test harness)
- `games/2016-pokemon-go/` … `games/2026-re-requiem/` — one Vite app per game,
  own port (5301–5311), own `shots/` film test

### Build status

| Game | Slice | Status |
|---|---|---|
| 2016 Pokémon GO | walk → catch loop → gym | ✅ |
| 2017 PUBG | drop → loot → shrink → chicken dinner | ✅ |
| 2018 Fortnite | dive → harvest → build → victory royale | ✅ |
| 2019 Minecraft | punch → craft → shelter → survive the night | ✅ |
| 2020 Among Us | tasks → body → meeting → eject | ✅ |
| 2021 Genshin Impact | meadow combat → glide → world boss | ✅ |
| 2022 Elden Ring | soldiers → fog gate → Bridge Warden | ✅ |
| 2023 Baldur's Gate 3 | dialogue rolls → turn-based tollhouse fight | ✅ |
| 2024 Black Myth: Wukong | staff combos → perfect dodge → Tiger Abbot | ⬜ |
| 2025 Clair Obscur | dodge/parry turn-based → Marionette boss | ⬜ |
| 2026 RE Requiem | flashlight ward → puzzle → pursuer chase | ⬜ |

### Building a game

Feed the `/goal` prompt from `MASTER.md` §7, filling `{{N}}`, `{{YEAR}}`,
`{{TITLE}}`, `{{SLUG}}`, `{{NN}}` from the fill table — one game per run.

## Sources

- Wikipedia, "YYYY in video games" (best-selling premium games by region, 2016–2026)
- Circana (NPD) top-10 best-sellers, US
- GamesIndustry.biz European annual reports
- Steam / SteamDB concurrent-player records
