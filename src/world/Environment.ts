import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { QUALITY } from "../engine/quality.ts";

/**
 * Procedural outdoor environment framing the play-field: a distant low-poly
 * mountain backdrop plus scattered trees / rocks / bushes. Everything is drawn
 * with InstancedMesh (a handful of draw calls for thousands of objects), so it
 * stays cheap on mobile. Counts scale down on the mobile quality profile.
 *
 * Placement avoids the player base (+Z bottom) and the central zone corridors.
 */
export class Environment {
  // animated landmarks updated each frame
  private fireflies: { mesh: THREE.InstancedMesh; base: THREE.Vector3[]; dummy: THREE.Object3D } | null = null;
  private islands: { obj: THREE.Object3D; y0: number; phase: number }[] = [];

  // trails from the gate to each arena (shared by paths() and scatter-exclusion)
  // diverge near the gate so the three trails don't pile on top of each other
  private readonly ROUTES: { color: number; pts: [number, number][] }[] = [
    { color: 0xffce4f, pts: [[0, 54], [0, 18], [0, -26]] }, // → Sunspire (center)
    { color: 0x6fd0ff, pts: [[-7, 54], [-20, 38], [-34, 12], [-46, -13]] }, // → Frost (left)
    { color: 0xb06fff, pts: [[7, 54], [20, 38], [34, 12], [46, -13]] }, // → Storm (right)
    { color: 0xff5d8f, pts: [[-6, 52], [-16, 18], [-28, -30], [-50, -58], [-72, -66]] }, // → Colosseum (far-left)
  ];
  private readonly PATH_CLEAR = 6.5; // keep scatter this far from any trail

  constructor(scene: THREE.Scene, fieldSize: number) {
    const half = fieldSize / 2; // 120
    const m = QUALITY.mobile;

    this.mountains(scene, half);

    // foliage + ground cover (clear values keep big items well off the trails)
    this.instance(scene, treeGeometry(), this.scatter(m ? 55 : 150, 34, half - 4, 8), 0.7, 1.6, true);
    this.instance(scene, rockGeometry(), this.scatter(m ? 26 : 60, 30, half - 6, 7), 0.5, 1.6, true);
    this.instance(scene, bushGeometry(), this.scatter(m ? 30 : 80, 28, half - 6, 7), 0.6, 1.4, false);
    this.instance(scene, mushroomGeometry(), this.scatter(m ? 8 : 20, 30, half - 8, 9), 0.7, 1.8, true);
    this.mounds(scene, this.scatter(m ? 6 : 14, 40, half - 12, 20));
    this.flowers(scene, this.scatter(m ? 60 : 160, 28, half - 6, 6));

    // glowing landmarks
    this.crystals(scene, this.scatter(m ? 8 : 18, 34, half - 8, 11));
    this.ponds(scene, this.scatter(4, 36, half - 16, 16));

    // animated life
    this.makeFireflies(scene, this.scatter(m ? 18 : 46, 28, half - 8, 7));
    this.floatingIslands(scene);

    this.paths(scene);
  }

  /**
   * Pretty trails to each arena: a dark bordered bed, light cobble top, a glowing
   * center stripe in the arena's color, and flanking guide-light bollards.
   */
  private paths(scene: THREE.Scene) {
    const W = 3.4;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbb78d, roughness: 0.95 });
    for (const r of this.ROUTES) {
      const lineMat = new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: 0.4, roughness: 0.6 });
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i];
        const [bx, bz] = r.pts[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        const yaw = Math.atan2(dx, dz);
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        // flat stone path, low to the ground
        const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, len), stoneMat);
        top.position.set(mx, 0.05, mz);
        top.rotation.y = yaw;
        top.receiveShadow = true;
        scene.add(top);
        // a single thin guide line in the arena's color
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, len), lineMat);
        line.position.set(mx, 0.09, mz);
        line.rotation.y = yaw;
        scene.add(line);
      }
      // small round pads soften the corners at each waypoint
      for (const [x, z] of r.pts) {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(W / 2, 20), stoneMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(x, 0.055, z);
        pad.receiveShadow = true;
        scene.add(pad);
      }
    }
  }

  /** Distance test from a point to any trail segment (for scatter exclusion). */
  private nearAnyPath(x: number, z: number, clear = this.PATH_CLEAR): boolean {
    for (const r of this.ROUTES) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i];
        const [bx, bz] = r.pts[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz || 1;
        let tt = ((x - ax) * dx + (z - az) * dz) / l2;
        tt = Math.max(0, Math.min(1, tt));
        const px = ax + dx * tt;
        const pz = az + dz * tt;
        if (Math.hypot(x - px, z - pz) < clear) return true;
      }
    }
    return false;
  }

  update(t: number) {
    if (this.fireflies) {
      const { mesh, base, dummy } = this.fireflies;
      for (let i = 0; i < base.length; i++) {
        const b = base[i];
        dummy.position.set(
          b.x + Math.sin(t * 0.6 + i) * 1.6,
          b.y + Math.sin(t * 1.7 + i * 1.3) * 0.8,
          b.z + Math.cos(t * 0.5 + i * 0.7) * 1.6
        );
        dummy.scale.setScalar(0.7 + Math.sin(t * 4 + i) * 0.3);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const isl of this.islands) {
      isl.obj.position.y = isl.y0 + Math.sin(t * 0.5 + isl.phase) * 1.2;
      isl.obj.rotation.y += 0.0015;
    }
  }

  /** A ring of big hazy peaks beyond the field for depth (instanced). */
  private mountains(scene: THREE.Scene, half: number) {
    const geo = new THREE.ConeGeometry(1, 1, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f7d96, roughness: 1, flatShading: true });
    const count = 18;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.18;
      const r = half + 34 + (i % 3) * 16;
      const h = 26 + (i % 4) * 12;
      const w = 18 + (i % 3) * 8;
      d.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      d.scale.set(w, h, w);
      d.rotation.y = a;
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    scene.add(mesh);
  }

  private instance(
    scene: THREE.Scene,
    geo: THREE.BufferGeometry,
    spots: { x: number; z: number }[],
    sMin: number,
    sMax: number,
    castShadow: boolean,
    material?: THREE.Material
  ): THREE.InstancedMesh | null {
    if (!spots.length) return null;
    const mat = material ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const d = new THREE.Object3D();
    for (let i = 0; i < spots.length; i++) {
      const s = sMin + Math.random() * (sMax - sMin);
      d.position.set(spots[i].x, 0, spots[i].z);
      d.rotation.set(0, Math.random() * Math.PI * 2, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  /** Low rounded grass mounds for rolling-terrain relief. */
  private mounds(scene: THREE.Scene, spots: { x: number; z: number }[]) {
    if (!spots.length) return;
    const geo = paint(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.28, 1), 0x4a8a55);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const d = new THREE.Object3D();
    for (let i = 0; i < spots.length; i++) {
      const w = 8 + Math.random() * 12;
      d.position.set(spots[i].x, 0, spots[i].z);
      d.rotation.y = Math.random() * Math.PI;
      d.scale.set(w, w * (0.5 + Math.random() * 0.4), w);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  /** Glowing crystal formation clusters as landmarks. */
  private crystals(scene: THREE.Scene, spots: { x: number; z: number }[]) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8fa6ff, emissive: 0x5a7bff, emissiveIntensity: 0.8, roughness: 0.3, flatShading: true });
    this.instance(scene, crystalGeometry(), spots, 1.4, 3.2, true, mat);
  }

  /** Tiny colorful flower dots (per-instance color) in the meadow. */
  private flowers(scene: THREE.Scene, spots: { x: number; z: number }[]) {
    if (!spots.length) return;
    const geo = new THREE.SphereGeometry(0.16, 6, 5);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, emissiveIntensity: 0.3 });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const palette = [0xff5d8f, 0xffc24b, 0xa970ff, 0x4f8fff, 0xff7a3d, 0xffffff];
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < spots.length; i++) {
      d.position.set(spots[i].x, 0.2, spots[i].z);
      d.scale.setScalar(0.7 + Math.random() * 0.8);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.set(palette[(Math.random() * palette.length) | 0]));
    }
    scene.add(mesh);
  }

  /** Flat translucent ponds with a sandy rim. */
  private ponds(scene: THREE.Scene, spots: { x: number; z: number }[]) {
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x3aa7e0, emissive: 0x1d6fb0, emissiveIntensity: 0.25, transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc6b083, roughness: 1 });
    for (const s of spots) {
      const r = 6 + Math.random() * 6;
      const rim = new THREE.Mesh(new THREE.CircleGeometry(r + 1.2, 28), rimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(s.x, 0.04, s.z);
      rim.receiveShadow = true;
      scene.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(r, 28), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(s.x, 0.08, s.z);
      scene.add(water);
    }
  }

  private makeFireflies(scene: THREE.Scene, spots: { x: number; z: number }[]) {
    if (!spots.length) return;
    const geo = new THREE.SphereGeometry(0.13, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const base = spots.map((s) => new THREE.Vector3(s.x, 1.5 + Math.random() * 3, s.z));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fireflies = { mesh, base, dummy: new THREE.Object3D() };
    scene.add(mesh);
  }

  /** A few floating rock islands (rock + grass + a tree) that bob and turn. */
  private floatingIslands(scene: THREE.Scene) {
    const spots = [
      { x: -68, z: 24, y: 16 },
      { x: 66, z: 30, y: 19 },
      { x: 6, z: -98, y: 24 },
    ];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 1, flatShading: true });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a9a55, roughness: 1, flatShading: true });
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const g = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0).scale(1, 1.3, 1), rockMat);
      rock.position.y = -1.5;
      rock.castShadow = true;
      g.add(rock);
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 0.8, 12), grassMat);
      grass.position.y = 0.4;
      g.add(grass);
      const tree = new THREE.Mesh(treeGeometry(), treeMat);
      tree.scale.setScalar(1.2);
      tree.position.y = 0.8;
      g.add(tree);
      g.position.set(s.x, s.y, s.z);
      g.scale.setScalar(1 + (i % 2) * 0.4);
      scene.add(g);
      this.islands.push({ obj: g, y0: s.y, phase: i * 2 });
    }
  }

  /** Random outer-field spots that skip the base, zone corridors and trails.
   *  `clear` widens the trail/camp keep-out for larger props. */
  private scatter(count: number, minR: number, maxR: number, clear = this.PATH_CLEAR): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    for (let tries = 0; tries < count * 8 && out.length < count; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (z > 56 && Math.abs(x) < 82) continue; // player base + parade
      if (Math.abs(x) < 14 && z < 60) continue; // path out to the center zone
      // keep the three (now larger, edge-spread) capture-zone courses clear
      if (x > -14 && x < 14 && z > -90 && z < -24) continue; // zone 1 (center, far)
      if (x > -112 && x < -42 && z > -46 && z < -12) continue; // zone 2 (left edge)
      if (x > 42 && x < 112 && z > -46 && z < -12) continue; // zone 3 (right edge)
      if (this.nearAnyPath(x, z, clear)) continue; // keep the trails clear of props
      if (Math.hypot(x - 78, z + 68) < 14 + clear) continue; // enemy camp
      if (Math.hypot(x + 78, z + 68) < 18 + clear) continue; // colosseum (far-left)
      out.push({ x, z });
    }
    return out;
  }
}

// ---- merged, vertex-colored geometries (one draw call per type) ----

function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Stylized pine: trunk + two foliage cones, merged with vertex colors. */
function treeGeometry(): THREE.BufferGeometry {
  const trunk = paint(new THREE.CylinderGeometry(0.28, 0.42, 2.4, 6).translate(0, 1.2, 0), 0x6b4a2c);
  const c1 = paint(new THREE.ConeGeometry(1.7, 2.8, 7).translate(0, 3.1, 0), 0x3f8a4e);
  const c2 = paint(new THREE.ConeGeometry(1.2, 2.1, 7).translate(0, 4.5, 0), 0x4fa35c);
  return mergeGeometries([trunk, c1, c2], false)!;
}

function rockGeometry(): THREE.BufferGeometry {
  return paint(new THREE.IcosahedronGeometry(1, 0).scale(1.1, 0.7, 0.9), 0x8a8f9c);
}

function bushGeometry(): THREE.BufferGeometry {
  const a = paint(new THREE.IcosahedronGeometry(0.9, 0), 0x4a9a55);
  const b = paint(new THREE.IcosahedronGeometry(0.6, 0).translate(0.6, 0.3, 0.2), 0x57ad62);
  return mergeGeometries([a, b], false)!;
}

/** Whimsical giant mushroom: cream stem + red spotted cap (fixed spot pattern). */
function mushroomGeometry(): THREE.BufferGeometry {
  const parts = [
    paint(new THREE.CylinderGeometry(0.5, 0.7, 2, 8).translate(0, 1, 0), 0xe7ddc4),
    paint(new THREE.SphereGeometry(1.7, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 2, 0), 0xd1473f),
  ];
  // a few white cap spots
  const spots: [number, number, number][] = [
    [0.7, 2.5, 0.4],
    [-0.6, 2.6, 0.5],
    [0.2, 2.9, -0.7],
    [-0.8, 2.4, -0.4],
  ];
  // NOTE: spots use SphereGeometry (indexed) to match the stem/cap — mixing an
  // indexed mesh with a non-indexed Icosahedron makes mergeGeometries fail.
  for (const [x, y, z] of spots) parts.push(paint(new THREE.SphereGeometry(0.24, 7, 6).translate(x, y, z), 0xf3efe6));
  return mergeGeometries(parts, false)!;
}

/** A cluster of crystal shards (uniform geometry, colored by an emissive mat). */
function crystalGeometry(): THREE.BufferGeometry {
  const parts = [
    new THREE.OctahedronGeometry(1, 0).scale(0.7, 2.2, 0.7).translate(0, 2, 0),
    new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.5, 0.5).translate(0.9, 1.3, 0.3),
    new THREE.OctahedronGeometry(1, 0).scale(0.45, 1.2, 0.45).translate(-0.8, 1.1, -0.4),
  ];
  return mergeGeometries(parts, false)!;
}
