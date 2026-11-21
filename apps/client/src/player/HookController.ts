import { hookPower } from "@oceansurvival/shared";

/**
 * Mouse controls for the Grapple Line (GAMEPLAY_SYSTEMS §C):
 * - no hook out: hold LEFT to charge (0–1.2 s), release to throw;
 * - hook out: hold LEFT to reel in, release to stop;
 * - RIGHT: cancel (releases anything caught).
 * Pure input → intents; the server simulates everything.
 */
export interface HookActions {
  hasHook(): boolean;
  throwHook(power: number): void;
  reel(active: boolean): void;
  cancel(): void;
}

export class HookController {
  private active = false;
  private chargeStart: number | null = null;
  private reeling = false;

  constructor(private readonly actions: HookActions) {
    document.addEventListener("mousedown", this.onDown);
    document.addEventListener("mouseup", this.onUp);
  }

  /** Enabled only while playing (pointer locked, not typing). */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      this.chargeStart = null;
      if (this.reeling) this.actions.reel(false);
      this.reeling = false;
    }
  }

  /** Current charge (0..1) while the button is held, else null. */
  charge(now = performance.now()): number | null {
    return this.chargeStart === null ? null : hookPower((now - this.chargeStart) / 1000);
  }

  dispose(): void {
    document.removeEventListener("mousedown", this.onDown);
    document.removeEventListener("mouseup", this.onUp);
  }

  private readonly onDown = (e: MouseEvent) => {
    if (!this.active) return;
    if (e.button === 2) {
      this.chargeStart = null;
      this.reeling = false;
      this.actions.cancel();
      return;
    }
    if (e.button !== 0) return;
    if (this.actions.hasHook()) {
      this.reeling = true;
      this.actions.reel(true);
    } else {
      this.chargeStart = performance.now();
    }
  };

  private readonly onUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (this.chargeStart !== null) {
      const power = this.charge() ?? 0;
      this.chargeStart = null;
      if (this.active) this.actions.throwHook(power);
    }
    if (this.reeling) {
      this.reeling = false;
      this.actions.reel(false);
    }
  };
}
