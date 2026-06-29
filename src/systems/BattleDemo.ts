import * as THREE from "three";
import { deriveCombat } from "../creatures/stats.ts";
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
  readonly center = new THREE.Vector3(0, 0, 40);

  private pad: THREE.Group | null = null;
  private fighters: Fighter[] = [];
  private particles: Particle[] = [];
  private overTimer = 0;
  private dot = makeDotTexture();

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    private bus: EventBus
  ) {}

  /** Begin a battle between two creature defs. */
  async start(a: CreatureDef, b: CreatureDef) {
    if (this.active) return;
    this.active = true;
    this.overTimer = 0;
    this.buildPad();

    this.fighters = [];
    for (const [def, side] of [
      [a, -1],
      [b, 1],
    ] as const) {
      const mesh = await this.library.createInstance(def);
      const baseScale = mesh.scale.x * 2; // bigger so the fight reads
      mesh.scale.setScalar(baseScale);
      const home = new THREE.Vector3(this.center.x + side * 3.2, 0, this.center.z);
      mesh.position.copy(home);
      mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // face the middle
      this.scene.add(mesh);

      const s = deriveCombat(def, 1);
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
    const dmg = Math.max(1, Math.round((attacker.atk - victim.defense * 0.5) * (0.85 + Math.random() * 0.3)));
    victim.hp = Math.max(0, victim.hp - dmg);
    victim.flash = 0.2;
    this.redrawBar(victim);
    this.spawnNumber(victim.home, dmg);
    this.spawnBurst(victim.home);

    if (victim.hp <= 0 && victim.state !== "dead") {
      victim.state = "dead";
      victim.death = 0;
      this.bus.emit("notify", { text: `🏆 ${attacker.def.name} wins!`, kind: "good" });
    }
  }

  // --- arena pad ---
  private buildPad() {
    if (this.pad) {
      this.pad.visible = true;
      return;
    }
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.4, 0.3, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.8, emissive: 0x140a1c, emissiveIntensity: 0.5 })
    );
    disc.position.set(this.center.x, 0.15, this.center.z);
    disc.receiveShadow = true;
    g.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.18, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xff5d8f, emissive: 0xff5d8f, emissiveIntensity: 1 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.center.x, 0.32, this.center.z);
    g.add(ring);
    this.scene.add(g);
    this.pad = g;
  }

  private end() {
    for (const f of this.fighters) {
      this.scene.remove(f.mesh);
      this.scene.remove(f.bar);
    }
    this.fighters = [];
    for (const p of this.particles) this.scene.remove(p.obj);
    this.particles = [];
    if (this.pad) this.pad.visible = false;
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
