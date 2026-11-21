import { CALM_WAVES, DEBRIS, DebrisKind, sampleWaveHeight } from "@oceansurvival/shared";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

/**
 * Renders replicated debris (GAMEPLAY_SYSTEMS §C) with one InstancedMesh per kind
 * (PERFORMANCE_BUDGET: instancing). Positions are computed from world position − raft
 * world position; height/tilt from the shared wave model; fade in/out by age.
 * PLACEHOLDER art: procedural low-poly shapes in the ART_DIRECTION palette.
 */
export interface DebrisLike {
  kind: number;
  worldX: number;
  worldZ: number;
  spawnTime: number;
  yaw: number;
  /** Owner session id of the hook carrying it ("" or undefined = floating free). */
  hookId?: string;
}

interface KindVisual {
  mesh: InstancedMesh;
  /** Vertical offset of the center relative to the water surface. */
  float: number;
  count: number;
}

const CAPACITY = DEBRIS.maxActive;
const PLASTIC_COLORS = [0xe2574c, 0x3e8ed0, 0xf2c14e, 0xf4fbf8].map((c) => new Color(c));
const SAMPLE = 0.5;

export class DebrisRenderer {
  readonly group = new Object3D();
  private readonly kinds = new Map<number, KindVisual>();
  private readonly matrix = new Matrix4();
  private readonly pos = new Vector3();
  private readonly quat = new Quaternion();
  private readonly tilt = new Quaternion();
  private readonly spin = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly normal = new Vector3();
  /** Per-hook counter for spreading caught pieces. */
  private readonly onHook = new Map<string, number>();

  constructor() {
    this.group.name = "Debris";
    const wood = new MeshStandardMaterial({ color: 0x8c7258, roughness: 0.95 });
    const plastic = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const grass = new MeshStandardMaterial({ color: 0x4f9a52, roughness: 0.9 });
    const barrel = new MeshStandardMaterial({ color: 0x3e8ed0, roughness: 0.5, metalness: 0.2 });
    const coconut = new MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 });

    const log = new CylinderGeometry(0.11, 0.14, 1.3, 7);
    log.rotateZ(Math.PI / 2);
    const crate = new BoxGeometry(0.5, 0.12, 0.38);
    const mat = new CylinderGeometry(0.42, 0.48, 0.05, 7);
    const drum = new CylinderGeometry(0.28, 0.28, 0.8, 10);
    drum.rotateZ(Math.PI / 2);
    const nut = new IcosahedronGeometry(0.15, 0);

    this.add(DebrisKind.Driftwood, log, wood, 0.02);
    this.add(DebrisKind.Plastic, crate, plastic, 0.02);
    this.add(DebrisKind.Seagrass, mat, grass, 0.01);
    this.add(DebrisKind.Barrel, drum, barrel, 0.06);
    this.add(DebrisKind.Coconut, nut, coconut, 0.03);
  }

  /**
   * @param raftX/raftZ world position of the render origin (the raft)
   * @param camera camera position in the render frame (wave visual fade)
   */
  update(
    items: Iterable<DebrisLike>,
    worldTime: number,
    raftX: number,
    raftZ: number,
    camera: Vector3,
    /** Render positions of hooks by owner id: caught pieces hang on their hook. */
    hookPositions?: ReadonlyMap<string, Vector3>,
  ): void {
    for (const v of this.kinds.values()) v.count = 0;
    this.onHook.clear();
    for (const d of items) {
      const visual = this.kinds.get(d.kind);
      if (!visual || visual.count >= CAPACITY) continue;
      const hookPos = d.hookId ? hookPositions?.get(d.hookId) : undefined;
      if (hookPos) {
        const i = this.onHook.get(d.hookId as string) ?? 0;
        this.onHook.set(d.hookId as string, i + 1);
        this.spin.setFromAxisAngle(this.up, d.yaw);
        this.pos.set(
          hookPos.x + (i - 1) * 0.35,
          hookPos.y + visual.float,
          hookPos.z + 0.25 * (i % 2),
        );
        this.scale.setScalar(1);
        this.matrix.compose(this.pos, this.spin, this.scale);
        visual.mesh.setMatrixAt(visual.count, this.matrix);
        visual.count++;
        continue;
      }
      const lx = d.worldX - raftX;
      const lz = d.worldZ - raftZ;
      const viewDist = Math.hypot(lx - camera.x, lz - camera.z);
      const h = sampleWaveHeight(CALM_WAVES, d.worldX, d.worldZ, worldTime, viewDist);
      const hx = sampleWaveHeight(CALM_WAVES, d.worldX + SAMPLE, d.worldZ, worldTime, viewDist);
      const hz = sampleWaveHeight(CALM_WAVES, d.worldX, d.worldZ + SAMPLE, worldTime, viewDist);
      this.normal.set(-(hx - h) / SAMPLE, 1, -(hz - h) / SAMPLE).normalize();
      this.tilt.setFromUnitVectors(this.up, this.normal);
      // Slow drift-spin so pieces feel alive.
      this.spin.setFromAxisAngle(this.up, d.yaw + (worldTime - d.spawnTime) * 0.05);
      this.quat.copy(this.tilt).multiply(this.spin);

      const age = worldTime - d.spawnTime;
      const fadeIn = Math.min(1, Math.max(0, age / DEBRIS.fadeSeconds));
      const fadeOut = Math.min(1, Math.max(0, (DEBRIS.lifetimeSeconds - age) / DEBRIS.fadeSeconds));
      const s = Math.max(0.001, Math.min(fadeIn, fadeOut));
      this.scale.setScalar(s);
      this.pos.set(lx, h + visual.float, lz);
      this.matrix.compose(this.pos, this.quat, this.scale);
      visual.mesh.setMatrixAt(visual.count, this.matrix);
      if (d.kind === DebrisKind.Plastic) {
        visual.mesh.setColorAt(
          visual.count,
          PLASTIC_COLORS[Math.floor(d.yaw * 7) % PLASTIC_COLORS.length] as Color,
        );
      }
      visual.count++;
    }
    for (const v of this.kinds.values()) {
      v.mesh.count = v.count;
      v.mesh.instanceMatrix.needsUpdate = true;
      if (v.mesh.instanceColor) v.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const v of this.kinds.values()) {
      v.mesh.geometry.dispose();
      (v.mesh.material as MeshStandardMaterial).dispose();
      v.mesh.dispose();
    }
  }

  private add(
    kind: number,
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    float: number,
  ) {
    const mesh = new InstancedMesh(geometry, material, CAPACITY);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = `debris:${kind}`;
    if (kind === DebrisKind.Plastic) mesh.setColorAt(0, new Color(1, 1, 1));
    this.group.add(mesh);
    this.kinds.set(kind, { mesh, float, count: 0 });
  }
}
