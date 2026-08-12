/**
 * index.ts — @tenyears/core public surface.
 *
 * The studio package shared by all eleven games (MASTER.md §4). Fixed by
 * the franchise: the NPR recipe, ink passes, HUD CSS language, audio chain
 * + primitives, camera spring core, frame-loop invariants, harness
 * contract. Swapped per game: palette values, world, rigs, sky dressing.
 */
export * from "./world/palette";
export * from "./world/noise";
export * from "./world/heightfield";
export * from "./render/cel";
export * from "./render/post";
export * from "./render/sky";
export * from "./camera/chase";
export * from "./audio/synth";
export * from "./hud/hud.css";
export * from "./hud/widgets";
export * from "./harness/game";
export * from "./harness/frame";
