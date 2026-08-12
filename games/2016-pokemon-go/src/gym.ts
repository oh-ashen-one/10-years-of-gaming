/**
 * gym.ts — the Crown Plaza gym battle presentation. GYMHORN (a big
 * purple horned bruiser, original kitbash) holds the plaza; your buddy
 * faces it across three dodge lanes. Pure presentation: HP, lanes,
 * telegraphs and outcomes all live in game.ts — this rig reads GymState
 * each frame and takes event nudges (attack lunges, slams) from main.ts.
 */
import * as THREE from "three";
import { makeCelMaterial, addOutline, col } from "@tenyears/core";
import { PAL } from "./palette";
import { PLACES } from "./world/layout";
import { buildCritter, type SpeciesId, type CritterRig } from "./creatures";
import type { GymState } from "./game";

export const GYM_ARENA = {
  boss: new THREE.Vector3(PLACES.plaza.x, 0, PLACES.plaza.z + 10),
  buddy: new THREE.Vector3(PLACES.plaza.x, 0, PLACES.plaza.z + 22),
  laneWidth: 3.2,
};

export class GymBattleFX {
  group = new THREE.Group();
  private boss: THREE.Group;
  private bossBody: THREE.Mesh;
  private buddy: CritterRig | null = null;
  private buddyHolder = new THREE.Group();
  private laneMarks: THREE.Mesh[] = [];
  private lungeT = Infinity;
  private slamT = Infinity;
  private buddyX = 0;

  constructor(parent: THREE.Group) {
    // GYMHORN — broad purple brute with gold horns and cement fists
    const boss = new THREE.Group();
    const mBody = makeCelMaterial({ color: PAL.extra.gymPurple, specBand: 0.4, specPow: 30, rim: 0.6 });
    const mBelly = makeCelMaterial({ color: 0xd8cce8, rim: 0.3 });
    const mGold = makeCelMaterial({ color: PAL.extra.gold, specBand: 0.9, specPow: 50, rim: 0.4 });
    const mFist = makeCelMaterial({ color: PAL.extra.gymDeep, rim: 0.4 });

    this.bossBody = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 16), mBody);
    this.bossBody.position.y = 2.0;
    this.bossBody.scale.set(1.15, 1.05, 1);
    boss.add(this.bossBody);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), mBelly);
    belly.position.set(0, 1.8, 0.7);
    belly.scale.set(0.9, 0.9, 0.5);
    boss.add(belly);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 8), mGold);
      horn.position.set(s * 1.0, 3.4, 0);
      horn.rotation.z = -s * 0.5;
      boss.add(horn);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), mFist);
      fist.position.set(s * 2.0, 1.5, 0.3);
      boss.add(fist);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mFist);
      foot.position.set(s * 0.8, 0.35, 0);
      foot.scale.set(1, 0.6, 1.2);
      boss.add(foot);
    }
    // glowering eyes
    const eyeMat = makeCelMaterial({ color: 0xffffff, emissive: 0xffd23f, emissiveStrength: 0.4, rim: 0.1 });
    const pupilMat = makeCelMaterial({ color: 0x1a1a2e, rim: 0.1 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), eyeMat);
      e.position.set(s * 0.55, 2.5, 1.35);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), pupilMat);
      p.position.set(s * 0.55, 2.5, 1.52);
      boss.add(e, p);
    }
    addOutline(boss, 2.6, col(PAL.ink.line));
    boss.position.copy(GYM_ARENA.boss);
    // eyes are on local +Z; the buddy stands at +Z world — no turn needed
    this.boss = boss;
    this.group.add(boss);

    // lane dodge markers (flash on telegraph)
    for (let i = -1; i <= 1; i++) {
      const mark = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.0, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: PAL.extra.ringRed, transparent: true, opacity: 0 }),
      );
      mark.position.set(GYM_ARENA.buddy.x + i * GYM_ARENA.laneWidth, 0.06, GYM_ARENA.buddy.z);
      this.laneMarks.push(mark);
      this.group.add(mark);
    }

    this.buddyHolder.position.copy(GYM_ARENA.buddy);
    this.buddyHolder.rotation.y = Math.PI; // buddy faces north (the boss)
    this.group.add(this.buddyHolder);

    this.group.visible = false;
    parent.add(this.group);
  }

  begin(buddy: SpeciesId): void {
    if (this.buddy) this.buddyHolder.remove(this.buddy.group);
    this.buddy = buildCritter(buddy);
    this.buddy.group.scale.multiplyScalar(1.2);
    this.buddyHolder.add(this.buddy.group);
    this.lungeT = Infinity;
    this.slamT = Infinity;
    this.group.visible = true;
  }

  end(): void {
    this.group.visible = false;
  }

  attackLunge(): void {
    this.lungeT = 0;
  }

  slam(): void {
    this.slamT = 0;
  }

  update(dt: number, time: number, g: GymState | null): void {
    if (!g || !this.group.visible) return;

    // boss idle: heavy breathing; leans back while telegraphing
    const warn = g.warnLane !== null;
    this.boss.position.y = Math.abs(Math.sin(time * 1.6)) * 0.15;
    this.boss.rotation.x = warn ? -0.25 - Math.sin(time * 20) * 0.04 : 0;
    (this.bossBody.material as THREE.ShaderMaterial).uniforms.uEmissive.value.set(
      warn ? 0xff5a5a : 0x000000,
    );
    (this.bossBody.material as THREE.ShaderMaterial).uniforms.uEmissiveStr.value = warn ? 0.35 : 0;

    // slam: the whole brute drops forward for a beat
    if (this.slamT < 0.4) {
      this.slamT += dt;
      const k = Math.sin(Math.min(1, this.slamT / 0.4) * Math.PI);
      this.boss.rotation.x = k * 0.7;
      this.boss.position.z = GYM_ARENA.boss.z + k * 2.5;
    } else {
      this.boss.position.z = GYM_ARENA.boss.z;
    }

    // telegraph lane decal pulses
    this.laneMarks.forEach((m, i) => {
      const lane = i - 1;
      const on = warn && g.warnLane === lane;
      (m.material as THREE.MeshBasicMaterial).opacity = on ? 0.5 + Math.sin(time * 18) * 0.3 : 0;
    });

    // buddy: slides between lanes, hops idle, lunges on attack
    this.buddyX += (g.lane * GYM_ARENA.laneWidth - this.buddyX) * Math.min(1, dt * 12);
    let z = 0;
    if (this.lungeT < 0.35) {
      this.lungeT += dt;
      z = -Math.sin(Math.min(1, this.lungeT / 0.35) * Math.PI) * 3.2;
    }
    this.buddyHolder.position.set(GYM_ARENA.buddy.x + this.buddyX, 0, GYM_ARENA.buddy.z + z);
    this.buddy?.update(dt, time, g.sub === "won" ? "dizzy" : "idle");
  }
}
