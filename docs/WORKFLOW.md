# Workflow

Tài liệu kỹ thuật về **node-based workflow**: loại node, kết nối, chạy trên service worker, và pipeline RPC Google Flow.

> Provider Flow chi tiết hơn: [providers/flow.md](./providers/flow.md)  
> Schema version hiện tại: **3** (`SCHEMA_VERSION` trong `src/shared/schema/index.ts`)

---

## 1. Tổng quan kiến trúc

```
Editor (EditorApp / WorkflowNodeView)
  → chrome.runtime.sendMessage { type: 'workflow.run' }
Service Worker
  → RunManager → topoSort → executors[nodeType]
  → ProviderRouter.execute('flow' | 'gemini', action)
      Flow generate → generateViaRpc (batchexecute)
      Gemini / Flow DOM → content script driver
Flow tab (MAIN world)
  → fetch('/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=…')
```

| Lớp | Path | Vai trò |
|---|---|---|
| Schema | `src/shared/schema/index.ts` | Node/edge/workflow Zod schema, migrate |
| Ports | `src/nodes/ports.ts` | Handle, màu, luật nối cạnh |
| Registry | `src/nodes/registry.ts` | Định nghĩa UI / toolbar |
| Executors | `src/engine/executors.ts` | Logic chạy từng loại node |
| Run | `src/engine/RunManager.ts` | Queue, retry, cache input hash |
| Scheduler | `src/engine/scheduler.ts` | Topo-sort, upstream/downstream |
| Resolver | `src/engine/resolver.ts` | Ghép prompt, chú thích `[Label]` → URL |
| Flow RPC | `src/providers/flow/rpc/*` | Generate không click DOM |
| Editor | `src/features/editor/*` | Canvas React Flow |

Workflow lưu **IndexedDB** (local). UI tiếng Việt.

---

## 2. Workflow node

### 2.1 Loại node

| Type | Toolbar | Executor | Vai trò |
|---|---|---|---|
| `asset` | ✅ | `assetExecutor` | Ảnh/video/audio local hoặc Flow (`flowMediaId`) |
| `prompt` | ✅ | `promptExecutor` | Ghép text + forward refs; optional Gemini preset |
| `generateImage` | ✅ | `generateImageExecutor` | Tạo ảnh qua Flow RPC |
| `generateVideo` | ✅ | `generateVideoExecutor` | Tạo video qua Flow RPC (Omni / Veo) |
| `autoDownload` | ✅ | `autoDownloadExecutor` | `chrome.downloads.download` |
| `note` | ✅ | — (skip) | Ghi chú trên canvas |
| `text` | ❌ | — | Legacy; schema v3 migrate → `prompt` |
| `unknown` | ❌ | skip | Type không hỗ trợ sau migrate |

### 2.2 Graph schema

```ts
WorkflowNode = { id, type, slug?, label?, position, size?, data, disabled? }
WorkflowEdge = { id, source, sourceHandle, target, targetHandle, type: PortType }
Workflow = {
  id, schemaVersion, workspaceId, name, enabled, locked,
  nodes, edges, viewport,
  settings: { concurrency 1–8, retry 0–10, stopOnError, downloadFolder? },
  …
}
```

**Port types:** `text` | `image` | `video` | `audio` | `any`

### 2.3 Ports (handles)

| Node | Inputs | Outputs |
|---|---|---|
| **asset** | — | `out:image` / `out:video` / `out:audio` theo `kind` |
| **prompt** | `in:text` (≤16), `in:image` (≤16), `in:video` (≤8), `in:audio` (≤8) | `out:text` |
| **generateImage** | `in:text` (≤4), `in:image` (≤8) | `out:image` |
| **generateVideo** | `in:text` (≤4), `in:image` (≤8), `in:video` (≤2), `in:audio` (≤2) | `out:video` |
| **autoDownload** | `in:any` (≤16) | — |
| **note** | — | — |

**Nguồn được phép nối** (`ALLOWED_SOURCES`):

| Target | Sources hợp lệ |
|---|---|
| `prompt` | asset, prompt, generateImage, generateVideo |
| `generateImage` | asset, prompt |
| `generateVideo` | asset, prompt |
| `autoDownload` | generateImage, generateVideo |

Validate thêm: tương thích port type, `maxConnections`, không tạo cycle.

### 2.4 Data từng node

**Asset**

- `assetLabel`: Outfit | Background | Character | Video reference | Video expand | Audio voice
- `kind`: image | video | audio
- `source`: `local` | `flow`
- Flow: chỉ giữ `flowMediaId` (+ `flowPreviewUrl` preview) — **không** download/re-upload khi run

**Prompt**

- `provider: 'gemini'`, `preset`: enhance | analyzeImage | script | summarize | translate | brainstorm | **custom**
- `instruction`, `outputFormat`: plain | json
- Preset ≠ `custom` → gọi Gemini; `custom` chỉ compose + forward refs

**Generate Image**

- `model` (mặc định `Nano Banana 2`), `aspectRatio` (`9:16`), `count` 1–4, `resolution` 720/1080, `timeoutSec` (mặc định 600)

**Generate Video**

- Như image + `durationSec` (Omni: 4/6/8/10)
- Models: Omni Flash | Veo 3.1 Lite | Lite Low Priority | Fast (Ultra)

**Auto Download**

- `folderTemplate`: `MyXFlows/{{workflow}}/{{date}}`
- `filenameTemplate`: `{{slug}}_{{index}}`
- `conflict`: uniquify | overwrite

### 2.5 Runtime value roles

Khi `gatherInputs`, mỗi giá trị có `role`:

| Role | Nguồn điển hình | Ý nghĩa |
|---|---|---|
| `prompt` | node Prompt | Text đưa vào generate |
| `ref` | Asset / generate image | Media tham chiếu |
| `continuation` | Generate Video | Scene trước → cắt frame cuối khi kéo dài (I2V) |

- Asset Flow: `flowMediaId` + `fromFlow: true` → **không** `maseQ`
- Asset local: upload một lần / run (cache theo `cacheKey`)

Prompt giữ `[Label]` trần trong narrative; khối `[Label]: mô tả` chuyển thành `[Label]: {mô tả}. Tham khảo https://flow-content.google/…` (`annotateAssetLabels`). Không thay label bằng URL. URL bị replace nhầm từ bản cũ được khôi phục về `[Label]`.

### 2.6 UI canvas

- Component: `WorkflowNodeView` (`type: 'workflow'`)
- Border status: queued / running / success / error
- Run một node: lưu dirty → `workflow.run` mode `node`
- Port `run-events`: `node.status` | `node.progress` | `node.output` | `run.done`
- Chỉ generate*, autoDownload, và prompt (preset ≠ custom) hiện trạng thái chạy trên canvas

### 2.7 Graph mẫu

```
[Asset: Character] ──image──┐
[Asset: Outfit]   ──image──┼──► [Prompt] ──text(+refs)──► [Generate Video]
                              ▲                              │
[Generate Video prev] ─video──┘ (continuation)               ▼
                                                      [Auto Download]
```

- **Omni Flash:** asset chủ yếu là link trong prompt → `YhhmEf`
- **Veo:** đúng 1 ảnh đầu = start frame → `eb1hJf`
- **Kéo dài / scene tiếp:** video → Prompt → Generate Video → extract last frame → upload → Veo i2v

---

## 3. Overview workflow RPC (Google Flow)

Generate **không click** nút Generate trên DOM. DOM chỉ dùng cho auth, diagnose, listMedia, fetchMedia.

### 3.1 Transport

1. `ProviderRouter.execute('flow', { name: 'generate', payload })`
2. `generateViaRpc(tabId, payload, …)` trên service worker
3. Resolve `flowProjectId` (URL `/project/{uuid}` hoặc `chrome.storage.local`)
4. `runBatchRpc`: mint captcha → content `BATCH_RPC` → MAIN `fetch` batchexecute
5. Captcha: MAIN `grecaptcha.enterprise` — action `IMAGE_GENERATION` / `VIDEO_GENERATION`, slot `__CAPTCHA__`

**Endpoint:** `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids={rpcid}`  
**Media CDN:** `flow-content.google`

### 3.2 RPC IDs

| Constant | rpcid | Mục đích |
|---|---|---|
| `RPC_GEN_IMAGE` | `ogiZ0b` | Text / image-to-image |
| `RPC_GEN_VIDEO` | `eb1hJf` | Veo image-to-video |
| `RPC_GEN_VIDEO_TEXT` | `YhhmEf` | Omni Flash text-to-video |
| `RPC_UPLOAD_IMAGE` | `maseQ` | Upload ảnh local → media id |
| `RPC_OPERATION` | `jwpduf` | Poll trạng thái Veo |
| `RPC_PROJECT_MEDIA` | `Zzl0ze` | Liệt kê media project |
| `RPC_MEDIA` | `as29s` | Resolve CDN URL theo media id |

Codec: `src/providers/flow/rpc/batch.ts`  
Orchestrate: `src/providers/flow/rpc/generate.ts`

### 3.3 Model mapping (UI → wire)

| UI | Wire |
|---|---|
| Nano Banana 2 | `NARWHAL` (`ogiZ0b`) |
| Nano Banana 2 Lite | `HARBOR_SEAL` (`ogiZ0b`) |
| Omni Flash | `YhhmEf` + `abra_t2v_{4\|6\|8\|10}s` |
| Veo 3.1 Lite / Low Priority / Fast | `eb1hJf` + `veo_3_1_i2v_*` (fallback khi `MODEL_ACCESS_DENIED`) |

**Không** dùng `ogiZ0b` để tự tạo ảnh trung gian cho video.

### 3.4 Pipeline generate (tóm tắt)

**Image**

1. Resolve refs (Flow id giữ nguyên; local → compress → `maseQ`)
2. Thay `[Label]` trong prompt
3. `count` request `ogiZ0b` (stagger 0/500/1500/2500 ms), mỗi request một captcha
4. Lỗi transient `[8]` → chờ ~34s, retry các index đó
5. Lấy URL ảnh → base64

**Video**

| Trường hợp | Hành vi |
|---|---|
| Omni, không continue | Prompt (+ CDN link) → `YhhmEf` × count → poll media |
| Veo / có frame | Đúng 1 start frame → `eb1hJf` + model fallback |
| continueFrom | Extract last frame → `maseQ` → Veo i2v |
| Không frame + không Omni | Lỗi: chọn Omni hoặc cung cấp 1 ảnh / scene trước |

Poll: mỗi 10s (`jwpduf` + định kỳ `Zzl0ze` → `as29s`).

### 3.5 Action không phải generate

| Action | Cách | Ghi chú |
|---|---|---|
| `checkAuth` | DOM | Sign-in / avatar |
| `diagnose` | DOM | Selector + project URL |
| `listMedia` | DOM gallery | Asset picker |
| `fetchMedia` | fetch URL | → base64 |
| Gemini `prompt` | DOM driver | Không batchexecute |

---

## 4. Detail workflow (end-to-end)

### 4.1 Chạy từ editor

1. User bấm **Run** trên node Generate (hoặc Run full trên toolbar).
2. UI lưu workflow dirty → IndexedDB → `sendToSw({ type: 'workflow.run', workflowId, mode, fromNodeId? })`.
3. SW `RunManager.runWorkflow` → tạo `Run` → queue toàn cục (`maxSpeed` concurrency).
4. Chọn tập node theo mode → `topoSort` (bỏ `note`, `disabled`).
5. Scheduler chạy node sẵn sàng, tối đa `settings.concurrency`.
6. Mỗi node: `gatherInputs` → hash cache → retry (generate mặc định **0**) → `executors[type]`.
7. Generate executor → `callDriver('flow', { name: 'generate', payload })` → `generateViaRpc`.
8. Kết quả: medias → blob (+ `flowMediaId`) → lưu output / preview → broadcast UI.
9. `autoDownload` (nếu nối) → template path → Chrome Downloads.
10. `run.done` + notification; `stopOnError` dừng phần còn lại.

### 4.2 Run modes

| Message / mode | Phạm vi |
|---|---|
| `workflow.run` · `full` | Toàn bộ DAG |
| `workflow.run` · `node` + `fromNodeId` | Upstream + node đó |
| `workflow.run` · `from` / `node.runFrom` | Node + downstream |
| `runAll` | Mọi workflow `enabled` trong workspace |
| `run.cancel` / `workflow.cancel` | AbortController |

### 4.3 Retry & lỗi không retry

**NON_RETRYABLE (engine):**  
`FLOW_ASSET_NO_UPLOAD`, `CONTENT_POLICY`, `AUTH_REQUIRED`, `QUOTA_EXCEEDED`, `SELECTOR_NOT_FOUND`

**Driver / RPC thường gặp:**  
`NO_AT_TOKEN`, `NO_FLOW_PROJECT`, `CAPTCHA_FAILED`, `TIMEOUT`, `TAB_LOST`, `UPLOAD_FAILED`, `MODEL_ACCESS_DENIED` (có fallback Veo), `[13]` INTERNAL trên Veo (fail cứng, không blind retry)

Debug: Editor → **Console** (Ctrl+\`) — log `run` / `node` / `driver` / `rpc`. RPC lỗi có thể kèm `freq` (vẫn `__CAPTCHA__`, không lộ token).

### 4.4 Hằng số hữu ích

| Tên | Ý nghĩa |
|---|---|
| `SCHEMA_VERSION` | `3` |
| `BATCH_PATH` | `/_/AiSandboxAngularFrontend/data/batchexecute` |
| `VIDEO_POLL_INTERVAL_MS` | 10_000 |
| `IMAGE_SUBMIT_OFFSETS_MS` | `[0, 500, 1500, 2500]` |
| `IMAGE_TRANSIENT_RETRY_MS` | 34_000 |
| `FLOW_PROJECT_STORAGE_KEY` | `flowProjectId` |

---

## 5. Index file nguồn

| Concern | Path |
|---|---|
| Schema + migrate | `src/shared/schema/index.ts` |
| Ports / edges | `src/nodes/ports.ts` |
| Registry | `src/nodes/registry.ts` |
| Executors | `src/engine/executors.ts` |
| RunManager | `src/engine/RunManager.ts` |
| Scheduler | `src/engine/scheduler.ts` |
| Resolver | `src/engine/resolver.ts` |
| Messaging | `src/shared/messaging/index.ts` |
| SW entry | `src/background/index.ts` |
| TabPool / router | `src/providers/TabPool.ts` |
| RPC generate | `src/providers/flow/rpc/generate.ts` |
| RPC codec | `src/providers/flow/rpc/batch.ts` |
| RPC runner | `src/providers/flow/rpc/runner.ts` |
| Captcha | `src/providers/flow/rpc/captcha.ts` |
| Editor node | `src/features/editor/nodes/WorkflowNodeView.tsx` |
| Editor shell | `src/features/editor/EditorApp.tsx` |
