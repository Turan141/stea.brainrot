/**
 * Minimal typed pub/sub. Systems communicate through events instead of
 * holding hard references to each other where it makes sense.
 */
export type GameEvents = {
  "creature:captured": { value: number; rarity: string; name: string };
  "creature:delivered": { count: number; value: number };
  "money:changed": { money: number };
  "upgrade:purchased": { key: string; level: number };
  "zone:unlocked": { id: string };
  "fusion:done": Record<string, never>;
  "arena:won": Record<string, never>;
  "save:written": { at: number };
  notify: { text: string; kind?: "info" | "good" | "warn" };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(event: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}
