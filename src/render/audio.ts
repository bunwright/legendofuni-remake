import { asset, runtime } from '../content/world';
import type { Settings } from '../game/types';

export class AudioDirector {
  private context?: AudioContext;
  private music = new Audio();
  private track = 0;
  private settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
    this.music.preload = 'none';
    this.music.loop = true;
    this.music.src = asset(runtime.tracks[0]);
    this.music.volume = settings.volume * 0.65;
  }
  apply(settings: Settings): void {
    this.settings = settings;
    this.music.volume = settings.volume * 0.65;
    if (!settings.sound) this.music.pause();
    else void this.music.play().catch(() => {});
  }
  gesture(): void {
    if (!this.settings.sound) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Sound is optional. */
    }
    void this.music.play().catch(() => {});
  }
  scene(mode: 'menu' | 'map' | 'battle' | 'diplomacy'): void {
    const track = { menu: 0, map: 1, battle: 3, diplomacy: 2 }[mode];
    if (track === this.track) return;
    this.track = track;
    this.music.src = asset(runtime.tracks[track]);
    if (this.settings.sound) void this.music.play().catch(() => {});
  }
  tone(kind: 'click' | 'success' | 'error' | 'fire'): void {
    if (!this.settings.sound || !this.context) return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    const frequencies = { click: 640, success: 880, error: 180, fire: 100 };
    osc.type = kind === 'fire' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(frequencies[kind], ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'success' ? 1320 : frequencies[kind] * 0.35,
      ctx.currentTime + 0.17,
    );
    gain.gain.setValueAtTime(this.settings.volume * 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }
}
