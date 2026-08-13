/**
 * hud.ts — the ship HUD: task list ink panel with check-offs, room-name
 * banners, context prompts, the kill flash, the MEETING full-screen ink
 * card (chat-log testimony, then the vote list with bean swatches), the
 * eject card, and the results card with the impostor reveal. House
 * language, palette only.
 */
import { injectHudStyles, MessageFlash, hudColors, css } from "@tenyears/core";
import { PAL, CREW_COLORS } from "./palette";
import { STATIONS } from "./ship";
import type { Game, Crew } from "./game";

const C = hudColors(PAL);
const RED = css(PAL.accents.primary);

const TASK_LABELS: Record<string, string> = Object.fromEntries(
  STATIONS.map((s) => [s.task, `${s.label} — ${s.room}`]),
);

export class HUD {
  private flash: MessageFlash;
  private tasksEl: HTMLElement;
  private bannerEl: HTMLElement;
  private promptEl: HTMLElement;
  private meetingEl: HTMLElement;
  private meetTitle: HTMLElement;
  private meetLines: HTMLElement;
  private voteEl: HTMLElement;
  private resultsEl: HTMLElement;
  private bannerT = 0;
  private lastRoom = "";
  voteSel = 0;

  constructor() {
    injectHudStyles(PAL);
    const root = document.getElementById("hud")!;
    root.innerHTML = `
      <div id="hud-tasks" class="ty-panel ty-txt"><div class="tt">TASKS</div><div class="list"></div></div>
      <div id="hud-room" class="ty-txt"></div>
      <div id="hud-prompt" class="ty-panel ty-txt"></div>
      <div id="hud-msg"></div>
      <div id="hud-meeting"><div class="ty-card ty-txt meet-card">
        <h1 id="meet-title">DEAD BODY REPORTED</h1>
        <div class="chat"></div>
        <div class="vote"></div>
      </div></div>
      <div id="hud-results"><div class="ty-card ty-txt">
        <h1 id="res-title">CREW WINS</h1>
        <div class="sub" id="res-sub"></div>
        <div class="res-stats"></div>
        <div class="again ty-pulse">ENTER — NEXT SHIFT</div>
      </div></div>
    `;
    const style = document.createElement("style");
    style.textContent = /* css */ `
      #hud-tasks { left: 26px; top: 24px; padding: 10px 18px 10px 14px; min-width: 210px; }
      #hud-tasks .tt { font-size: 13px; letter-spacing: 0.3em; color: ${C.accent}; margin-bottom: 6px; }
      #hud-tasks .t { font-size: 13px; color: ${C.paper}; margin: 4px 0; letter-spacing: 0.04em; }
      #hud-tasks .t.done { color: #6a7488; text-decoration: line-through; }
      #hud-tasks .t.done::before { content: "☑ "; color: ${C.accent}; }
      #hud-tasks .t:not(.done)::before { content: "☐ "; color: ${C.accent}; }
      #hud-room { position: absolute; top: 26px; left: 50%; transform: translateX(-50%) skewX(-6deg);
        font-size: 30px; color: ${C.paper}; letter-spacing: 0.3em; text-indent: 0.3em;
        text-shadow: 3px 3px 0 ${C.ink}; opacity: 0; transition: opacity 0.4s; }
      #hud-prompt { left: 50%; bottom: 30px; transform: translateX(-50%) skewX(-6deg);
        padding: 9px 24px; font-size: 16px; letter-spacing: 0.1em; color: ${C.paper}; display: none; }
      #hud-prompt b { color: ${RED}; }
      #hud-meeting { position: absolute; inset: 0; display: none; align-items: center;
        justify-content: center; background: rgba(10,12,24,0.6); }
      .meet-card { min-width: 560px; max-width: 640px; }
      .meet-card h1 { font-size: 40px; color: ${RED}; text-shadow: 3px 3px 0 ${C.ink}; margin: 0 0 4px; }
      .meet-card .chat { margin: 14px 0; min-height: 170px; }
      .meet-card .chat .line { font-size: 15px; margin: 6px 0; color: ${C.paper};
        font-weight: 700; }
      .meet-card .chat .line .who { font-style: italic; }
      .meet-card .chat .line.mine { color: ${C.accent}; }
      .meet-card .vote { display: none; flex-wrap: wrap; gap: 8px; }
      .meet-card .vote .cand {
        display: flex; align-items: center; gap: 8px; padding: 6px 14px;
        border: 3px solid ${C.ink}; background: rgba(255,255,255,0.06);
        font: italic 900 15px var(--ty-font); color: ${C.paper};
      }
      .meet-card .vote .cand.on { border-color: ${RED}; background: rgba(224,58,74,0.18); }
      .meet-card .vote .cand .sw { width: 16px; height: 16px; border-radius: 5px;
        border: 2px solid ${C.ink}; }
      .meet-card .vote-hint { font-size: 12px; letter-spacing: 0.2em; color: ${C.accent};
        margin-top: 10px; }
      #hud-results .sub { color: ${C.accent}; letter-spacing: 0.35em; font-size: 12px; margin-bottom: 16px; }
      #hud-results .res-stats { font-size: 17px; line-height: 2.0; color: ${C.paper}; text-align: center; }
      #hud-results .res-stats b { color: ${RED}; }
      #hud-results .again { margin-top: 20px; text-align: center; font-size: 15px; letter-spacing: 0.2em; }
    `;
    document.head.appendChild(style);

    this.flash = new MessageFlash(root.querySelector("#hud-msg")!);
    this.tasksEl = root.querySelector("#hud-tasks .list")!;
    this.bannerEl = root.querySelector("#hud-room")!;
    this.promptEl = root.querySelector("#hud-prompt")!;
    this.meetingEl = root.querySelector("#hud-meeting")!;
    this.meetTitle = root.querySelector("#meet-title")!;
    this.meetLines = root.querySelector("#hud-meeting .chat")!;
    this.voteEl = root.querySelector("#hud-meeting .vote")!;
    this.resultsEl = root.querySelector("#hud-results")!;
  }

  msg(text: string, ms: number, warn = false): void {
    this.flash.show(text, ms, warn);
  }

  tick(dtMs: number): void {
    this.flash.tick(dtMs);
    if (this.bannerT > 0) {
      this.bannerT -= dtMs;
      if (this.bannerT <= 0) this.bannerEl.style.opacity = "0";
    }
  }

  roomBanner(name: string): void {
    if (name === this.lastRoom) return;
    this.lastRoom = name;
    if (!name) return;
    this.bannerEl.textContent = name;
    this.bannerEl.style.opacity = "1";
    this.bannerT = 1800;
  }

  prompt(html: string): void {
    this.promptEl.style.display = html ? "block" : "none";
    if (html) this.promptEl.innerHTML = html;
  }

  update(game: Game): void {
    this.tasksEl.innerHTML = STATIONS.map(
      (s) => `<div class="t ${game.tasksDone.has(s.task) ? "done" : ""}">${TASK_LABELS[s.task]}</div>`,
    ).join("");
  }

  /* ------------------------------------------------------------ meeting -- */

  showMeeting(title: string): void {
    this.meetTitle.textContent = title;
    this.meetLines.innerHTML = "";
    this.voteEl.innerHTML = "";
    this.voteEl.style.display = "none";
    this.meetingEl.style.display = "flex";
    this.voteSel = 0;
  }

  addMeetingLine(who: string, text: string, mine: boolean): void {
    const whoColor = mine ? C.accent : (CREW_COLORS.find((c) => c.name === who) ? css(CREW_COLORS.find((c) => c.name === who)!.hex) : C.paper);
    const div = document.createElement("div");
    div.className = "line" + (mine ? " mine" : "");
    div.innerHTML = `<span class="who" style="color:${whoColor}">${who}:</span> ${text}`;
    this.meetLines.appendChild(div);
  }

  showVote(game: Game): void {
    this.voteEl.style.display = "flex";
    this.voteEl.innerHTML = "";
    const alive = game.crew.filter((c) => c.alive);
    const mk = (label: string, id: number | "skip", hex?: number) => {
      const d = document.createElement("div");
      d.className = "cand";
      d.dataset.id = String(id);
      d.innerHTML = (hex !== undefined ? `<span class="sw" style="background:${css(hex)}"></span>` : "") + label;
      this.voteEl.appendChild(d);
    };
    for (const c of alive) mk(c.name, c.id, CREW_COLORS[c.colorIdx].hex);
    mk("SKIP VOTE", "skip");
    const hint = document.createElement("div");
    hint.className = "vote-hint";
    hint.textContent = "← → SELECT · SPACE — VOTE";
    this.voteEl.appendChild(hint);
    this.markVoteSel();
  }

  voteMove(dir: number): void {
    const cands = this.voteEl.querySelectorAll(".cand");
    if (!cands.length) return;
    this.voteSel = (this.voteSel + dir + cands.length) % cands.length;
    this.markVoteSel();
  }

  private markVoteSel(): void {
    this.voteEl.querySelectorAll(".cand").forEach((el, i) => {
      el.classList.toggle("on", i === this.voteSel);
    });
  }

  /** the selected candidate id (number) or "skip" */
  voteChoice(): number | "skip" {
    const el = this.voteEl.querySelectorAll(".cand")[this.voteSel] as HTMLElement | undefined;
    if (!el) return "skip";
    return el.dataset.id === "skip" ? "skip" : Number(el.dataset.id);
  }

  hideMeeting(): void {
    this.meetingEl.style.display = "none";
  }

  results(game: Game, won: boolean, kind: string): void {
    (this.resultsEl.querySelector("#res-title") as HTMLElement).textContent = won
      ? "CREW WINS"
      : "IMPOSTOR WINS";
    (this.resultsEl.querySelector("#res-sub") as HTMLElement).textContent = won
      ? kind === "tasks" ? "ALL TASKS COMPLETE" : "THE IMPOSTOR WAS EJECTED"
      : kind === "killed" ? "YOU WERE KILLED ALONE" : "THE IMPOSTOR OUTNUMBERED YOU";
    (this.resultsEl.querySelector(".res-stats") as HTMLElement).innerHTML =
      `THE IMPOSTOR WAS <b>${game.impostor.name}</b><br/>` +
      `TASKS DONE <b>${game.tasksDone.size}/5</b> · SURVIVED <b>${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, "0")}</b>`;
    this.resultsEl.style.display = "flex";
  }
}
