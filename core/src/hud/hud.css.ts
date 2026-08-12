/**
 * hud.css.ts — the house HUD language as an injectable style module (§2.5).
 *
 * Fixed by the franchise: dark translucent fill, 3px ink border, 5px hard
 * offset shadow, slight skewX(-6deg), italic 900 weight, deliberately
 * choppy steps(2) pulses. Palette hexes only — injected as CSS custom
 * properties (`--ty-*`) so each game re-skins the language from ITS palette
 * without touching the rules.
 *
 * Usage: `injectHudStyles(palette)` once at boot; then use the `.ty-*`
 * classes on DOM HUD elements. Canvas widgets live in `widgets.ts`.
 */
import { css, type Palette } from "../world/palette";

/**
 * Inject the house style. Optional accent overrides let a game point the
 * two "pop" colors at its own accents (they default to the palette's).
 */
export function injectHudStyles(
  palette: Palette,
  opts: { fontStack?: string } = {},
): void {
  const font = opts.fontStack ?? '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const style = document.createElement("style");
  style.dataset.tyHud = "true";
  style.textContent = /* css */ `
:root {
  --ty-ink: ${css(palette.ink.line)};
  --ty-ink-deep: ${css(palette.ink.deep)};
  --ty-paper: ${css(palette.sky.sunCore)};
  --ty-accent: ${css(palette.accents.primary)};
  --ty-accent-deep: ${css(palette.accents.primaryDeep)};
  --ty-hot: ${css(palette.accents.rimHot)};
  --ty-fill: color-mix(in srgb, ${css(palette.ink.deep)} 72%, transparent);
  --ty-font: ${font};
}
.ty-panel {
  position: absolute; pointer-events: none;
  background: var(--ty-fill);
  border: 3px solid var(--ty-ink);
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--ty-ink-deep) 55%, transparent);
  transform: skewX(-6deg);
}
.ty-txt {
  font-family: var(--ty-font);
  font-style: italic; font-weight: 900;
  color: var(--ty-paper);
}
.ty-card {
  background: color-mix(in srgb, var(--ty-ink-deep) 90%, transparent);
  border: 4px solid var(--ty-ink);
  box-shadow: 10px 10px 0 color-mix(in srgb, var(--ty-accent-deep) 50%, transparent);
  padding: 34px 56px; transform: skewX(-4deg);
  color: var(--ty-paper); min-width: 460px;
}
.ty-card h1 {
  margin: 0 0 6px; font-size: 52px; font-style: italic;
  color: var(--ty-hot);
  text-shadow: 4px 4px 0 var(--ty-accent-deep);
}
.ty-msg {
  position: absolute; left: 50%; top: 16%;
  transform: translateX(-50%) skewX(-6deg);
  color: var(--ty-paper); font-size: 74px; font-weight: 900; font-style: italic;
  text-shadow: 5px 5px 0 var(--ty-ink),
    10px 10px 0 color-mix(in srgb, var(--ty-accent-deep) 60%, transparent);
  text-align: center; letter-spacing: 0.04em; pointer-events: none;
}
.ty-msg.ty-warn { color: var(--ty-hot); font-size: 44px; }
.ty-pulse { animation: ty-pulse 1.1s steps(2) infinite; }
@keyframes ty-pulse { 50% { color: var(--ty-accent); } }
`;
  document.head.appendChild(style);
}
