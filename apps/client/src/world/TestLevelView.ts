import { TEST_LEVEL } from "@oceansurvival/shared";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

/**
 * PLACEHOLDER (Phase 2): renders the shared test platform so players can see what
 * they collide with. Replaced by the raft (building pieces, Phase 3/7).
 */
export class TestLevelView {
  readonly group = new Group();
  private readonly material = new MeshStandardMaterial({ color: 0xa27b5c, roughness: 0.95 });
  private readonly geometries: BoxGeometry[] = [];

  constructor() {
    this.group.name = "TestLevel(PLACEHOLDER)";
    for (const box of TEST_LEVEL.boxes) {
      const geometry = new BoxGeometry(
        box.halfExtents[0] * 2,
        box.halfExtents[1] * 2,
        box.halfExtents[2] * 2,
      );
      this.geometries.push(geometry);
      const mesh = new Mesh(geometry, this.material);
      mesh.position.set(box.center[0], box.center[1], box.center[2]);
      this.group.add(mesh);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
