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
| Captcha | MAIN-world `grecaptcha.enterprise` (`IMAGE_GENERATION` / `VIDEO_GENERATION`) |
| POST | `chrome.scripting.executeScript({ world: 'MAIN' })` → `/_/AiSandboxAngularFrontend/data/batchexecute` với cookie + `at` (`WIZ_global_data.SNlM0e`) |
| Image | upload refs local nếu có (`maseQ`) → `ogiZ0b` → URL inline → base64. Asset Flow **không** upload lại |
| Video | **Không** tạo ảnh trung gian (`ogiZ0b`). Prompt **không** chứa link CDN. Omni text → `YhhmEf`. Omni + ảnh → `MZZa6b` (ảnh neo trong structured prompt). Veo → đúng 1 start frame → `eb1hJf` → poll… |
| Text-only video | Omni Flash (`abra_t2v_*`). Veo không có start frame → lỗi (không tự gen ảnh) |
| Asset Flow | Chỉ `flowMediaId` trong slot RPC / mảnh image. Mất id → `FLOW_ASSET_NO_UPLOAD`, **không bao giờ** `maseQ` |
| Debug | Editor → **Console**: trước mỗi submit có `payload → {rpcid}` với `wireMediaIds`, `anchoredMediaIds` (MZZa6b), `urlsInPrompt` (phải = 0), `missingRefs`. RPC lỗi kèm `freq` (còn `__CAPTCHA__`) |
| Model video | UI Omni Flash không ảnh → `YhhmEf` / `abra_t2v_*`. Có ảnh → `MZZa6b` / `abra_r2v_*`. Veo labels → `eb1hJf` + fallback nếu `MODEL_ACCESS_DENIED` |
| i2v lỗi `[13]` | Flow từ chối start frame / lỗi nội bộ — báo ngay, **không tự retry** |
| Retry node generate | Mặc định `retry: 0` cho Generate Image/Video |
| Không hỗ trợ (tạm) | Veo ≥ 2 ảnh (r2v qua MZZa6b tuỳ chọn); ref video/audio (Audio voice, Video reference); `entityId` ingredient; extend REST cũ |
| Nhiều asset video | Omni ≤ `OMNI_MAX_REFS` ảnh qua `MZZa6b` (mọi label `kind: image`, gồm Background). Veo ≥ 2 ảnh → lỗi. continueFrom + Veo → chỉ frame cuối trên wire (`eb1hJf`), `[Label]` giữ trong prompt. continueFrom + Omni → frame cuối (`maseQ`) là ảnh đầu tiên `[Cảnh trước]` trong `MZZa6b`, kèm ảnh tham chiếu (tính vào `OMNI_MAX_REFS`); Veo i2v từ frame upload trả "Media not found." nên Omni không đi `eb1hJf`. Không dùng link làm dự phòng |

RPC ids: `ogiZ0b` (image), `eb1hJf` (Veo i2v), `YhhmEf` (Omni text), `MZZa6b` (reference-to-video), `jwpduf` (poll), `Zzl0ze` (project media), `as29s` (media urls), `maseQ` (upload).
`WuwhI` = telemetry UI (sự kiện `MEDIA_GENERATION` / ingredients) — **không** tái tạo / không submit.
Captcha placeholder: `__CAPTCHA__`. Site key: `6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`.

### Nguồn capture MZZa6b

- Fallback fixture: [sp1007/flowkit](https://github.com/sp1007/flowkit) `agent/services/testdata/boq_payloads.json` (MIT), commit `9d119432…` — model Veo `veo_3_1_r2v_lite_low_priority`, cùng wire shape.
- Khoá Omni `abra_r2v_{4,6,8,10}s` xác nhận từ Flow UI (`MEDIA_GENERATION_SETTINGS` trong `WuwhI`, 2026-09-14).
- Fixture local: `tests/fixtures/providers/flow/mzza6b-r2v.json` (+ đối chứng `yhhmef-t2v.json`, `eb1hjf-i2v.json`).
- Drift đã ghi: YhhmEf trailer capture `[uuid,2]` vs app `[uuid,1]` (Omni live); eb1hJf crop capture `[null,null,1,1]` vs app `FULL_FRAME_CROP`.

### Đọc log payload

1. Trước mỗi submit: `payload → MZZa6b (abra_r2v_4s) ref 2/2 vào wire, 0 link`.
2. `wireMediaIds` = `item[1]`; `anchoredMediaIds` = mảnh image trong structured prompt — phải khớp thứ tự.
3. `prompt` dạng chữ với `⟦ảnh [Character] 5ef8…⟧` tại chỗ neo; `urlsInPrompt` chỉ quét mảnh text.
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

## Modules

| Path | Role |
|---|---|
| `rpc/batch.ts` | Envelope build/parse (`referenceVideoRequest`, `omniReferenceVideoModel`) |
| `rpc/promptParts.ts` | `buildReferencePromptParts` — neo `[Label]` → mảnh image |
| `rpc/payloadLog.ts` | `describeSubmit` / `sanitizeFreq` trước khi gửi |
| `rpc/captcha.ts` | SW → content → MAIN grecaptcha |
| `rpc/runner.ts` | `runBatchRpc` via MAIN `executeScript` |
| `rpc/project.ts` | Resolve `flowProjectId` |
| `rpc/generate.ts` | Orchestrate upload → gen → poll → base64 |
| `injected/captcha.ts` | MAIN-world `GET_CAPTCHA` listener |
| `driver.ts` | Auth / diagnose / list / fetch only |

## Manual smoke / E2E

1. Mở `https://flow.google.com/project/<uuid>` và đăng nhập.
2. Nano Banana + Character: log `ogiZ0b`, `urlsInPrompt: 0`, `wireMediaIds` đủ.
3. Omni Flash text-only: `YhhmEf`, không ảnh Nano Banana mới.
4. Video Veo với đúng 1 ảnh start frame (i2v).
5. Character + Outfit (asset Flow) → Prompt → Omni: `MZZa6b`, `abra_r2v_*`, `item[1]` = 2 id, không `maseQ`, đúng mặt/outfit.
6. Character + Outfit (file local) → Omni: `maseQ` mỗi ảnh 1 lần rồi `MZZa6b`.
7. Omni > `OMNI_MAX_REFS` ảnh / Veo + 2 ảnh / Omni + video asset: lỗi rõ, không submit.
8. Scene tiếp Veo (+ Character/Outfit tùy chọn): `maseQ` frame cuối + `eb1hJf`; ảnh tham chiếu chỉ trong prompt.
   Scene tiếp Omni: `maseQ` frame cuối + `MZZa6b` / `abra_r2v_*`, `item[1]` = frame cuối rồi Character/Outfit/Background.
9. Workflow cũ có link trong prompt: link khớp asset → `[Label]`; link lạ → lỗi.

### Kiểm chứng live Omni refs (plan 7.2)

Ghi kết quả sau khi chạy trên tài khoản dự án (khoảng 7 credit / clip Omni 720p 4s):

| # | Thiết lập | Đạt khi | Kết quả |
|---|---|---|---|
| L1 | Omni 4s + 1 asset, prompt không mô tả chủ thể | HTTP 200, mặt giống ảnh, `MZZa6b` + `abra_r2v_4s` | _chưa chạy_ |
| L2 | Như L1 không asset (text) | Nhân vật khác ảnh rõ | _chưa chạy_ |
| L3 | Character + Outfit | Đúng mặt và outfit | _chưa chạy_ |
| L4 | Prompt bắt đầu bằng `[Character]` | Nhận hoặc cần text dẫn | _chưa chạy_ |
| L5 | 7 vs 8 ảnh | 7 chạy, 8 bị app chặn | _chưa chạy_ |

Cập nhật khi wire format đổi; chạy `diagnose()` từ content script (`window.__myXFlowsFlow` trong DEV).
