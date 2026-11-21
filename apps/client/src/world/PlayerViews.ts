import { CHARACTER, CHARACTER_CENTER_HEIGHT } from "@oceansurvival/shared";
import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  Sprite,
  SpriteMaterial,
} from "three";
import type { Pose } from "../net/WorldConnection";

/**
 * PLACEHOLDER visuals for other players (Phase 2): a capsule with a "nose" showing
 * facing, plus a name tag. Real character models + animation arrive in Phase 3/14.
 */
interface View {
  group: Group;
  body: Mesh;
  nameTag: Sprite;
  nameTexture: CanvasTexture;
  material: MeshStandardMaterial;
  name: string;
}

const capsule = new CapsuleGeometry(CHARACTER.radius, CHARACTER.halfHeight * 2, 6, 12);
const nose = new ConeGeometry(0.12, 0.3, 8);
nose.rotateX(-Math.PI / 2);
const noseMaterial = new MeshStandardMaterial({ color: 0x0b2540, roughness: 0.8 });

function colorFor(id: string): Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return new Color().setHSL((h % 360) / 360, 0.55, 0.55);
}

function makeNameTexture(name: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(11,37,64,0.7)";
    ctx.fillRect(0, 8, 256, 48);
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4fbf8";
    ctx.fillText(name.slice(0, 24), 128, 33);
  }
  return new CanvasTexture(canvas);
}

export class PlayerViews {
  private readonly views = new Map<string, View>();

  constructor(private readonly scene: Scene) {}

  /** Creates/updates the view for `id`. Call each frame for every visible remote. */
  update(id: string, name: string, playerId: string, pose: Pose, connected: boolean): void {
    let view = this.views.get(id);
    if (!view) {
      view = this.create(name, playerId);
      this.views.set(id, view);
      this.scene.add(view.group);
    } else if (view.name !== name) {
      view.nameTexture.dispose();
      view.nameTexture = makeNameTexture(name);
      (view.nameTag.material as SpriteMaterial).map = view.nameTexture;
      view.name = name;
    }
    view.group.position.set(pose.x, pose.y, pose.z);
    view.group.rotation.y = pose.yaw;
    view.material.opacity = connected ? 1 : 0.4;
    view.material.transparent = !connected;
  }

  /** Removes views whose ids are not in `alive`. */
  prune(alive: Set<string>): void {
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.scene.remove(view.group);
      view.material.dispose();
      view.nameTexture.dispose();
      (view.nameTag.material as SpriteMaterial).dispose();
      this.views.delete(id);
    }
  }

  dispose(): void {
    this.prune(new Set());
  }

  private create(name: string, playerId: string): View {
    const material = new MeshStandardMaterial({ color: colorFor(playerId), roughness: 0.7 });
    const body = new Mesh(capsule, material);
    const noseMesh = new Mesh(nose, noseMaterial);
    noseMesh.position.set(0, CHARACTER.eyeOffset, -CHARACTER.radius - 0.05);
    const nameTexture = makeNameTexture(name);
    const nameTag = new Sprite(new SpriteMaterial({ map: nameTexture, depthWrite: false }));
    nameTag.scale.set(1.6, 0.4, 1);
    nameTag.position.y = CHARACTER_CENTER_HEIGHT + 0.45;
    const group = new Group();
    group.name = `player:${name}`;
    group.add(body, noseMesh, nameTag);
    return { group, body, nameTag, nameTexture, material, name };
  }
}
