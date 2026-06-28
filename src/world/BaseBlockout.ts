import * as THREE from "three";
import { CONFIG } from "../config.ts";

/**
 * Greybox/blockout of the player base: walls, a road-width gate and labeled
 * placeholder buildings. Pure primitives so we can agree layout & scale before
 * commissioning real Meshy models — each building here maps 1:1 to a future
 * art asset (footprint + height + label are the brief).
 */

interface BuildingDef {
  id: string;
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  roof?: "flat" | "dome" | "towers" | "awning";
}

/**
 * Building footprints, positioned relative to the base extents so the whole
 * layout rescales automatically when the base grows. The central area is left
 * open for the creature cages; structures hug the back and side walls.
 */
function layoutBuildings(): BuildingDef[] {
  const { centerX, centerZ, halfWidth, halfDepth } = CONFIG.base;
  const backZ = centerZ + halfDepth;
  const frontZ = centerZ - halfDepth;
  return [
    { id: "castle", label: "🏰 Castle (HQ)", x: centerX - (halfWidth - 16), z: backZ - 9, w: 24, d: 14, h: 18, color: 0x9098a6, roof: "towers" },
    { id: "arena", label: "⚔️ PvP Arena Guild", x: centerX + (halfWidth - 14), z: backZ - 9, w: 20, d: 14, h: 13, color: 0xc0506a, roof: "flat" },
    { id: "store-a", label: "🏠 Storage", x: centerX - 20, z: backZ - 8, w: 14, d: 9, h: 8, color: 0x707a92, roof: "flat" },
    { id: "store-b", label: "🏠 Workshop", x: centerX + 20, z: backZ - 8, w: 14, d: 9, h: 8, color: 0x6a7488, roof: "flat" },
    { id: "fusion", label: "⚗️ Fusion Lab", x: centerX - (halfWidth - 6), z: centerZ - 4, w: 11, d: 12, h: 9, color: 0xa970ff, roof: "dome" },
    { id: "warehouse", label: "🏭 Warehouse", x: centerX + (halfWidth - 6), z: centerZ - 4, w: 11, d: 12, h: 8, color: 0x6f7891, roof: "flat" },
    { id: "shop", label: "🛒 Creature Shop", x: centerX - 30, z: frontZ + 7, w: 8, d: 6, h: 4.5, color: 0x33c2b0, roof: "awning" },
    { id: "upgrades", label: "🔧 Upgrades Stall", x: centerX + 30, z: frontZ + 7, w: 8, d: 6, h: 4.5, color: 0xffa53c, roof: "awning" },
  ];
}

interface AssetSource {
  instance(id: string, targetSize: number): THREE.Object3D | null;
}

export class BaseBlockout {
  /** Solid meshes the follow-camera should not see through (for pull-in). */
  readonly obstacles: THREE.Object3D[] = [];

  private buildingGroups = new Map<string, { group: THREE.Group; def: BuildingDef }>();
  private gateGroup = new THREE.Group();

  constructor(private scene: THREE.Scene) {
    this.buildWalls();
    this.buildGate();
    for (const b of layoutBuildings()) this.buildBuilding(b);
  }

  private get deckTop() {
    return CONFIG.base.deckTop;
  }

  /**
   * Replace primitive placeholders with real generated models where available.
   * Buildings without a model keep their labeled greybox.
   */
  applyModels(assets: AssetSource) {
    // building id → scene asset id (drop a matching GLB into models/scene to
    // auto-swap; missing assets simply keep their greybox placeholder)
    const MAP: Record<string, string> = {
      castle: "base-hq",
      fusion: "fusion-lab",
      arena: "arena",
      warehouse: "warehouse",
      "store-a": "storage",
      "store-b": "workshop",
      shop: "shop",
      upgrades: "upgrades",
    };
    for (const [buildingId, assetId] of Object.entries(MAP)) {
      const entry = this.buildingGroups.get(buildingId);
      if (!entry) continue;
      const size = Math.max(entry.def.w, entry.def.d, entry.def.h);
      this.swapBuilding(buildingId, assets.instance(assetId, size), this.faceCenter(entry.def));
    }
    const gate = assets.instance("base-gate", 16);
    if (gate) {
      this.gateGroup.clear();
      gate.rotation.y = 0;
      this.gateGroup.add(gate);
    }
  }

  /** World position of a building (for proximity interactions). */
  buildingPosition(id: string): THREE.Vector3 | null {
    const e = this.buildingGroups.get(id);
    return e ? e.group.position.clone() : null;
  }

  /**
   * Yaw that turns a building's front (assumed +Z) toward the plaza center,
   * snapped to the nearest cardinal so structures sit square to the base.
   */
  private faceCenter(def: BuildingDef): number {
    const dx = CONFIG.base.centerX - def.x;
    const dz = CONFIG.base.centerZ - def.z;
    // back/front-row buildings face square along Z; only mid-row sides face X
    if (Math.abs(dz) > CONFIG.base.halfDepth * 0.4) return dz < 0 ? Math.PI : 0;
    return dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private swapBuilding(id: string, model: THREE.Object3D | null, rotY: number) {
    const entry = this.buildingGroups.get(id);
    if (!entry || !model) return;
    entry.group.clear(); // drop the greybox body/door/roof
    model.rotation.y = rotY;
    entry.group.add(model);
  }

  private buildWalls() {
    const { centerX, centerZ, halfWidth, halfDepth } = CONFIG.base;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x586073, roughness: 0.95 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x707a90, roughness: 0.9 });
    const H = 3.4;
    const T = 0.8;
    const y = this.deckTop + H / 2;

    const seg = (x: number, z: number, w: number, d: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      wall.position.set(x, y, z);
      wall.castShadow = wall.receiveShadow = true;
      this.scene.add(wall);
      this.obstacles.push(wall);
      // lighter coping cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), capMat);
      cap.position.set(x, this.deckTop + H + 0.15, z);
      this.scene.add(cap);
    };

    const backZ = centerZ + halfDepth;
    const frontZ = centerZ - halfDepth;
    const gateHalf = CONFIG.avenue.halfWidth; // gate opening = road width

    seg(centerX, backZ, halfWidth * 2 + T, T); // back
    seg(-halfWidth, centerZ, T, halfDepth * 2); // left
    seg(halfWidth, centerZ, T, halfDepth * 2); // right
    // front split around the gate opening
    const frontHalfLen = halfWidth - gateHalf;
    seg(-(gateHalf + frontHalfLen / 2), frontZ, frontHalfLen, T);
    seg(gateHalf + frontHalfLen / 2, frontZ, frontHalfLen, T);
  }

  private buildGate() {
    const { centerZ, halfDepth } = CONFIG.base;
    const z = centerZ - halfDepth; // front edge
    const gateHalf = CONFIG.avenue.halfWidth; // = road half-width
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7a8294, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4f8fff, emissive: 0x2f6fe0, emissiveIntensity: 0.8 });

    const g = this.gateGroup;
    g.position.set(0, this.deckTop, z); // pieces below are relative to this
    const PH = 6;
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, PH, 1.4), pillarMat);
      pillar.position.set(sx * (gateHalf + 0.7), PH / 2, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(gateHalf * 2 + 3, 1.2, 1.6), pillarMat);
    lintel.position.set(0, PH + 0.6, 0);
    lintel.castShadow = true;
    g.add(lintel);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(gateHalf * 2, 0.25, 0.4), trimMat);
    trim.position.set(0, PH - 0.1, 0);
    g.add(trim);

    this.scene.add(g);
    this.obstacles.push(g);

    const lbl = makeLabel("⛩️ Main Gate", 0xbfd4ff);
    lbl.position.set(0, this.deckTop + PH + 2.2, z);
    this.scene.add(lbl);
  }

  private buildBuilding(b: BuildingDef) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    body.position.y = b.h / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // a darker door so orientation reads (faces -Z toward the plaza)
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(2.4, b.w * 0.3), Math.min(3, b.h * 0.6), 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 })
    );
    door.position.set(0, Math.min(1.5, b.h * 0.3), -b.d / 2 - 0.01);
    group.add(door);

    this.addRoof(group, b);

    group.position.set(b.x, this.deckTop, b.z);
    this.scene.add(group);
    this.obstacles.push(group);
    this.buildingGroups.set(b.id, { group, def: b });

    const label = makeLabel(b.label, b.color);
    label.position.set(b.x, this.deckTop + b.h + 2.4, b.z);
    this.scene.add(label);
  }

  private addRoof(group: THREE.Group, b: BuildingDef) {
    const accent = new THREE.MeshStandardMaterial({ color: lighten(b.color, 1.25), roughness: 0.8 });
    if (b.roof === "towers") {
      // four corner towers with conical caps (castle silhouette)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const th = b.h * 1.3;
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, th, 12), accent);
          tower.position.set(sx * (b.w / 2 - 1), th / 2, sz * (b.d / 2 - 1));
          tower.castShadow = true;
          group.add(tower);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3, 12), new THREE.MeshStandardMaterial({ color: 0x4f8fff, roughness: 0.7 }));
          cone.position.set(sx * (b.w / 2 - 1), th + 1.5, sz * (b.d / 2 - 1));
          cone.castShadow = true;
          group.add(cone);
        }
      }
    } else if (b.roof === "dome") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(b.w * 0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent);
      dome.position.y = b.h;
      dome.castShadow = true;
      group.add(dome);
    } else if (b.roof === "awning") {
      const awn = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.5, 0.3, b.d + 1.5), accent);
      awn.position.y = b.h + 0.4;
      awn.rotation.x = 0.12;
      group.add(awn);
    } else {
      // flat parapet
      const cap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.5, b.d + 0.6), accent);
      cap.position.y = b.h + 0.25;
      group.add(cap);
    }
  }
}

function lighten(hex: number, f: number): number {
  const r = Math.min(255, ((hex >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((hex >> 8) & 255) * f) | 0;
  const bl = Math.min(255, (hex & 255) * f) | 0;
  return (r << 16) | (g << 8) | bl;
}

/** Floating text label so the blockout is self-describing. */
function makeLabel(text: string, color: number): THREE.Sprite {
  const W = 512;
  const H = 110;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(10,14,24,0.85)";
  roundRect(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.stroke();
  ctx.fillStyle = "#eaf0ff";
  ctx.font = "700 46px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(9, 1.95, 1);
  return sprite;
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
