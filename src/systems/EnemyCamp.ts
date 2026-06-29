import * as THREE from "three";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { CreatureDef } from "../creatures/types.ts";
import type { Player } from "../player/Player.ts";

interface Guard {
  group: THREE.Group;
  hp: number;
  angle: number; // patrol angle around the cage
  alive: boolean;
  hitFlash: number;
}

/**
 * A hostile camp out in the field that holds a caged creature. Guards patrol
 * the cage and chase the player (knockback on contact). Hit guards with the
 * sword to defeat them; once the camp is cleared the cage opens and the
 * creature can be freed (E) and joins your base.
 *
 * Self-contained: builds its own visuals, owns its guards, exposes a small
 * interaction API to Game.
 */
export class EnemyCamp {
  readonly position: THREE.Vector3;
  private guards: Guard[] = [];
  private reward: CreatureDef | null = null;
  private rewardMesh: THREE.Object3D | null = null;
  private bars: THREE.Mesh[] = [];
  private cleared = false;
  private collected = false;
  private t = 0;

  private static readonly AGGRO = 15;
  private static readonly REACH = 3.0; // sword reach
  private static readonly GUARD_HP = 3;

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    pos: THREE.Vector3
  ) {
    this.position = pos.clone();
  }

  async init() {
    this.buildCamp();
    await this.buildReward();
    this.buildGuards(4);
  }

  // --- visuals ---

  private buildCamp() {
    const { x, z } = this.position;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(x, 0.04, z);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // spiky log palisade ring with a front opening
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4f3a25, roughness: 1 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      if (Math.abs(a - Math.PI) < 0.5) continue; // gate gap facing -? leave an opening
      const lx = x + Math.cos(a) * 12;
      const lz = z + Math.sin(a) * 12;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3, 6), logMat);
      log.position.set(lx, 1.5, lz);
      log.rotation.z = 0.12 * Math.sin(i);
      log.castShadow = true;
      this.scene.add(log);
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x6a5236, roughness: 1 });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 6), tipMat);
      tip.position.set(lx, 3.2, lz);
      this.scene.add(tip);
    }

    // tents
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x7a3b3b, roughness: 0.9, flatShading: true });
    for (const [tx, tz] of [[x - 7, z + 5], [x + 7, z + 5], [x + 6, z - 6]] as const) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 4), tentMat);
      tent.rotation.y = Math.PI / 4;
      tent.position.set(tx, 1.5, tz);
      tent.castShadow = true;
      this.scene.add(tent);
    }

    // campfire
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 8), logMat);
    logs.position.set(x - 5, 0.2, z - 5);
    this.scene.add(logs);
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.6, 7),
      new THREE.MeshStandardMaterial({ color: 0xffa336, emissive: 0xff5a18, emissiveIntensity: 2, roughness: 0.4 })
    );
    fire.position.set(x - 5, 1.1, z - 5);
    this.scene.add(fire);
    const light = new THREE.PointLight(0xff7a2a, 1.0, 18, 2);
    light.position.set(x - 5, 2, z - 5);
    this.scene.add(light);

    // central cage: floor + 4 corner posts + vertical bars (removed when cleared)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x8893ad, roughness: 0.5, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x3a3328, roughness: 1 }));
    base.position.set(x, 0.15, z);
    base.receiveShadow = true;
    this.scene.add(base);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), barMat);
      bar.position.set(x + Math.cos(a) * 2.2, 1.7, z + Math.sin(a) * 2.2);
      bar.castShadow = true;
      this.scene.add(bar);
      this.bars.push(bar);
    }
    const cap = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 20), barMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(x, 3.4, z);
    this.scene.add(cap);
    this.bars.push(cap);
  }

  private async buildReward() {
    // prefer a rarer creature as the prize
    const pool = this.library.all.filter((d) => d.rarity === "epic" || d.rarity === "legendary" || d.rarity === "mythic");
    this.reward = pool.length ? pool[(Math.random() * pool.length) | 0] : this.library.pick(99);
    if (!this.reward) return;
    const mesh = await this.library.createInstance(this.reward);
    mesh.position.set(this.position.x, 0.3, this.position.z);
    this.scene.add(mesh);
    this.rewardMesh = mesh;
  }

  private buildGuards(n: number) {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.55, 1.0, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.8, flatShading: true })
      );
      body.position.y = 1.1;
      body.castShadow = true;
      g.add(body);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 1.2 })
        );
        eye.position.set(sx * 0.2, 1.5, 0.45);
        g.add(eye);
      }
      // a crude club
      const club = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 }));
      club.position.set(0.5, 1.2, 0.2);
      club.rotation.z = -0.5;
      g.add(club);
      g.position.set(this.position.x + Math.cos(angle) * 5.5, 0, this.position.z + Math.sin(angle) * 5.5);
      this.scene.add(g);
      this.guards.push({ group: g, hp: EnemyCamp.GUARD_HP, angle, alive: true, hitFlash: 0 });
    }
  }

  // --- gameplay ---

  get guardsLeft(): number {
    return this.guards.filter((g) => g.alive).length;
  }

  /** Within interaction range of the cage? */
  near(p: THREE.Vector3): boolean {
    return p.distanceTo(this.position) < 6;
  }

  get isCleared(): boolean {
    return this.cleared;
  }
  get rewardName(): string {
    return this.reward?.name ?? "creature";
  }
  get canCollect(): boolean {
    return this.cleared && !this.collected;
  }

  /** A sword swing — damage the nearest alive guard in reach. Returns hit. */
  tryHit(p: THREE.Vector3): boolean {
    let best: Guard | null = null;
    let bestD = EnemyCamp.REACH * EnemyCamp.REACH;
    for (const g of this.guards) {
      if (!g.alive) continue;
      const d = g.group.position.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (!best) return false;
    best.hp -= 1;
    best.hitFlash = 0.2;
    if (best.hp <= 0) {
      best.alive = false;
      best.group.visible = false;
    }
    if (this.guardsLeft === 0) this.openCage();
    return true;
  }

  private openCage() {
    this.cleared = true;
    for (const b of this.bars) b.visible = false;
  }

  /** Claim the freed creature once. Returns its def (Game stores it). */
  collect(): CreatureDef | null {
    if (!this.canCollect) return null;
    this.collected = true;
    if (this.rewardMesh) this.rewardMesh.visible = false;
    return this.reward;
  }

  update(dt: number, player: Player) {
    this.t += dt;
    const p = player.position;
    for (const g of this.guards) {
      if (!g.alive) continue;
      const gp = g.group.position;
      const toPlayer = p.distanceTo(gp);
      let tx: number;
      let tz: number;
      if (toPlayer < EnemyCamp.AGGRO && !this.collected) {
        tx = p.x;
        tz = p.z; // chase
      } else {
        g.angle += dt * 0.5; // patrol
        tx = this.position.x + Math.cos(g.angle) * 5.5;
        tz = this.position.z + Math.sin(g.angle) * 5.5;
      }
      const dx = tx - gp.x;
      const dz = tz - gp.z;
      const d = Math.hypot(dx, dz) || 1;
      const speed = toPlayer < EnemyCamp.AGGRO ? 4.2 : 2;
      if (d > 1.0) {
        gp.x += (dx / d) * speed * dt;
        gp.z += (dz / d) * speed * dt;
      }
      g.group.rotation.y = Math.atan2(dx, dz);
      g.group.position.y = Math.abs(Math.sin(this.t * 6 + g.angle)) * 0.15; // stomp bob

      // hit flash recovery
      if (g.hitFlash > 0) {
        g.hitFlash = Math.max(0, g.hitFlash - dt);
        g.group.scale.setScalar(1 + g.hitFlash);
      } else {
        g.group.scale.setScalar(1);
      }

      // knockback the player on contact
      if (toPlayer < 1.5) {
        const nx = (p.x - gp.x) / (toPlayer || 1);
        const nz = (p.z - gp.z) / (toPlayer || 1);
        player.body.velocity.x = nx * 16;
        player.body.velocity.z = nz * 16;
      }
    }

    // float + spin the freed reward
    if (this.rewardMesh && this.cleared) {
      this.rewardMesh.position.y = 0.3 + 1.2 + Math.sin(this.t * 2) * 0.2;
      this.rewardMesh.rotation.y += dt * 0.8;
    }
  }
}
