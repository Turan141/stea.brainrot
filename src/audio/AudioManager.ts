import type { EventBus } from "../engine/EventBus.ts";

interface AudioSettings {
  sfx: boolean;
  music: boolean;
}

/**
 * Synthesized audio via WebAudio (no asset files). Subscribes to game events
 * for SFX and provides a soft ambient music pad. Respects the settings object
 * (mutated live by the Settings panel). Unlocks on first user gesture.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicOn = false;

  constructor(
    private settings: AudioSettings,
    bus: EventBus
  ) {
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      if (this.settings.music) this.startMusic();
    };
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);

    bus.on("creature:captured", () => this.blip(660, 0.08, "triangle", 0.8));
    bus.on("creature:delivered", () => {
      this.blip(523, 0.12, "sine", 0.9);
      this.blip(784, 0.16, "sine", 0.6);
    });
    bus.on("upgrade:purchased", () => {
      this.blip(880, 0.06, "square", 0.5);
      this.blip(1175, 0.1, "square", 0.4);
    });
    bus.on("notify", (p) => {
      if (p.kind === "warn") this.blip(180, 0.22, "sawtooth", 0.5);
    });
    bus.on("zone:unlocked", () => {
      this.blip(523, 0.1, "sine", 0.7);
      this.blip(659, 0.1, "sine", 0.7);
      this.blip(880, 0.18, "sine", 0.7);
    });
  }

  private ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (!this.settings.sfx || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  setSfx(on: boolean) {
    this.settings.sfx = on;
  }

  setMusic(on: boolean) {
    this.settings.music = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    this.ensure();
    if (!this.ctx || !this.master || this.musicOn) return;
    this.musicOn = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.06;
    this.musicGain.connect(this.master);
    // soft two-note detuned pad
    for (const freq of [110, 164.81]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(this.musicGain);
      osc.start();
      lfo.start();
      this.musicNodes.push(osc, lfo);
    }
  }

  private stopMusic() {
    for (const n of this.musicNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
    this.musicOn = false;
  }
}
