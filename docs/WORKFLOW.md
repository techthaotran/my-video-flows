# Workflow

Tài liệu kỹ thuật về **node-based workflow**: loại node, kết nối, chạy trên service worker, và pipeline RPC Google Flow.

> Provider Flow chi tiết hơn: [providers/flow.md](./providers/flow.md)  
> Schema version hiện tại: **5** (`SCHEMA_VERSION` trong `src/shared/schema/index.ts`)

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

Node `mergeVideo` không đi qua ProviderRouter — nó xử lý media ngay trong máy:

```
mergeVideoExecutor (Service Worker)
  → composeVideoInOffscreen: ghi blob vào IndexedDB assets, gửi asset id
Offscreen document (có WebCodecs / OffscreenCanvas / AudioContext)
  → composeVideo (mediabunny): decode từng clip → vẽ canvas + logo → encode → mp4
  ← trả asset id của mp4; tiến độ bắn về bằng message riêng
```

Blob không đi qua `chrome.runtime.sendMessage` (không serialize được, base64 thì
quá nặng cho nhiều clip) — cả đầu vào lẫn kết quả đều đi qua bảng `assets` của
IndexedDB, message chỉ mang id. Các message tiến độ còn giữ service worker khỏi
ngủ giữa lúc encode.

| Lớp | Path | Vai trò |
|---|---|---|
| Schema | `src/shared/schema/index.ts` | Node/edge/workflow Zod schema, migrate |
| Ports | `src/nodes/ports.ts` | Handle, màu, luật nối cạnh |
| Registry | `src/nodes/registry.ts` | Định nghĩa UI / toolbar |
| Executors | `src/engine/executors.ts` | Logic chạy từng loại node |
| Run | `src/engine/RunManager.ts` | Queue, retry, cache input hash |
| Scheduler | `src/engine/scheduler.ts` | Topo-sort, upstream/downstream |
| Resolver | `src/engine/resolver.ts` | Ghép prompt, giữ `[Label]` + mô tả (không nhúng URL) |
| Flow RPC | `src/providers/flow/rpc/*` | Generate không click DOM |
| Ghép video | `src/media/*` | WebCodecs compose chạy ở offscreen document |
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
| `mergeVideo` | ✅ | `mergeVideoExecutor` | Ghép clip + audio + logo bằng WebCodecs (offscreen) |
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
| **mergeVideo** | `in:video` (≤32), `in:audio` (≤1), `in:image` (≤1, logo) | `out:video` |
| **autoDownload** | `in:any` (≤16) | — |
| **note** | — | — |

**Nguồn được phép nối** (`ALLOWED_SOURCES`):

| Target | Sources hợp lệ |
|---|---|
| `prompt` | asset, prompt, generateImage, generateVideo |
| `generateImage` | asset, prompt |
| `generateVideo` | asset, prompt |
| `mergeVideo` | asset, generateImage, generateVideo, mergeVideo |
| `autoDownload` | generateImage, generateVideo, mergeVideo |

Validate thêm: tương thích port type, `maxConnections`, không tạo cycle.

### 2.4 Data từng node

**Asset**

- File local: `accept` gồm cả MIME lẫn đuôi (`MEDIA_ACCEPT`), và `kind` suy ra bằng `mediaKindOf` — MIME trước, đuôi file sau. Chrome trả `file.type` rỗng cho `.mp3` trên máy thiếu mapping, đoán theo mặc định sẽ biến mp3 thành ảnh và node xuất sai cổng.
- Chọn file audio ở node đang mang label ảnh/video → label tự chuyển sang `Audio voice` (chỉ một label audio nên không mơ hồ). Ảnh/video có nhiều label nên giữ nguyên lựa chọn của người dùng.

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

**Merge Video** (`mergeVideo`)

- `order`: mảng id node nguồn, quyết định thứ tự ghép. Node mới nối vào mà chưa có trong `order` được ghép sau cùng (`orderedClipIds`).
- `fps` (30), `bitrateMbps` (8) — thông số encode ra mp4.
- `audioStartSec`: mốc bắt đầu cắt trong file audio. Điểm kết thúc luôn là tổng độ dài video; audio ngắn hơn thì phần cuối im lặng.
- `logoXPercent` / `logoYPercent` / `logoWidthPercent` / `logoOpacity`: vị trí, kích thước, độ mờ của logo tính theo % khung hình nên đổi độ phân giải vẫn đúng chỗ (`logoRect`).

Hành vi cố định (không có setting):

- Nút **Ghép video** trên node chạy mode `only`: node generate phía trước dùng lại `previewOutputId` thay vì tạo lại, nên bấm ghép không đốt quota Flow. Upstream chưa từng chạy → báo lỗi rõ thay vì generate ngầm.
- Không blind retry (`retries = 0` như node generate): ghép là việc tất định, chạy lại chỉ lặp đúng lỗi cũ và tốn thêm vài phút CPU.
- **Tiếng gốc của clip bị bỏ hoàn toàn** khi có audio nối vào — audio nền thay thế, không trộn.
- Khung hình đích lấy theo clip đầu tiên; clip khác tỉ lệ được `contain` (viền đen), không cắt xén.
- Chỉ nhận clip **có blob**. Asset Flow chỉ có `flowMediaId` bị từ chối với lỗi `FLOW_ASSET_NO_UPLOAD` — không tải về, không upload lại.

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

Prompt giữ `[Label]` trần trong narrative; khối `[Label]: mô tả` gom xuống `Danh sách tham chiếu` (`annotateAssetLabels`).
Asset đã có `flowMediaId` hiện `mediaId {uuid}` trên dòng tham chiếu (không nhúng URL CDN).
Media id gửi generate vẫn đi qua slot RPC; URL Flow trong prompt cũ khớp asset → khôi phục `[Label]`; URL lạ → lỗi trước submit.

### 2.6 UI canvas

- Component: `WorkflowNodeView` (`type: 'workflow'`)
- Border status: queued / running / success / error
- Run một node: lưu dirty → `workflow.run` mode `node`
- Port `run-events`: `node.status` | `node.progress` | `node.output` | `run.done`
  - Kênh **tự nối lại** (`connectRunEvents` trả về `RunEventsChannel`). Service worker MV3 bị Chrome tắt khi rảnh và port chết theo; port một lần thì run vẫn chạy ở service worker nhưng UI câm hẳn — bấm chạy lần hai không thấy progress, preview không đổi.
  - Khi UI nối (lại), service worker gửi `queue.update` + `log.snapshot` + `replayActiveStatuses()` (trạng thái các node đang chạy), để reconnect giữa chừng không để UI treo ở trạng thái cũ.
- Chỉ generate*, mergeVideo, autoDownload, và prompt (preset ≠ custom) hiện trạng thái chạy trên canvas
- `mergeVideo` có UI riêng (`nodes/MergeVideoBody.tsx`), không dùng chung khối preview của node generate: mỗi clip là một hàng có thumbnail + id/slug node nguồn + độ dài, nút ↑↓ đổi thứ tự; logo kéo thả / kéo góc để resize trên preview khung hình; thanh progress riêng khi ghép; player + nút Tải video cho kết quả
- Hook dùng chung cho preview media: `nodes/useMediaUrl.ts` (`useOutputUrl`, `useNodeOutputUrl`, `useMediaDuration`). Hai bẫy đã gặp, đừng làm lại:
  - Object URL cũ chỉ được `revokeObjectURL` **sau khi** URL mới đã set. Thu hồi trong cleanup của effect thì `<video>` còn đang render URL cũ (state chưa đổi) trong lúc blob mới còn đọc dở → thẻ video trỏ vào blob đã huỷ.
  - Không nạp lại preview theo trạng thái chạy (`running`/`success`) — chỉ theo `previewOutputId` + `previewRev`. Trạng thái đổi không làm nội dung đổi, nạp lại theo nó chỉ tạo thêm một nhịp không có video.
- `NodeVideoPlayer` đặt `key={src}`: đổi video là thay hẳn phần tử, không giữ buffer/timeline cũ. Sự kiện `error` cũng phải đối chiếu `e.currentTarget === videoRef.current` — lỗi bất đồng bộ của src cũ tới sau khi src đã đổi sẽ khoá player ở màn hình "không phát được" dù video mới bình thường.

**Cửa sổ "Chạy"** (`src/features/runner/`, page `src/pages/runner/`):
- Mở bằng `runner.open` (nút "Tải lên" ở side panel); popup 1280×800, tối đa một cửa sổ mỗi workflow.
- Đọc workflow bằng `useLiveQuery(() => workflowRepo.get(id))`; ghi field bằng `workflowRepo.patchNodeData` (không tạo revision).
- Trạng thái chạy: `useRunnerStore` hydrate từ `runRepo.latestNodeRuns` + `connectRunEvents`.
- Tạo lại một cảnh: `workflow.regenerate` (SW chạy mode `only`, rồi tự ghép nếu đủ clip).

**Editor đồng bộ bên ngoài:**
- `useLiveQuery` + `applyExternalWorkflow`: node không thuộc `dirtyNodeIds` nhận `data` mới từ DB; node đang sửa giữ bản editor.
- Lưu bằng `workflowRepo.saveFromEditor(wf, dirtyNodeIds)` - cấu trúc lấy từ editor, data node không dirty lấy từ DB.
- Khoá workflow ghi ngay bằng `workflowRepo.setLocked` để cửa sổ "Chạy" khoá theo.

### 2.7 Graph mẫu

```
[Asset: Character]  ──image──┐
[Asset: Outfit]     ──image──┼──► [Prompt] ──text(+refs)──► [Generate Video]
[Asset: Background] ──image──┤     ▲                              │
                                 │                              ▼
[Generate Video prev] ──video────┘ (continuation)        [Auto Download]
```

- **Omni Flash text-only:** prompt thuần → `YhhmEf` / `abra_t2v_*`
- **Omni + ảnh:** structured prompt neo ảnh tại `[Label]` → `MZZa6b` / `abra_r2v_*` (tối đa `OMNI_MAX_REFS`).
  Mọi label `kind: image` (Character, Outfit, Background, …) đều neo media id như nhau.
- **Veo:** đúng 1 ảnh = start frame → `eb1hJf`; ≥ 2 ảnh → lỗi
- **Audio / Video reference:** nối vào Generate Video → lỗi rõ (`refKindUnsupported`); mô tả chữ `[Audio voice]: …` trong prompt vẫn được.
- **Kéo dài / scene tiếp:** video → Prompt (cắt frame cuối, offscreen) → Generate Video → driver upload frame → Veo i2v hoặc Omni `MZZa6b`.
  Veo: Character/Outfit/Background giữ `[Label]` + mô tả trong prompt, **không** gửi media id (slot start frame đã dùng cho frame cuối).
  Omni: frame cuối là ảnh đầu tiên `[Cảnh trước]`, sau đó các ảnh tham chiếu (tính vào `OMNI_MAX_REFS`).
- **Cache frame cuối:** Prompt nhận video lưu frame cuối vào assets và gắn `continueFrameAssetId` trên chính Prompt.
  Xoá liên kết Generate Video → Prompt thì Prompt vẫn hiện frame đã lưu và chuyển tiếp nó; bấm × trên thumbnail để tạo cảnh mới.
  Asset của frame bị mất → lỗi rõ, không tự chuyển sang cảnh mới.
- **Generate Video không có prompt nhưng còn nối node phía sau:** khi chạy, node không generate mà chuyển tiếp video đã tạo lần trước (`previewOutputId`), trạng thái success kèm thông báo.
  Không có video cũ (vd. đã Reset) → lỗi "Thiếu prompt" như trước.
- **Generate Video → "Chỉ node này"** (run mode `only`): các node phía trước vẫn chạy (Prompt, Asset), nhưng mọi Generate Image/Video phía trước dùng lại kết quả đã hiển thị (`previewOutputId`, kèm `flowMediaId` lưu trong output), chỉ node được chọn gọi Flow.
  Node Generate phía trước chưa có kết quả → run dừng với lỗi rõ; nút "Generate" giữ hành vi cũ (tạo lại cả phía trước).

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
| `RPC_GEN_VIDEO_REFS` | `MZZa6b` | Omni (và Veo r2v) reference-to-video — ảnh neo trong structured prompt |
| `RPC_UPLOAD_IMAGE` | `maseQ` | Upload ảnh local → media id |
| `RPC_OPERATION` | `jwpduf` | Poll trạng thái Veo |
| `RPC_PROJECT_MEDIA` | `Zzl0ze` | Liệt kê media project |
| `RPC_MEDIA` | `as29s` | Resolve CDN URL theo media id |

`WuwhI` là telemetry UI (không phải submit) — không gọi.

Codec: `src/providers/flow/rpc/batch.ts`  
Orchestrate: `src/providers/flow/rpc/generate.ts`

### 3.3 Model mapping (UI → wire)

| UI | Wire |
|---|---|
| Nano Banana 2 | `NARWHAL` (`ogiZ0b`) |
| Nano Banana 2 Lite | `HARBOR_SEAL` (`ogiZ0b`) |
| Omni Flash (text) | `YhhmEf` + `abra_t2v_{4\|6\|8\|10}s` |
| Omni Flash (có ảnh) | `MZZa6b` + `abra_r2v_{4\|6\|8\|10}s` |
| Veo 3.1 Lite / Low Priority / Fast | `eb1hJf` + `veo_3_1_i2v_*` (fallback khi `MODEL_ACCESS_DENIED`) |

**Không** dùng `ogiZ0b` để tự tạo ảnh trung gian cho video.

### 3.4 Pipeline generate (tóm tắt)

**Image**

1. Resolve refs (Flow id giữ nguyên; local → compress → `maseQ`)
2. Giữ `[Label]` trong prompt; media id vào `refMediaIds`
3. `count` request `ogiZ0b` (stagger 0/500/1500/2500 ms), mỗi request một captcha
4. Lỗi transient `[8]` → chờ ~34s, retry các index đó
5. Lấy URL ảnh → base64

**Video**

| Trường hợp | Hành vi |
|---|---|
| Omni, không ref | Prompt (không CDN link) → `YhhmEf` × count → poll media |
| Omni, 1..`OMNI_MAX_REFS` ảnh | `buildReferencePromptParts` → `MZZa6b` / `abra_r2v_*` → poll media |
| Omni, > `OMNI_MAX_REFS` ảnh | Lỗi rõ ràng, không cắt bớt |
| Veo, 1 ảnh | Start frame → `eb1hJf` + model fallback |
| Veo, ≥ 2 ảnh | Lỗi rõ ràng |
| continueFrame, Veo | Frame cuối → `maseQ` → Veo i2v; `[Label]` giữ trong prompt; không upload / không wire media id của Character/Outfit |
| continueFrame, Omni | Frame cuối → `maseQ` → `MZZa6b` (frame cuối trước, rồi ảnh tham chiếu) |
| Không frame + không Omni | Lỗi: chọn Omni hoặc cung cấp 1 ảnh / scene trước |

Poll: mỗi 10s (`jwpduf` + định kỳ `Zzl0ze` → `as29s`).

### 3.5 Action không phải generate

| Action | Cách | Ghi chú |
|---|---|---|
| `checkAuth` | DOM | Sign-in / avatar |
| `diagnose` | DOM | Selector + project URL |
| `listFlowMedia` | `Zzl0ze` phân trang (+ DOM trang đầu) | Asset picker — bấm số trang |
| `signFlowMedia` | `as29s` theo trang UI | Preview CDN đã ký |
| `listMedia` | DOM gallery | Bổ sung media mới trên tab (trang đầu) |
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
| `workflow.run` · `only` + `nodeId` | Upstream chạy (generate phía trước dùng lại `previewOutputId`); chỉ node được chọn gọi Flow / compose |
| `workflow.run` · `from` / `node.runFrom` | Node + downstream |
| `workflow.regenerate` | Mode `only` trên một generate; nếu thành công và đủ clip thì xếp thêm run `only` trên Merge |
| `runAll` | Mọi workflow `enabled` trong workspace |
| `run.cancel` / `workflow.cancel` | AbortController |

### 4.3 Retry & lỗi không retry

**NON_RETRYABLE (engine):**  
`FLOW_ASSET_NO_UPLOAD`, `CONTENT_POLICY`, `AUTH_REQUIRED`, `QUOTA_EXCEEDED`, `SELECTOR_NOT_FOUND`

**Driver / RPC thường gặp:**  
`NO_AT_TOKEN`, `NO_FLOW_PROJECT`, `CAPTCHA_FAILED`, `TIMEOUT`, `TAB_LOST`, `UPLOAD_FAILED`, `MODEL_ACCESS_DENIED` (có fallback Veo), `[13]` INTERNAL trên Veo (fail cứng, không blind retry)

`TAB_LOST` chỉ ném ra sau khi `sendToContent` đã thử phục hồi: gửi message →
nếu Chrome trả `Receiving end does not exist` thì inject lại content script của
provider (`chrome.scripting.executeScript`, giữ nguyên trang) → vẫn hỏng thì
reload tab rồi thử lần cuối. Cả hai entry point content script đều idempotent
(cờ `__myXFlowsFlowContent` / `__myXFlowsGeminiContent`) nên inject lặp không
đăng ký listener hai lần. Thông điệp cuối là tiếng Việt chỉ rõ việc cần làm;
chuỗi gốc của Chrome chỉ nằm ở `error.cause` cho log.

Debug: Editor → **Console** (Ctrl+\`) — log `run` / `node` / `driver` / `rpc`. RPC lỗi có thể kèm `freq` (vẫn `__CAPTCHA__`, không lộ token).

### 4.4 Hằng số hữu ích

| Tên | Ý nghĩa |
|---|---|
| `SCHEMA_VERSION` | `5` |
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
| Merge ready (isMergeReady) | `src/engine/mergeReady.ts` |
| Scheduler | `src/engine/scheduler.ts` |
| Resolver | `src/engine/resolver.ts` |
| Messaging | `src/shared/messaging/index.ts` |
| SW entry | `src/background/index.ts` |
| Popup windows | `src/background/windows.ts` |
| TabPool / router | `src/providers/TabPool.ts` |
| RPC generate | `src/providers/flow/rpc/generate.ts` |
| RPC codec | `src/providers/flow/rpc/batch.ts` |
| RPC runner | `src/providers/flow/rpc/runner.ts` |
| Captcha | `src/providers/flow/rpc/captcha.ts` |
| Ghép video — engine | `src/media/composeVideo.ts` (WebCodecs, chạy ở offscreen) |
| Ghép video — bridge SW | `src/media/composeClient.ts`, `src/media/composeTypes.ts` |
| Ghép video — toán bố cục | `src/media/layout.ts` |
| Offscreen document | `src/pages/offscreen/main.ts`, `src/media/offscreenBridge.ts` |
| Editor node | `src/features/editor/nodes/WorkflowNodeView.tsx`, `nodes/MergeVideoBody.tsx` |
| Editor shell | `src/features/editor/EditorApp.tsx` |
| Cửa sổ "Chạy" | `src/features/runner/` |
| Page runner | `src/pages/runner/` |
