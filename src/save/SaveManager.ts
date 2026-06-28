import type { EventBus } from "../engine/EventBus.ts";

/** Current persisted schema version. Bump + add a migration when shape changes. */
export const SAVE_VERSION = 1;
const STORAGE_KEY = "stea.brainrot.save";

export interface SaveState {
  version: number;
  money: number;
  geneCells: number;
  upgrades: Record<string, number>;
  stored: { id: string; level: number }[]; // creatures on the base (with levels)
  discovered: string[]; // creature ids ever captured (for the dex)
  zones: string[]; // unlocked zone ids
  settings: { sfx: boolean; music: boolean };
  updatedAt: number;
}

export function defaultSave(): SaveState {
  return {
    version: SAVE_VERSION,
    money: 120, // starter coins so the avenue is usable immediately
    geneCells: 6, // CONFIG.fusion.startingGene — enough for a first splice
    upgrades: {},
    stored: [],
    discovered: [],
    zones: ["zone-1"],
    settings: { sfx: true, music: true },
    updatedAt: 0,
  };
}

/**
 * LocalStorage persistence with versioned migrations. All reads go through
 * `load()` which guarantees a valid, current-version object.
 */
export class SaveManager {
  constructor(private bus?: EventBus) {}

  load(): SaveState {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return defaultSave();
    }
    if (!raw) return defaultSave();

    try {
      const parsed = JSON.parse(raw);
      return this.migrate(parsed);
    } catch {
      return defaultSave();
    }
  }

  save(state: SaveState): void {
    state.version = SAVE_VERSION;
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.bus?.emit("save:written", { at: state.updatedAt });
    } catch {
      // private mode / quota — ignore
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Upgrade any older/partial blob to the current schema. */
  private migrate(raw: any): SaveState {
    const base = defaultSave();
    if (!raw || typeof raw !== "object") return base;

    // version-by-version migrations would go here as the schema evolves:
    // if (raw.version === 1) raw = migrateV1toV2(raw);

    return {
      version: SAVE_VERSION,
      money: numberOr(raw.money, 0),
      geneCells: numberOr(raw.geneCells, base.geneCells),
      upgrades: typeof raw.upgrades === "object" && raw.upgrades ? raw.upgrades : {},
      stored: normalizeStored(raw.stored),
      discovered: Array.isArray(raw.discovered) ? raw.discovered.filter((s: unknown) => typeof s === "string") : [],
      zones: Array.isArray(raw.zones) && raw.zones.length ? raw.zones : base.zones,
      settings: {
        sfx: raw.settings?.sfx ?? true,
        music: raw.settings?.music ?? true,
      },
      updatedAt: numberOr(raw.updatedAt, 0),
    };
  }
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

/** Accept both the old `string[]` format and the new `{id,level}[]` format. */
function normalizeStored(raw: unknown): { id: string; level: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; level: number }[] = [];
  for (const item of raw) {
    if (typeof item === "string") out.push({ id: item, level: 1 });
    else if (item && typeof item === "object" && typeof (item as any).id === "string") {
      out.push({ id: (item as any).id, level: numberOr((item as any).level, 1) });
    }
  }
  return out;
}
