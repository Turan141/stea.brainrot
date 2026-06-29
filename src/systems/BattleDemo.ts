import * as THREE from "three";
import { deriveCombat, elementMultiplier } from "../creatures/stats.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import { ELEMENT_COLOR, ROLE_LABEL, type CreatureDef } from "../creatures/types.ts";
import type { EventBus } from "../engine/EventBus.ts";

interface Fighter {
  def: CreatureDef;
  mesh: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  side: number; // -1 left, +1 right
  home: THREE.Vector3;
  hp: number;
  maxHp: number;
  atk: number;
  defense: number;
  interval: number; // seconds between attacks
  cd: number;
  state: "idle" | "lunge" | "return" | "dead";
  t: number; // state progress 0..1
  hit: boolean; // damage applied this lunge
  flash: number; // hit reaction timer
  death: number; // death anim progress
  bar: THREE.Sprite;
  baseScale: number;
  shield: number; // tank block window (seconds remaining)
  abilityCd: number; // time until next role ability
}

interface Particle {
  obj: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  max: number;
  s0: number; // base scale
  grow: boolean; // burst sprites expand; damage numbers keep their aspect
}

/**
 * A self-contained procedural battle demo: two creatures lunge-attack each
 * other on an arena pad with hit flashes, floating damage numbers and a death
 * animation. Presentation only — a preview of the future PvP Arena. Runs inside
 * the world scene at a fixed spot; the camera is focused here while active.
 */
export class BattleDemo {
  active = false;
  readonly center = new THREE.Vector3(-78, 0, -68); // dedicated colosseum, far-left field

  private fighters: Fighter[] = [];
  private particles: Particle[] = [];
  private overTimer = 0;
  private dot = makeDotTexture();
  private onResult: ((playerWon: boolean) => void) | null = null;
  private resolved = false;

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    private bus: EventBus
  ) {
    this.buildArena();
  }

  /**
   * Begin a battle between two creature defs. `a` is the player's champion
   * (left). onResult fires once when a winner is decided (true = player won).
   */
  async start(a: CreatureDef, b: CreatureDef, onResult?: (playerWon: boolean) => void, levelA = 1, levelB = 1) {
    if (this.active) return;
    this.active = true;
    this.overTimer = 0;
    this.resolved = false;
    this.onResult = onResult ?? null;

    this.fighters = [];
    for (const [def, side, level] of [
      [a, -1, levelA],
      [b, 1, levelB],
    ] as const) {
      const mesh = await this.library.createInstance(def);
      const baseScale = mesh.scale.x * 2; // bigger so the fight reads
      mesh.scale.setScalar(baseScale);
      const home = new THREE.Vector3(this.center.x + side * 3.2, 0, this.center.z);
      mesh.position.copy(home);
      mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // face the middle
      this.scene.add(mesh);

      const s = deriveCombat(def, level);
      const bar = this.makeBar(def);
      bar.position.set(home.x, 3.2, home.z);
      this.scene.add(bar);

      this.fighters.push({
        def,
        mesh,
        mixer: mesh.userData.mixer as THREE.AnimationMixer | undefined,
        side,
        home,
        hp: s.hp,
        maxHp: s.hp,
        atk: s.attack,
        defense: s.defense,
        interval: Math.max(0.7, 1.8 - s.speed * 0.07),
        cd: 0.6 + Math.random() * 0.6,
        state: "idle",
        t: 0,
        hit: false,
        flash: 0,
        death: 0,
        bar,
        baseScale,
        shield: 0,
        abilityCd: 3 + Math.random() * 3,
      });
    }
    this.bus.emit("notify", { text: `⚔️ ${a.name} vs ${b.name}!`, kind: "info" });
  }

  update(dt: number) {
    if (!this.active) return;
    const [f0, f1] = this.fighters;
    for (const f of this.fighters) this.updateFighter(f, f === f0 ? f1 : f0, dt);
    this.updateParticles(dt);

    // end condition: someone dead → linger, then clean up
    if (this.fighters.some((f) => f.state === "dead")) {
      this.overTimer += dt;
      if (this.overTimer > 2.2) this.end();
    }
  }

  private updateFighter(f: Fighter, enemy: Fighter, dt: number) {
    if (f.mixer) f.mixer.update(dt);
    f.shield = Math.max(0, f.shield - dt);

    // hit reaction (squash + jitter)
    if (f.flash > 0) {
      f.flash = Math.max(0, f.flash - dt);
      const k = f.flash / 0.2;
      f.mesh.scale.setScalar(f.baseScale * (1 + 0.18 * k));
      f.mesh.position.x = f.home.x + (Math.random() - 0.5) * 0.25 * k;
    } else if (f.state !== "lunge" && f.state !== "return") {
      f.mesh.scale.setScalar(f.baseScale);
    }

    if (f.state === "dead") {
      f.death = Math.min(1, f.death + dt / 0.9);
      f.mesh.rotation.y += dt * 6;
      f.mesh.scale.setScalar(f.baseScale * (1 - f.death));
      f.mesh.position.y = f.death * 0.5;
      f.bar.visible = false;
      return;
    }

    // idle bob
    if (f.state === "idle") {
      f.mesh.position.y = Math.abs(Math.sin(performance.now() / 220 + f.side)) * 0.08;

      // role active ability on a timer (tank shields, support heals)
      f.abilityCd -= dt;
      if (f.abilityCd <= 0 && enemy.state !== "dead") {
        if (f.def.role === "tank") {
          f.shield = 2.2;
          this.spawnText(f.home, "SHIELD", "#9fc0ff");
        } else if (f.def.role === "support") {
          const heal = Math.round(f.maxHp * 0.18);
          f.hp = Math.min(f.maxHp, f.hp + heal);
          this.redrawBar(f);
          this.spawnText(f.home, `+${heal}`, "#3fe07a");
        }
        f.abilityCd = 5 + Math.random() * 3;
      }

      f.cd -= dt;
      if (f.cd <= 0 && enemy.state !== "dead") {
        f.state = "lunge";
        f.t = 0;
        f.hit = false;
      }
      return;
    }

    // lunge toward enemy, apply damage at apex, then return
    const speed = 3.2;
    if (f.state === "lunge") {
      f.t = Math.min(1, f.t + dt * speed);
      const target = new THREE.Vector3().lerpVectors(f.home, enemy.home, 0.62);
      f.mesh.position.lerpVectors(f.home, target, easeOut(f.t));
      if (!f.hit && f.t > 0.55) {
        f.hit = true;
        this.strike(f, enemy);
      }
      if (f.t >= 1) {
        f.state = "return";
        f.t = 0;
      }
    } else if (f.state === "return") {
      f.t = Math.min(1, f.t + dt * speed);
      const target = new THREE.Vector3().lerpVectors(f.home, enemy.home, 0.62);
      f.mesh.position.lerpVectors(target, f.home, f.t);
      if (f.t >= 1) {
        f.mesh.position.copy(f.home);
        f.state = "idle";
        f.cd = f.interval;
      }
    }
  }

  private strike(attacker: Fighter, victim: Fighter) {
    // trickster evasion
    if (victim.def.role === "trickster" && Math.random() < 0.22) {
      this.spawnText(victim.home, "DODGE", "#9fe8ff");
      return;
    }
    let dmg = attacker.atk - victim.defense * 0.5;
    dmg *= elementMultiplier(attacker.def.element, victim.def.element); // type advantage
    let critLabel: string | null = null;
    if (attacker.def.role === "assassin" && Math.random() < 0.3) {
      dmg *= 2;
      critLabel = "CRIT";
    } else if (attacker.def.role === "fighter" && Math.random() < 0.25) {
      dmg *= 1.6;
      critLabel = "POWER";
    }
    if (victim.shield > 0) {
      dmg *= 0.4; // tank block
      this.spawnText(victim.home, "BLOCK", "#9fc0ff");
    }
    dmg = Math.max(1, Math.round(dmg * (0.85 + Math.random() * 0.3)));
    victim.hp = Math.max(0, victim.hp - dmg);
    victim.flash = 0.2;
    this.redrawBar(victim);
    if (critLabel) this.spawnText(victim.home, critLabel, "#ffd24b");
    this.spawnNumber(victim.home, dmg);
    this.spawnBurst(victim.home);

    if (victim.hp <= 0 && victim.state !== "dead") {
      victim.state = "dead";
      victim.death = 0;
      this.bus.emit("notify", { text: `🏆 ${attacker.def.name} wins!`, kind: "good" });
      if (!this.resolved) {
        this.resolved = true;
        this.onResult?.(attacker.side < 0); // left fighter is the player's champion
      }
    }
  }

  // --- premium colosseum (built once, always visible as a landmark) ---
  private buildArena() {
    const { x, z } = this.center;
    const g = new THREE.Group();

    const marbleLight = new THREE.MeshStandardMaterial({ color: 0xe7e0cf, roughness: 0.55, metalness: 0.05 });
    const marbleMid = new THREE.MeshStandardMaterial({ color: 0xcdc4ad, roughness: 0.6 });
    const marbleDark = new THREE.MeshStandardMaterial({ color: 0xb4ab92, roughness: 0.65 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.35, metalness: 0.7, emissive: 0x6a4f12, emissiveIntensity: 0.3 });

    // arena floor — polished dark stone with a glowing emblem ring
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, 0.4, 56), new THREE.MeshStandardMaterial({ color: 0x241b2c, roughness: 0.5, metalness: 0.2, emissive: 0x140a1c, emissiveIntensity: 0.4 }));
    floor.position.set(x, 0.2, z);
    floor.receiveShadow = true;
    g.add(floor);
    for (const rr of [4.6, 6.2]) {
      const emblem = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.12, 8, 64), new THREE.MeshStandardMaterial({ color: 0xff5d8f, emissive: 0xff5d8f, emissiveIntensity: 1.1 }));
      emblem.rotation.x = -Math.PI / 2;
      emblem.position.set(x, 0.42, z);
      g.add(emblem);
    }

    // tiered amphitheater bowl (concentric stepped walls)
    const tiers: [number, number, THREE.Material][] = [
      [10.5, 1.6, marbleLight],
      [13, 2.9, marbleMid],
      [15.5, 4.3, marbleDark],
    ];
    for (const [r, h, mat] of tiers) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 56, 1, true), mat);
      wall.position.set(x, h / 2, z);
      wall.receiveShadow = true;
      g.add(wall);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 64), gold);
      rail.rotation.x = -Math.PI / 2;
      rail.position.set(x, h, z);
      g.add(rail);
    }

    // colonnade on the outer rim (instanced) + architrave ring
    const colCount = 20;
    const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 5.4, 8);
    const cols = new THREE.InstancedMesh(colGeo, marbleLight, colCount);
    const d = new THREE.Object3D();
    for (let i = 0; i < colCount; i++) {
      const a = (i / colCount) * Math.PI * 2;
      d.position.set(x + Math.cos(a) * 15.5, 4.3 + 2.7, z + Math.sin(a) * 15.5);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      cols.setMatrixAt(i, d.matrix);
    }
    cols.castShadow = true;
    g.add(cols);
    const architrave = new THREE.Mesh(new THREE.TorusGeometry(15.5, 0.45, 8, 72), gold);
    architrave.rotation.x = -Math.PI / 2;
    architrave.position.set(x, 9.8, z);
    g.add(architrave);

    // braziers + banners at the four cardinals
    const accents = [0x4f8fff, 0xff5d8f, 0xffc24b, 0xa970ff];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bx = x + Math.cos(a) * 9.2;
      const bz = z + Math.sin(a) * 9.2;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.5, 10), gold);
      bowl.position.set(bx, 1.5, bz);
      g.add(bowl);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6), gold);
      stem.position.set(bx, 0.7, bz);
      g.add(stem);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xffa336, emissive: 0xff6a1a, emissiveIntensity: 2 }));
      flame.position.set(bx, 2.2, bz);
      g.add(flame);
      const light = new THREE.PointLight(0xff8a3a, 0.8, 22, 2);
      light.position.set(bx, 3, bz);
      g.add(light);
      // tall banner on the outer wall
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5, 1, 1), new THREE.MeshStandardMaterial({ color: accents[i], emissive: accents[i], emissiveIntensity: 0.12, side: THREE.DoubleSide, roughness: 0.9 }));
      banner.position.set(x + Math.cos(a) * 15.2, 5, z + Math.sin(a) * 15.2);
      banner.lookAt(x, 5, z);
      g.add(banner);
    }

    this.scene.add(g);
  }

  private end() {
    for (const f of this.fighters) {
      this.scene.remove(f.mesh);
      this.scene.remove(f.bar);
    }
    this.fighters = [];
    for (const p of this.particles) this.scene.remove(p.obj);
    this.particles = [];
    this.active = false;
  }

  // --- VFX ---
  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.obj.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(0.9);
      const k = Math.max(0, p.life / p.max);
      (p.obj.material as THREE.SpriteMaterial).opacity = k;
      if (p.grow) p.obj.scale.setScalar(p.s0 * (1.4 - k) + 0.1);
    }
    const dead = this.particles.filter((p) => p.life <= 0);
    for (const p of dead) this.scene.remove(p.obj);
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spawnBurst(at: THREE.Vector3) {
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.dot, color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      const s0 = 0.5 + Math.random() * 0.5;
      s.scale.setScalar(s0);
      s.position.set(at.x + (Math.random() - 0.5), 1.4 + Math.random(), at.z + (Math.random() - 0.5) * 0.6);
      this.scene.add(s);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        obj: s,
        vel: new THREE.Vector3(Math.cos(a) * 3, 2 + Math.random() * 2, Math.sin(a) * 1.5),
        life: 0.5,
        max: 0.5,
        s0,
        grow: true,
      });
    }
  }

  private spawnNumber(at: THREE.Vector3, dmg: number) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.font = "900 48px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(`-${dmg}`, 64, 34);
    ctx.fillStyle = "#ff5d6c";
    ctx.fillText(`-${dmg}`, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(2, 1, 1);
    spr.position.set(at.x + (Math.random() - 0.5), 3.2, at.z);
    spr.renderOrder = 999;
    this.scene.add(spr);
    this.particles.push({ obj: spr, vel: new THREE.Vector3(0, 2.2, 0), life: 0.9, max: 0.9, s0: 2, grow: false });
  }

  /** Floating ability label (CRIT / DODGE / BLOCK / SHIELD / +heal). */
  private spawnText(at: THREE.Vector3, text: string, color: string) {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(text, 100, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 100, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(2.6, 0.83, 1);
    spr.position.set(at.x + (Math.random() - 0.5) * 0.6, 4.2, at.z);
    spr.renderOrder = 999;
    this.scene.add(spr);
    this.particles.push({ obj: spr, vel: new THREE.Vector3(0, 1.8, 0), life: 1.0, max: 1.0, s0: 2.6, grow: false });
  }

  private makeBar(def: CreatureDef): THREE.Sprite {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    spr.scale.set(3, 0.7, 1);
    spr.renderOrder = 998;
    spr.userData.def = def;
    spr.userData.ratio = 1;
    this.drawBar(spr);
    return spr;
  }
  private redrawBar(f: Fighter) {
    f.bar.userData.ratio = f.hp / f.maxHp;
    this.drawBar(f.bar);
  }
  private drawBar(spr: THREE.Sprite) {
    const def = spr.userData.def as CreatureDef;
    const ratio = spr.userData.ratio as number;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 56;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(10,14,24,0.85)";
    ctx.fillRect(0, 24, 256, 26);
    ctx.fillStyle = ratio > 0.4 ? "#3fe07a" : ratio > 0.18 ? "#ffce4f" : "#ff5d6c";
    ctx.fillRect(3, 27, (256 - 6) * ratio, 20);
    ctx.strokeStyle = "#" + (ELEMENT_COLOR[def.element ?? "object"]).toString(16).padStart(6, "0");
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 27, 250, 20);
    ctx.fillStyle = "#eaf0ff";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${def.name}  ·  ${def.role ? ROLE_LABEL[def.role] : ""}`, 128, 14);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = spr.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function makeDotTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
