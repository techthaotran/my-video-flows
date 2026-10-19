/** Dựng cảnh Three.js từ SceneDef. Preview và export dùng chung `seek(t)` nên ra cùng khung hình. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Actor, Block, Manifest, ManifestEntry, SceneDef } from './schema';
import { activeCameraAt, actorStateAt, cameraStateAt, type CameraState } from './timeline';

const DEFAULT_HEIGHT = 1.7;
const CAMERA_COLORS = ['#ff5a5f', '#2db37a', '#e0a800', '#7a5af8', '#00a3c4'];
const PATH_SAMPLES = 80;
/** Bảng màu mô hình trắng: bối cảnh và đồ vật xám, nhân vật xanh, viền xám đậm */
const CLAY = { surface: '#d9dce1', character: '#2f5fd8', edge: '#6f7680', ground: '#cfd3d9' };
const EDGE_ANGLE = 30;
/** Chiều cao nhãn theo tỉ lệ chiều cao khung hình (cố định trên màn hình, không phóng to khi máy lại gần) */
const LABEL_SCREEN_HEIGHT = 0.035;
/** Độ dài khung nhìn vẽ trước máy quay (m) */
const FRUSTUM_LENGTH = 1.4;
/** Khoảng lùi nhãn ra sau máy quay (m) */
const LABEL_BEHIND_CAMERA = 0.6;
/** Đường đi của nhân vật trên sơ đồ */
const ACTOR_PATH_COLOR = '#4f86ff';
const ACTOR_PATH_RADIUS = 0.05;
/** Khối có đáy cao hơn mức này (mái hiên, đèn treo) bị ẩn ở góc sơ đồ từ trên để không che bên dưới */
const OVERHEAD_MIN_Y = 1.8;
/** Khoảng trống quanh nội dung trên sơ đồ (m) và kích thước tối thiểu */
const PLAN_PADDING = 2.5;
const PLAN_MIN_SPAN = 6;

type MaterialRole = 'character' | 'prop' | 'block';

/** 'shots' = theo danh sách cắt cảnh; 'plan' = sơ đồ nhìn từ trên; còn lại là id một camera cố định */
export type ViewMode = 'shots' | 'plan' | (string & {});

interface TextSprite {
  sprite: THREE.Sprite;
  setText: (text: string) => void;
}

/** Máy quay vẽ trong cảnh: thân máy + khung nhìn theo tiêu cự + nhãn, kèm quỹ đạo và đường ngắm */
interface CameraHelper {
  id: string;
  name: string;
  /** Thân máy và khung nhìn, đặt tại vị trí camera, hướng +Z về điểm nhìn */
  rig: THREE.Group;
  frustum: THREE.LineSegments;
  label: TextSprite;
  /** Đường đi của camera (toạ độ thế giới, cố định) */
  path: THREE.Line;
  /** Đường ngắm từ camera tới điểm nhìn, cập nhật mỗi lần seek */
  aim: THREE.Line;
}

type VisibilityMode = 'scene' | 'plan' | 'thumb';

interface Rig {
  actor: Actor;
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  /** Pose thủ tục cho hình khối thay thế */
  pose?: (clip: string, localT: number) => void;
  activeClip?: string;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 500);
  readonly warnings: string[] = [];
  /** false = để người dùng tự xoay camera (OrbitControls), seek không ghi đè camera */
  followSceneCamera = true;
  /** Góc nhìn chính: theo shots hoặc một camera cố định */
  viewMode: ViewMode = 'shots';
  /** Hiện đường đi và vị trí các camera trong cảnh */
  showCameraPaths = false;
  /** Camera đang lên hình ở lần seek gần nhất */
  activeCameraId = '';
  /** Trạng thái từng camera ở lần seek gần nhất (để UI hiện tiêu cự) */
  readonly cameraStates = new Map<string, CameraState>();
  /** Hiện nhãn tên trên đầu nhân vật/vật thể (cả khi export) */
  showLabels = true;
  private labels: THREE.Sprite[] = [];
  /** Nhãn khối bối cảnh: chỉ hiện ở sơ đồ */
  private blockLabels: THREE.Sprite[] = [];
  private overheadBlocks: THREE.Object3D[] = [];
  private actorPaths: THREE.Object3D[] = [];
  private readonly planCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  private allSprites: THREE.Sprite[] = [];
  private labelFactor = 1;
  private rigs: Rig[] = [];
  private views = new Map<string, THREE.PerspectiveCamera>();
  private helpers: CameraHelper[] = [];
  private width = 16;
  private height = 9;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly def: SceneDef,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(def.background);
    // Mô hình trắng cần ánh sáng đều (bóng nhẹ) để AI video đọc rõ hình khối; chế độ màu thì nắng gắt hơn.
    const clay = def.style === 'clay';
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, clay ? 2.2 : 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, clay ? 0.7 : 1.6);
    sun.position.set(6, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 40 });
    this.scene.add(sun);
    if (def.ground) {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ color: this.clay ? CLAY.ground : 0xc9d1da, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);
      this.scene.add(new THREE.GridHelper(60, 60, 0x9aa5b1, 0xb4bdc7));
    }
    for (const block of def.environment.blocks) this.scene.add(this.buildBlock(block));
    def.cameras.forEach((cam, i) => {
      this.views.set(cam.id, new THREE.PerspectiveCamera(cam.fov, 16 / 9, 0.05, 500));
      this.helpers.push(this.buildHelper(cam.id, cam.label ?? cam.id, CAMERA_COLORS[i % CAMERA_COLORS.length]));
    });
    for (const actor of def.actors) {
      const path = this.buildActorPath(actor);
      if (path) this.actorPaths.push(path);
    }
  }

  private get clay(): boolean {
    return this.def.style === 'clay';
  }

  static colorOf(def: SceneDef, cameraId: string): string {
    const i = def.cameras.findIndex((c) => c.id === cameraId);
    return CAMERA_COLORS[Math.max(0, i) % CAMERA_COLORS.length];
  }

  setSize(width: number, height: number): void {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.width = width;
    this.height = height;
    for (const cam of [this.camera, ...this.views.values()]) {
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
    }
    this.fitPlanCamera(width / height);
  }

  async load(manifest: Manifest, baseUrl = '/models/'): Promise<void> {
    const loader = new GLTFLoader();
    for (const actor of this.def.actors) {
      const entry = manifest.models.find((m) => m.id === actor.model);
      if (!entry) continue;
      const rig = await this.buildRig(actor, entry, loader, baseUrl);
      if (actor.label) {
        const top = new THREE.Box3().setFromObject(rig.root).max.y;
        rig.root.add(this.buildLabel(actor.label, top));
      }
      this.rigs.push(rig);
      this.scene.add(rig.root);
    }
    this.seek(0);
  }

  seek(t: number): void {
    for (const rig of this.rigs) {
      const s = actorStateAt(rig.actor, t);
      rig.root.position.set(...s.pos);
      rig.root.rotation.y = s.yaw;
      this.applyClip(rig, s.clip, t - s.clipStart);
    }
    this.activeCameraId = this.viewMode === 'shots' || this.viewMode === 'plan' ? activeCameraAt(this.def, t) : this.viewMode;
    if (!this.views.has(this.activeCameraId)) this.activeCameraId = this.def.cameras[0].id;
    const states = this.cameraStates;
    for (const cam of this.def.cameras) {
      const state = cameraStateAt(this.def, cam.id, t);
      states.set(cam.id, state);
      this.applyCameraState(this.views.get(cam.id)!, state);
    }
    if (this.followSceneCamera) this.applyCameraState(this.camera, states.get(this.activeCameraId)!);
    const aspect = this.def.size.width / this.def.size.height;
    for (const h of this.helpers) {
      const state = states.get(h.id)!;
      h.rig.position.set(...state.pos);
      h.rig.lookAt(...state.lookAt);
      h.frustum.geometry.setFromPoints(frustumPoints(state.fov, aspect));
      h.aim.geometry.setFromPoints([new THREE.Vector3(...state.pos), new THREE.Vector3(...state.lookAt)]);
      // Nhãn đặt sau lưng máy (ngược hướng nhìn) để không che thân máy và khung nhìn trên sơ đồ.
      const back = new THREE.Vector2(state.pos[0] - state.lookAt[0], state.pos[2] - state.lookAt[2]).normalize().multiplyScalar(LABEL_BEHIND_CAMERA);
      h.label.sprite.position.set(state.pos[0] + back.x, state.pos[1] + 0.3, state.pos[2] + back.y);
      h.label.setText(`${h.name} · ${Math.round(state.focal)}mm`);
    }
  }

  render(): void {
    const r = this.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.width, this.height);
    const plan = this.viewMode === 'plan' && this.followSceneCamera;
    this.applyVisibility(plan ? 'plan' : 'scene');
    r.render(this.scene, plan ? this.planCamera : this.camera);
  }

  /**
   * Vẽ ảnh xem trước của từng camera vào canvas 2D nhỏ.
   * Dùng chung renderer: vẽ vào góc trên trái của canvas WebGL rồi chép ngay sang canvas 2D (buffer WebGL chỉ còn tới khi compositor chạy),
   * nên phải gọi trước `render()` để khung chính vẽ đè lên sau cùng.
   */
  renderThumbnails(targets: Iterable<[cameraId: string, ctx: CanvasRenderingContext2D]>): void {
    const r = this.renderer;
    const source = r.domElement;
    r.setScissorTest(true);
    for (const [id, ctx] of targets) {
      const view = id === 'plan' ? this.planCamera : this.views.get(id);
      if (!view) continue;
      this.applyVisibility(id === 'plan' ? 'plan' : 'thumb');
      const w = Math.min(ctx.canvas.width, this.width);
      const h = Math.min(ctx.canvas.height, this.height);
      r.setViewport(0, this.height - h, w, h);
      r.setScissor(0, this.height - h, w, h);
      r.render(this.scene, view);
      ctx.drawImage(source, 0, 0, w, h, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, this.width, this.height);
  }

  dispose(): void {
    this.renderer.dispose();
  }

  private material(role: MaterialRole, color?: string): THREE.MeshStandardMaterial {
    if (this.clay) {
      return new THREE.MeshStandardMaterial({ color: role === 'character' ? CLAY.character : CLAY.surface, roughness: 0.9 });
    }
    return new THREE.MeshStandardMaterial({ color: color ?? '#8899aa', roughness: 0.7 });
  }

  /** Viền cạnh cho khối (chỉ ở chế độ mô hình trắng), giúp AI video đọc được hình khối. */
  private withEdges(mesh: THREE.Mesh): THREE.Mesh {
    if (this.clay) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE),
        new THREE.LineBasicMaterial({ color: CLAY.edge }),
      );
      mesh.add(edges);
    }
    return mesh;
  }

  private buildBlock(block: Block): THREE.Object3D {
    const [sx, sy, sz] = block.size;
    let geo: THREE.BufferGeometry;
    if (block.shape === 'sphere') geo = new THREE.SphereGeometry(sx / 2, 32, 16).translate(0, sx / 2, 0);
    else if (block.shape === 'cylinder') geo = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 32).translate(0, sy / 2, 0);
    else geo = new THREE.BoxGeometry(sx, sy, sz).translate(0, sy / 2, 0);
    const mesh = this.withEdges(new THREE.Mesh(geo, this.material('block', block.color)));
    mesh.name = block.id ?? block.label ?? 'block';
    mesh.position.set(...block.pos);
    mesh.rotation.y = (block.yaw * Math.PI) / 180;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (block.pos[1] >= OVERHEAD_MIN_Y) this.overheadBlocks.push(mesh);
    else if (block.label) {
      const { sprite } = this.textSprite(block.label, 'rgba(90,96,106,0.85)', LABEL_SCREEN_HEIGHT * 0.8);
      sprite.position.set(block.pos[0], block.pos[1] + sy + 0.05, block.pos[2]);
      sprite.visible = false;
      this.blockLabels.push(sprite);
      this.scene.add(sprite);
    }
    return mesh;
  }

  /** Nhãn chữ luôn quay về phía camera, cỡ cố định trên màn hình; `setText` vẽ lại khi chữ đổi. */
  private textSprite(text: string, background = 'rgba(20,22,26,0.85)', screenHeight = LABEL_SCREEN_HEIGHT): TextSprite {
    const font = 48;
    const pad = 18;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, sizeAttenuation: false }));
    sprite.renderOrder = 20;
    let current = '';
    const setText = (next: string) => {
      if (next === current) return;
      current = next;
      ctx.font = `600 ${font}px system-ui, sans-serif`;
      c.width = Math.ceil(ctx.measureText(next).width) + pad * 2;
      c.height = font + pad;
      ctx.font = `600 ${font}px system-ui, sans-serif`;
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(0, 0, c.width, c.height, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(next, pad, c.height / 2 + 2);
      // Kích thước canvas đổi nên phải tạo texture mới thay vì chỉ needsUpdate.
      texture.dispose();
      sprite.material.map = new THREE.CanvasTexture(c);
      sprite.material.map.colorSpace = THREE.SRGBColorSpace;
      sprite.material.needsUpdate = true;
      sprite.userData.base = new THREE.Vector2((screenHeight * c.width) / c.height, screenHeight);
      this.applyLabelScale(sprite);
    };
    setText(text);
    this.allSprites.push(sprite);
    return { sprite, setText };
  }

  /**
   * Sprite `sizeAttenuation: false` tự giữ cỡ trên màn hình với camera phối cảnh, nhưng với camera trực giao (sơ đồ)
   * scale được hiểu theo mét, nên nhân thêm chiều cao khung sơ đồ để nhãn vẫn chiếm cùng tỉ lệ màn hình.
   */
  private applyLabelScale(sprite: THREE.Sprite): void {
    const base = sprite.userData.base as THREE.Vector2 | undefined;
    if (base) sprite.scale.set(base.x * this.labelFactor, base.y * this.labelFactor, 1);
  }

  private setLabelFactor(factor: number): void {
    if (factor === this.labelFactor) return;
    this.labelFactor = factor;
    for (const sprite of this.allSprites) this.applyLabelScale(sprite);
  }

  private buildLabel(text: string, top: number): THREE.Sprite {
    const { sprite } = this.textSprite(text);
    sprite.position.y = top + 0.25;
    this.labels.push(sprite);
    return sprite;
  }

  private applyCameraState(cam: THREE.PerspectiveCamera, c: CameraState): void {
    cam.position.set(...c.pos);
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(...c.lookAt);
  }

  /**
   * scene: khung chính (máy quay hiện theo công tắc, ẩn máy đang lên hình vì đang nhìn từ trong nó);
   * plan: sơ đồ từ trên (hiện mọi máy quay, đường đi, nhãn khối; ẩn khối treo cao);
   * thumb: ảnh xem trước của từng góc (không vẽ máy quay).
   */
  private applyVisibility(mode: VisibilityMode): void {
    const showCams = mode === 'plan' || (mode === 'scene' && this.showCameraPaths);
    const hiddenId = mode === 'scene' && this.followSceneCamera ? this.activeCameraId : undefined;
    for (const h of this.helpers) {
      const own = h.id === hiddenId;
      h.rig.visible = h.aim.visible = h.label.sprite.visible = showCams && !own;
      h.path.visible = showCams;
    }
    for (const p of this.actorPaths) p.visible = showCams;
    for (const l of this.blockLabels) l.visible = mode === 'plan';
    for (const b of this.overheadBlocks) b.visible = mode !== 'plan';
    for (const l of this.labels) l.visible = this.showLabels || mode === 'plan';
    this.setLabelFactor(mode === 'plan' ? this.planCamera.top - this.planCamera.bottom : 1);
  }

  /** Khung nhìn từ trên xuống, ôm trọn vị trí nhân vật và máy quay; -Z (phía sâu trong ảnh gốc) hướng lên trên. */
  private fitPlanCamera(aspect: number): void {
    const xs: number[] = [];
    const zs: number[] = [];
    for (const a of this.def.actors) for (const k of a.keys) xs.push(k.pos[0]), zs.push(k.pos[2]);
    for (const c of this.def.cameras) for (const k of c.keys) xs.push(k.pos[0]), zs.push(k.pos[2]);
    const minX = Math.min(...xs) - PLAN_PADDING;
    const maxX = Math.max(...xs) + PLAN_PADDING;
    const minZ = Math.min(...zs) - PLAN_PADDING;
    const maxZ = Math.max(...zs) + PLAN_PADDING;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    let halfW = Math.max(PLAN_MIN_SPAN, maxX - minX) / 2;
    let halfH = Math.max(PLAN_MIN_SPAN, maxZ - minZ) / 2;
    if (halfW / halfH > aspect) halfH = halfW / aspect;
    else halfW = halfH * aspect;
    const cam = this.planCamera;
    Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    cam.position.set(cx, 100, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, 0, cz);
    cam.updateProjectionMatrix();
  }

  /** Máy quay: thân + ống kính + khung nhìn (theo fov và tỉ lệ khung cảnh) + nhãn "tên · mm". */
  private buildHelper(id: string, name: string, color: string): CameraHelper {
    const lineMaterial = new THREE.LineBasicMaterial({ color, depthTest: false });
    const bodyMaterial = new THREE.MeshBasicMaterial({ color });
    const rig = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.32).translate(0, 0, -0.16), bodyMaterial);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.12, 20).rotateX(Math.PI / 2).translate(0, 0, 0.06), bodyMaterial);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16).translate(0, 0.12, -0.16), bodyMaterial);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.24, 0.18, 0.32).translate(0, 0, -0.16)),
      new THREE.LineBasicMaterial({ color: '#111' }),
    );
    const frustum = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    rig.add(body, lens, top, edges, frustum);
    const aim = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);

    const cam = this.def.cameras.find((c) => c.id === id)!;
    const start = cam.keys[0].t;
    const span = cam.keys[cam.keys.length - 1].t - start;
    const points = Array.from({ length: PATH_SAMPLES + 1 }, (_, i) => {
      const p = cameraStateAt(this.def, id, start + (span * i) / PATH_SAMPLES).pos;
      return new THREE.Vector3(...p);
    });
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    const label = this.textSprite(name, color);

    for (const o of [rig, aim, path, label.sprite]) {
      o.visible = false;
      o.renderOrder = o === label.sprite ? 21 : 10;
      this.scene.add(o);
    }
    return { id, name, rig, frustum, label, path, aim };
  }

  /** Đường đi trên sàn + mũi tên ở điểm cuối, cho nhân vật/vật thể có di chuyển. */
  private buildActorPath(actor: Actor): THREE.Object3D | undefined {
    const start = actor.keys[0].t;
    const end = actor.keys[actor.keys.length - 1].t;
    const points = Array.from({ length: PATH_SAMPLES + 1 }, (_, i) => {
      const [x, , z] = actorStateAt(actor, start + ((end - start) * i) / PATH_SAMPLES).pos;
      return new THREE.Vector3(x, 0.03, z);
    });
    const a = points[0];
    const b = points[points.length - 1];
    if (a.distanceTo(b) < 0.05 && points.every((p) => p.distanceTo(a) < 0.05)) return undefined;
    const group = new THREE.Group();
    // Ống dày thay cho nét 1px để nhìn rõ trên sơ đồ và trong video.
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), PATH_SAMPLES, ACTOR_PATH_RADIUS, 8);
    group.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: ACTOR_PATH_COLOR, depthTest: false })));
    // Mũi tên theo hướng đoạn cuối có di chuyển.
    const tail = [...points].reverse().find((p) => p.distanceTo(b) > 0.05) ?? a;
    const dir = b.clone().sub(tail).normalize();
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.4, 16).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ACTOR_PATH_COLOR, depthTest: false }),
    );
    arrow.position.copy(b);
    arrow.lookAt(b.clone().add(dir));
    group.add(arrow);
    group.visible = false;
    group.renderOrder = 10;
    this.scene.add(group);
    return group;
  }

  private applyClip(rig: Rig, clip: string, localT: number): void {
    if (rig.pose) {
      rig.pose(clip, localT);
      return;
    }
    if (!rig.mixer) return;
    const action = rig.actions.get(clip);
    if (!action) return;
    if (rig.activeClip !== clip) {
      for (const a of rig.actions.values()) a.stop();
      action.reset().play();
      rig.activeClip = clip;
    }
    // Đặt thời gian tuyệt đối để seek ngược/xuôi đều đúng; mixer.update(0) áp pose.
    action.time = localT % Math.max(action.getClip().duration, 1e-3);
    rig.mixer.update(0);
  }

  private async buildRig(actor: Actor, entry: ManifestEntry, loader: GLTFLoader, baseUrl: string): Promise<Rig> {
    const root = new THREE.Group();
    root.name = actor.id;
    const targetHeight = actor.height ?? entry.height ?? DEFAULT_HEIGHT;

    if (entry.file) {
      try {
        const gltf = await loader.loadAsync(baseUrl + entry.file);
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        if (h > 0) model.scale.setScalar(targetHeight / h);
        const scaled = new THREE.Box3().setFromObject(model);
        model.position.y -= scaled.min.y;
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (this.clay) mesh.material = this.material(entry.kind === 'character' ? 'character' : 'prop');
          }
        });
        root.add(model);
        const rig: Rig = { actor, root, actions: new Map() };
        if (gltf.animations.length > 0) {
          rig.mixer = new THREE.AnimationMixer(model);
          for (const clip of gltf.animations) rig.actions.set(clip.name, rig.mixer.clipAction(clip));
          for (const [alias, real] of Object.entries(entry.clips ?? {})) {
            const action = rig.actions.get(real);
            if (action) rig.actions.set(alias, action);
            else this.warnings.push(`"${entry.id}": không thấy clip "${real}" trong file glb`);
          }
        }
        return rig;
      } catch (e) {
        this.warnings.push(`Không tải được ${entry.file} (${e instanceof Error ? e.message : String(e)}), dùng hình khối thay thế`);
      }
    }
    return this.buildFallback(actor, entry, root, targetHeight);
  }

  private buildFallback(actor: Actor, entry: ManifestEntry, root: THREE.Group, height: number): Rig {
    const fb = entry.fallback ?? { shape: entry.kind === 'character' ? 'humanoid' : 'box', size: [1, 1, 1] as [number, number, number], color: '#8899aa' };
    const mat = this.material(fb.shape === 'humanoid' ? 'character' : 'prop', fb.color);
    const mesh = (geo: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const rig: Rig = { actor, root, actions: new Map() };

    if (fb.shape === 'humanoid') {
      const k = height / DEFAULT_HEIGHT;
      const torso = mesh(new THREE.BoxGeometry(0.42 * k, 0.6 * k, 0.24 * k));
      torso.position.y = 1.15 * k;
      const head = mesh(new THREE.SphereGeometry(0.13 * k, 24, 16));
      head.position.y = 1.62 * k;
      const limb = (w: number, len: number, x: number, y: number) => {
        const pivot = new THREE.Group();
        pivot.position.set(x * k, y * k, 0);
        const m = mesh(new THREE.BoxGeometry(w * k, len * k, w * k));
        m.position.y = (-len / 2) * k;
        pivot.add(m);
        return pivot;
      };
      const armL = limb(0.1, 0.55, -0.27, 1.42);
      const armR = limb(0.1, 0.55, 0.27, 1.42);
      const legL = limb(0.14, 0.85, -0.11, 0.85);
      const legR = limb(0.14, 0.85, 0.11, 0.85);
      root.add(torso, head, armL, armR, legL, legR);
      rig.pose = (clip, t) => {
        const freq = clip === 'run' ? 3.2 : 1.8;
        const amp = clip === 'run' ? 0.9 : clip === 'walk' ? 0.55 : 0;
        const s = Math.sin(t * Math.PI * 2 * freq) * amp;
        legL.rotation.x = s;
        legR.rotation.x = -s;
        armL.rotation.x = -s * 0.8;
        armR.rotation.x = s * 0.8;
        armR.rotation.z = 0;
        if (clip === 'wave') armR.rotation.set(0, 0, Math.PI * 0.85 + Math.sin(t * 9) * 0.3);
        torso.position.y = 1.15 * k + (clip === 'idle' ? Math.sin(t * 2) * 0.004 : Math.abs(Math.sin(t * Math.PI * 2 * freq)) * 0.03 * k);
      };
    } else {
      const [sx, sy, sz] = fb.size;
      let m: THREE.Mesh;
      if (fb.shape === 'sphere') m = mesh(new THREE.SphereGeometry(sx / 2, 32, 16));
      else if (fb.shape === 'cylinder') m = mesh(new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 32));
      else m = mesh(new THREE.BoxGeometry(sx, sy, sz));
      m.position.y = fb.shape === 'sphere' ? sx / 2 : sy / 2;
      root.add(this.withEdges(m));
    }
    return rig;
  }
}

/** 4 cạnh từ tâm máy tới các góc khung + khung chữ nhật ở cuối, hướng +Z (hướng nhìn sau `lookAt`). */
function frustumPoints(fov: number, aspect: number): THREE.Vector3[] {
  const hh = Math.tan((fov * Math.PI) / 360) * FRUSTUM_LENGTH;
  const hw = hh * aspect;
  const o = new THREE.Vector3(0, 0, 0);
  const c = [
    new THREE.Vector3(-hw, -hh, FRUSTUM_LENGTH),
    new THREE.Vector3(hw, -hh, FRUSTUM_LENGTH),
    new THREE.Vector3(hw, hh, FRUSTUM_LENGTH),
    new THREE.Vector3(-hw, hh, FRUSTUM_LENGTH),
  ];
  // Vạch nhỏ trên cạnh trên cho biết chiều "lên" của khung hình.
  const up = [new THREE.Vector3(-hw * 0.3, hh, FRUSTUM_LENGTH), new THREE.Vector3(0, hh * 1.3, FRUSTUM_LENGTH), new THREE.Vector3(hw * 0.3, hh, FRUSTUM_LENGTH)];
  return [o, c[0], o, c[1], o, c[2], o, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0], up[0], up[1], up[1], up[2]];
}
