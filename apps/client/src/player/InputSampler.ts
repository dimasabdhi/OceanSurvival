import { Buttons, CHARACTER } from "@oceansurvival/shared";

/**
 * Samples keyboard + mouse into the per-step player input (PlayerInput schema).
 * Look angles update on every mouse event (render uses them immediately for
 * responsiveness); movement keys are read once per fixed step.
 */
export class InputSampler {
  yaw = 0;
  pitch = 0;
  sensitivity = 0.0022;
  /** When false (menus, chat), keys are ignored and released. */
  private active = false;
  private readonly keys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.release);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.release();
  }

  /** Writes the current input into `out` (the Colyseus input handle's `data`). */
  sample(out: { moveX: number; moveZ: number; yaw: number; pitch: number; buttons: number }): void {
    const k = this.keys;
    out.moveX = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    out.moveZ = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    out.yaw = this.yaw;
    out.pitch = this.pitch;
    out.buttons =
      (k.has("Space") ? Buttons.Jump : 0) |
      (k.has("ShiftLeft") || k.has("ShiftRight") ? Buttons.Sprint : 0);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.release);
    document.removeEventListener("mousemove", this.onMouseMove);
  }

  private readonly release = () => {
    this.keys.clear();
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (this.active) this.keys.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.active) return;
    let yaw = this.yaw - e.movementX * this.sensitivity;
    // Keep yaw in [-π, π] (the server sanitizes to that range).
    if (yaw > Math.PI) yaw -= Math.PI * 2;
    else if (yaw < -Math.PI) yaw += Math.PI * 2;
    this.yaw = yaw;
    this.pitch = Math.max(
      -CHARACTER.maxPitch,
      Math.min(CHARACTER.maxPitch, this.pitch - e.movementY * this.sensitivity),
    );
  };
}
