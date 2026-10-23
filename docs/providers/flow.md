# Google Flow provider notes

> **Transport (2026):** batchexecute RPC inside a signed-in `flow.google.com` tab.
> DOM automation remains only for `checkAuth` / login / light `diagnose` / gallery `listMedia` / `fetchMedia`.
> **Generate** does **not** click prompt/Generate — see `src/providers/flow/rpc/`.
>
> **URL chính:** `https://flow.google.com/` (project: `/project/<uuid>`).
> Legacy: `https://labs.google/fx/tools/flow` — vẫn giữ match để tương thích redirect.
> Media CDN: `https://flow-content.google/*`.

## Auth

| Tín hiệu | Cách nhận biết |
|---|---|
| Đã đăng nhập | Avatar account / prompt bar hiện / URL `flow.google.com` không phải Sign in |
| Chưa đăng nhập | Nút Sign in / redirect accounts.google.com |

## Generate (RPC)

| Bước | Chi tiết |
|---|---|
| Tab | `TabPool.acquire('flow')` — ưu tiên tab có `/project/{uuid}` |
| Project | UUID từ URL hoặc `chrome.storage.local.flowProjectId` → lỗi `NO_FLOW_PROJECT` |
| Captcha | MAIN-world `grecaptcha.enterprise` (`IMAGE_GENERATION` / `VIDEO_GENERATION`). Trang Flow ghi đè `execute` thành action `extension_hijack_detected`; mint phải giữ action thật, không thì submit trả `PUBLIC_ERROR_UNUSUAL_ACTIVITY`. |
| POST | `chrome.scripting.executeScript({ world: 'MAIN' })` → `/_/AiSandboxAngularFrontend/data/batchexecute` với cookie + `at` (`WIZ_global_data.SNlM0e`) |
| Image | upload refs local nếu có (`maseQ`) → `ogiZ0b` → URL inline → base64. Asset Flow **không** upload lại |
| Upload ảnh local | JPEG/PNG ≤ 1,2MB và cạnh ≤ 1536px gửi nguyên file gốc; ảnh lớn hơn hoặc định dạng khác mới vẽ lại thành JPEG (`canUploadOriginal`). Upload xong node Asset ảnh thành asset Flow trên id đó (`source: flow`, `flowMediaId` = `uploadedMediaId`), vẫn giữ file local để xem trước, gửi Gemini và đóng gói khi xuất; xuất `.xflow` trả node về file local |
| Video | **Không** tạo ảnh trung gian (`ogiZ0b`). Prompt **không** chứa link CDN. Omni text → `YhhmEf`. Omni + ảnh → `MZZa6b` (ảnh neo trong structured prompt). Veo → đúng 1 start frame → `eb1hJf` → poll… |
| Text-only video | Omni Flash (`abra_t2v_*`). Veo không có start frame → lỗi (không tự gen ảnh) |
| Asset Flow | Chỉ `flowMediaId` trong slot RPC / mảnh image. Mất id → `FLOW_ASSET_NO_UPLOAD`, **không bao giờ** `maseQ` |
| Debug | Editor → **Console**: trước mỗi submit có `payload → {rpcid}` với `wireMediaIds`, `anchoredMediaIds` (MZZa6b), `urlsInPrompt` (phải = 0), `missingRefs`. RPC lỗi kèm `freq` (còn `__CAPTCHA__`) |
| Model video | UI Omni Flash không ảnh → `YhhmEf` / `abra_t2v_*`. Có ảnh → `MZZa6b` / `abra_r2v_*`. Veo labels → `eb1hJf` + fallback nếu `MODEL_ACCESS_DENIED` |
| i2v lỗi `[13]` | Flow từ chối start frame / lỗi nội bộ — báo ngay, **không tự retry** |
| r2v lỗi `[5]` | `MZZa6b` trả NOT_FOUND = tài khoản không có nhánh Veo r2v (khác `MODEL_ACCESS_DENIED` gate từng key): bỏ luôn các key `veo_3_1_r2v_*` còn lại, nhảy thẳng sang `abra_r2v_*` |
| Retry node generate | Mặc định `retry: 0` cho Generate Image/Video |
| Video reference | Chỉ Omni: video edit `jIps6` / `abra_edit` (xem mục dưới). Veo + video → lỗi |
| Không hỗ trợ (tạm) | Veo ≥ 2 ảnh (r2v qua MZZa6b tuỳ chọn); ref audio (Audio voice); `entityId` ingredient; extend REST cũ |
| Nhiều asset video | Omni ≤ `OMNI_MAX_REFS` ảnh qua `MZZa6b` (mọi label `kind: image`, gồm Background). Veo ≥ 2 ảnh → lỗi (không continue). continueFrame (Omni hoặc Veo) → frame cuối `maseQ` rồi `MZZa6b` (Omni `abra_r2v_*` / Veo `veo_3_1_r2v_*` với fallback chuỗi r2v rồi `abra_r2v_*` nếu tài khoản không có Veo r2v); frame là ảnh đầu `[Cảnh trước]`; **không** `eb1hJf` vì maseQ frame trả "Media not found.". Không dùng link làm dự phòng |

Veo ảnh local: id upload đã lưu mà Flow không còn biết → bỏ id, upload lại (`maseQ`) và thay id mới; id mới phải resolve được (poll `as29s`) rồi mới submit. `eb1hJf` chỉ nhận id do Flow sinh (id `maseQ` báo "Media not found." sau submit), nên start frame là file local đi qua `MZZa6b` (`veo_3_1_r2v_*`, fallback `abra_r2v_*`); start frame là asset Flow vẫn `eb1hJf`.

RPC ids: `ogiZ0b` (image), `SPrCad` (image 2K upscale/download), `eb1hJf` (Veo i2v), `YhhmEf` (Omni text), `MZZa6b` (reference-to-video), `jIps6` (Omni video edit), `jwpduf` (poll), `Zzl0ze` (project media), `as29s` (media urls), `maseQ` (upload), `mYWVGd` (metadata `primary_media_id`).
`WuwhI` = telemetry UI (sự kiện `MEDIA_GENERATION` / ingredients) - **không** tái tạo / không submit.
Captcha placeholder: `__CAPTCHA__`. Site key: `6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`.

### 2K upscale (`SPrCad`) - capture 2026-09-26

Spike Phase 0 (fashion-image): trên tab Flow đã đăng nhập, gen ảnh rồi bấm Download **2K**.

| Bước | RPC | Ghi chú |
|---|---|---|
| Gen ảnh | `ogiZ0b` | Vẫn 1K; response có dims ví dụ `[896, 1200]` + URL CDN |
| Tải 2K | `SPrCad` | Upscale/download riêng; **không** phải tham số trong `ogiZ0b` |
| Metadata | `mYWVGd` | `[["<editOrSessionId>",null,null,[null,null,null,null,"<mediaId>"],"<projectId>"],[["metadata.primary_media_id"]]]` - không generate |

Wire `SPrCad` (đã thay captcha):

```json
["<sourceMediaId>", 1, [null, 22, null, null, null, "<projectId>", null, null, null, null, ["__CAPTCHA__", 1]]]
```

- `sourceMediaId` = media id ảnh vừa gen (`ogiZ0b`).
- Slot `1` = mode 2K (file tải về tên `…_2K_…`).
- Context slot `22` = `SURFACE_ID` (giống generate khác), không phải độ phân giải.
- Response: JPEG base64 inline trong `wrb.fr`; sample **1792×2400** (= 2× `[896, 1200]`), ~662 KB.
- Watermark: C2PA ghi SynthID **không nhìn thấy**; **không** logo Flow/Google trên ảnh.
  Watermark brand sẵn trên ảnh nguồn (nếu có) vẫn giữ.

### Video reference: Omni video edit (`jIps6`) - capture 2026-10-19

Flow chỉ nhận video làm đầu vào qua chỉnh sửa video của Omni.
Trong composer, khi Ingredients có video thì request đổi từ `REFERENCES` (`MZZa6b`) sang `EDIT_VIDEO` (`jIps6` = `BatchAsyncGenerateVideoEditVideo`), chỉ dùng video đầu tiên.
Model duy nhất có capability video (`GetModels` / `HTrJv`): `abra_edit`, tối đa 5 ingredient (r2v: 7), UI báo 20 credit cho clip 8s 720p.
Veo không có đường nhận video (chỉ Extend cho clip Veo tự tạo, `fZytfe`).

Wire (bắt từ UI, chặn trước khi gửi nên không tốn credit; fixture `tests/fixtures/providers/flow/jips6-edit.json`):

```json
[[[[null, "<videoId>", 0, 192],
   [null, null, [[["<prompt text>"]]]],
   "abra_edit", 1,
   [null, null, null, null, "<uuid>", "<uuid>"],
   null, null, null,
   [[null, "<imageId>"]]]],
 [null, 22, null, null, null, "<projectId>", null, null, null, null, ["__CAPTCHA__", 1]],
 ["<uuid>", 2]]
```

- `item[0]` = video vào: `[null, mediaId, startFrame, endFrame]`, đơn vị là frame **của chính clip** (UI đọc fps của clip, thiếu thì 24), tối đa 10s.
  Clip Studio 3D 30 fps 8s → 240; gửi 192 thì Flow chỉ lấy 6,4s đầu (đã gặp khi chạy thật).
- `item[1]` = structured prompt giống `MZZa6b`; `item[8]` = ảnh tham chiếu `[[null, id], …]`.
  App neo mọi ảnh tại `[Label]` (UI có thể gửi ảnh không neo); `[Video reference]` thay bằng chữ vì video không phải mảnh ảnh.
- Độ dài clip ra theo đoạn video (UI: "Length based on ingredient"), không có thời lượng trong payload.
- Response / poll giống `MZZa6b` (`readTextVideoSubmit` + `jwpduf`): đã chạy thật qua extension 2026-10-19 (upload → `jIps6` → poll → clip).
  Video thử quay người thật bị `PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED`; previz ma-nơ-canh Studio 3D + `[Model]` ra clip đúng dáng đứng, bước tới và máy đẩy vào.

Upload video local (không phải `maseQ`; asset Flow vẫn **không** upload lại) - Scotty resumable cùng origin, chạy trong content script (`rpc/videoUpload.ts`, message `flow.uploadVideo`):

| Bước | Request | Ghi chú |
|---|---|---|
| start | `POST /upload/v1/flow/upload/video/{projectId}` | `X-Goog-Upload-Protocol: resumable`, `X-Goog-Upload-Command: start`, `X-Goog-Upload-Header-Content-Length`, `Slug` (tên file); trả header `X-Goog-Upload-URL` |
| finalize | `POST <X-Goog-Upload-URL>` + bytes | `X-Goog-Upload-Command: upload, finalize`, `X-Goog-Upload-Offset: 0` |

- Response finalize (fixture `video-upload-finalize.json`): `mediaId`, `media.video.dimensions.length` (`"4s"`), trạng thái `MEDIA_GENERATION_STATUS_PENDING` → chờ `as29s` trả URL rồi mới submit.
- UI Flow cho upload ≤ 60s / 1 GB, cắt về ≤ 30s; tuỳ chọn header `x-trim-start` / `x-trim-end` (ms). App không cắt: clip > 10s báo lỗi trước khi upload.
- Lần đầu upload video trong UI, Flow hỏi "Rights to use this video"; upload qua app không đi qua hộp thoại này.
- Độ dài và fps lấy từ track video trong `moov` (`mdhd` + `stsz`, `src/media/mp4Info.ts`): file local trước khi upload, asset Flow sau khi tải bản ký `as29s`.

### Nguồn capture MZZa6b

- Fallback fixture: [sp1007/flowkit](https://github.com/sp1007/flowkit) `agent/services/testdata/boq_payloads.json` (MIT), commit `9d119432…` — model Veo `veo_3_1_r2v_lite_low_priority`, cùng wire shape.
- Khoá Omni `abra_r2v_{4,6,8,10}s` xác nhận từ Flow UI (`MEDIA_GENERATION_SETTINGS` trong `WuwhI`, 2026-09-14).
- Fixture local: `tests/fixtures/providers/flow/mzza6b-r2v.json` (+ đối chứng `yhhmef-t2v.json`, `eb1hjf-i2v.json`).
- YhhmEf trailer khớp capture `[uuid, 2]` (Omni Flash UI, 2026-10-12).
- Drift đã ghi: eb1hJf crop capture `[null,null,1,1]` vs app `FULL_FRAME_CROP`.

### Đọc log payload

1. Trước mỗi submit: `payload → MZZa6b (abra_r2v_4s) ref 2/2 vào wire, 0 link`.
2. `wireMediaIds` = `item[1]`; `anchoredMediaIds` = mảnh image trong structured prompt — phải khớp thứ tự.
3. `prompt` dạng chữ với `⟦ảnh [Model] 5ef8…⟧` tại chỗ neo; `urlsInPrompt` chỉ quét mảnh text.
4. `missingRefs` hoặc `urlsInPrompt > 0` → warn và **không** submit.

## DOM / listing (không generate)

| Hành động | Ghi chú |
|---|---|
| checkAuth | Sign-in / avatar / prompt bar |
| diagnose | Selector health + project URL |
| listFlowMedia | Picker: một trang `Zzl0ze` (`pageToken`); trang đầu merge DOM gallery; favourite ở clip-summary `meta[3]`, mediaId `meta[4]` |
| signFlowMedia | `as29s` theo trang đang xem (concurrency 8); video ưu tiên poster `/image/` làm thumb |
| listMedia | Quét gallery DOM — chỉ bổ sung trang đầu picker |
| fetchMedia | `fetch(url)` → base64 |
| fetchMediaById | SW ký url qua `as29s` rồi tab Flow `fetchMedia` → base64; Prompt dùng để gửi ảnh Flow cho Gemini (tải 1 lần/run, không bao giờ `maseQ`) |

## Modules

| Path | Role |
|---|---|
| `rpc/batch.ts` | Envelope build/parse (`referenceVideoRequest`, `omniReferenceVideoModel`) |
| `rpc/promptParts.ts` | `buildReferencePromptParts` — neo `[Label]` → mảnh image |
| `rpc/videoUpload.ts` | Upload video local (Scotty) - chạy trong content script qua message `flow.uploadVideo` |
| `rpc/payloadLog.ts` | `describeSubmit` / `sanitizeFreq` trước khi gửi |
| `rpc/captcha.ts` | SW → content → MAIN grecaptcha |
| `rpc/runner.ts` | `runBatchRpc` via MAIN `executeScript` |
| `rpc/project.ts` | Resolve `flowProjectId` |
| `rpc/generate.ts` | Orchestrate upload → gen → poll → base64 |
| `injected/captcha.ts` | MAIN-world `GET_CAPTCHA` listener |
| `driver.ts` | Auth / diagnose / list / fetch only |

## Manual smoke / E2E

1. Mở `https://flow.google.com/project/<uuid>` và đăng nhập.
2. Nano Banana + Model: log `ogiZ0b`, `urlsInPrompt: 0`, `wireMediaIds` đủ.
3. Omni Flash text-only: `YhhmEf`, không ảnh Nano Banana mới.
4. Video Veo với đúng 1 ảnh start frame (i2v).
5. Model + Outfit (asset Flow) → Prompt → Omni: `MZZa6b`, `abra_r2v_*`, `item[1]` = 2 id, không `maseQ`, đúng mặt/outfit.
6. Model + Outfit (file local) → Omni: `maseQ` mỗi ảnh 1 lần rồi `MZZa6b`; lần sau node đã thành asset Flow, không `maseQ`.
7. Omni > `OMNI_MAX_REFS` ảnh / Veo + 2 ảnh / Veo + video / Omni + 2 video / video > 10s: lỗi rõ, không submit.
8. Scene tiếp (Veo hoặc Omni, + Model/Outfit tùy chọn): `maseQ` frame cuối + `MZZa6b` (`veo_3_1_r2v_*` / `abra_r2v_*`); `item[1]` = frame cuối rồi Model/Outfit/Background. Không `eb1hJf`.
9. Workflow cũ có link trong prompt: link khớp asset → `[Label]`; link lạ → lỗi.
10. Omni + Video reference (file local ≤ 10s) + Model: `flow.uploadVideo` một lần, chờ `as29s`, rồi `jIps6` (`abra_edit`); `wireMediaIds` = video rồi ảnh; clip ra theo chuyển động/góc máy của video.

### Kiểm chứng live Omni refs (plan 7.2)

Ghi kết quả sau khi chạy trên tài khoản dự án (khoảng 7 credit / clip Omni 720p 4s):

| # | Thiết lập | Đạt khi | Kết quả |
|---|---|---|---|
| L1 | Omni 4s + 1 asset, prompt không mô tả chủ thể | HTTP 200, mặt giống ảnh, `MZZa6b` + `abra_r2v_4s` | _chưa chạy_ |
| L2 | Như L1 không asset (text) | Nhân vật khác ảnh rõ | _chưa chạy_ |
| L3 | Model + Outfit | Đúng mặt và outfit | _chưa chạy_ |
| L4 | Prompt bắt đầu bằng `[Model]` | Nhận hoặc cần text dẫn | _chưa chạy_ |
| L5 | 7 vs 8 ảnh | 7 chạy, 8 bị app chặn | _chưa chạy_ |

Cập nhật khi wire format đổi; chạy `diagnose()` từ content script (`window.__myXFlowsFlow` trong DEV).
