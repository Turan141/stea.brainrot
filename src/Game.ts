import * as THREE from "three";
import { Engine } from "./engine/Engine.ts";
import { World } from "./world/World.ts";
import { Player } from "./player/Player.ts";
import { PlayerController } from "./player/PlayerController.ts";
import { PlayerCamera } from "./player/PlayerCamera.ts";
import { loadCharacter } from "./player/loadCharacter.ts";
import { SaveManager, type SaveState } from "./save/SaveManager.ts";
import { CreatureLibrary } from "./creatures/CreatureLibrary.ts";
import { Creature } from "./creatures/Creature.ts";
import { CaptureSystem } from "./systems/CaptureSystem.ts";
import { EconomySystem } from "./systems/EconomySystem.ts";
import { UpgradeSystem } from "./systems/UpgradeSystem.ts";
import { BaseStorage } from "./systems/BaseStorage.ts";
import { HUD } from "./ui/HUD.ts";
import { Shop } from "./ui/Shop.ts";
import { Inventory } from "./ui/Inventory.ts";
import { Settings } from "./ui/Settings.ts";
import { LoadingScreen } from "./ui/LoadingScreen.ts";
import { AudioManager } from "./audio/AudioManager.ts";
import { CONFIG } from "./config.ts";

const BASE_CENTER = new THREE.Vector3(0, 0, 8);
const BASE_RADIUS = 10;
const RESPAWN = new THREE.Vector3(0, 0.2, 8);

/** Top-level orchestrator: wires engine + gameplay systems and the update order. */
export class Game {
  private engine: Engine;
  private world: World;
  private player: Player;
  private controller: PlayerController;
  private camera: PlayerCamera;
  private save: SaveManager;
  private state: SaveState;
  private library = new CreatureLibrary();
  private capture!: CaptureSystem;
  private economy: EconomySystem;
  private upgrades = new UpgradeSystem();
  private baseStorage: BaseStorage;
  private hud: HUD;
  private shop: Shop;
  private inventory: Inventory;
  private settingsPanel: Settings;
  private audio: AudioManager;
  private loading: LoadingScreen;
  private libraryReady = false;

  private discovered: Set<string>;
  private unlockedZones = new Set<string>();
  private focus = new THREE.Vector3();
  private autosave = CONFIG.base.autosaveInterval;

  constructor(canvas: HTMLCanvasElement) {
    this.loading = new LoadingScreen();
    this.engine = new Engine(canvas);
    this.save = new SaveManager(this.engine.bus);
    this.state = this.save.load();
    this.discovered = new Set(this.state.discovered);

    this.world = new World(this.engine.scene);
    this.player = new Player(this.engine.scene);
    this.controller = new PlayerController();
    this.camera = new PlayerCamera(this.engine.camera);
    this.economy = new EconomySystem(this.engine.bus);
    this.baseStorage = new BaseStorage(this.engine.scene);
    this.capture = new CaptureSystem(this.engine.scene, this.library, this.player, this.engine.bus, this.discovered);
    this.audio = new AudioManager(this.state.settings, this.engine.bus);

    // restore persisted progress (stored creatures restored after library load)
    this.economy.money = this.state.money;
    this.upgrades.setLevels(this.state.upgrades);

    const ui = document.getElementById("ui")!;
    this.hud = new HUD(ui, this.engine.bus);
    this.shop = new Shop(ui, this.upgrades, this.economy, (key) => {
      this.engine.bus.emit("upgrade:purchased", { key, level: this.upgrades.level(key) });
      this.persist();
    });
    this.inventory = new Inventory(ui, this.library, this.discovered);
    this.settingsPanel = new Settings(
      ui,
      this.state.settings,
      this.audio,
      () => this.persist(),
      () => this.resetProgress()
    );
    this.buildButtons(ui);

    this.player.body.position.copy(RESPAWN);
    window.addEventListener("beforeunload", () => this.persist());
  }

  private buildButtons(ui: HTMLElement) {
    const bar = document.createElement("div");
    bar.id = "ui-buttons";
    const inv = iconButton("🐾", "Creaturedex (I)");
    const set = iconButton("⚙️", "Settings");
    inv.addEventListener("click", () => this.inventory.toggle());
    set.addEventListener("click", () => this.settingsPanel.toggle());
    bar.append(inv, set);
    ui.appendChild(bar);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyI") this.inventory.toggle();
      if (e.code === "Escape") {
        this.inventory.close();
        this.settingsPanel.close();
      }
    });
  }

  private resetProgress() {
    this.save.clear();
    location.reload();
  }

  async start() {
    await this.library.load();
    await this.baseStorage.restore(this.state.stored, this.library);

    // swap in the generated character model if one exists (else keep capsule)
    const charModel = await loadCharacter();
    if (charModel) this.player.setModel(charModel);

    // seed zone lock baseline silently (no unlock toasts for already-open zones)
    const level = this.upgrades.progressionLevel;
    for (const zone of this.world.zones) {
      const locked = zone.unlockLevel > level;
      zone.setLocked(locked);
      if (!locked) this.unlockedZones.add(zone.id);
    }

    this.libraryReady = true;
    this.loading.hide();
    this.engine.start((dt, t) => this.update(dt, t));
  }

  private update(dt: number, t: number) {
    const p = this.player;
    const body = p.body;

    // upgrades -> live stats
    this.upgrades.apply(p);
    this.controller.dashUnlocked = this.upgrades.dashUnlocked;
    this.baseStorage.capacity = this.upgrades.baseCapacity;
    const level = this.upgrades.progressionLevel;

    // world first (moving boxes), then movement modifiers
    this.world.update(dt, t);
    this.updateZoneLocks(level);
    const mod = this.world.sampleModifiers(body.position, body.radius, body.grounded);

    this.controller.update(dt, this.engine.input, p, this.engine.camera, mod);
    if (mod.jumpBoost > 0) {
      body.velocity.y = mod.jumpBoost;
      body.grounded = false;
    }

    body.groundY = this.world.sampleGround(body.position.x, body.position.z, body.position.y);
    body.integrate(dt);
    if (body.grounded && this.world.lastSupport) {
      body.position.x += this.world.lastSupport.dx;
      body.position.z += this.world.lastSupport.dz;
    }
    const b = this.world.bounds;
    body.clampXZ(b.minX, b.maxX, b.minZ, b.maxZ);

    if (this.world.checkHazard(body.position, body.radius)) this.die();

    if (this.libraryReady) this.capture.update(dt, this.world.zones, level);
    this.tryDeliver();

    // passive income from the base
    const income = this.baseStorage.baseIncomePerSec * this.upgrades.incomeMult;
    if (income > 0) this.economy.add(income * dt);

    this.baseStorage.update(dt);
    p.syncVisual();

    // HUD + shop
    this.hud.update(
      {
        money: this.economy.money,
        incomePerSec: income,
        carried: p.carried.length,
        capacity: p.carryCapacity,
        stored: this.baseStorage.stored.length,
        baseCapacity: this.baseStorage.capacity,
        stamina: p.stamina,
        staminaMax: p.staminaMax,
        level,
      },
      dt
    );
    this.shop.refresh();

    this.focus.set(p.position.x, p.position.y + 1, p.position.z);
    this.camera.update(dt, this.focus);
    this.engine.sceneManager.focusShadow(p.position.x, p.position.z);

    this.autosave -= dt;
    if (this.autosave <= 0) {
      this.autosave = CONFIG.base.autosaveInterval;
      this.persist();
    }
  }

  private updateZoneLocks(level: number) {
    for (const zone of this.world.zones) {
      const locked = zone.unlockLevel > level;
      if (zone.locked !== locked) zone.setLocked(locked);
      if (!locked && !this.unlockedZones.has(zone.id)) {
        this.unlockedZones.add(zone.id);
        // only announce after the initial frame's baseline
        if (this.libraryReady) this.engine.bus.emit("zone:unlocked", { id: zone.name });
      }
    }
  }

  private die() {
    for (const item of this.player.unloadAll()) {
      this.engine.scene.remove(item.mesh);
      this.capture.retire(item as Creature);
    }
    this.player.body.position.copy(RESPAWN);
    this.player.body.velocity.set(0, 0, 0);
    this.engine.bus.emit("notify", { text: "Knocked out — haul lost!", kind: "warn" });
  }

  private tryDeliver() {
    if (!this.player.isCarrying) return;
    const p = this.player.position;
    const dx = p.x - BASE_CENTER.x;
    const dz = p.z - BASE_CENTER.z;
    if (dx * dx + dz * dz > BASE_RADIUS * BASE_RADIUS) return;
    if (this.baseStorage.isFull) {
      this.engine.bus.emit("notify", { text: "Base is full — upgrade Base Size!", kind: "warn" });
      return;
    }

    let count = 0;
    let value = 0;
    for (const item of this.player.unloadAll()) {
      const creature = item as Creature;
      this.capture.retire(creature);
      if (this.baseStorage.store(creature)) {
        count++;
        value += creature.value;
      } else {
        this.engine.scene.remove(creature.mesh); // base filled mid-unload
      }
    }
    if (count > 0) {
      this.engine.bus.emit("creature:delivered", { count, value });
      this.persist();
    }
  }

  private persist() {
    this.state.money = this.economy.money;
    this.state.upgrades = this.upgrades.getLevels();
    this.state.stored = this.baseStorage.ids();
    this.state.discovered = [...this.discovered];
    this.save.save(this.state);
  }
}

function iconButton(label: string, title: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "icon-btn";
  b.textContent = label;
  b.title = title;
  return b;
}
