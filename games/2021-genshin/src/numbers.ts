/**
 * numbers.ts — chunky italic ink damage numbers. DOM pool projected from
 * world space each frame: pop scale-in, rise, fade. Swirl blooms are
 * bigger and teal; core crits gold. This is the combat read.
 */
import * as THREE from "three";
import { hudColors } from "@tenyears/core";
import { PAL } from "./palette";
import type { DmgKind } from "./game";

const C = hudColors(PAL);

const COLORS: Record<DmgKind | "swirl", string> = {
  wind: "#7ff0d0",
  pyro: "#ffb05a",
  swirl: "#5ff0c8",
  core: "#ffd23f",
  plain: "#ffffff",
};

interface Num {
  el: HTMLElement;
  t: number;
  life: number;
  wp: THREE.Vector3;
}

export class DamageNumbers {
  private pool: Num[] = [];
  private root: HTMLElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "dmg-numbers";
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #dmg-numbers { position: fixed; inset: 0; pointer-events: none; z-index: 8; overflow: hidden; }
      #dmg-numbers .n {
        position: absolute; font-family: var(--ty-font, "Segoe UI", Arial);
        font-style: italic; font-weight: 900; transform: translate(-50%,-50%);
        text-shadow: 2px 2px 0 ${C.ink}, 4px 4px 0 rgba(0,0,0,0.3);
        will-change: transform, opacity;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.root);
  }

  spawn(wp: THREE.Vector3, dmg: number, kind: DmgKind | "swirl"): void {
    let n = this.pool.find((v) => v.t >= v.life);
    if (!n) {
      const el = document.createElement("div");
      el.className = "n";
      this.root.appendChild(el);
      n = { el, t: 0, life: 0, wp: new THREE.Vector3() };
      this.pool.push(n);
    }
    n.t = 0;
    n.life = kind === "swirl" ? 1.0 : 0.7;
    n.wp.copy(wp);
    n.el.textContent = kind === "swirl" ? `SWIRL ${dmg}` : String(Math.round(dmg));
    n.el.style.color = COLORS[kind];
    n.el.style.fontSize = kind === "swirl" ? "34px" : kind === "core" ? "30px" : dmg > 30 ? "26px" : "20px";
  }

  update(dt: number, camera: THREE.Camera): void {
    const v = new THREE.Vector3();
    for (const n of this.pool) {
      if (n.t >= n.life) {
        n.el.style.display = "none";
        continue;
      }
      n.t += dt;
      const k = n.t / n.life;
      v.copy(n.wp);
      v.y += k * 1.6;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2 - k * 0.2;
      n.el.style.display = "block";
      n.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%,-50%) scale(${pop.toFixed(2)}) skewX(-6deg)`;
      n.el.style.opacity = String(1 - Math.max(0, (k - 0.6) / 0.4));
    }
  }
}
