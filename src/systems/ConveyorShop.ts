import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Creature } from "../creatures/Creature.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import { RARITY_COLOR, type CreatureDef } from "../creatures/types.ts";
import type { Player } from "../player/Player.ts";
import type { EconomySystem } from "./EconomySystem.ts";
import type { BaseStorage } from "./BaseStorage.ts";
import type { EventBus } from "../engine/EventBus.ts";
import { weightedPick } from "../utils/math.ts";

interface Offer {
  group: THREE.Group;
  creature: Creature;
  def: CreatureDef;
  price: number;
  x: number;
}

export interface OfferInfo {
  name: string;
  rarity: string;
  price: number;
  affordable: boolean;
}

/**
 * Central Avenue conveyor: capsules carrying buyable creatures drift toward the
 * base. Personal market (weighted to commons) with a pity timer for rares. Buy
 * the nearest in-range offer with the interact key.
 */
export class ConveyorShop {
  private offers: Offer[] = [];
  private spawnTimer = 0;
  private pity = 0;
  private spawning = false;
  private nearest: Offer | null = null;

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    private economy: EconomySystem,
    private baseStorage: BaseStorage,
    private bus: EventBus
  ) {
    this.buildParade();
  }

  /** Horizontal road in front of the base; creatures walk left → right along it. */
  private buildParade() {
    const { z, halfLen, width, margin } = CONFIG.parade;
    const len = (halfLen + margin) * 2;

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.12, width),
      new THREE.MeshStandardMaterial({ color: 0x2b3142, roughness: 0.95 })
    );
    road.position.set(0, 0.08, z);
    road.receiveShadow = true;
    this.scene.add(road);

    // curbs + glowing rails along both long edges
    for (const sz of [-1, 1]) {
      const edgeZ = z + sz * (width / 2);
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.35, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9aa3b4, roughness: 0.9 })
      );
      curb.position.set(0, 0.22, edgeZ);
      curb.receiveShadow = true;
      this.scene.add(curb);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.18, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x4f8fff, emissive: 0x2a5fb0, emissiveIntensity: 0.9 })
      );
      rail.position.set(0, 0.46, edgeZ);
      this.scene.add(rail);
    }

    // dashed center line
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xe6ecff, emissive: 0x6f86b8, emissiveIntensity: 0.25 });
    for (let x = -halfLen; x <= halfLen; x += 4) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(2, 0.13, 0.3), dashMat);
      dash.position.set(x, 0.145, z);
      this.scene.add(dash);
    }

    // lamp posts along the field-side edge
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcf5a, emissiveIntensity: 1.4 });
    const lampZ = z - width / 2 - 0.9;
    for (let x = -halfLen + 4; x <= halfLen; x += 14) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), lampMat);
      post.position.set(x, 1.2, lampZ);
      post.castShadow = true;
      this.scene.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), glowMat);
      bulb.position.set(x, 2.5, lampZ);
      this.scene.add(bulb);
    }
  }

  update(dt: number, player: Player) {
    const { speed } = CONFIG.conveyor;
    const { halfLen, margin } = CONFIG.parade;

    // walk offers left → right; despawn past the right end
    for (const o of this.offers) {
      o.x += speed * dt;
      o.group.position.x = o.x;
      o.creature.update(dt);
    }
    const gone = this.offers.filter((o) => o.x > halfLen + margin);
    for (const o of gone) this.despawn(o);

    // spawn new offers up to the cap
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.offers.length < CONFIG.conveyor.maxOffers && !this.spawning) {
      this.spawnTimer = CONFIG.conveyor.spawnInterval;
      void this.spawn();
    }

    this.nearest = this.findNearest(player);
  }

  /** Info for the nearest in-range offer (for the buy prompt UI). */
  nearestInfo(): OfferInfo | null {
    if (!this.nearest) return null;
    return {
      name: this.nearest.def.name,
      rarity: this.nearest.def.rarity,
      price: this.nearest.price,
      affordable: this.economy.money >= this.nearest.price,
    };
  }

  /** Attempt to buy the nearest in-range offer. */
  tryBuy(): boolean {
    const o = this.nearest;
    if (!o) return false;
    if (this.baseStorage.isFull) {
      this.bus.emit("notify", { text: "All cages full — sell a creature (Q)!", kind: "warn" });
      return false;
    }
    if (!this.economy.spend(o.price)) {
      this.bus.emit("notify", { text: "Not enough coins", kind: "warn" });
      return false;
    }
    // hand the capsule's creature to the base
    o.group.remove(o.creature.mesh);
    this.scene.add(o.creature.mesh);
    this.baseStorage.store(o.creature);
    this.bus.emit("creature:delivered", { count: 1, value: o.creature.value });
    this.removeOffer(o, false);
    return true;
  }

  private findNearest(player: Player): Offer | null {
    const r = CONFIG.conveyor.interactRadius;
    let best: Offer | null = null;
    let bestD = r * r;
    for (const o of this.offers) {
      const dx = o.x - player.position.x;
      const dz = CONFIG.parade.z - player.position.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private async spawn() {
    const def = this.pickMarketDef();
    if (!def) return;
    this.spawning = true;
    try {
      const inst = await this.library.createInstance(def);
      inst.scale.multiplyScalar(0.7);
      const creature = new Creature(def, inst);

      const group = new THREE.Group();
      const rarityHex = RARITY_COLOR[def.rarity];
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 0.25, 24),
        new THREE.MeshStandardMaterial({ color: 0x223152, roughness: 0.6, emissive: rarityHex, emissiveIntensity: 0.25 })
      );
      pad.position.y = -0.12;
      inst.position.y = 0.3;
      group.add(pad, inst);

      const price = Math.max(1, Math.round(def.income * CONFIG.conveyor.priceFactor));
      group.add(this.priceTag(def, price));

      const startX = -(CONFIG.parade.halfLen + CONFIG.parade.margin);
      group.position.set(startX, 0.4, CONFIG.parade.z);
      this.scene.add(group);
      this.offers.push({ group, creature, def, price, x: startX });
    } finally {
      this.spawning = false;
    }
  }

  private pickMarketDef(): CreatureDef | null {
    const defs = this.library.all;
    if (!defs.length) return null;
    this.pity++;
    // pity: force a rare+ if commons-only for too long
    const rares = defs.filter((d) => d.unlockLevel >= 2);
    if (rares.length && this.pity >= CONFIG.conveyor.pityAfter) {
      this.pity = 0;
      return weightedPick(rares, (d) => d.spawnWeight);
    }
    // weight toward easier creatures (commons more common on the avenue)
    return weightedPick([...defs], (d) => 1 / d.unlockLevel);
  }

  private priceTag(def: CreatureDef, price: number): THREE.Sprite {
    const W = 320;
    const H = 150;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const rarityCss = "#" + RARITY_COLOR[def.rarity].toString(16).padStart(6, "0");

    // card background with rarity-tinted border
    ctx.fillStyle = "rgba(12,18,32,0.92)";
    roundRect(ctx, 6, 6, W - 12, H - 12, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rarityCss;
    ctx.stroke();

    // rarity pill
    ctx.font = "700 22px system-ui, sans-serif";
    const rarityText = def.rarity.toUpperCase();
    const pillW = ctx.measureText(rarityText).width + 28;
    ctx.fillStyle = rarityCss;
    roundRect(ctx, W / 2 - pillW / 2, 20, pillW, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#0b0f1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rarityText, W / 2, 37);

    // name
    ctx.fillStyle = "#eaf0ff";
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.fillText(fit(ctx, def.name, W - 30), W / 2, 82);

    // price
    ctx.font = "900 30px system-ui, sans-serif";
    ctx.fillStyle = "#ffd24b";
    ctx.fillText(`${price} $`, W / 2, 120);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(3.2, 1.5, 1);
    sprite.position.y = 2.6;
    sprite.renderOrder = 999;
    return sprite;
  }

  private despawn(o: Offer) {
    this.removeOffer(o, true);
  }

  private removeOffer(o: Offer, disposeCreature: boolean) {
    const i = this.offers.indexOf(o);
    if (i >= 0) this.offers.splice(i, 1);
    if (disposeCreature) this.scene.remove(o.creature.mesh);
    this.scene.remove(o.group);
    if (this.nearest === o) this.nearest = null;
  }
}

/** Truncate text with an ellipsis so it fits within maxWidth. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
