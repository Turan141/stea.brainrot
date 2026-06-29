import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Box } from "./types.ts";
import { QUALITY } from "../engine/quality.ts";

interface AssetProvider {
  instance(id: string, size: number): THREE.Object3D | null;
  has(id: string): boolean;
}

/**
 * Procedural detailing pass for the player base — lamps, banners, bunting,
 * planters, crates/barrels, flag poles, avenue rugs and strung lights. Pure
 * primitive geometry (no assets), with shared geometries/materials so the whole
 * dressing is cheap. Visual only: nothing here collides or occludes the camera.
 *
 * A light update() animates flags/banners swaying and lanterns pulsing.
 */
export class BaseDecor {
  private animated: { obj: THREE.Object3D; kind: "flag" | "lantern" | "bunting" | "banner" | "flame" | "dummy"; phase: number; base: number }[] = [];

  // shared resources
  private mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3b4250, roughness: 0.5, metalness: 0.4 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4fae5d, roughness: 0.8 }),
    leafDark: new THREE.MeshStandardMaterial({ color: 0x3a8a4a, roughness: 0.8 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.4, roughness: 0.4 }),
    glowCyan: new THREE.MeshStandardMaterial({ color: 0x6fe0ff, emissive: 0x2f9fe0, emissiveIntensity: 1.2, roughness: 0.4 }),
    flame: new THREE.MeshStandardMaterial({ color: 0xffa336, emissive: 0xff6a1a, emissiveIntensity: 2.0, roughness: 0.4 }),
    hay: new THREE.MeshStandardMaterial({ color: 0xcaa64a, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xe7ecf5, roughness: 0.9 }),
  };
  private accent = [0x4f8fff, 0xff5d8f, 0xffc24b, 0xa970ff, 0x33c2b0];

  constructor(
    private scene: THREE.Scene,
    private assets: AssetProvider | null = null
  ) {
    const { centerX, centerZ, halfWidth, halfDepth, deckTop } = CONFIG.base;
    const left = centerX - halfWidth;
    const right = centerX + halfWidth;
    const front = centerZ - halfDepth;
    const back = centerZ + halfDepth;

    this.lampsAndStrings(left, right, front, back, deckTop);
    this.banners(left, right, back, deckTop);
    this.gateDressing(front, deckTop);
    this.cornerFlags(left, right, front, back, deckTop);
    this.cratesAndBarrels(deckTop);
    this.avenueRugs(centerX, centerZ, deckTop);

    // fill the open front plaza + avenues so the base reads as lived-in
    this.frontPlaza(centerX, front, deckTop);
    this.braziers(centerX, centerZ, deckTop);
    this.topiaryRows(centerX, centerZ, deckTop);
    this.groundClutter(centerX, centerZ, front, back, deckTop);
  }

  /** Reject spots inside the cage clusters, the gate road, or building rows. */
  private clear(x: number, z: number, cx: number, cz: number): boolean {
    const dx = Math.abs(x - cx);
    const dz = Math.abs(z - cz);
    if (dx < 10 && z < cz - 12) return false; // gate road / front avenue
    if (dx > 2 && dx < 18 && dz > 2 && dz < 18) return false; // cage quadrants
    if (dz < 4 && dx < 18) return false; // E/W avenue arm
    if (z < cz - 12 && (Math.abs(x - (cx - 30)) < 7 || Math.abs(x - (cx + 30)) < 7)) return false; // shop/upgrades
    return true;
  }

  /** A textured GLB instance for a prop id (max dim ≈ size), or null to fall
   *  back to the procedural build. */
  private model(id: string, size: number): THREE.Object3D | null {
    if (!this.assets?.has(id)) return null;
    const m = this.assets.instance(id, size);
    if (m) {
      m.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
      });
    }
    return m;
  }

  /** Solid props the player collides with (low ones are standable on top). */
  readonly colliders: Box[] = [];
  private addSolid(x: number, z: number, hx: number, hz: number, height: number, deckTop: number) {
    this.colliders.push(new Box(x, deckTop + height / 2, z, hx, height / 2, hz));
  }

  // ---- front entrance plaza: signs, stalls, benches, dummies, statues ----

  private frontPlaza(cx: number, front: number, deckTop: number) {
    const gateHalf = CONFIG.avenue.halfWidth;
    for (const sx of [-1, 1]) {
      this.signpost(cx + sx * (gateHalf + 4), front + 5, deckTop);
      this.bench(cx + sx * 18, front + 4.5, deckTop, sx > 0 ? -0.4 : 0.4);
      this.marketStall(cx + sx * 44, front + 6, deckTop, this.accent[sx > 0 ? 1 : 3]);
      this.trainingDummy(cx + sx * 52, front + 10, deckTop);
      this.statue(cx + sx * 14, front + 9, deckTop, this.accent[sx > 0 ? 0 : 2]);
    }
  }

  private signpost(x: number, z: number, deckTop: number) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8), this.mats.wood);
    post.position.y = 1.7;
    post.castShadow = true;
    g.add(post);
    const labels = ["→ Arena", "Shop ←", "Cages ↑"];
    for (let i = 0; i < 3; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.12), this.mats.wood);
      board.position.set(i % 2 ? 0.6 : -0.6, 2.7 - i * 0.65, 0);
      board.rotation.y = i % 2 ? -0.25 : 0.25;
      g.add(board);
      const arrow = makeLabel(labels[i], this.accent[i % this.accent.length]);
      arrow.scale.set(2.4, 0.55, 1);
      arrow.position.set(board.position.x, board.position.y, 0.12);
      g.add(arrow);
    }
    g.position.set(x, deckTop, z);
    this.scene.add(g);
  }

  private bench(x: number, z: number, deckTop: number, rotY: number) {
    this.addSolid(x, z, 1.3, 0.9, 1.2, deckTop); // low → jumpable
    const m = this.model("prop-bench", 2.6);
    if (m) {
      m.position.set(x, deckTop, z);
      m.rotation.y = rotY;
      this.scene.add(m);
      return;
    }
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.7), this.mats.wood);
    seat.position.y = 0.6;
    seat.castShadow = true;
    g.add(seat);
    const backRest = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.12), this.mats.wood);
    backRest.position.set(0, 0.95, -0.3);
    g.add(backRest);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.6), this.mats.metal);
      leg.position.set(sx * 1.1, 0.3, 0);
      g.add(leg);
    }
    g.position.set(x, deckTop, z);
    g.rotation.y = rotY;
    this.scene.add(g);
  }

  private marketStall(x: number, z: number, deckTop: number, color: number) {
    this.addSolid(x, z, 2.0, 1.9, 3.6, deckTop); // tall → solid wall
    const m = this.model("prop-stall", 4.2);
    if (m) {
      m.position.set(x, deckTop, z);
      m.rotation.y = x > 0 ? -0.3 : 0.3;
      this.scene.add(m);
      return;
    }
    const g = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.6), this.mats.wood);
    counter.position.y = 0.55;
    counter.castShadow = counter.receiveShadow = true;
    g.add(counter);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), this.mats.wood);
      post.position.set(sx * 1.6, 1.6, -0.6);
      g.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 2.4), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    canopy.position.set(0, 3.1, 0);
    canopy.rotation.x = -0.18;
    canopy.castShadow = true;
    g.add(canopy);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(4, 0.45, 0.1), this.mats.cloth);
    trim.position.set(0, 2.85, 1.15);
    trim.rotation.x = -0.18;
    g.add(trim);
    // goods on the counter
    for (let i = 0; i < 4; i++) {
      const good = new THREE.Mesh(
        i % 2 ? new THREE.SphereGeometry(0.22, 8, 6) : new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: this.accent[i % this.accent.length], roughness: 0.7 })
      );
      good.position.set(-1.2 + i * 0.8, 1.3, 0.2);
      g.add(good);
    }
    g.position.set(x, deckTop, z);
    g.rotation.y = x > 0 ? -0.3 : 0.3;
    this.scene.add(g);
  }

  private trainingDummy(x: number, z: number, deckTop: number) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 8), this.mats.wood);
    post.position.y = 1.3;
    g.add(post);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 6, 10), this.mats.hay);
    body.position.y = 2.0;
    body.castShadow = true;
    g.add(body);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.22), this.mats.wood);
    arms.position.y = 2.1;
    g.add(arms);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), this.mats.hay);
    head.position.y = 2.8;
    g.add(head);
    // target ring on the chest
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 16), new THREE.MeshStandardMaterial({ color: 0xff5d5d, emissive: 0xc02020, emissiveIntensity: 0.3 }));
    ring.position.set(0, 2.0, 0.5);
    g.add(ring);
    g.position.set(x, deckTop, z);
    this.scene.add(g);
    this.animated.push({ obj: g, kind: "dummy", phase: x + z, base: 0 });
  }

  private statue(x: number, z: number, deckTop: number, glowColor: number) {
    this.addSolid(x, z, 1.3, 1.3, 4.2, deckTop); // tall → solid
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 16), this.mats.stone);
    base.position.y = 0.25;
    base.receiveShadow = true;
    g.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 1.4, 16), this.mats.stone);
    column.position.y = 1.2;
    g.add(column);
    // abstract stone "creature" trophy: stacked rounded shapes
    const statueMat = new THREE.MeshStandardMaterial({ color: 0xb8c0d0, roughness: 0.7 });
    const bodyS = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), statueMat);
    bodyS.position.y = 2.5;
    bodyS.castShadow = true;
    g.add(bodyS);
    const headS = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), statueMat);
    headS.position.y = 3.4;
    g.add(headS);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), statueMat);
      ear.position.set(sx * 0.28, 3.85, 0);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 0.6 }));
      eye.position.set(sx * 0.2, 3.45, 0.42);
      g.add(eye);
    }
    g.position.set(x, deckTop, z);
    g.rotation.y = x > 0 ? -0.5 : 0.5;
    this.scene.add(g);
  }

  // ---- brazier fire bowls flanking the central plaza ----

  private braziers(cx: number, cz: number, deckTop: number) {
    const spots: [number, number][] = [
      [cx - 20, cz - 14],
      [cx + 20, cz - 14],
      [cx - 20, cz + 14],
      [cx + 20, cz + 14],
    ];
    for (const [x, z] of spots) this.brazier(x, z, deckTop);
  }

  private brazier(x: number, z: number, deckTop: number) {
    this.addSolid(x, z, 0.7, 0.7, 2.8, deckTop); // tall (don't stand in the fire)
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.5, 12), this.mats.metal);
    bowl.position.y = 1.4;
    bowl.castShadow = true;
    g.add(bowl);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), this.mats.metal);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35);
      leg.rotation.z = Math.cos(a) * 0.2;
      leg.rotation.x = -Math.sin(a) * 0.2;
      g.add(leg);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), this.mats.flame);
    flame.position.y = 2.05;
    g.add(flame);
    g.position.set(x, deckTop, z);
    this.scene.add(g);
    this.animated.push({ obj: flame, kind: "flame", phase: x * 1.3 + z, base: 1 });
    if (QUALITY.dynamicLights) {
      const light = new THREE.PointLight(0xff7a2a, 1.0, 20, 2);
      light.position.set(x, deckTop + 2.2, z);
      this.scene.add(light);
    }
  }

  // ---- topiary pots lining the avenue arms ----

  private topiaryRows(cx: number, cz: number, deckTop: number) {
    // Plants form a ring AROUND the cage cluster (outside the pens), never
    // inside them. clear() rejects the cage band / avenues / building fronts.
    const R = 18; // just outside the cage cluster (which reaches ~15.6)
    // Planter GLBs are dense (~16k tris) and can't decimate — space them out on
    // mobile so far fewer are placed (big tri + draw-call saving).
    const step = QUALITY.mobile ? 9 : 4.5;
    const place = (x: number, z: number) => {
      if (this.clear(x, z, cx, cz)) this.topiary(x, z, deckTop);
    };
    for (let z = -R; z <= R; z += step) {
      place(cx - R, cz + z);
      place(cx + R, cz + z);
    }
    for (let x = -R + step; x <= R - step; x += step) {
      place(cx + x, cz - R);
      place(cx + x, cz + R);
    }
  }

  private topiary(x: number, z: number, deckTop: number) {
    this.addSolid(x, z, 1.0, 1.0, 1.8, deckTop);
    const m = this.model("prop-planter", 1.9);
    if (m) {
      m.position.set(x, deckTop, z);
      m.rotation.y = (x + z) % Math.PI;
      this.scene.add(m);
      return;
    }
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xb6603a, roughness: 0.9 }));
    pot.position.y = 0.3;
    pot.castShadow = true;
    g.add(pot);
    const ball1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), this.mats.leaf);
    ball1.position.y = 1.0;
    ball1.castShadow = true;
    g.add(ball1);
    const ball2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), this.mats.leafDark);
    ball2.position.y = 1.6;
    g.add(ball2);
    g.position.set(x, deckTop, z);
    g.scale.setScalar(0.9 + Math.random() * 0.3);
    this.scene.add(g);
  }

  // ---- scattered small rocks, grass tufts and flower dots on open deck ----

  private groundClutter(cx: number, cz: number, front: number, back: number, deckTop: number) {
    const { halfWidth } = CONFIG.base;
    const target = QUALITY.clutterCount;
    let placed = 0;
    for (let tries = 0; tries < 260 && placed < target; tries++) {
      const x = cx + (Math.random() * 2 - 1) * (halfWidth - 6);
      const z = front + 3 + Math.random() * (back - front - 6);
      if (!this.clear(x, z, cx, cz)) continue;
      placed++;
      const r = Math.random();
      if (r < 0.4) {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + Math.random() * 0.3, 0), this.mats.stone);
        rock.position.set(x, deckTop + 0.1, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        this.scene.add(rock);
      } else if (r < 0.8) {
        const tuft = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5 + Math.random() * 0.3, 4), i ? this.mats.leafDark : this.mats.leaf);
          blade.position.set((i - 1) * 0.12, 0.25, 0);
          blade.rotation.z = (i - 1) * 0.2;
          tuft.add(blade);
        }
        tuft.position.set(x, deckTop, z);
        this.scene.add(tuft);
      } else {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: this.accent[(placed) % this.accent.length], emissive: this.accent[placed % this.accent.length], emissiveIntensity: 0.25 }));
        flower.position.set(x, deckTop + 0.15, z);
        this.scene.add(flower);
      }
    }
  }

  // ---- lamps around the inner perimeter + strung lights across the plaza ----

  private lampsAndStrings(left: number, right: number, front: number, back: number, deckTop: number) {
    const inset = 3.2;
    const lampXs: number[] = [];
    const lampStep = QUALITY.mobile ? 26 : 16; // fewer lamp GLBs on mobile
    for (let x = left + 8; x <= right - 8; x += lampStep) lampXs.push(x);
    const lamps: THREE.Vector3[] = [];

    // back + front rows (skip the gate gap on the front). Only every other
    // back lamp carries a real light — keeps the dynamic light count sane.
    lampXs.forEach((x, i) => {
      lamps.push(this.lamp(x, back - inset, deckTop, i % 2 === 0));
      if (Math.abs(x) > CONFIG.avenue.halfWidth + 3) lamps.push(this.lamp(x, front + inset, deckTop, false));
    });
    // side rows
    const sideStep = QUALITY.mobile ? 24 : 14;
    for (let z = front + 14; z <= back - 14; z += sideStep) {
      this.lamp(left + inset, z, deckTop, false);
      this.lamp(right - inset, z, deckTop, false);
    }

    // warm string lights sagging between the back-row lamp heads
    const sorted = lamps.filter((p) => Math.abs(p.z - (back - inset)) < 0.1).sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) this.stringLights(sorted[i], sorted[i + 1]);
  }

  /** A lamp post; the 4th of each row gets a real point light for ambiance. */
  private lamp(x: number, z: number, deckTop: number, withLight: boolean): THREE.Vector3 {
    const H = 4.2;
    this.addSolid(x, z, 0.35, 0.35, H, deckTop); // thin tall pole
    const m = this.model("prop-lamp", H);
    if (m) {
      m.position.set(x, deckTop, z);
      this.scene.add(m);
    } else {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, H, 8), this.mats.metal);
      post.position.y = H / 2;
      post.castShadow = true;
      g.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.4, 10), this.mats.stone);
      base.position.y = 0.2;
      g.add(base);
      const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), this.mats.glow);
      lantern.position.y = H + 0.1;
      g.add(lantern);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.4, 8), this.mats.metal);
      cap.position.y = H + 0.7;
      g.add(cap);
      g.position.set(x, deckTop, z);
      this.scene.add(g);
      this.animated.push({ obj: lantern, kind: "lantern", phase: x * 0.7 + z, base: 1.4 });
    }

    if (withLight && QUALITY.dynamicLights) {
      const light = new THREE.PointLight(0xffc36b, 0.9, 26, 2);
      light.position.set(x, deckTop + H, z);
      this.scene.add(light);
    }
    return new THREE.Vector3(x, deckTop + H + 0.1, z);
  }

  private stringLights(a: THREE.Vector3, b: THREE.Vector3) {
    const seg = 7;
    const sag = 1.6;
    const bulbGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 1; i < seg; i++) {
      const t = i / seg;
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const z = THREE.MathUtils.lerp(a.z, b.z, t);
      const y = THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag;
      const warm = i % 2 === 0;
      const bulb = new THREE.Mesh(bulbGeo, warm ? this.mats.glow : this.mats.glowCyan);
      bulb.position.set(x, y, z);
      this.scene.add(bulb);
      this.animated.push({ obj: bulb, kind: "lantern", phase: i + a.x, base: warm ? 1.3 : 1.1 });
    }
  }

  // ---- hanging banners on the back/side walls ----

  private banners(left: number, right: number, back: number, deckTop: number) {
    const top = deckTop + 3.0;
    let k = 0;
    for (let x = left + 18; x <= right - 18; x += 18) {
      this.banner(x, back - 0.9, top, 0, this.accent[k++ % this.accent.length]);
    }
    for (let z = back - 16; z >= back - 40; z -= 16) {
      this.banner(left + 0.9, z, top, Math.PI / 2, this.accent[k++ % this.accent.length]);
      this.banner(right - 0.9, z, top, -Math.PI / 2, this.accent[k++ % this.accent.length]);
    }
  }

  private banner(x: number, z: number, top: number, rotY: number, color: number) {
    const m = this.model("prop-banner", 2.6);
    if (m) {
      m.position.set(x, top - 1.4, z); // hang on the wall
      m.rotation.y = rotY;
      this.scene.add(m);
      return;
    }
    const g = new THREE.Group();
    const w = 1.6;
    const h = 3.0;
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h, 1, 4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.08 })
    );
    cloth.position.y = -h / 2;
    g.add(cloth);
    // emblem
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshStandardMaterial({ color: 0xeaf0ff, side: THREE.DoubleSide, emissive: 0x9fb4d6, emissiveIntensity: 0.2 }));
    emblem.position.set(0, -h * 0.42, 0.02);
    g.add(emblem);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w + 0.4, 8), this.mats.metal);
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
    g.position.set(x, top, z);
    g.rotation.y = rotY;
    this.scene.add(g);
    this.animated.push({ obj: g, kind: "banner", phase: x + z, base: rotY });
  }

  // ---- gate: planters + pennant bunting framing the entrance ----

  private gateDressing(front: number, deckTop: number) {
    const gateHalf = CONFIG.avenue.halfWidth;
    for (const sx of [-1, 1]) {
      this.planter(sx * (gateHalf + 3), front + 2.5, deckTop);
    }
    // bunting from each gate side toward the front corners
    const top = deckTop + 6;
    for (const sx of [-1, 1]) {
      this.bunting(
        new THREE.Vector3(sx * (gateHalf + 1), top, front),
        new THREE.Vector3(sx * (CONFIG.base.halfWidth - 4), top - 1.5, front + 0.5)
      );
    }
  }

  private bunting(a: THREE.Vector3, b: THREE.Vector3) {
    const seg = 10;
    const sag = 1.3;
    const flagGeo = new THREE.ConeGeometry(0.28, 0.55, 3);
    for (let i = 1; i < seg; i++) {
      const t = i / seg;
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const z = THREE.MathUtils.lerp(a.z, b.z, t);
      const y = THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag;
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: this.accent[i % this.accent.length], roughness: 0.8, side: THREE.DoubleSide }));
      flag.position.set(x, y, z);
      flag.rotation.x = Math.PI; // point down
      this.scene.add(flag);
      this.animated.push({ obj: flag, kind: "bunting", phase: i * 0.8 + a.x, base: 0 });
    }
  }

  // ---- decorative planter with foliage blobs ----

  private planter(x: number, z: number, deckTop: number) {
    this.addSolid(x, z, 1.0, 1.0, 1.8, deckTop);
    const m = this.model("prop-planter", 2.1);
    if (m) {
      m.position.set(x, deckTop, z);
      this.scene.add(m);
      return;
    }
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.8), this.mats.stone);
    box.position.y = 0.45;
    box.castShadow = box.receiveShadow = true;
    g.add(box);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), this.mats.soil);
    soil.position.y = 0.92;
    g.add(soil);
    for (let i = 0; i < 5; i++) {
      const r = 0.4 + (i % 2) * 0.2;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i % 2 ? this.mats.leafDark : this.mats.leaf);
      blob.position.set((i - 2) * 0.32, 1.1 + (i % 3) * 0.28, ((i % 2) - 0.5) * 0.5);
      blob.castShadow = true;
      g.add(blob);
    }
    // a couple of bright "flowers"
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: this.accent[(i + 1) % this.accent.length], emissive: this.accent[(i + 1) % this.accent.length], emissiveIntensity: 0.3 }));
      f.position.set((i - 1) * 0.4, 1.5, 0.2);
      g.add(f);
    }
    g.position.set(x, deckTop, z);
    this.scene.add(g);
  }

  // ---- corner flag poles with waving flags ----

  private cornerFlags(left: number, right: number, front: number, back: number, deckTop: number) {
    const inset = 4;
    const corners: [number, number, number][] = [
      [left + inset, back - inset, 0],
      [right - inset, back - inset, 1],
      [left + inset, front + inset, 2],
      [right - inset, front + inset, 3],
    ];
    for (const [x, z, k] of corners) this.flagPole(x, z, deckTop, this.accent[k % this.accent.length]);
  }

  private flagPole(x: number, z: number, deckTop: number, color: number) {
    const g = new THREE.Group();
    const H = 7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, H, 8), this.mats.metal);
    pole.position.y = H / 2;
    pole.castShadow = true;
    g.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), this.mats.glowCyan);
    knob.position.y = H + 0.1;
    g.add(knob);
    const flag = new THREE.Group();
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.3, 4, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.1 })
    );
    cloth.position.x = 1.1;
    flag.add(cloth);
    flag.position.set(0, H - 1, 0);
    g.add(flag);
    g.position.set(x, deckTop, z);
    this.scene.add(g);
    this.animated.push({ obj: flag, kind: "flag", phase: x + z, base: 0 });
  }

  // ---- crate / barrel clusters near the storage-type buildings ----

  private cratesAndBarrels(deckTop: number) {
    const { centerX, halfWidth } = CONFIG.base;
    const spots: [number, number][] = [
      [centerX + halfWidth - 14, 84],
      [centerX - 26, 100],
      [centerX + 26, 100],
    ];
    for (const [x, z] of spots) this.crateCluster(x, z, deckTop);
  }

  private crateCluster(x: number, z: number, deckTop: number) {
    const g = new THREE.Group();
    const layout: [number, number, number, number][] = [
      [0, 0, 0, 1.3],
      [1.5, 0, 0.3, 1.1],
      [0.2, 0, 1.5, 1.2],
      [0.6, 1.25, 0.1, 1.0], // stacked
    ];
    for (const [dx, dy, dz, s] of layout) g.add(this.crate(dx, dy, dz, s));
    // a couple of barrels
    g.add(this.barrel(-1.4, 0.5));
    g.add(this.barrel(-1.2, 1.7));
    g.position.set(x, deckTop, z);
    g.rotation.y = (x + z) % 1.5;
    this.scene.add(g);
    this.addSolid(x, z, 2.4, 2.4, 2.0, deckTop); // the whole pile — low, jumpable
  }

  private crate(dx: number, dy: number, dz: number, s: number): THREE.Object3D {
    const m = this.model("prop-crate", s);
    if (m) {
      m.position.set(dx, dy, dz);
      m.rotation.y = (dx + dz) % 1.2;
      return m;
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), this.mats.wood);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // darker corner frame so it reads as a crate
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2616, roughness: 0.9 });
    const t = 0.1;
    for (const ax of ["x", "z"] as const) {
      for (const sy of [-1, 1]) {
        const bar = new THREE.Mesh(
          ax === "x" ? new THREE.BoxGeometry(s + 0.02, t, t) : new THREE.BoxGeometry(t, t, s + 0.02),
          frameMat
        );
        bar.position.y = (sy * s) / 2;
        g.add(bar);
      }
    }
    g.position.set(dx, dy + s / 2, dz);
    return g;
  }

  private barrel(dx: number, dz: number): THREE.Object3D {
    const m = this.model("prop-barrel", 1.4);
    if (m) {
      m.position.set(dx, 0, dz);
      return m;
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.3, 14), new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.8 }));
    body.castShadow = true;
    g.add(body);
    for (const y of [-0.4, 0.4]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 16), this.mats.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    g.position.set(dx, 0.65, dz);
    return g;
  }

  // ---- glowing rugs along the avenue arms + a medallion under the fountain ----

  private avenueRugs(cx: number, cz: number, deckTop: number) {
    const pathHalf = CONFIG.base.pathHalf;
    const reach = 15;
    const crimson = new THREE.MeshStandardMaterial({ color: 0x97323f, roughness: 0.8 }); // crimson carpet
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc24b, emissive: 0xc8902a, emissiveIntensity: 0.35, roughness: 0.6 }); // gold band

    // Each layer is a thin slab at a DISTINCT, non-overlapping height so no two
    // faces are coplanar (that was the flicker / z-fighting). The whole rug also
    // sits clearly above the stone avenue (top ≈ deckTop+0.07).
    const rug = (w: number, d: number, baseY: number) => {
      const g = new THREE.Group();
      const layer = (lw: number, ld: number, mat: THREE.Material, yc: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.02, ld), mat);
        m.position.y = yc;
        m.receiveShadow = true;
        g.add(m);
      };
      layer(w, d, crimson, 0); // base mat
      layer(w - 0.6, d - 0.6, gold, 0.025); // gold ring, lifted above base
      layer(w - 1.0, d - 1.0, crimson, 0.05); // inner field, above gold
      g.position.y = baseY;
      return g;
    };

    const nsBase = deckTop + 0.1; // above the avenue stone
    const ns = rug(pathHalf * 2 - 0.6, reach * 2, nsBase);
    ns.position.x = cx;
    ns.position.z = cz;
    this.scene.add(ns);
    // EW arm sits a clear step above the NS arm so the crossing never z-fights.
    const ew = rug(reach * 2, pathHalf * 2 - 0.6, nsBase + 0.09);
    ew.position.x = cx;
    ew.position.z = cz;
    this.scene.add(ew);

    // medallion under the fountain, clearly above both rug arms
    const med = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 0.04, 32),
      new THREE.MeshStandardMaterial({ color: 0x8a6c3a, roughness: 0.7 })
    );
    med.position.set(cx, nsBase + 0.2, cz);
    med.receiveShadow = true;
    this.scene.add(med);
  }

  update(t: number) {
    for (const a of this.animated) {
      if (a.kind === "flag") {
        a.obj.rotation.y = Math.sin(t * 2.2 + a.phase) * 0.25;
        a.obj.rotation.z = Math.sin(t * 3.1 + a.phase) * 0.08;
      } else if (a.kind === "banner") {
        a.obj.rotation.y = a.base + Math.sin(t * 1.6 + a.phase) * 0.06;
      } else if (a.kind === "bunting") {
        a.obj.rotation.z = Math.sin(t * 2.6 + a.phase) * 0.12;
      } else if (a.kind === "lantern") {
        const m = (a.obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = a.base + Math.sin(t * 3 + a.phase) * 0.25;
      } else if (a.kind === "flame") {
        const flick = 1 + Math.sin(t * 11 + a.phase) * 0.18 + Math.sin(t * 6.3 + a.phase * 1.7) * 0.1;
        a.obj.scale.set(0.85 + flick * 0.15, flick, 0.85 + flick * 0.15);
        const m = (a.obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 1.8 + Math.sin(t * 9 + a.phase) * 0.5;
      } else if (a.kind === "dummy") {
        a.obj.rotation.z = Math.sin(t * 1.4 + a.phase) * 0.04;
      }
    }
  }
}

/** Small canvas text sprite for directional signage. */
function makeLabel(text: string, color: number): THREE.Sprite {
  const W = 256;
  const H = 64;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(10,14,24,0.0)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}
