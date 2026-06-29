import * as THREE from "three";
import { Engine } from "./engine/Engine.ts";
import { World } from "./world/World.ts";
import { SceneAssets } from "./world/SceneAssets.ts";
import { Player } from "./player/Player.ts";
import { PlayerController } from "./player/PlayerController.ts";
import { PlayerCamera } from "./player/PlayerCamera.ts";
import { loadCharacter } from "./player/loadCharacter.ts";
import { SaveManager, type SaveState } from "./save/SaveManager.ts";
import { CreatureLibrary } from "./creatures/CreatureLibrary.ts";
import { Creature } from "./creatures/Creature.ts";
import { CaptureSystem } from "./systems/CaptureSystem.ts";
import { ConveyorShop } from "./systems/ConveyorShop.ts";
import { EconomySystem } from "./systems/EconomySystem.ts";
import { UpgradeSystem } from "./systems/UpgradeSystem.ts";
import { BaseStorage } from "./systems/BaseStorage.ts";
import { FusionSystem } from "./systems/FusionSystem.ts";
import { BattleDemo } from "./systems/BattleDemo.ts";
import { FusionPanel } from "./ui/FusionPanel.ts";
import { HUD } from "./ui/HUD.ts";
import { Shop } from "./ui/Shop.ts";
import { Inventory } from "./ui/Inventory.ts";
import { Settings } from "./ui/Settings.ts";
import { ShopPrompt } from "./ui/ShopPrompt.ts";
import { TouchControls, isTouchDevice } from "./ui/TouchControls.ts";
import { LoadingScreen } from "./ui/LoadingScreen.ts";
import { AudioManager } from "./audio/AudioManager.ts";
import { CONFIG } from "./config.ts";

const BASE_CENTER = new THREE.Vector3(CONFIG.base.centerX, 0, CONFIG.base.centerZ);
const RESPAWN = new THREE.Vector3(
  CONFIG.base.centerX,
  CONFIG.base.deckTop + 0.4,
  CONFIG.base.centerZ - CONFIG.base.halfDepth + 6 // near the front of the deck, facing the field
);

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
  private conveyor: ConveyorShop;
  private shopPrompt: ShopPrompt;
  private economy: EconomySystem;
  private upgrades = new UpgradeSystem();
  private baseStorage: BaseStorage;
  private fusion: FusionSystem;
  private fusionPanel: FusionPanel;
  private fusionLabPos = new THREE.Vector3();
  private battle: BattleDemo;
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
    this.camera.setObstacles(this.world.occluders);
    this.economy = new EconomySystem(this.engine.bus);
    this.baseStorage = new BaseStorage(this.engine.scene);
    this.capture = new CaptureSystem(this.engine.scene, this.library, this.player, this.engine.bus, this.discovered);
    this.conveyor = new ConveyorShop(this.engine.scene, this.library, this.economy, this.baseStorage, this.engine.bus);
    this.fusion = new FusionSystem(this.engine.scene, this.library, this.baseStorage, this.economy, this.engine.bus);
    this.battle = new BattleDemo(this.engine.scene, this.library, this.engine.bus);
    this.audio = new AudioManager(this.state.settings, this.engine.bus);

    // restore persisted progress (stored creatures restored after library load)
    this.economy.money = this.state.money;
    this.economy.geneCells = this.state.geneCells;
    this.upgrades.setLevels(this.state.upgrades);

    const ui = document.getElementById("ui")!;
    this.hud = new HUD(ui, this.engine.bus);
    this.shop = new Shop(ui, this.upgrades, this.economy, (key) => {
      this.engine.bus.emit("upgrade:purchased", { key, level: this.upgrades.level(key) });
      this.persist();
    });
    this.shopPrompt = new ShopPrompt(ui);
    this.inventory = new Inventory(ui, this.library, this.discovered);
    this.fusionPanel = new FusionPanel(ui, this.baseStorage, this.fusion, this.economy, () => this.persist());
    this.fusion.onChange = () => this.persist();
    this.settingsPanel = new Settings(
      ui,
      this.state.settings,
      this.audio,
      () => this.persist(),
      () => this.resetProgress()
    );
    this.buildButtons(ui);
    if (isTouchDevice()) new TouchControls(this.engine.input, ui);

    this.player.body.position.copy(RESPAWN);
    window.addEventListener("beforeunload", () => this.persist());
  }

  private buildButtons(ui: HTMLElement) {
    const bar = document.createElement("div");
    bar.id = "ui-buttons";
    const inv = iconButton("🐾", "Creaturedex (I)");
    const lab = iconButton("⚗️", "Splice Lab (L)");
    const fight = iconButton("⚔️", "Battle demo (B)");
    const set = iconButton("⚙️", "Settings");
    inv.addEventListener("click", () => this.inventory.toggle());
    lab.addEventListener("click", () => this.fusionPanel.toggle());
    fight.addEventListener("click", () => this.startBattleDemo());
    set.addEventListener("click", () => this.settingsPanel.toggle());
    bar.append(inv, lab, fight, set);
    ui.appendChild(bar);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyI") this.inventory.toggle();
      if (e.code === "KeyL") this.fusionPanel.toggle();
      if (e.code === "KeyB") this.startBattleDemo();
      if (e.code === "Escape") {
        this.inventory.close();
        this.fusionPanel.close();
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

    // swap blockout placeholders for the generated structure models (HQ, Fusion
    // Lab, Gate); buildings without a model keep their labeled greybox.
    const sceneAssets = new SceneAssets();
    await sceneAssets.load();
    this.world.applyBuildingModels(sceneAssets);
    this.baseStorage.applyModels(sceneAssets);
    this.fusionLabPos.copy(this.world.buildingPosition("fusion") ?? this.fusionLabPos);

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

    if (!this.battle.active) this.controller.update(dt, this.engine.input, p, this.engine.camera, mod);
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

    // parade conveyor + splice lab + battle demo + interactions
    this.conveyor.update(dt, p);
    this.fusion.update(dt);
    this.fusionPanel.update();
    this.battle.update(dt);
    if (!this.battle.active) this.handleInteraction();
    else this.shopPrompt.update(null);

    this.tryDeliver();

    // passive income from the base
    const income = this.baseStorage.baseIncomePerSec * this.upgrades.incomeMult;
    if (income > 0) this.economy.add(income * dt);

    this.baseStorage.update(dt);
    p.syncVisual(dt);

    // HUD + shop
    this.hud.update(
      {
        money: this.economy.money,
        geneCells: this.economy.geneCells,
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

    if (this.battle.active) {
      this.focus.set(this.battle.center.x, 1.6, this.battle.center.z);
    } else {
      this.focus.set(p.position.x, p.position.y + 1, p.position.z);
    }
    this.camera.update(dt, this.focus);
    this.engine.sceneManager.focusShadow(this.focus.x, this.focus.z);

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

  /** Interact key: upgrade a nearby stored creature first, else buy from the avenue. */
  private handleInteraction() {
    const p = this.player.position;
    const pressed = this.engine.input.justPressed("interact");

    // priority 0 — Splice Lab: open the fusion panel when standing by it
    const dxl = p.x - this.fusionLabPos.x;
    const dzl = p.z - this.fusionLabPos.z;
    const r = CONFIG.fusion.interactRadius;
    if (dxl * dxl + dzl * dzl <= r * r) {
      this.shopPrompt.update({ html: `⚗️ <b>Splice Lab</b> <kbd>E</kbd> open · 🧬 ${this.economy.geneCells}`, affordable: true });
      if (pressed) this.fusionPanel.open();
      return;
    }

    // priority 1 — upgrade (E) or sell (Q) the creature in the cage you're next to
    const creature = this.baseStorage.nearestStored(p.x, p.z, 3);
    if (creature) {
      const cost = creature.upgradeCost;
      const refund = Math.max(1, Math.round(creature.value * CONFIG.base.sellPriceFactor));
      const afford = this.economy.money >= cost;
      this.shopPrompt.update({
        html:
          `<b>${creature.def.name}</b> <span class="rar">Lv ${creature.level}</span> — ` +
          `<span class="price">${cost}$</span> <kbd>E</kbd> upgrade · ` +
          `<span class="price">+${refund}$</span> <kbd>Q</kbd> sell`,
        affordable: afford,
      });
      if (this.engine.input.justPressed("sell")) {
        const name = creature.def.name;
        const got = this.baseStorage.sell(creature);
        if (got > 0) {
          this.economy.add(got);
          this.economy.addGene(CONFIG.fusion.geneOnSell);
          this.engine.bus.emit("notify", { text: `Sold ${name} for ${got}$ (+🧬${CONFIG.fusion.geneOnSell})`, kind: "info" });
          this.persist();
        }
      } else if (pressed) {
        if (this.economy.spend(cost)) {
          creature.levelUp();
          this.persist();
        } else {
          this.engine.bus.emit("notify", { text: "Not enough coins", kind: "warn" });
        }
      }
      return;
    }

    // priority 2 — buy the nearest conveyor offer
    const offer = this.conveyor.nearestInfo();
    this.shopPrompt.update(
      offer
        ? {
            html:
              `<span class="rar rar-${offer.rarity}">${offer.rarity}</span> <b>${offer.name}</b> ` +
              `— <span class="price">${offer.price}$</span> <kbd>E</kbd> buy`,
            affordable: offer.affordable,
          }
        : null
    );
    if (pressed) this.conveyor.tryBuy();
  }

  /** Kick off a demo battle between two creatures (prefers ones you own). */
  private startBattleDemo() {
    if (this.battle.active) return;
    const pool = this.baseStorage.stored.length >= 2 ? this.baseStorage.stored.map((c) => c.def) : [...this.library.all];
    if (pool.length < 2) {
      this.engine.bus.emit("notify", { text: "Need at least 2 creatures to battle", kind: "warn" });
      return;
    }
    const i = Math.floor(Math.random() * pool.length);
    let j = Math.floor(Math.random() * pool.length);
    if (j === i) j = (j + 1) % pool.length;
    void this.battle.start(pool[i], pool[j]);
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
    // deliver anywhere on the home deck
    if (
      Math.abs(p.x - BASE_CENTER.x) > CONFIG.base.halfWidth ||
      Math.abs(p.z - BASE_CENTER.z) > CONFIG.base.halfDepth
    )
      return;
    if (this.baseStorage.isFull) {
      this.engine.bus.emit("notify", { text: "All cages full — sell a creature (Q)!", kind: "warn" });
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
      this.economy.addGene(count * CONFIG.fusion.geneOnCapture);
      this.engine.bus.emit("creature:delivered", { count, value });
      this.persist();
    }
  }

  private persist() {
    this.state.money = this.economy.money;
    this.state.geneCells = this.economy.geneCells;
    this.state.upgrades = this.upgrades.getLevels();
    this.state.stored = this.baseStorage.serialize();
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
