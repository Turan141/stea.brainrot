/**
 * Generic object pool. Avoids per-frame allocation / GC churn for
 * short-lived entities (particles, projectiles, transient creatures).
 */
export class Pool<T> {
  private free: T[] = [];
  private active = new Set<T>();

  constructor(
    private factory: () => T,
    private onAcquire?: (t: T) => void,
    private onRelease?: (t: T) => void
  ) {}

  acquire(): T {
    const obj = this.free.pop() ?? this.factory();
    this.active.add(obj);
    this.onAcquire?.(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.delete(obj)) return;
    this.onRelease?.(obj);
    this.free.push(obj);
  }

  get activeItems(): IterableIterator<T> {
    return this.active.values();
  }

  get activeCount(): number {
    return this.active.size;
  }
}
