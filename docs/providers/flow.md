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
| Video | **Không** tạo ảnh trung gian (`ogiZ0b`). Omni Flash → prompt (giữ `[Label]` + chú thích URL) → `YhhmEf`. Veo → đúng 1 start frame → `eb1hJf` → poll… |
| Text-only video | Omni Flash (`abra_t2v_*`). Veo không có start frame → lỗi (không tự gen ảnh) |
| Asset Flow | Chỉ `flowMediaId` / CDN url. Mất id → `FLOW_ASSET_NO_UPLOAD`, **không bao giờ** `maseQ` |
| Debug | Editor → nút **Console** (Ctrl+\`): log run/node/driver/RPC; RPC lỗi kèm `freq` (còn `__CAPTCHA__`, không lộ token) + body |
| Model video | UI Omni Flash → `YhhmEf` / `abra_t2v_*`. Veo labels → `eb1hJf` + fallback nếu `MODEL_ACCESS_DENIED` |
| i2v lỗi `[13]` | Flow từ chối start frame / lỗi nội bộ — báo ngay, **không tự retry** |
| Retry node generate | Mặc định `retry: 0` cho Generate Image/Video |
| Không hỗ trợ | Omni frame/r2v native batch (chưa capture); extend REST cũ |
| Nhiều asset video | Giữ `[Label]` + chú thích URL cuối prompt (Omni). Veo: 1 ảnh đầu = start frame; phần còn lại chỉ qua chú thích/prompt |

RPC ids: `ogiZ0b` (image), `eb1hJf` (video), `jwpduf` (poll), `Zzl0ze` (project media), `as29s` (media urls), `maseQ` (upload).  
Captcha placeholder: `__CAPTCHA__`. Site key: `6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`.

## DOM (không generate)

| Hành động | Ghi chú |
|---|---|
| checkAuth | Sign-in / avatar / prompt bar |
| diagnose | Selector health + project URL |
| listMedia | Quét gallery/result grid → Asset picker |
| fetchMedia | `fetch(url)` → base64 |

## Modules

| Path | Role |
|---|---|
| `rpc/batch.ts` | Envelope build/parse |
| `rpc/captcha.ts` | SW → content → MAIN grecaptcha |
| `rpc/runner.ts` | `runBatchRpc` via MAIN `executeScript` |
| `rpc/project.ts` | Resolve `flowProjectId` |
| `rpc/generate.ts` | Orchestrate upload → gen → poll → base64 |
| `injected/captcha.ts` | MAIN-world `GET_CAPTCHA` listener |
| `driver.ts` | Auth / diagnose / list / fetch only |

## Manual smoke

1. Mở `https://flow.google.com/project/<uuid>` và đăng nhập.
2. Chạy node **Flow – Image** (text-only và có 1 ảnh ref Flow).
3. Chạy node **Flow – Video** Omni Flash text-only / prompt có link asset — **không** xuất hiện ảnh Nano Banana mới.
4. Video Veo với đúng 1 ảnh start frame (i2v).
5. Character + Outfit → Prompt → Omni Video: chỉ `YhhmEf`, không `ogiZ0b`.
6. Kéo dài (video → prompt → video): frame cuối upload (`maseQ`) rồi Veo i2v — không gen scene.

Cập nhật khi wire format đổi; chạy `diagnose()` từ content script (`window.__myXFlowsFlow` trong DEV).
