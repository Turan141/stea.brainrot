import { Renderer } from "./Renderer.ts";
import { SceneManager } from "./SceneManager.ts";
import { Input } from "./Input.ts";
import { Time } from "./Time.ts";
import { EventBus } from "./EventBus.ts";

export type UpdateFn = (dt: number, elapsed: number) => void;

/**
 * Core runtime: owns rendering, scene, input, clock and the event bus, and
 * drives the requestAnimationFrame loop. Gameplay is injected via `start`.
 */
export class Engine {
  readonly renderer: Renderer;
  readonly sceneManager: SceneManager;
  readonly input: Input;
  readonly time: Time;
  readonly bus: EventBus;

  private update: UpdateFn = () => {};
  private running = false;

  // Frame cap (fps). The panel may be 120Hz; capping to 60 halves GPU/CPU work
  // and gives steady pacing. 0 = uncapped.
  private maxFps = 60;
  private frameInterval = 1000 / 60;
  private nextFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.sceneManager = new SceneManager();
    this.input = new Input();
    this.time = new Time();
    this.bus = new EventBus();
  }

  get scene() {
    return this.sceneManager.scene;
  }
  get camera() {
    return this.renderer.camera;
  }

  start(update: UpdateFn) {
    this.update = update;
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    // Frame cap via a target-time accumulator: on a 120Hz panel this renders on
    // every 2nd vsync = a steady 60, instead of free-running at 120.
    if (this.maxFps > 0) {
      if (this.nextFrame === 0) this.nextFrame = now;
      if (now < this.nextFrame - 1) return; // not time for the next frame yet
      this.nextFrame += this.frameInterval;
      if (this.nextFrame < now) this.nextFrame = now + this.frameInterval; // resync after a stall
    }
    const dt = this.time.tick(now);
    this.update(dt, this.time.elapsed);
    this.renderer.render(this.scene);
    this.input.endFrame();
  };

  /** Set the frame-rate cap (fps). 0 = uncapped. */
  setMaxFps(fps: number) {
    this.maxFps = Math.max(0, fps);
    this.frameInterval = fps > 0 ? 1000 / fps : 0;
    this.nextFrame = 0;
  }

  stop() {
    this.running = false;
  }
}
