/**
 * Frame clock. Provides clamped delta (guards against huge jumps when the
 * tab was backgrounded) and a monotonically increasing elapsed time.
 */
export class Time {
  elapsed = 0;
  delta = 0;
  private last = 0;
  private started = false;

  start(now: number) {
    this.last = now;
    this.started = true;
  }

  tick(now: number): number {
    if (!this.started) this.start(now);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1; // clamp
    if (dt < 0) dt = 0;
    this.delta = dt;
    this.elapsed += dt;
    return dt;
  }
}
