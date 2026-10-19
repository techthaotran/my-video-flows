import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { strings } from '@/shared/strings';
import { ManifestSchema, SceneSchema, validateScene, type Manifest, type SceneDef } from '@/studio3d/schema';
import { Stage, type ViewMode } from '@/studio3d/stage';
import { shotSpans, type ShotSpan } from '@/studio3d/timeline';
import { exportMp4, exportPlanPng } from '@/studio3d/exporter';

const files = import.meta.glob('./scenes/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('stage');
const select = $<HTMLSelectElement>('scenes');
const play = $<HTMLButtonElement>('play');
const timeline = $('timeline');
const segments = $('segments');
const playhead = $('playhead');
const timeEl = $('time');
const badge = $('badge');
const refImg = $<HTMLImageElement>('refImg');
const cams = $('cams');
const shotsList = $('shots');
const notesBox = $<HTMLDetailsElement>('notesBox');
const free = $<HTMLInputElement>('free');
const paths = $<HTMLInputElement>('paths');
const labels = $<HTMLInputElement>('labels');
const ref = $<HTMLInputElement>('ref');
const refRow = $('refRow');
const refSub = $('refSub');
const refOpacity = $<HTMLInputElement>('refOpacity');
const refOpacityValue = $<HTMLOutputElement>('refOpacityValue');
const approve = $<HTMLInputElement>('approve');
const exportBtn = $<HTMLButtonElement>('export');
const planBtn = $<HTMLButtonElement>('planPng');
const exportTarget = $('exportTarget');
const messages = $('messages');
const status = $('status');

const texts: Record<string, string> = {
  title: strings.studio3dTitle,
  hCams: strings.studio3dSectionCameras,
  hScript: strings.studio3dSectionScript,
  hDisplay: strings.studio3dSectionDisplay,
  hExport: strings.studio3dSectionExport,
  notesLabel: strings.studio3dNotes,
  freeLabel: strings.studio3dFreeCamera,
  pathsLabel: strings.studio3dShowPaths,
  labelsLabel: strings.studio3dShowLabels,
  refLabel: strings.studio3dReference,
  refOpacityLabel: strings.studio3dReferenceOpacity,
  approveLabel: strings.studio3dApprove,
  export: strings.studio3dExport,
  planPng: strings.studio3dDownloadPlan,
  shortcuts: strings.studio3dShortcuts,
};
for (const [id, text] of Object.entries(texts)) $(id).textContent = text;

interface CamCard {
  /** 'shots', 'plan' hoặc id camera */
  id: ViewMode;
  el: HTMLButtonElement;
  ctx: CanvasRenderingContext2D;
  mm: HTMLElement;
}

let stage: Stage | undefined;
let controls: OrbitControls | undefined;
let def: SceneDef | undefined;
let manifest: Manifest;
let spans: ShotSpan[] = [];
let cards: CamCard[] = [];
let view: ViewMode = 'shots';
let playing = false;
let t = 0;
let last = 0;

function show(kind: 'err' | 'warn', title: string, lines: string[]) {
  if (lines.length === 0) return;
  const pre = document.createElement('pre');
  pre.className = kind;
  pre.textContent = `${title}\n- ${lines.join('\n- ')}`;
  messages.appendChild(pre);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Tên file tải về lấy theo tên file cảnh (ASCII), tiêu đề tiếng Việt có dấu sẽ thành tên file khó đọc. */
function sceneSlug(): string {
  return select.value.replace(/^.*\//, '').replace(/\.json$/, '') || 'studio3d';
}

function viewName(id: ViewMode): string {
  if (id === 'shots') return strings.studio3dViewShots;
  if (id === 'plan') return strings.studio3dViewPlan;
  return cameraName(id);
}

function cameraName(id: string): string {
  return def?.cameras.find((c) => c.id === id)?.label ?? id;
}

function focalOf(id: string): number {
  return stage?.cameraStates.get(id)?.focal ?? 0;
}

function colorOf(id: string): string {
  return def ? Stage.colorOf(def, id) : '#888';
}

function fit() {
  if (!stage || !def) return;
  const wrap = $('stageWrap');
  const scale = Math.min(wrap.clientWidth / def.size.width, wrap.clientHeight / def.size.height);
  stage.setSize(Math.max(1, Math.floor(def.size.width * scale)), Math.max(1, Math.floor(def.size.height * scale)));
  sizeThumbnails();
}

/** Canvas thumbnail theo đúng tỉ lệ khung cảnh và bề rộng thẻ (không vượt canvas chính, nơi thumbnail được vẽ trước khi chép). */
function sizeThumbnails() {
  if (!def) return;
  for (const card of cards) {
    const w = Math.max(1, Math.floor(card.el.clientWidth - 8));
    card.ctx.canvas.width = w;
    card.ctx.canvas.height = Math.max(1, Math.round((w * def.size.height) / def.size.width));
  }
}

function buildCards(d: SceneDef) {
  cams.classList.toggle('portrait', d.size.width < d.size.height);
  const ids: ViewMode[] = ['shots', 'plan', ...d.cameras.map((c) => c.id)];
  cards = ids.map((id) => {
    const button = el('button', 'cam');
    button.type = 'button';
    const thumb = el('div', 'thumb');
    const c = el('canvas');
    thumb.append(c, el('span', 'live', strings.studio3dOnAir));
    const name = el('div', 'name');
    if (id !== 'shots' && id !== 'plan') {
      const dot = el('i', 'dot');
      dot.style.background = colorOf(id);
      name.append(dot);
    }
    name.append(el('span', undefined, viewName(id)));
    const mm = el('div', 'mm');
    button.append(thumb, name, mm);
    button.onclick = () => setView(id);
    return { id, el: button, ctx: c.getContext('2d')!, mm };
  });
  cams.replaceChildren(...cards.map((c) => c.el));
}

function buildScript(d: SceneDef) {
  spans = shotSpans(d);
  segments.replaceChildren(
    ...spans.map((s) => {
      const seg = el('div', 'seg', cameraName(s.camera));
      seg.style.left = `${(s.from / d.duration) * 100}%`;
      seg.style.width = `${((s.to - s.from) / d.duration) * 100}%`;
      seg.style.background = colorOf(s.camera);
      return seg;
    }),
  );
  const items = spans.map((s) => {
    const li = el('li');
    const button = el('button', 'shot');
    button.type = 'button';
    const bar = el('i', 'bar');
    bar.style.background = colorOf(s.camera);
    const head = el('div', 'head');
    head.append(el('span', undefined, cameraName(s.camera)), el('span', 'range', strings.studio3dShotRange(s.from, s.to)));
    button.append(bar, head, el('div', 'note', s.note ?? ''));
    button.onclick = () => {
      setView('shots');
      seekTo(s.from);
    };
    li.append(button);
    return li;
  });
  if (d.shots.length === 0) items.push(el('li', 'hint', strings.studio3dNoShots));
  shotsList.replaceChildren(...items);
  $('notes').textContent = d.notes ?? '';
  notesBox.style.display = d.notes ? '' : 'none';
}

function setView(next: ViewMode) {
  view = next;
  if (stage) stage.viewMode = next;
  for (const card of cards) card.el.classList.toggle('selected', card.id === next);
  exportTarget.textContent = strings.studio3dExportTarget(viewName(next));
  render();
}

function refreshExport() {
  exportBtn.disabled = !approve.checked || !def;
  exportBtn.title = approve.checked ? '' : strings.studio3dExportNeedApprove;
}

function setPlaying(value: boolean) {
  playing = value;
  play.textContent = value ? strings.studio3dPause : strings.studio3dPlay;
  last = performance.now();
}

function seekTo(time: number) {
  if (!def) return;
  setPlaying(false);
  t = Math.min(def.duration, Math.max(0, time));
  render();
}

function applyDisplay() {
  if (!stage) return;
  stage.showCameraPaths = paths.checked;
  stage.showLabels = labels.checked;
  stage.followSceneCamera = !free.checked;
  if (controls) controls.enabled = free.checked;
  refImg.style.display = ref.checked ? 'block' : 'none';
  refSub.style.display = ref.checked ? '' : 'none';
  refImg.style.opacity = String(Number(refOpacity.value) / 100);
  refOpacityValue.textContent = `${refOpacity.value}%`;
}

async function openScene(key: string) {
  stage?.dispose();
  controls?.dispose();
  stage = def = controls = undefined;
  messages.replaceChildren();
  status.textContent = '';
  approve.checked = false;
  free.checked = false;
  ref.checked = false;
  setPlaying(false);
  t = 0;

  const parsed = SceneSchema.safeParse(files[key]);
  const errors = parsed.success
    ? validateScene(parsed.data, manifest)
    : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  if (!parsed.success || errors.length > 0) {
    show('err', strings.studio3dInvalid, errors);
    cams.replaceChildren();
    shotsList.replaceChildren();
    segments.replaceChildren();
    refreshExport();
    return;
  }
  def = parsed.data;
  stage = new Stage(canvas, def);
  await stage.load(manifest);
  show('warn', strings.studio3dWarnings, stage.warnings);
  controls = new OrbitControls(stage.camera, canvas);
  refRow.style.display = def.reference ? '' : 'none';
  if (def.reference) {
    refImg.src = `/${def.reference.image}`;
    refOpacity.value = String(Math.round(def.reference.opacity * 100));
  }
  buildCards(def);
  buildScript(def);
  applyDisplay();
  fit();
  setView('shots');
  refreshExport();
}

function render() {
  if (!stage || !def) return;
  stage.seek(t);
  stage.renderThumbnails(cards.map((c) => [c.id === 'shots' ? stage!.activeCameraId : c.id, c.ctx] as [string, CanvasRenderingContext2D]));
  if (controls?.enabled) controls.update();
  stage.render();

  const active = stage.activeCameraId;
  for (const card of cards) {
    const camId = card.id === 'shots' ? active : card.id;
    card.mm.textContent =
      card.id === 'shots' || card.id === 'plan'
        ? strings.studio3dCameraBadge(cameraName(active), focalOf(active))
        : `${Math.round(focalOf(camId))}mm`;
    card.el.classList.toggle('on-air', card.id === active);
  }
  badge.style.display = stage.followSceneCamera && view !== 'plan' ? '' : 'none';
  const dot = el('i', 'dot');
  dot.style.background = colorOf(active);
  badge.replaceChildren(dot, el('span', undefined, strings.studio3dCameraBadge(cameraName(active), focalOf(active))));

  const current = spans.findIndex((s, i) => t < s.to || i === spans.length - 1);
  [...segments.children].forEach((seg, i) => seg.classList.toggle('active', i === current));
  [...shotsList.querySelectorAll('.shot')].forEach((item, i) => item.classList.toggle('active', i === current));
  playhead.style.left = `${(t / def.duration) * 100}%`;
  timeEl.textContent = `${t.toFixed(2)} / ${def.duration.toFixed(2)}s`;
}

function tick(now: number) {
  if (playing && def) {
    t += (now - last) / 1000;
    if (t >= def.duration) {
      t = def.duration;
      setPlaying(false);
    }
    render();
  } else if (controls?.enabled) {
    render();
  }
  last = now;
  requestAnimationFrame(tick);
}

function togglePlay() {
  if (!def) return;
  if (!playing && t >= def.duration) t = 0;
  setPlaying(!playing);
}

play.onclick = togglePlay;

// Timeline: bấm hoặc kéo để tua
function seekFromPointer(e: PointerEvent) {
  if (!def) return;
  const box = timeline.getBoundingClientRect();
  seekTo(((e.clientX - box.left) / box.width) * def.duration);
}
timeline.addEventListener('pointerdown', (e) => {
  timeline.setPointerCapture(e.pointerId);
  seekFromPointer(e);
});
timeline.addEventListener('pointermove', (e) => {
  if (timeline.hasPointerCapture(e.pointerId)) seekFromPointer(e);
});

ref.addEventListener('change', () => {
  // Ảnh gốc chỉ khớp khi nhìn qua camera tái tạo góc chụp.
  const cam = def?.reference?.camera;
  if (ref.checked && cam) setView(cam);
});
for (const input of [paths, labels, free, ref]) {
  input.addEventListener('change', () => {
    applyDisplay();
    render();
  });
}
refOpacity.oninput = () => applyDisplay();
approve.onchange = refreshExport;
select.onchange = () => void openScene(select.value);
window.onresize = () => {
  fit();
  render();
};

window.addEventListener('keydown', (e) => {
  if (!def || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
  if (e.key === ' ') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    seekTo(t + (e.key === 'ArrowLeft' ? -1 : 1) / def.fps);
  } else if (/^[0-9]$/.test(e.key)) {
    const n = Number(e.key);
    if (n === 0) setView('shots');
    else if (def.cameras[n - 1]) setView(def.cameras[n - 1].id);
  } else if (e.key === 'p' || e.key === 'P') {
    setView('plan');
  }
});

exportBtn.onclick = async () => {
  if (!def || !approve.checked) return;
  exportBtn.disabled = true;
  setPlaying(false);
  try {
    const blob = await exportMp4(def, manifest, { view, showLabels: labels.checked }, (done, total) => {
      status.textContent = strings.studio3dExporting(done, total);
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sceneSlug()}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
    status.textContent = strings.studio3dExported;
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    refreshExport();
  }
};

planBtn.onclick = async () => {
  if (!def) return;
  planBtn.disabled = true;
  try {
    const blob = await exportPlanPng(def, manifest, t);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sceneSlug()}_so-do-may-quay.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    planBtn.disabled = false;
  }
};

async function boot() {
  const keys = Object.keys(files).sort();
  if (keys.length === 0) {
    show('err', strings.studio3dNoScenes, []);
    return;
  }
  manifest = ManifestSchema.parse(await (await fetch('/models/manifest.json')).json());
  for (const k of keys) select.add(new Option(k.replace('./scenes/', ''), k));
  requestAnimationFrame(tick);
  await openScene(keys[0]);
}
void boot();
