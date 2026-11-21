import {
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type PerspectiveCamera,
  TorusGeometry,
  Vector3,
} from "three";

/**
 * First-person "held item" (PLACEHOLDER): a rope coil with the hook in the right hand.
 * Attached to the camera; the hook hides while it is thrown. Also provides the hand
 * position used as the rope's start point.
 */
export class Viewmodel {
  readonly group = new Group();
  private readonly hook = new Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly handLocal = new Vector3(0.28, -0.26, -0.5);
  private chargeKick = 0;

  constructor(camera: PerspectiveCamera) {
    const ropeMat = new MeshStandardMaterial({ color: 0xc9b37e, roughness: 1 });
    const metal = new MeshStandardMaterial({ color: 0x5e6b70, metalness: 0.6, roughness: 0.4 });
    const coilGeo = new TorusGeometry(0.07, 0.022, 6, 14);
    const prong = new ConeGeometry(0.02, 0.1, 5);
    this.disposables.push(ropeMat, metal, coilGeo, prong);

    const coil = new Mesh(coilGeo, ropeMat);
    coil.rotation.set(1.15, 0.45, 0); // ring faces the camera
    for (let i = 0; i < 3; i++) {
      const p = new Mesh(prong, metal);
      const a = (i / 3) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.03, 0.06, Math.sin(a) * 0.03);
      p.rotation.set(Math.sin(a) * 2.4, 0, -Math.cos(a) * 2.4);
      this.hook.add(p);
    }
    this.hook.position.set(0.02, 0.05, -0.05);
    this.group.add(coil, this.hook);
    this.group.position.copy(this.handLocal);
    this.group.name = "Viewmodel(PLACEHOLDER)";
    // Render on top of the world isn't needed at this size; keep it simple.
    camera.add(this.group);
  }

  /** `charge` 0..1 pulls the hand back while charging a throw. */
  update(hookOut: boolean, charge: number | null, visible: boolean): void {
    this.group.visible = visible;
    this.hook.visible = !hookOut;
    const target = charge ?? 0;
    this.chargeKick += (target - this.chargeKick) * 0.3;
    this.group.position.set(
      this.handLocal.x,
      this.handLocal.y + this.chargeKick * 0.06,
      this.handLocal.z + this.chargeKick * 0.12,
    );
  }

  /** World (render-frame) position of the hand, for the rope start. */
  handWorld(out: Vector3): Vector3 {
    this.group.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.group.matrixWorld);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }
}
