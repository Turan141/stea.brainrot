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
    const dt = this.time.tick(now);
    this.update(dt, this.time.elapsed);
    this.renderer.render(this.scene);
    this.input.endFrame();
  };

  stop() {
    this.running = false;
  }
}
