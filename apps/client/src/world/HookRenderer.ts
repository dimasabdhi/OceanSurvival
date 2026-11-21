import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  type Vector3,
} from "three";

/**
 * Hooks + ropes for every player (GAMEPLAY_SYSTEMS §C: "rope = Bezier, 16 segments, not
 * physics"). PLACEHOLDER art: a small three-prong hook and a tan line.
 */
const SEGMENTS = 16;

interface Entry {
  hook: Group;
  rope: Line;
  positions: Float32Array;
  seen: boolean;
}

export class HookRenderer {
  readonly group = new Group();
  private readonly entries = new Map<string, Entry>();
  private readonly hookMat = new MeshStandardMaterial({
    color: 0x5e6b70,
    metalness: 0.6,
    roughness: 0.4,
  });
  private readonly ropeMat = new LineBasicMaterial({ color: 0xc9b37e });
  private readonly prong = new ConeGeometry(0.035, 0.18, 5);
  private readonly ring = new TorusGeometry(0.05, 0.012, 5, 10);

  constructor() {
    this.group.name = "Hooks";
  }

  /** Marks the start of a frame; entries not `set` before `endFrame` are removed. */
  beginFrame(): void {
    for (const e of this.entries.values()) e.seen = false;
  }

  /** Places hook `id` at `hookPos` with a rope from `handPos` (render frame). */
  set(id: string, hookPos: Vector3, handPos: Vector3, inWater: boolean): void {
    let e = this.entries.get(id);
    if (!e) {
      e = this.create();
      this.entries.set(id, e);
      this.group.add(e.hook, e.rope);
    }
    e.seen = true;
    e.hook.position.copy(hookPos);
    // Rope: quadratic Bézier hand → hook; sags more when lying in the water.
    const dist = hookPos.distanceTo(handPos);
    const sag = inWater ? Math.min(2.5, dist * 0.25) : Math.min(1, dist * 0.06);
    const cx = (handPos.x + hookPos.x) / 2;
    const cy = Math.min(handPos.y, hookPos.y) - sag;
    const cz = (handPos.z + hookPos.z) / 2;
    const p = e.positions;
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      p[i * 3] = a * handPos.x + b * cx + c * hookPos.x;
      p[i * 3 + 1] = a * handPos.y + b * cy + c * hookPos.y;
      p[i * 3 + 2] = a * handPos.z + b * cz + c * hookPos.z;
    }
    const attr = e.rope.geometry.getAttribute("position") as BufferAttribute;
    attr.needsUpdate = true;
    e.rope.geometry.computeBoundingSphere();
  }

  endFrame(): void {
    for (const [id, e] of this.entries) {
      if (e.seen) continue;
      this.group.remove(e.hook, e.rope);
      e.rope.geometry.dispose();
      this.entries.delete(id);
    }
  }

  dispose(): void {
    this.beginFrame();
    this.endFrame();
    this.hookMat.dispose();
    this.ropeMat.dispose();
    this.prong.dispose();
    this.ring.dispose();
  }

  private create(): Entry {
    const hook = new Group();
    for (let i = 0; i < 3; i++) {
      const p = new Mesh(this.prong, this.hookMat);
      const a = (i / 3) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.06, -0.02, Math.sin(a) * 0.06);
      p.rotation.set(Math.sin(a) * 2.4, 0, -Math.cos(a) * 2.4);
      hook.add(p);
    }
    hook.add(new Mesh(this.ring, this.hookMat));
    const positions = new Float32Array((SEGMENTS + 1) * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const rope = new Line(geometry, this.ropeMat);
    rope.frustumCulled = false;
    return { hook, rope, positions, seen: true };
  }
}
