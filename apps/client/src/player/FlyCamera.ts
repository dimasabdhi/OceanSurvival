import { Euler, MathUtils, type PerspectiveCamera, Vector3 } from "three";

const UP = new Vector3(0, 1, 0);

/**
 * DEBUG fly camera for Phase 1 (no player controller yet — that is Phase 3).
 * Mouse look requires pointer lock; WASD moves, Space/C up/down, Shift faster.
 */
export class FlyCamera {
  sensitivity = 0.0022;
  private readonly keys = new Set<string>();
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  private readonly move = new Vector3();
  private enabled = false;

  constructor(private readonly camera: PerspectiveCamera) {
    this.euler.setFromQuaternion(camera.quaternion);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const speed = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 25 : 6) * dt;
    this.move.set(
      (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
      (this.keys.has("Space") ? 1 : 0) - (this.keys.has("KeyC") ? 1 : 0),
      (this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("KeyW") ? 1 : 0),
    );
    if (this.move.lengthSq() === 0) return;
    this.move.normalize().multiplyScalar(speed);
    const vertical = this.move.y;
    this.move.y = 0;
    this.move.applyAxisAngle(UP, this.euler.y);
    this.camera.position.add(this.move);
    this.camera.position.y = MathUtils.clamp(this.camera.position.y + vertical, 0.8, 400);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (this.enabled) this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private readonly onBlur = () => {
    this.keys.clear();
  };
  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.enabled) return;
    this.euler.y -= e.movementX * this.sensitivity;
    this.euler.x = MathUtils.clamp(
      this.euler.x - e.movementY * this.sensitivity,
      -Math.PI / 2 + 0.01,
      Math.PI / 2 - 0.01,
    );
    this.camera.quaternion.setFromEuler(this.euler);
  };
}
