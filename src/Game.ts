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
import type { CreatureDef } from "./creatures/types.ts";
import { CaptureSystem } from "./systems/CaptureSystem.ts";
import { ConveyorShop } from "./systems/ConveyorShop.ts";
import { EconomySystem } from "./systems/EconomySystem.ts";
import { UpgradeSystem } from "./systems/UpgradeSystem.ts";
import { BaseStorage } from "./systems/BaseStorage.ts";
import { FusionSystem } from "./systems/FusionSystem.ts";
import { BattleDemo } from "./systems/BattleDemo.ts";
import { EnemyCamp } from "./systems/EnemyCamp.ts";
import { FusionPanel } from "./ui/FusionPanel.ts";
import { ArenaPanel } from "./ui/ArenaPanel.ts";
import { ThumbnailRenderer } from "./ui/ThumbnailRenderer.ts";
import { Objectives } from "./ui/Objectives.ts";
import { Tutorial } from "./systems/Tutorial.ts";
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
  private arenaPanel!: ArenaPanel;
  private thumbs!: ThumbnailRenderer;
  private pads: { x: number; z: number; radius: number; label: string; action: () => void; ring: THREE.Mesh }[] = [];
  private camp!: EnemyCamp;
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
    this.thumbs = new ThumbnailRenderer(this.library);
    this.hud = new HUD(ui, this.engine.bus);
    this.shop = new Shop(ui, this.upgrades, this.economy, (key) => {
      this.engine.bus.emit("upgrade:purchased", { key, level: this.upgrades.level(key) });
      this.persist();
    });
    this.shopPrompt = new ShopPrompt(ui);
    this.inventory = new Inventory(ui, this.library, this.discovered, this.thumbs);
    this.fusionPanel = new FusionPanel(ui, this.baseStorage, this.fusion, this.economy, this.thumbs, () => this.persist());
    this.arenaPanel = new ArenaPanel(ui, this.baseStorage, this.library, this.thumbs, (champ, prize, lvl) => this.startArenaFight(champ, prize, lvl));
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

    // first-session onboarding (objective banner, persisted progress)
    const objectives = new Objectives(ui);
    new Tutorial(this.engine.bus, objectives, this.state.tutorialStep, (step) => {
      this.state.tutorialStep = step;
      this.persist();
    });

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
    fight.addEventListener("click", () => this.arenaPanel.open());
    set.addEventListener("click", () => this.settingsPanel.toggle());
    bar.append(inv, lab, fight, set);
    ui.appendChild(bar);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyI") this.inventory.toggle();
      if (e.code === "KeyL") this.fusionPanel.toggle();
      if (e.code === "KeyB") this.arenaPanel.open();
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
    this.world.addColliders(this.baseStorage.colliders);
    this.buildPads();

    await this.baseStorage.restore(this.state.stored, this.library);

    this.camp = new EnemyCamp(this.engine.scene, this.library, new THREE.Vector3(78, 0, -68));
    await this.camp.init();

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
    for (const pad of this.pads) {
      (pad.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 3 + pad.x) * 0.35;
    }
    this.updateZoneLocks(level);
    const mod = this.world.sampleModifiers(body.position, body.radius, body.grounded);

    if (!this.battle.active) this.controller.update(dt, this.engine.input, p, this.engine.camera, mod);
    if (!this.battle.active && this.engine.input.justPressed("attack")) {
      p.attack();
      this.camp.tryHit(p.position);
    }
    this.camp.update(dt, p);
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
    this.world.resolveCollisions(body.position, body.radius);

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

  /** Free the camp's creature into the base. */
  private async collectCamp() {
    const def = this.camp.collect();
    if (!def) return;
    const mesh = await this.library.createInstance(def);
    this.engine.scene.add(mesh);
    this.baseStorage.store(new Creature(def, mesh, 1));
    this.economy.addGene(CONFIG.fusion.geneOnCapture);
    this.engine.bus.emit("notify", { text: `Freed ${def.name}! It joined your base.`, kind: "info" });
    this.persist();
  }

  /** Glowing interaction circles in front of each building that has a menu. */
  private buildPads() {
    this.addPad("fusion", "⚗️ <b>Splice Lab</b>", 0xa970ff, () => this.fusionPanel.open());
    this.addPad("upgrades", "🔧 <b>Upgrades</b>", 0xffa53c, () => this.shop.toggle());
    this.addPad("arena", "⚔️ <b>Arena</b>", 0xff5d6a, () => this.arenaPanel.open());
    this.addPad("castle", "🐾 <b>Creaturedex</b>", 0x4f8fff, () => this.inventory.toggle());
  }

  private addPad(buildingId: string, label: string, color: number, action: () => void) {
    const pos = this.world.buildingPosition(buildingId);
    if (!pos) return;
    const dx = BASE_CENTER.x - pos.x;
    const dz = BASE_CENTER.z - pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const off = 6;
    const x = pos.x + (dx / len) * off;
    const z = pos.z + (dz / len) * off;
    const y = CONFIG.base.deckTop + 0.07;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.5, 40),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    this.engine.scene.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, y - 0.01, z);
    this.engine.scene.add(disc);

    this.pads.push({ x, z, radius: 2.6, label, action, ring });
  }

  /** Interact key: building pad first, then upgrade a nearby stored creature, else buy from the avenue. */
  private handleInteraction() {
    const p = this.player.position;
    const pressed = this.engine.input.justPressed("interact");

    // priority 0 — building interaction pads (glowing circles in front of each)
    for (const pad of this.pads) {
      const dx = p.x - pad.x;
      const dz = p.z - pad.z;
      if (dx * dx + dz * dz <= pad.radius * pad.radius) {
        this.shopPrompt.update({ html: `${pad.label} <kbd>E</kbd> open`, affordable: true });
        if (pressed) pad.action();
        return;
      }
    }
    // not on any pad → close the upgrades menu if it was open
    if (this.shop.isOpen) this.shop.close();

    // enemy camp: defeat guards, then free the caged creature
    if (this.camp.near(p)) {
      if (this.camp.canCollect) {
        this.shopPrompt.update({ html: `🎁 Free <b>${this.camp.rewardName}</b> <kbd>E</kbd>`, affordable: true });
        if (pressed) {
          if (this.baseStorage.isFull) this.engine.bus.emit("notify", { text: "Base full — sell or expand first", kind: "warn" });
          else void this.collectCamp();
        }
      } else if (!this.camp.isCleared) {
        this.shopPrompt.update({ html: `⚔️ <b>Enemy Camp</b> — defeat ${this.camp.guardsLeft} guards <kbd>J</kbd>`, affordable: false });
      } else {
        this.shopPrompt.update(null);
      }
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

  /** Arena: champion fights the prize; win → a reduced-income clone joins base. */
  private startArenaFight(champion: CreatureDef, prize: CreatureDef, championLevel = 1) {
    if (this.battle.active) return;
    void this.battle.start(champion, prize, (won) => void this.onArenaResult(won, prize), championLevel, 1);
  }

  private async onArenaResult(won: boolean, prize: CreatureDef) {
    if (!won) {
      this.engine.bus.emit("notify", { text: `Defeated in the Arena — your champion is unharmed.`, kind: "warn" });
      return;
    }
    if (this.baseStorage.isFull) {
      this.engine.bus.emit("notify", { text: `Won ${prize.name}, but your base is full!`, kind: "warn" });
      return;
    }
    const mesh = await this.library.createInstance(prize);
    this.engine.scene.add(mesh);
    this.baseStorage.store(new Creature(prize, mesh, 1, 0.5)); // clone earns 50%
    this.economy.addGene(CONFIG.fusion.geneOnCapture);
    this.engine.bus.emit("notify", { text: `🏆 Won a clone of ${prize.name}! (50% income)`, kind: "good" });
    this.engine.bus.emit("arena:won", {});
    this.persist();
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
