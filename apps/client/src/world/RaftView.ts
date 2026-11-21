import {
  CELL_SIZE,
  cellCenter,
  FOUNDATION_THICKNESS,
  LANTERN_HEIGHT,
  LANTERN_POSITION,
  RAFT_DECK_Y,
  START_RAFT_CELLS,
} from "@oceansurvival/shared";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from "three";

/**
 * PLACEHOLDER art for the starting raft (Phase 3): procedural low-poly planks, beams and
 * float barrels per foundation cell + the lantern. Geometry matches RAFT_COLLIDERS; final
 * models come with the building system/art pass (Phase 7/14). Lives in the raft frame.
 */
const PLANKS_PER_CELL = 5;

export class RaftView {
  readonly group = new Group();
  private readonly lanternGlass: MeshStandardMaterial;
  private readonly lanternLight = new PointLight(0xffc46b, 0, 9, 1.6);
  private readonly disposables: { dispose(): void }[] = [];

  constructor() {
    this.group.name = "Raft";
    const plankMat = this.mat(new MeshStandardMaterial({ color: 0xa27b5c, roughness: 0.95 }));
    const plankDark = this.mat(new MeshStandardMaterial({ color: 0x8c6849, roughness: 0.95 }));
    const beamMat = this.mat(new MeshStandardMaterial({ color: 0x6b4f3a, roughness: 1 }));
    const barrelMat = this.mat(new MeshStandardMaterial({ color: 0x3e8ed0, roughness: 0.6 }));
    const ropeMat = this.mat(new MeshStandardMaterial({ color: 0xc9b37e, roughness: 1 }));

    const plankW = CELL_SIZE / PLANKS_PER_CELL;
    const plankGeo = this.geo(new BoxGeometry(plankW * 0.94, 0.08, CELL_SIZE * 0.98));
    const beamGeo = this.geo(new BoxGeometry(CELL_SIZE, 0.12, 0.14));
    const barrelGeo = this.geo(new CylinderGeometry(0.22, 0.22, CELL_SIZE * 0.8, 8));
    barrelGeo.rotateX(Math.PI / 2);
    const ropeGeo = this.geo(new CylinderGeometry(0.235, 0.235, 0.06, 8));
    ropeGeo.rotateX(Math.PI / 2);

    for (const [gx, gz] of START_RAFT_CELLS) {
      const [cx, cz] = cellCenter(gx, gz);
      for (let i = 0; i < PLANKS_PER_CELL; i++) {
        const plank = new Mesh(plankGeo, i % 2 === 0 ? plankMat : plankDark);
        plank.position.set(cx - CELL_SIZE / 2 + plankW * (i + 0.5), RAFT_DECK_Y - 0.04, cz);
        // Slight irregularity: driftwood planks are never perfectly aligned.
        plank.rotation.y = ((i * 37 + gx * 11 + gz * 7) % 5) * 0.004 - 0.008;
        this.group.add(plank);
      }
      for (const dz of [-0.5, 0.5]) {
        const beam = new Mesh(beamGeo, beamMat);
        beam.position.set(cx, RAFT_DECK_Y - 0.14, cz + dz * CELL_SIZE * 0.7);
        this.group.add(beam);
      }
      for (const dx of [-0.3, 0.3]) {
        const barrel = new Mesh(barrelGeo, barrelMat);
        barrel.position.set(cx + dx * CELL_SIZE, RAFT_DECK_Y - FOUNDATION_THICKNESS + 0.02, cz);
        const rope = new Mesh(ropeGeo, ropeMat);
        rope.position.copy(barrel.position);
        this.group.add(barrel, rope);
      }
    }

    // Lantern: pole + housing + glowing glass + light.
    const [lx, ly, lz] = LANTERN_POSITION;
    const pole = new Mesh(this.geo(new CylinderGeometry(0.05, 0.07, LANTERN_HEIGHT, 6)), beamMat);
    pole.position.set(lx, ly + LANTERN_HEIGHT / 2, lz);
    const housing = new Mesh(
      this.geo(new BoxGeometry(0.24, 0.05, 0.24)),
      this.mat(new MeshStandardMaterial({ color: 0x5e6b70, roughness: 0.5, metalness: 0.4 })),
    );
    housing.position.set(lx, ly + LANTERN_HEIGHT + 0.14, lz);
    this.lanternGlass = this.mat(
      new MeshStandardMaterial({ color: 0xf2c14e, emissive: new Color(0xffb347), roughness: 0.3 }),
    );
    const glass = new Mesh(this.geo(new BoxGeometry(0.18, 0.22, 0.18)), this.lanternGlass);
    glass.position.set(lx, ly + LANTERN_HEIGHT, lz);
    glass.name = "lantern-glass";
    this.lanternLight.position.set(lx, ly + LANTERN_HEIGHT, lz);
    this.group.add(pole, housing, glass, this.lanternLight);
    this.setLantern(false);
  }

  setLantern(on: boolean): void {
    this.lanternGlass.emissiveIntensity = on ? 2.2 : 0;
    this.lanternLight.intensity = on ? 4 : 0;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }

  private mat<T extends Material>(m: T): T {
    this.disposables.push(m);
    return m;
  }

  private geo<T extends BoxGeometry | CylinderGeometry>(g: T): T {
    this.disposables.push(g);
    return g;
  }
}
