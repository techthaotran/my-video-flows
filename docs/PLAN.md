# Kế hoạch chi tiết: Extension chạy Workflow (node-based) trên Google Flow

> Tài liệu dựa trên phân tích sản phẩm tham chiếu **TobyFlow** (ảnh chụp side panel, trình soạn workflow, bảng chọn node).
> Không bao gồm ước lượng thời gian. Khi viết code, lộ trình được chia theo **milestone + tiêu chí hoàn thành**.

## 0. Quyết định đã chốt

| # | Chủ đề | Quyết định | Ảnh hưởng tới plan |
|---|---|---|---|
| 1 | Provider | **Google Flow + Gemini** | Chỉ có 2 driver: `flow`, `gemini`. Bỏ ChatGPT, GPT Image 2, Grok |
| 2 | Chia sẻ | **Không share, không cloud**. Workflow phải còn nguyên sau reload trang/trình duyệt | Bỏ tab Shared và backend. Lưu local bền vững (mục 4.4) |
| 3 | Gói / hạn mức | **Không** | Bỏ `FREE`, `Nâng cấp`, `Runs x/15`, `Nodes x/5`, bộ đếm footer, các nút bị khoá 🔒 |
| 4 | Tab khác | **Chỉ làm tab Workflow** | Bỏ Generate / Prompts / Tasks / Gallery / History |
| 5 | Phát hành | **Nội bộ** | Load unpacked hoặc tải file zip nội bộ. Không cần review Chrome Web Store hay privacy policy công khai |
| 6 | Ngôn ngữ | **Chỉ tiếng Việt** | Không dùng thư viện i18n, không có nút đổi ngôn ngữ. Chuỗi UI gom trong `src/shared/strings.ts` cho dễ sửa |
| 7 | Build / dev | **Vite + `@crxjs/vite-plugin`** | Hot reload side panel, editor, content script khi dev (mục 3.1). Không dùng WXT |
| 8 | Export / Import | **Bắt buộc** | Đặc tả chi tiết ở mục 4.5 |

---

## 1. Phân tích sản phẩm tham chiếu

### 1.1 Side panel (Chrome Side Panel)

| Khu vực | Thành phần quan sát được | Diễn giải chức năng |
|---|---|---|
| Header | Logo + tên + badge gói (`FREE`) | Nhận diện, trạng thái gói |
| Header icons | Record (●), Docs, Credit ($), Ngôn ngữ (🌐), Settings, Notifications | Ghi thao tác, hướng dẫn, số dư/credit, đổi ngôn ngữ (**không làm**), cài đặt, thông báo |
| Workspace selector | Dropdown `Sept 12` + nút `+` | **Workspace/Project**: gom workflow theo nhóm. Có thể gắn với project tương ứng trên Google Flow |
| Tab chính | `Generate`, `Workflow`, `Prompts`, `Tasks`, + 4 icon (Gallery, Assets, History, Logs — suy đoán) | Mỗi tab là một module. **Plan này tập trung vào tab Workflow** và các phần hạ tầng nó cần |
| Sub-tab Workflow | `Templates`, `Workflows`, `Shared` | Mẫu có sẵn, workflow của tôi, workflow được chia sẻ |
| Toolbar | Search, Refresh, Import (⬇), Filter `All (1)`, `Chạy tất cả`, `+ Thêm` | Tìm kiếm, đồng bộ lại, nhập file, lọc, chạy mọi workflow đang bật, tạo mới |
| Danh sách | Nhóm theo workspace (`SEPT 12 (1)` + nhãn `hiện tại`) | Mỗi nhóm có header, số lượng, workspace hiện hành được đánh dấu |
| Item workflow | Radio chọn, tên, `5 nodes`, `5 phút trước`, toggle bật/tắt, menu ⋮ | Chọn nhiều, số node, thời điểm cập nhật, bật/tắt tham gia "Chạy tất cả", menu hành động |
| Footer | `Nâng cấp`, bộ đếm `0/200` (prompts), `0/2` (tasks), `1/2` (workflows), `Max Speed`, toggle `Xóa watermark ảnh` | Hạn mức theo gói, chế độ chạy song song, hậu xử lý ảnh |

### 1.2 Workflow Editor (cửa sổ/tab riêng)

Mở trong **cửa sổ riêng** (`chrome.windows.create` với page của extension), không nằm trong side panel vì cần canvas lớn.

| Khu vực | Thành phần | Chức năng |
|---|---|---|
| Top bar trái | Tên workflow (sửa inline), toggle bật/tắt | Đổi tên, bật/tắt workflow |
| Top bar phải | `Runs 0/15`, `Nodes 5/5`, `Nâng cấp`, `Max Speed`, `Reset`, 🔒 Lock, `Lưu`, ✕ | Hạn mức lượt chạy/số node, chạy song song, xoá kết quả chạy, khoá canvas (chống sửa nhầm), lưu thủ công, đóng (cảnh báo nếu chưa lưu) |
| Toolbar dọc trái | `+` (thêm node), Select, Pan (✋), Note, Thêm ảnh/video, ▶ Run, Undo, Redo, Refresh/Reset kết quả, Auto-layout, Settings | Công cụ canvas |
| Toolbar dưới trái | Zoom in, `29%`, Zoom out, Reset view, Docs, Export (🔒 khoá theo gói), Share (🔒) | Điều khiển view, xuất và chia sẻ |
| Giữa dưới | `Căn giữa` | Fit view |
| Canvas | Lưới chấm, node, cạnh cong có màu theo kiểu dữ liệu | React Flow |
| Mini-map | Góc phải dưới | Điều hướng |

### 1.3 Bảng chọn node (Node Picker)

Popup có ô `Tìm node...`, phím tắt `↑↓ Di chuyển`, `Enter Chọn`, `Esc Đóng`. Mở khi bấm `+` hoặc thả một cạnh ra vùng trống.

| Node | Mô tả | Nhóm | Phạm vi |
|---|---|---|---|
| **Image/Video** | Upload hoặc gán ảnh/video tham chiếu | Input | ✅ |
| **Text** | Văn bản/prompt tĩnh, dùng để ghép qua `@slug` | Input | ✅ |
| **Prompt** | Gửi prompt tới LLM: nâng cấp prompt, phân tích ảnh, viết kịch bản, tóm tắt, dịch, brainstorm | LLM | ✅ (chỉ Gemini) |
| **Flow – Image/Video Generate** | Tạo ảnh/video trên Google Flow | Generate | ✅ |
| **Gemini – Image/Video Generate** | Tạo ảnh/video qua Gemini | Generate | ✅ |
| **GPT Image 2** | Tạo ảnh bằng ChatGPT | Generate | ❌ |
| **Grok – Images/Videos Generate** | Tạo ảnh/video bằng Grok | Generate | ❌ |
| **Auto Download** | Tự tải kết quả của node trước | Output | ✅ |
| **Note** | Ghi chú trên canvas, không thực thi | Annotation | ✅ |

### 1.4 Phân tích workflow mẫu "Google Flow Dancing motion control"

```
[Note] "*Pls replace the video node with the 10s reference video (no audio)"

[Image/Video: Video]  @video ───────────────(video)──┐
[Image/Video: Model Image] @image_xxx_1 ─(image)─────┤
[Prompt Assistant] ──────────────────────(text)──────┼──► [Flow – Image/Video Generate] ──► (video out)
   "Replace the character in the reference video     │                                   └► (image out)
    with the character from the provided reference   │
    image… face 100% identical… body movements,      │
    poses, timing follow the reference video…"       │
```

Rút ra:
- **Port có kiểu**: `image`, `video`, `text`, mỗi kiểu có icon và màu cạnh riêng. Chỉ được nối các port cùng kiểu.
- **Slug `@name`**: node media/text có nhãn slug (vàng) để prompt tham chiếu trong nội dung (`@video`, `@image_xxx_1`).
- Node Generate có **nhiều input** (image, text, video) và **nhiều output** (video, image/frame) → nối tiếp được với node sau (Auto Download, Extend…).
- Node hiển thị **preview kết quả** ngay trong node (video player hoặc ảnh), kèm footer tên provider (`Google Flow`).
- Node Prompt có footer chọn model và bộ đếm ký tự.
- Template kèm Note hướng dẫn người dùng thay input → **Template = workflow + chỉ dẫn**.

### 1.5 Kết luận yêu cầu

1. Workflow là **đồ thị có hướng không vòng (DAG)** gồm node và cạnh có kiểu dữ liệu, không phải danh sách bước tuyến tính.
2. Việc thực thi dựa trên **tự động hoá UI của Google Flow và Gemini** trong tab người dùng đã đăng nhập.
3. Lưu trữ **local, bền vững** gồm đồ thị, file media đính kèm, kết quả chạy; có workspace, template, import/export (không chia sẻ).

---

## 2. Phạm vi

### Trong phạm vi
- **Side panel – chỉ tab Workflow**: sub-tab Templates / Workflows, workspace, danh sách, tìm kiếm, lọc, bật/tắt, menu ⋮, Chạy tất cả, Thêm, Import, Settings, Notifications.
- **Editor**: canvas node graph, Node Picker, 6 node thực thi (Image/Video, Text, Prompt, Flow Generate, Gemini Generate, Auto Download) + Note; lưu/đóng/reset/lock/undo/redo/auto-layout; Export không khoá.
- **Provider**: Google Flow, Gemini (gemini.google.com).
- **Engine**: chạy toàn workflow, chạy một node, chạy từ một node, Chạy tất cả, Max Speed (song song), huỷ, retry, tự phục hồi.
- **Lưu trữ local bền vững** (IndexedDB): workflow, revision, draft, asset, template, run; backup/restore toàn bộ.
- **Export / Import workflow**: 1 hoặc nhiều workflow, cả workspace; file `.xflow.json` / `.xflow.zip` kèm media (mục 4.5).
- **Giao diện tiếng Việt** duy nhất.
- **Dev với Vite + @crxjs/vite-plugin** (hot reload).
- **Phân phối nội bộ**: build zip, hướng dẫn cài unpacked, cơ chế cập nhật phiên bản.

### Ngoài phạm vi
- ChatGPT, GPT Image 2, Grok.
- Tab Shared, link chia sẻ, đồng bộ cloud, backend, đăng nhập tài khoản riêng.
- Hệ thống gói/hạn mức (`FREE`, `Nâng cấp`, `Runs x/15`, `Nodes x/5`, `0/200`, `0/2`, `1/2`).
- Tab Generate / Prompts / Tasks / Gallery / History, nút Credit ($).
- Recorder (nút ●) — có thể xem xét sau.
- Đa ngôn ngữ / nút đổi ngôn ngữ (🌐).
- **"Xóa watermark ảnh"**: có thể vi phạm điều khoản của Google và quy định minh bạch nội dung AI.

---

## 3. Kiến trúc

```
┌──────────────────────────────── Chrome Extension (MV3) ─────────────────────────────────┐
│                                                                                         │
│  ┌─ Side Panel (React) ─────┐   ┌─ Editor Page (React, cửa sổ riêng) ─┐                │
│  │ WorkspaceSelector        │   │ TopBar / LeftToolbar / BottomBar    │                │
│  │ WorkflowList / Templates │   │ Canvas (React Flow) + NodePicker    │                │
│  │ RunAll / Import          │   │ Node components + Inspector         │                │
│  └───────────┬──────────────┘   └───────────────┬─────────────────────┘                │
│              │        typed messaging (chrome.runtime + Port)                           │
│              └──────────────────┬───────────────┘                                       │
│                                 ▼                                                       │
│  ┌─ Service Worker ─────────────────────────────────────────────────────────────┐      │
│  │ RunManager ── Scheduler (DAG) ── NodeExecutors registry                       │      │
│  │     │               │                    │                                    │      │
│  │ RunStore (persist)  Concurrency pool     ProviderRouter ── TabPool            │      │
│  │     │            (Max Speed = N tab)          │         (mở/tái sử dụng tab)  │      │
│  │ DownloadService (chrome.downloads)            │                               │      │
│  └───────────────────────────────────────────────┼───────────────────────────────┘      │
│                                                  ▼                                      │
│  ┌─ Content Scripts (mỗi provider một driver) ─────────────────────────────────────┐   │
│  │ flow.content.ts    → labs.google/fx/tools/flow                                   │   │
│  │ gemini.content.ts  → gemini.google.com                                           │   │
│  │ Dùng chung: dom-kit (waitFor, typeInto, click, uploadFile, observeResult)        │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  Storage: IndexedDB (Dexie) — workspaces, workflows, workflowRevisions, assets(Blob),   │
│           templates, runs, nodeRuns · chrome.storage.local — settings, UI state          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Build / dev | **Vite + `@crxjs/vite-plugin`** (MV3, HMR cho extension pages và content script) |
| Manifest | `manifest.config.ts` dùng `defineManifest` của CRXJS (typed, lấy version từ `package.json`) |
| UI | React + TypeScript + Tailwind + shadcn/ui (dark theme, accent xanh lime) |
| Canvas | `@xyflow/react` (React Flow) + `elkjs`/`dagre` cho auto-layout |
| State editor | Zustand + `zundo` (undo/redo) |
| Schema | Zod (dùng chung editor, import, engine) |
| Nén / giải nén zip | `fflate` (export/import `.xflow.zip`, backup) |
| DB | Dexie (IndexedDB), lưu Blob cho asset |
| Ngôn ngữ | Chỉ tiếng Việt, chuỗi hằng trong `src/shared/strings.ts`; định dạng thời gian tương đối bằng `Intl.RelativeTimeFormat('vi')` |
| Test | Vitest (engine, schema), Playwright (E2E extension + trang giả lập provider) |

### 3.1 Môi trường dev với `@crxjs/vite-plugin`

**Cấu hình**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      // Các trang không khai báo trong manifest phải thêm input thủ công
      input: {
        editor: 'src/pages/editor/index.html',
        offscreen: 'src/pages/offscreen/index.html',
      },
    },
  },
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
});
```

```ts
// manifest.config.ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'My X Flows',
  version: pkg.version,
  key: '<public key cố định>',              // giữ extension ID ổn định (mục 4.4)
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/pages/sidepanel/index.html' },
  action: { default_title: 'My X Flows' },
  permissions: ['sidePanel', 'storage', 'unlimitedStorage', 'downloads', 'alarms',
                'scripting', 'offscreen', 'notifications', 'tabs'],
  host_permissions: ['https://flow.google.com/*', 'https://flow-content.google/*',
                     'https://labs.google/*', 'https://gemini.google.com/*'],
  content_scripts: [
    { matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
      js: ['src/providers/flow/injected/captcha.ts'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
      js: ['src/content/flow/index.ts'], run_at: 'document_start' },
    { matches: ['https://gemini.google.com/*'],   js: ['src/content/gemini/index.ts'], run_at: 'document_idle' },
  ],
});
```

**Quy trình dev**

| Bước | Lệnh / thao tác |
|---|---|
| Cài | `pnpm install` |
| Chạy dev | `pnpm dev` → Vite dev server + build ra `dist/` |
| Nạp extension | `chrome://extensions` → bật Developer mode → Load unpacked → chọn `dist/` (**chỉ làm một lần**) |
| Sửa side panel / editor (React) | HMR, giữ nguyên state component |
| Sửa content script | CRXJS tự inject lại; nếu driver giữ state/observer thì cần reload tab Flow/Gemini |
| Sửa service worker / manifest | CRXJS tự reload extension; run đang chạy được khôi phục qua `recovery.ts` |
| Build nội bộ | `pnpm build` → `dist/` → `scripts/release.ts` nén zip |

**Lưu ý kỹ thuật**
- Content script chạy trên trang HTTPS nhưng HMR client kết nối `ws://localhost:5173` → CRXJS xử lý qua loader; nếu trang có CSP chặn thì fallback: bật `watch` build và reload tab thủ công.
- Code dùng chung giữa content script và extension page không được import thứ phụ thuộc DOM của React (tránh bundle nặng trong content script).
- Dùng `import.meta.env.DEV` để bật panel debug (log driver, nút `diagnose()`), tắt khi build.
- Cùng `key` cho cả bản dev và build → IndexedDB dev và bản cài nội bộ **dùng chung ID**; nếu muốn tách dữ liệu dev, dùng một Chrome profile riêng khi dev.
- Ghim phiên bản `@crxjs/vite-plugin` và `vite` trong `package.json` (plugin nhạy với phiên bản Vite).
- **Flow generate** dùng batchexecute RPC (`src/providers/flow/rpc/`) trong service worker + MAIN world — không DOM-click Generate.

### 3.2 Luồng giao tiếp giữa các thành phần

| Kênh | Hướng | Nội dung |
|---|---|---|
| `chrome.runtime.sendMessage` | UI → SW | Lệnh: `workflow.run`, `run.cancel`, `runAll`, `node.runFrom` |
| `chrome.runtime.connect` (Port `run-events`) | SW → UI | Stream sự kiện: `node.status`, `node.progress`, `node.output`, `run.done` |
| `chrome.tabs.sendMessage` | SW → Content | `driver.execute({provider, action, payload})` |
| Port `driver-keepalive` | Content ↔ SW | Giữ SW sống trong lúc chờ generate lâu |
| `Dexie liveQuery` | DB → UI | Danh sách workflow, run tự cập nhật giữa side panel và editor |

---

## 4. Mô hình dữ liệu và lưu trữ

### 4.1 Bảng IndexedDB

| Bảng | Khoá / index | Mục đích |
|---|---|---|
| `workspaces` | `id`, `updatedAt` | Nhóm workflow (`Sept 12`), cờ `isCurrent` |
| `workflows` | `id`, `workspaceId`, `updatedAt`, `enabled`, `name` | Định nghĩa đồ thị hiện hành |
| `workflowRevisions` | `id`, `workflowId`, `createdAt` | Lịch sử mỗi lần bấm **Lưu** (giữ N bản) |
| `drafts` | `workflowId` | Bản nháp tự lưu khi chưa bấm Lưu, dùng khi crash hoặc đóng nhầm |
| `assets` | `id`, `sha256`, `workflowId` | Blob ảnh/video upload, khử trùng lặp theo hash |
| `templates` | `id`, `category` | Mẫu dựng sẵn (seed khi cài) và mẫu người dùng tự lưu |
| `runs` | `id`, `workflowId`, `status`, `startedAt` | Một lượt chạy |
| `nodeRuns` | `[runId+nodeId]`, `status` | Trạng thái, output và log từng node |
| `outputs` | `id`, `nodeRunId` | Blob hoặc URL kết quả, preview trong node và Gallery |

### 4.2 Schema workflow

```ts
type PortType = 'text' | 'image' | 'video' | 'any';

interface Workflow {
  id: string;
  schemaVersion: number;          // phục vụ migration
  workspaceId: string;
  name: string;
  enabled: boolean;               // toggle trong list/editor, dùng cho "Chạy tất cả"
  locked: boolean;                // nút 🔒
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  settings: { concurrency: number; retry: number; stopOnError: boolean };
  createdAt: number; updatedAt: number;
  sourceTemplateId?: string;      // "(copy)" từ template
}

interface WorkflowNode<T extends NodeType = NodeType> {
  id: string;
  type: T;                        // 'media' | 'text' | 'prompt' | 'flowGenerate' | 'geminiGenerate' | 'autoDownload' | 'note'
  slug?: string;                  // @video, @image_xxx_1 (duy nhất trong workflow)
  label?: string;                 // "Model Image", "Prompt Assistant"
  position: { x: number; y: number };
  size?: { w: number; h: number };
  data: NodeDataMap[T];           // cấu hình riêng từng loại, validate bằng Zod
  disabled?: boolean;             // bỏ qua khi chạy
}

interface WorkflowEdge {
  id: string;
  source: string; sourceHandle: string;   // vd 'out:video'
  target: string; targetHandle: string;   // vd 'in:image'
  type: PortType;                         // quyết định màu cạnh
}
```

### 4.3 Hành vi lưu

| Hành động | Hành vi |
|---|---|
| Sửa trên canvas | Cập nhật store → đánh dấu **dirty** (nút `Lưu` nổi bật) → ghi `drafts` (debounce) |
| Bấm `Lưu` / `Cmd+S` | Validate Zod → ghi `workflows` + tạo `workflowRevisions` → xoá draft → hết dirty |
| Đóng ✕ khi dirty | Hộp thoại: Lưu / Bỏ thay đổi / Huỷ |
| Mở editor có draft mới hơn bản đã lưu | Hỏi khôi phục bản nháp |
| `Reset` | Xoá kết quả chạy đang hiển thị trên node (không xoá cấu hình); cần xác nhận |
| Thêm từ Template | Deep-clone, sinh id mới, tên thêm hậu tố `(copy)`, clone asset tham chiếu |
| Menu ⋮ | Mở editor, Đổi tên, Nhân bản, Chuyển workspace, Export, Lưu thành template, Xoá (chuyển vào thùng rác mềm, có hoàn tác) |
| Export / Import | Xem mục 4.5 |
| Refresh (⟳) | Nạp lại từ DB |

### 4.4 Đảm bảo dữ liệu còn nguyên sau reload

Yêu cầu: reload trang Flow, đóng/mở side panel, đóng editor, khởi động lại Chrome, cập nhật extension → workflow vẫn xuất hiện đầy đủ (node, cạnh, vị trí, viewport, media, cấu hình, trạng thái bật/tắt, workspace hiện hành).

| Cơ chế | Chi tiết |
|---|---|
| Nơi lưu | IndexedDB thuộc **origin của extension** (`chrome-extension://<id>`), không phải origin labs.google → reload hoặc xoá cache trang Flow không ảnh hưởng |
| Không lưu trong content script/localStorage trang | Content script chỉ là driver, không giữ dữ liệu workflow |
| Chống bị trình duyệt dọn | Gọi `navigator.storage.persist()` khi khởi động; manifest khai báo quyền `unlimitedStorage` |
| **Extension ID cố định** | Khai báo `key` (public key) trong manifest → ID không đổi giữa các máy/lần load unpacked → không mất DB khi cài lại từ thư mục khác |
| Ghi an toàn | Mọi ghi workflow trong transaction Dexie (workflow + revision + asset cùng lúc); không lưu nửa vời |
| Không mất thay đổi chưa bấm Lưu | Draft ghi debounce + ghi ngay khi `visibilitychange`/`beforeunload` của editor |
| Nâng cấp schema | Dexie `version(n).upgrade()` + `schemaVersion` trong workflow; test migration với dữ liệu bản cũ |
| Đồng bộ giữa các view | `liveQuery` → side panel cập nhật ngay khi editor lưu, không cần reload |
| UI state | Workspace hiện hành, filter, sub-tab đang chọn lưu `chrome.storage.local` → mở lại đúng màn hình trước |
| Sao lưu | Settings → **Backup** (xuất toàn bộ DB + asset thành zip) / **Restore**; nhắc backup định kỳ (tuỳ chọn) |
| Lưu ý khi gỡ extension | Gỡ extension sẽ xoá IndexedDB → hướng dẫn nội bộ ghi rõ: backup trước khi gỡ/cài lại |

### 4.5 Export / Import workflow

#### a) Định dạng file

| Định dạng | Nội dung | Khi dùng |
|---|---|---|
| `.xflow.json` | Chỉ cấu trúc workflow (node, cạnh, cấu hình, viewport). Media được ghi dạng tham chiếu `sha256` + tên file | Chia sẻ nhanh cấu trúc, dán vào tài liệu, commit vào git |
| `.xflow.zip` (**mặc định**) | `manifest.json` + `workflows/*.json` + `assets/<sha256>.<ext>` (+ `outputs/` nếu chọn) | Chuyển workflow đầy đủ sang máy khác |
| `.xflow-backup.zip` | Cùng cấu trúc zip, `kind: 'backup'`, chứa mọi workspace, workflow, template, revision, (tuỳ chọn) run | Backup / Restore (mục 4.4) |

```ts
// manifest.json trong file zip (hoặc phần đầu của .xflow.json)
interface ExportManifest {
  format: 'my-x-flows';
  formatVersion: 1;                    // version định dạng file, tách với schemaVersion của workflow
  kind: 'workflows' | 'workspace' | 'backup';
  appVersion: string;                  // version extension lúc export
  exportedAt: string;                  // ISO
  workspaces?: { id: string; name: string }[];
  workflows: { id: string; name: string; schemaVersion: number; path: string; nodeCount: number }[];
  assets: { sha256: string; mime: string; size: number; path?: string; originalName: string }[];
  includes: { assets: boolean; outputs: boolean; runs: boolean };
}
```

- Không bao giờ export: cookie, token, thông tin tài khoản Google, cài đặt cá nhân (thư mục tải, remote config).
- Tên file: `<ten-workflow-khong-dau>-YYYYMMDD-HHmm.xflow.zip` (bỏ dấu tiếng Việt bằng `normalize('NFD')`, thay ký tự đặc biệt bằng `-`).

#### b) Export

| Điểm vào | Phạm vi |
|---|---|
| Menu ⋮ của item workflow | 1 workflow |
| Nút Export ở bottom toolbar editor | Workflow đang mở (nếu chưa lưu → hỏi "Lưu rồi export" / "Export bản đã lưu") |
| Chọn nhiều bằng checkbox → thanh thao tác hàng loạt | Các workflow đã chọn |
| Menu workspace | Cả workspace |
| Settings → Backup | Toàn bộ dữ liệu |

Hộp thoại Export:
- Định dạng: `.xflow.zip` (mặc định) / `.xflow.json`.
- ☑ Kèm file media (mặc định bật; tắt khi chọn `.json`).
- ☐ Kèm kết quả chạy gần nhất (video/ảnh đã tạo) — hiện dung lượng ước tính.
- Hiển thị: số workflow, số node, số asset, tổng dung lượng.

Luồng xử lý:
1. Đọc workflow **bản đã lưu** + asset liên quan trong một transaction đọc của Dexie.
2. Chuẩn hoá: bỏ trạng thái runtime khỏi node (preview, status), sắp xếp khoá ổn định để file diff được.
3. Tạo zip bằng `fflate` trong extension page (side panel/editor); với dữ liệu lớn chạy trong Web Worker để không đơ UI, có thanh tiến độ.
4. `URL.createObjectURL(blob)` → `chrome.downloads.download({ url, filename, saveAs: true })` → thu hồi URL khi xong.

#### c) Import

| Điểm vào | Ghi chú |
|---|---|
| Nút Import (⬇) trên toolbar side panel | Chọn 1 hoặc nhiều file |
| `+ Thêm` → "Import file" | |
| Kéo thả file vào danh sách workflow | Hiện vùng thả khi kéo file vào |
| Kéo thả `.xflow.json` vào canvas editor | Hỏi: "Mở thành workflow mới" hoặc "Chèn node vào workflow hiện tại" (remap id, đặt tại vị trí thả) |
| Settings → Restore | Chỉ nhận `.xflow-backup.zip` |

Pipeline:

```
chọn file ─► kiểm tra kích thước ─► nhận dạng (json | zip) ─► đọc manifest
   ─► Zod validate manifest + từng workflow
   ─► formatVersion > hỗ trợ? → dừng: "File được tạo từ phiên bản mới hơn, hãy cập nhật extension"
   ─► migrate schemaVersion của từng workflow lên hiện tại
   ─► kiểm tra asset: sha256 khớp nội dung, MIME hợp lệ, file có mặt
   ─► Màn hình xem trước
   ─► ghi DB trong 1 transaction ─► báo kết quả ─► mở workflow (nếu import 1 cái)
```

Màn hình xem trước:
- Danh sách workflow trong file: tên, số node, số asset, cảnh báo (thiếu media, node không hỗ trợ, đã migrate).
- Chọn workspace đích (mặc định: workspace hiện tại; hoặc tạo workspace mới theo tên trong file).
- Xử lý trùng (cùng `id` hoặc cùng tên trong workspace đích):
  | Lựa chọn | Hành vi |
  |---|---|
  | **Tạo bản sao** (mặc định) | Sinh id mới, tên thêm `(nhập)` nếu trùng tên |
  | Ghi đè | Giữ id, thay nội dung; bản cũ lưu vào `workflowRevisions` để khôi phục được |
  | Bỏ qua | Không nhập workflow đó |

Quy tắc khi ghi:
- **Remap id**: workflow luôn có id mới khi tạo bản sao; id node/edge giữ nguyên trong phạm vi workflow; khi chèn vào workflow đang mở thì sinh id node/edge mới và đổi slug trùng (`@image_1` → `@image_1_2`), cập nhật tham chiếu `@slug` trong prompt tương ứng.
- **Asset khử trùng lặp** theo `sha256`: đã có trong DB thì dùng lại, không ghi thêm.
- Import `.xflow.json` không có media → node Image/Video hiện trạng thái **"Thiếu file"** + nút chọn lại; kiểm tra trước khi chạy sẽ báo lỗi nếu còn thiếu.
- Node có `type` không nhận ra (ví dụ từ bản tương lai) → giữ nguyên dạng `unknown` (hiển thị xám, không chạy), không làm hỏng các node khác.
- Workflow nhập vào mặc định **tắt** (`enabled: false`) để không bị "Chạy tất cả" chạy ngoài ý muốn.
- Mọi thứ trong một transaction: lỗi giữa chừng thì không ghi gì.

Giới hạn và an toàn:
- Giới hạn kích thước file (cấu hình trong Settings, mặc định 2 GB cho zip, 20 MB cho json).
- Chống zip bomb: kiểm tra tổng dung lượng giải nén từ header trước khi giải nén.
- Chỉ nhận entry trong `workflows/`, `assets/`, `outputs/`, `manifest.json`; từ chối đường dẫn có `..` hoặc tuyệt đối.
- Zod `strict()`: loại bỏ trường lạ; không `eval`, không render HTML từ nội dung file (Note hiển thị dạng text/markdown đã sanitize).

#### d) Tiêu chí kiểm thử Export / Import
- Round-trip: export zip → import (bản sao) → deep-equal với bản gốc (trừ `id`, `createdAt`, `updatedAt`), media giống từng byte.
- Round-trip `.json` → node media ở trạng thái "Thiếu file", phần còn lại khớp.
- Import file `schemaVersion` cũ (fixture) → migrate đúng.
- Import file `formatVersion` mới hơn → báo lỗi, không ghi DB.
- File hỏng / zip thiếu asset / sha256 sai / entry `../` → báo lỗi rõ ràng, không ghi DB.
- Ghi đè → bản cũ còn trong revision.
- Chèn node từ file vào workflow đang mở → slug trùng được đổi, tham chiếu `@slug` cập nhật đúng.
- Backup → gỡ extension → cài lại → Restore → dữ liệu khớp.

---

## 5. Hệ thống port và quy tắc kết nối

| Port | Icon | Màu cạnh | Nguồn | Đích chấp nhận |
|---|---|---|---|---|
| `text` | `T` | tím | Text, Prompt | Prompt, các node Generate |
| `image` | 🖼 | xanh dương | Media (ảnh), Generate (ảnh/frame) | Prompt (phân tích ảnh), Generate, Auto Download |
| `video` | 🎥 | xanh lá | Media (video), Generate (video) | Generate (video tham chiếu), Auto Download |
| `any` | ⬇ | xám | — | Auto Download |

Quy tắc:
- `isValidConnection`: đúng kiểu, không nối vào chính node đó, không tạo vòng (DFS kiểm tra).
- Mỗi input có `maxConnections` riêng. Ví dụ `flowGenerate.in:text` = 1, `in:image` = tối đa 3 (ingredients).
- Thả cạnh ra vùng trống → mở Node Picker, **chỉ lọc các node tương thích**, chọn xong tự nối.
- **Slug**: tự sinh theo loại (`@image_<rand>_1`), sửa được, kiểm tra trùng. Trong textarea của Prompt/Text, gõ `@` để gợi ý slug. Khi đổi slug thì cập nhật mọi tham chiếu.
- **Giải quyết tham chiếu `@slug` khi chạy**: node text trả về nội dung, node media gắn file vào provider (upload), không chèn chữ.

---

## 6. Đặc tả từng node

Mỗi node định nghĩa bằng một `NodeDefinition` trong registry:

```ts
interface NodeDefinition<T> {
  type: T;
  title: string; description: string; icon: Icon; category: 'input'|'llm'|'generate'|'output'|'annotation';
  inputs: PortSpec[]; outputs: PortSpec[];
  dataSchema: ZodSchema; defaultData: () => Data;
  Component: React.FC<NodeProps>;        // hiển thị trên canvas
  Inspector?: React.FC<InspectorProps>;  // panel cấu hình chi tiết
  executor?: NodeExecutor;               // undefined với Note
}
```

### 6.1 Image/Video (`media`)
- **Output**: `image` hoặc `video`, tuỳ loại file.
- **Data**: `assetId`, `kind`, `slug`, `label`.
- **UI**: kéo thả hoặc chọn file, dán URL, chọn từ Gallery. Preview ảnh/video tỉ lệ gốc. Nút thay file. Cảnh báo theo gợi ý template (vd video > 10s hoặc có audio).
- **Validate**: MIME (png/jpg/webp/mp4/webm), dung lượng, thời lượng video (đọc metadata bằng `<video>`).
- **Executor**: trả Blob từ `assets` (không gọi provider).

### 6.2 Text (`text`)
- **Output**: `text`. **Data**: `content`, `slug`.
- **Executor**: resolve `@slug` lồng nhau trong `content` → trả chuỗi.

### 6.3 Prompt (`prompt`)
- **Input**: `text` (nhiều), `image` (nhiều). **Output**: `text`.
- **Data**: `provider: 'gemini'` (cố định), `model` (danh sách nạp động từ Gemini driver), `preset: 'enhance'|'analyzeImage'|'script'|'summarize'|'translate'|'brainstorm'|'custom'`, `instruction` (textarea, như nội dung "Prompt Assistant"), `outputFormat: 'plain'|'json'`, `newChat: boolean`.
- **UI**: textarea có gợi ý `@`, footer chọn model và bộ đếm ký tự, preview output sau khi chạy.
- **Executor**: ghép system preset + instruction + text input → mở tab Gemini (TabPool) → driver tải ảnh → gửi → chờ phản hồi xong (nút stop biến mất, text ổn định) → lấy text phản hồi cuối → nếu `json` thì parse, lỗi thì retry.
- Nếu không nối gì vào node và không có input: chỉ trả `instruction` (pass-through, như node "Prompt Assistant" trong mẫu).

### 6.4 Flow – Image/Video Generate (`flowGenerate`) — **node trọng tâm**
- **Input**: `text` (prompt, bắt buộc), `image` (0..3: frame đầu/cuối hoặc ingredients), `video` (0..1: video tham chiếu hoặc extend).
- **Output**: `video`, `image` (ảnh tạo ra hoặc last frame).
- **Data**:
  | Trường | Giá trị |
  |---|---|
  | `mode` | `text-to-video` · `frames-to-video` · `ingredients-to-video` · `text-to-image` · `extend` · `auto` (suy ra từ input đã nối) |
  | `model` | danh sách model Flow hiện có (Veo…, Imagen…) — nạp động từ driver |
  | `aspectRatio` | 16:9 · 9:16 · 1:1 … |
  | `outputsPerPrompt` | 1–4 |
  | `projectTarget` | `current` · `new` · `projectId` |
  | `pickOutput` | `first` · `all` (output thành danh sách) |
  | `timeoutSec`, `retry` | |
- **Chọn mode tự động**: có `video` → reference/extend; có ≥2 `image` → ingredients; có 1–2 `image` → frames; chỉ `text` → text-to-video.
- **UI node**: vùng preview lớn (placeholder 🎥 khi chưa có kết quả), trạng thái (Queued / Uploading / Generating x% / Done / Error), footer `Google Flow`, nút chạy lại node.
- **Executor (qua FlowDriver / batchexecute RPC)**:
  1. Đảm bảo tab `flow.google.com` mở và đã đăng nhập (nếu chưa: báo `AUTH_REQUIRED`).
  2. Resolve `flowProjectId` từ URL `/project/{uuid}` hoặc storage (`NO_FLOW_PROJECT`).
  3. Upload ảnh ref (`maseQ`) nếu có → generate image (`ogiZ0b`) hoặc video (`eb1hJf` + poll).
  4. Text-only video: tự tạo 1 ảnh từ prompt rồi i2v.
  5. Extend (video input) → `UNSUPPORTED_ON_BATCH_API`. Nhiều ảnh ingredients → ghép refs thành ảnh scene rồi i2v.
  6. Tải CDN URL → Blob/base64 → trả output.
- **Mã lỗi chuẩn hoá**: `AUTH_REQUIRED`, `QUOTA_EXCEEDED`, `CONTENT_POLICY`, `TIMEOUT`, `SELECTOR_NOT_FOUND`, `UPLOAD_FAILED`, `NO_AT_TOKEN`, `NO_FLOW_PROJECT`, `CAPTCHA_FAILED`, `UNSUPPORTED_ON_BATCH_API`, `UNKNOWN`.

### 6.5 Gemini – Image/Video Generate (`geminiGenerate`)
- **Input**: `text` (bắt buộc), `image` (0..n, ảnh tham chiếu/chỉnh sửa). **Output**: `image`, `video`.
- **Data**: `kind: 'image'|'video'`, `model`, `newChat: boolean`, `timeoutSec`, `retry`.
- **UI node**: preview kết quả, trạng thái, footer `Gemini`.
- **Executor (qua GeminiDriver)**: đảm bảo đăng nhập → mở chat mới nếu `newChat` → chọn tool tạo ảnh/video tương ứng → upload ảnh input → nhập prompt → gửi → chờ media xuất hiện trong phản hồi cuối → lấy URL bản gốc (không lấy thumbnail) → fetch Blob.
- **Lỗi riêng**: Gemini từ chối tạo (phản hồi chỉ có text) → `CONTENT_POLICY`; hết lượt tạo video trong ngày → `QUOTA_EXCEEDED`.

### 6.6 Auto Download (`autoDownload`)
- Input `any` (nhiều). Không có output.
- Data: `folderTemplate` (vd `TobyFlow/{{workflow}}/{{date}}`), `filenameTemplate` (vd `{{slug}}_{{index}}`), `conflict: uniquify|overwrite`, `onlyWhenAllDone`.
- Executor: `chrome.downloads.download` với blob URL (tạo trong offscreen document do SW không có `URL.createObjectURL`), lưu `downloadId` vào nodeRun.

### 6.7 Note (`note`)
- Không có port, không thực thi. Data: `content`, `color`, `fontSize`, `size` (kéo giãn được). Hiển thị như khung xanh trong mẫu.

---

## 7. Engine thực thi

### 7.1 Vòng đời một lượt chạy

```
validate ─► plan ─► schedule ─► execute nodes ─► collect ─► finish
   │          │         │              │
   │          │         │              └─ mỗi node: queued → running → (progress) → success | error | skipped | cancelled
   │          │         └─ ready = mọi upstream success; chạy song song tối đa `concurrency`
   │          └─ topo sort (Kahn), bỏ Note và node disabled, cắt subgraph nếu "chạy từ node X"
   └─ Zod + input bắt buộc đã nối + slug tồn tại + không có vòng + provider đã đăng nhập
```

### 7.2 Chế độ chạy

| Chế độ | Kích hoạt | Hành vi |
|---|---|---|
| Run workflow | ▶ trên toolbar editor | Chạy toàn bộ DAG |
| Run node | Nút chạy trên node | Chạy node đó, **tái sử dụng output đã cache** của upstream nếu input không đổi (hash cấu hình + hash input) |
| Run from here | Menu chuột phải trên node | Node đó và mọi downstream |
| Chạy tất cả | Side panel | Tạo run cho mọi workflow `enabled` trong workspace hiện tại, đưa vào hàng đợi toàn cục |
| Max Speed | Toggle | `concurrency > 1`: TabPool mở nhiều tab provider chạy song song; tắt thì chạy tuần tự 1 tab |

### 7.3 Độ bền (MV3)
- Ghi `runs`/`nodeRuns` sau **mỗi lần đổi trạng thái** → SW khởi động lại thì `RunManager.recover()` đọc run `running`: node đang chạy dở được hỏi lại content script (`driver.status`), không trả lời thì retry.
- Port keepalive từ content script trong lúc generate và `chrome.alarms` làm heartbeat.
- `chrome.tabs.onRemoved/onUpdated`: tab provider bị đóng hoặc điều hướng → node lỗi `TAB_LOST` → retry trên tab mới.
- Output lớn (video) lưu Blob vào `outputs`, message chỉ truyền `outputId`.

### 7.4 Retry và lỗi
- `retry` theo node (mặc định lấy từ workflow settings), backoff tăng dần có jitter.
- Không retry: `CONTENT_POLICY`, `AUTH_REQUIRED`, `QUOTA_EXCEEDED` → dừng run (hoặc chỉ nhánh đó nếu `stopOnError=false`) và gửi notification.
- Huỷ: `AbortController` cho mỗi node, gửi `driver.abort` tới content script.

### 7.5 Hiển thị trạng thái trên canvas
- Viền node theo trạng thái (xám / vàng nhấp nháy / xanh / đỏ), badge tiến độ.
- Cạnh chuyển động (animated) khi dữ liệu đang chảy qua.
- Panel log dưới canvas: timestamp, node, message; click để focus node.
- Top bar hiển thị trạng thái lượt chạy gần nhất (không có bộ đếm hạn mức).

---

## 8. Provider drivers (tự động hoá UI)

### 8.1 Giao diện chung

```ts
interface ProviderDriver {
  id: 'flow' | 'gemini';
  matches: string[];                          // host patterns
  checkAuth(): Promise<boolean>;
  capabilities(): Promise<Capabilities>;      // model, mode, ratio khả dụng
  execute(action: DriverAction, signal: AbortSignal, onProgress: (p) => void): Promise<DriverResult>;
  diagnose(): Promise<SelectorHealth[]>;      // kiểm tra selector
}
```

### 8.2 dom-kit dùng chung
- `waitFor(locator, {timeout, visible})` — MutationObserver + timeout.
- `locator` nhiều tầng: `role+name` → `aria-label` → `data-*` → text → CSS fallback. Cấu hình selector nằm trong `selectors/<provider>.ts` và có thể **cập nhật từ xa** (JSON remote config có version) để sửa nhanh khi UI provider đổi, không cần phát hành lại extension.
- `typeInto(el, text)` — dùng native setter + `input`/`change` event; với contenteditable dùng `execCommand('insertText')` hoặc `beforeinput`.
- `uploadFiles(input|dropZone, blobs)` — `DataTransfer`.
- `click(el)` — scrollIntoView + chuỗi pointer event.
- `observeNewItems(container)` — snapshot trước/sau để lấy đúng kết quả mới.
- Delay giống người thật (có jitter) giữa các thao tác.

### 8.3 Bảng hành động cần khảo sát trên Google Flow

| Hành động | Cần xác định |
|---|---|
| Nhận biết đăng nhập | Phần tử avatar hoặc trang sign-in |
| Danh sách project / tạo project | Nút New project, URL project |
| Chọn mode | Dropdown mode trong prompt bar |
| Chọn model, aspect ratio, số output | Panel settings |
| Upload frame / ingredient / video | Vùng thêm media, input file |
| Ô prompt | Loại phần tử (textarea hay contenteditable) |
| Nút Generate | Trạng thái enabled/disabled |
| Tiến độ và hoàn thành | Placeholder %, trạng thái lỗi |
| Lấy kết quả | `video[src]`, menu Download, độ phân giải |
| Hết credit / vi phạm chính sách | Nội dung toast/dialog |
| Extend / Scenebuilder | Luồng thao tác |

Kết quả khảo sát ghi thành `docs/providers/flow.md` kèm snapshot HTML dùng làm fixture cho test.

### 8.4 Bảng hành động cần khảo sát trên Gemini

| Hành động | Cần xác định |
|---|---|
| Nhận biết đăng nhập | Avatar / trang sign-in |
| Tạo chat mới | Nút New chat, URL |
| Chọn model | Model picker |
| Bật tool tạo ảnh / video | Nút/tool trong ô nhập |
| Upload ảnh | Nút thêm file, input file |
| Ô nhập | contenteditable (rich text) |
| Gửi và nhận biết đang trả lời | Nút gửi ↔ nút stop |
| Lấy phản hồi cuối | Container message cuối, text đã render |
| Lấy ảnh/video tạo ra | Phần tử media, nút tải bản gốc |
| Từ chối / hết lượt | Nội dung thông báo |

Ghi thành `docs/providers/gemini.md` + fixture.

---

## 9. Đặc tả UI

### 9.1 Side panel – tab Workflow
- **Workspace selector**: danh sách workspace, đổi tên/xoá, `+` tạo mới. Workspace hiện hành có nhãn `hiện tại`.
- **Templates**: lưới card (thumbnail, tên, số node, mô tả, tag) → "Dùng mẫu" clone vào workspace hiện tại rồi mở editor.
- **Workflows**:
  - Search theo tên (fuzzy), Filter: All / Đang bật / Đã tắt / Lỗi gần nhất / theo workspace.
  - Nhóm theo workspace, header `TÊN (count)`.
  - Item: checkbox chọn nhiều (thao tác hàng loạt: chạy, bật/tắt, xoá, export), tên (click mở editor), `N nodes`, thời gian tương đối, trạng thái lần chạy gần nhất, toggle, ⋮.
  - `Chạy tất cả`: hỏi xác nhận, hiển thị số workflow sẽ chạy.
  - `+ Thêm`: menu "Workflow trống" / "Từ template" / "Import file".
- **Empty state** cho từng sub-tab.
- Không có sub-tab Shared, không có các tab Generate / Prompts / Tasks.

### 9.2 Editor
- Mở bằng `chrome.windows.create({type:'popup', url:'editor.html?id=...'})`. Nếu workflow đó đã mở thì focus cửa sổ cũ.
- **Phím tắt**: `Cmd+S` lưu, `Cmd+Z / Shift+Cmd+Z` undo/redo, `Space` giữ để pan, `Del` xoá, `Cmd+D` nhân bản node, `Cmd+C/V` copy/paste node (qua clipboard JSON), `/` hoặc `Tab` mở Node Picker, `Shift+1` fit view.
- **Node Picker**: fuzzy search trên title và description, điều hướng bàn phím, nhóm theo category, hiện node gần đây.
- **Lock**: tắt kéo/nối/sửa, vẫn chạy được.
- **Auto-layout**: ELK layered từ trái sang phải, có undo.
- **Settings workflow**: concurrency, retry, stopOnError, thư mục tải mặc định.
- **Chuột phải**: trên canvas (thêm node, dán, fit view); trên node (chạy, chạy từ đây, nhân bản, tắt, xoá, xem log).
- **Inspector** (panel phải, mở khi chọn node): form cấu hình đầy đủ từ `dataSchema`.

### 9.3 Header và footer side panel
- Header: logo + tên (không badge gói), Notifications, Settings, trạng thái provider (Flow/Gemini: đã đăng nhập / chưa / driver lỗi).
- Footer: toggle **Max Speed** (concurrency), trạng thái hàng đợi (đang chạy x, chờ y). Không có Nâng cấp, bộ đếm hạn mức, xoá watermark.
- Notification: run xong/lỗi (`chrome.notifications` + danh sách trong app).
- Settings: thư mục tải, giới hạn kích thước file import, concurrency mặc định, model Gemini mặc định, remote selector config, **Backup / Restore**, phiên bản extension + kiểm tra cập nhật nội bộ.

---

## 10. Cấu trúc thư mục

```
my-x-flows/
├─ vite.config.ts                      # react() + crx({ manifest })
├─ manifest.config.ts                  # defineManifest (CRXJS)
├─ package.json
├─ src/
│  ├─ background/index.ts              # service worker: RunManager, message router
│  ├─ pages/
│  │  ├─ sidepanel/{index.html, main.tsx}
│  │  ├─ editor/{index.html, main.tsx} # khai báo trong rollupOptions.input
│  │  └─ offscreen/{index.html, main.ts}
│  ├─ content/
│  │  ├─ flow/index.ts
│  │  └─ gemini/index.ts
│  ├─ shared/
│  │  ├─ schema/                       # workflow, node data, run, export manifest (Zod) + migrations
│  │  ├─ messaging/                    # định nghĩa message typed
│  │  ├─ strings.ts                    # toàn bộ chuỗi UI tiếng Việt
│  │  └─ utils/
│  ├─ storage/
│  │  ├─ db.ts                         # Dexie + versions
│  │  ├─ repos/                        # workspaceRepo, workflowRepo, assetRepo, runRepo, templateRepo
│  │  └─ transfer/
│  │     ├─ exporter.ts                # build manifest, zip/json
│  │     ├─ importer.ts                # parse, validate, migrate, preview, commit
│  │     ├─ remap.ts                   # remap id, đổi slug trùng
│  │     ├─ zip.worker.ts              # fflate trong Web Worker
│  │     └─ backup.ts
│  ├─ nodes/
│  │  ├─ registry.ts
│  │  ├─ ports.ts                      # kiểu port, màu, quy tắc nối
│  │  └─ <type>/{definition.ts, Node.tsx, Inspector.tsx, executor.ts}
│  ├─ engine/
│  │  ├─ RunManager.ts
│  │  ├─ scheduler.ts                  # topo sort, ready queue, concurrency
│  │  ├─ resolver.ts                   # @slug, template {{ }}
│  │  ├─ cache.ts                      # hash input → reuse output
│  │  └─ recovery.ts
│  ├─ providers/
│  │  ├─ ProviderRouter.ts
│  │  ├─ TabPool.ts
│  │  ├─ dom-kit/
│  │  ├─ flow/{driver.ts, selectors.ts, actions/}
│  │  ├─ gemini/{driver.ts, selectors.ts, actions/}
│  │  └─ remote-config.ts
│  ├─ features/
│  │  ├─ workflow-list/ templates/ workspace/ transfer/ (ExportDialog, ImportPreview, DropZone)
│  │  └─ editor/{Canvas, TopBar, LeftToolbar, BottomBar, NodePicker, Inspector, LogPanel}
│  └─ templates/seed/                  # workflow mẫu (.xflow.json, nạp qua importer khi cài)
├─ tests/
│  ├─ unit/                            # scheduler, resolver, schema migration, port rules, transfer
│  ├─ fixtures/providers/              # snapshot HTML của Flow/Gemini
│  ├─ fixtures/transfer/               # file export bản cũ, file hỏng, zip độc hại
│  └─ e2e/
├─ scripts/
│  └─ release.ts                       # build + zip + version bump cho phát hành nội bộ
└─ docs/
   ├─ PLAN.md
   ├─ INSTALL.md                       # hướng dẫn cài/cập nhật nội bộ
   └─ providers/{flow.md, gemini.md}
```

---

## 11. Milestone và tiêu chí hoàn thành

### M0 — Khảo sát provider
- Hoàn thành bảng mục 8.3 (Google Flow) và 8.4 (Gemini).
- PoC content script: upload 1 ảnh + nhập prompt + generate + lấy URL video.
- ✅ Có `docs/providers/flow.md` và fixture HTML, PoC tạo được 1 video thật.

### M1 — Nền tảng
- Scaffold Vite + React + TS + `@crxjs/vite-plugin`, `manifest.config.ts`, các trang (side panel, editor, offscreen), content script rỗng cho Flow/Gemini.
- Tailwind/shadcn dark theme, `strings.ts` tiếng Việt.
- Manifest: `key` cố định ID, `unlimitedStorage`, `sidePanel`, `downloads`, `alarms`, `scripting`, `offscreen`, `notifications`, host `labs.google/*`, `gemini.google.com/*`.
- Dexie + repos + Zod schema + migration framework, `navigator.storage.persist()`.
- Messaging typed.
- ✅ Unit test schema/repos pass. Side panel và editor mở được, đọc/ghi DB. Load unpacked ở 2 thư mục khác nhau vẫn cùng extension ID.
- ✅ `pnpm dev`: sửa component side panel/editor → cập nhật ngay không reload; sửa content script → thay đổi có hiệu lực trên tab Flow; sửa service worker → extension tự reload. `pnpm build` ra `dist/` load được.

### M2 — Quản lý và lưu workflow (side panel)
- Workspace, danh sách nhóm, search/filter, toggle, menu ⋮, tạo mới, xoá mềm.
- Templates seed + "Dùng mẫu (copy)".
- **Export / Import** theo mục 4.5: ExportDialog, ImportPreview, kéo thả file, xử lý trùng, remap, Web Worker zip.
- Backup / Restore toàn bộ dữ liệu (dùng chung `transfer/`).
- ✅ Toàn bộ tiêu chí kiểm thử ở mục 4.5 (d) pass.
- ✅ Kiểm tra độ bền (mục 4.4): reload trang Flow, đóng/mở side panel, restart Chrome, reload extension, nâng version schema → danh sách và nội dung workflow còn đầy đủ. Backup → gỡ extension → cài lại → Restore khôi phục đủ.

### M3 — Editor canvas
- React Flow, top/left/bottom toolbar, Node Picker, hệ thống port và quy tắc nối, slug `@`.
- Node UI: Media, Text, Prompt, Flow Generate, Gemini Generate, Auto Download, Note (chưa chạy).
- Lưu/dirty/draft/khôi phục, undo/redo, lock, auto-layout, fit view, phím tắt.
- Export từ bottom toolbar, kéo thả `.xflow.json` vào canvas (mở mới / chèn node).
- ✅ Dựng lại được đúng workflow "Dancing motion control", Lưu → đóng → mở lại khớp 100% (vị trí, cạnh, asset, viewport). Export ra zip, import sang profile Chrome khác mở ra giống hệt.

### M4 — Engine và Google Flow driver
- RunManager, scheduler, resolver, cache, recovery, TabPool, retry, cancel.
- Executor: Media, Text, Flow Generate (các mode), Auto Download.
- Hiển thị trạng thái/tiến độ/preview trên node, log panel.
- ✅ Chạy workflow mẫu end-to-end ra video được tải về. Tắt SW giữa chừng (DevTools → terminate) thì run tự tiếp tục. Đóng tab Flow giữa chừng thì retry thành công.

### M5 — Gemini driver (Prompt + Gemini Generate)
- Gemini driver: đăng nhập, chat mới, model, upload ảnh, gửi, lấy text, lấy ảnh/video.
- Executor node Prompt (presets, output JSON) và Gemini Generate.
- ✅ Workflow `Media → Prompt(analyzeImage) → Flow Generate` và `Text → Gemini Generate(image) → Auto Download` chạy end-to-end.

### M6 — Chạy hàng loạt
- Run node, Run from here, output cache, Chạy tất cả, hàng đợi toàn cục, Max Speed (concurrency N tab mỗi provider).
- Notification, trạng thái hàng đợi ở footer.
- ✅ Chạy tất cả 3 workflow bật trong workspace, với concurrency 1 và 2 đều đúng thứ tự và kết quả.

### M7 — Độ ổn định và phát hành nội bộ
- `diagnose()` cho Flow và Gemini + màn hình "Tình trạng provider".
- Remote selector config (có version + checksum), đặt trên host nội bộ.
- Dọn asset/output mồ côi, cảnh báo dung lượng (`navigator.storage.estimate`).
- E2E Playwright cho luồng chính.
- `scripts/release.ts`: bump version, `vite build`, xuất `my-x-flows-<version>.zip` từ `dist/`; `docs/INSTALL.md` (cài unpacked, cập nhật bằng cách thay thư mục giữ nguyên `key`, backup trước khi gỡ).
- ✅ Bộ E2E xanh. Đổi thử 1 selector trong fixture thì `diagnose` báo đúng chỗ hỏng. Cập nhật từ version cũ lên mới không mất workflow.

---

## 12. Kiểm thử

| Lớp | Nội dung |
|---|---|
| Unit | Topo sort, phát hiện vòng, quy tắc port, resolver `@slug`, cache hash, migration schema, repos |
| Component | Node components, Node Picker (bàn phím), Inspector form |
| Driver | Chạy content script trên **fixture HTML** đã snapshot + mock tiến độ generate |
| Persistence | Playwright: tạo workflow có media → reload trang, đóng context, mở lại với cùng user-data-dir → dữ liệu khớp; migration từ DB fixture bản cũ |
| E2E | Playwright load extension: tạo workflow → lưu → reload → chạy trên trang Flow giả lập → file được tải |
| Manual smoke | Checklist chạy thật trên Flow/Gemini trước mỗi lần phát hành nội bộ |

---

## 13. Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Provider đổi UI làm hỏng driver | Locator nhiều tầng, remote selector config, `diagnose()`, fixture test |
| Vi phạm ToS hoặc tài khoản bị hạn chế do tự động hoá | Mặc định chạy tuần tự, delay có jitter, generate Flow qua batchexecute trong tab đã đăng nhập (reCAPTCHA + cookie), thông báo rõ rủi ro cho người dùng |
| Mất dữ liệu khi gỡ/cài lại extension hoặc ID thay đổi | `key` cố định trong manifest, Backup/Restore, hướng dẫn trong INSTALL.md |
| MV3 SW bị kill khi chờ video lâu | Persist mỗi transition, keepalive port, alarms, recovery |
| Dung lượng IndexedDB lớn do video | Lưu output theo tuỳ chọn, dọn định kỳ, cảnh báo quota, ưu tiên tải về đĩa rồi chỉ giữ thumbnail |
| Upload file vào provider bị chặn (isTrusted) | Thử `DataTransfer` trên input/drop, fallback `chrome.debugger` (`DOM.setFileInputFiles`) có xin quyền |
| Nhiều tab song song gây rate-limit | Giới hạn concurrency theo provider, backoff khi phát hiện lỗi giới hạn |
| Import file độc hại | Zod strict, giới hạn kích thước, kiểm MIME asset, không thực thi nội dung |

---

## 14. Quyết định

Xem **mục 0**. Không còn câu hỏi mở chặn việc bắt đầu M0/M1.
