import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Creature } from "../creatures/Creature.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { Player } from "../player/Player.ts";
import type { Zone } from "../world/Zone.ts";
import type { EventBus } from "../engine/EventBus.ts";

interface Slot {
  creature: Creature | null;
  timer: number;
  pending: boolean;
}

/**
 * Spawns a random unlocked creature on each zone's capture pad, then lets the
 * player pick it up by reaching the pad. Respawns after a delay once taken.
 */
export class CaptureSystem {
  private slots = new Map<string, Slot>();
  readonly active: Creature[] = [];

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    private player: Player,
    private bus: EventBus,
    private discovered: Set<string>
  ) {}

  update(dt: number, zones: Zone[], level: number) {
    for (const zone of zones) {
      if (zone.unlockLevel > level) continue;
      let slot = this.slots.get(zone.id);
      if (!slot) {
        slot = { creature: null, timer: 0, pending: false };
        this.slots.set(zone.id, slot);
      }

      if (!slot.creature && !slot.pending) {
        slot.timer -= dt;
        if (slot.timer <= 0) void this.spawn(zone, slot);
      } else if (slot.creature) {
        this.tryCapture(zone, slot);
      }
    }

    for (const c of this.active) c.update(dt);
  }

  private async spawn(zone: Zone, slot: Slot) {
    const def = this.library.pick(zone.level);
    if (!def) return;
    slot.pending = true;
    try {
      const mesh = await this.library.createInstance(def);
      this.scene.add(mesh);
      const creature = new Creature(def, mesh);
      const p = zone.capture.position;
      creature.setPosition(p.x, p.y + 1, p.z);
      slot.creature = creature;
      this.active.push(creature);
    } finally {
      slot.pending = false;
    }
  }

  private tryCapture(zone: Zone, slot: Slot) {
    const c = slot.creature!;
    if (this.player.isFull) return;
    const p = this.player.position;
    const cp = zone.capture.position;
    const dx = p.x - cp.x;
    const dz = p.z - cp.z;
    const r = zone.capture.radius + this.player.magnetRadius;
    if (dx * dx + dz * dz <= r * r) {
      c.state = "carried";
      this.player.pickUp(c);
      slot.creature = null;
      slot.timer = CONFIG.capture.respawnDelay;
      this.discovered.add(c.def.id);
      this.bus.emit("creature:captured", { value: c.value, rarity: c.def.rarity, name: c.def.name });
    }
  }

  /** Remove a creature from the active list (when stored or lost on death). */
  retire(creature: Creature) {
    const i = this.active.indexOf(creature);
    if (i >= 0) this.active.splice(i, 1);
  }
}
