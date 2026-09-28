# Implementation Plan API: Workflow tạo hình thời trang (Flow)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-26-fashion-image-workflow.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- Trong repo này "API" = service worker (`src/background`), engine (`src/engine`), provider (`src/providers`), template seed (`src/templates`). Không có backend.

---

## Phase 0 - Spike 2K và watermark trên Flow

*(Work matrix: #1)*

**Changes**
- Không sửa code. Người dùng mở tab Flow đã đăng nhập, tạo 1 ảnh, bấm tải/upscale 2K; agent đọc network request qua trình duyệt để lấy RPC id, tham số độ phân giải và response.
- Ghi kết quả vào `docs/providers/flow.md` (dòng "RPC ids") và cập nhật danh sách RPC trong `AGENTS.md` nếu có RPC mới.
- Kiểm tra ảnh 2K tải về có logo hiển thị hay không.
- Không đạt (không có 2K hoặc có logo) → dừng, báo người dùng, không sang Phase 1.

**Verify**
- Automated: N/A
- Manual: Có RPC id + tham số 2K ghi trong `docs/providers/flow.md`; ảnh mẫu 2K mở ra đúng kích thước, không logo.

---

## Phase 2 - Preset thời trang, dùng lại prompt, 2K, template, hồi quy video

*(Work matrix: #6, #7, #8, #9, #10, #11, #12)*

**Changes**
- `src/engine/presets/fashion.ts` (mới) - `FASHION_SYSTEM: Record<FashionPreset, string>` cho `fashionScene`, `fashionModel`, `fashionOutfit`, `fashionColor`; mỗi system prompt yêu cầu JSON có `type` (`scene` | `model` | `outfit` | `palette`), `summary` và các khối đã chốt (scene: pose, camera, lighting, background, mood, color_grading, bỏ qua người/đồ trong ảnh; model: identity, must_keep, never_change; outfit: items, accessories, must_keep, negative; palette: base, accent, neutral hex + rule theo phong cách trong instruction).
- `src/engine/presets/fashion.ts` - `composeFashionPrompt(texts: string[]): string` hàm thuần: parse an toàn từng khối, xếp `model` > `outfit` > `palette` > `scene`, render prompt tiếng Anh theo template cố định kèm câu ưu tiên ("giữ nguyên danh tính người mẫu trong ảnh tham chiếu"); khối không parse được → throw lỗi tiếng Việt từ `strings`.
- `src/engine/executors.ts:172` - `PRESET_SYSTEM` gộp `FASHION_SYSTEM`; `promptExecutor` với `fashionCompose` gọi `composeFashionPrompt` thay cho Gemini.
- `src/engine/executors.ts:207` - `promptExecutor`: tính `reuseHash = hash({ preset, instruction, model, outputFormat, upstream texts, sha256 từng ảnh })` bằng `hashBlobContent` (mỗi blob hash một lần); `reusePrompt && formattedOutput && reuseHash khớp` → trả `formattedOutput`, `onProgress(100, strings.promptReused)`, không gọi driver.
- `src/engine/executors.ts:246` - `forwardRefs === false` → chỉ trả output text (không kèm refs); continuation vẫn giữ.
- `src/engine/types.ts` - output text của Prompt mang thêm `reuseHash` để RunManager patch.
- `src/engine/RunManager.ts:586` - patch `formattedOutput` + `reuseHash` cùng lúc.
- `src/engine/cache.ts` + `src/engine/RunManager.ts` - `computeInputHash` dùng `sha256` nội dung thay cho `{ size, type }` của blob.
- `src/providers/flow/rpc/generate.ts:505` - `imageRequest` nhận `resolution`; áp theo RPC/tham số tìm ở Phase 0; `logPayload` ghi `resolution`, không ghi captcha.
- `src/engine/executors.ts:327` - `generateImageExecutor` truyền `data.resolution`.
- `src/shared/messaging/index.ts` - thêm `resolution` vào payload generate image trong union type (nếu payload khai báo ở đây).
- `src/templates/seed/index.ts` - template `tpl-fashion-image`: 3 Asset (Ảnh mẫu, Người mẫu, Outfit) → 3 Prompt `fashionScene`/`fashionModel`/`fashionOutfit` → `fashionColor` (instruction "Phong cách: sang trọng", ghi chú 3 lựa chọn) → `fashionCompose` → Generate Image (2K, 9:16) → Auto Download; `fashionScene` có `forwardRefs: false`; node Note hướng dẫn.
- `tests/unit/fashion-compose.test.ts` (mới) - thứ tự ưu tiên, JSON hỏng báo lỗi, thiếu khối vẫn ghép được.
- `tests/unit/prompt-reuse.test.ts` (mới) - cùng đầu vào → không gọi driver; đổi ảnh cùng size khác nội dung → gọi driver; `reusePrompt: false` → luôn gọi.
- `tests/unit/video-regression.test.ts` (mới) - workflow video mẫu (Asset → Prompt enhance → Generate Video) sau migrate v6: driver Gemini được gọi mỗi lần chạy, refs + continuation truyền xuống giống trước.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test`
- Manual: Tạo workflow từ template trên Gemini + Flow thật → hình 2K; chạy lần hai chỉ đổi outfit → Console chỉ có 1-2 lần gọi Gemini, payload Flow không chứa media id của ảnh mẫu scene.

---

## Phase 5 - Upload Flow một lần, skill và kết quả sửa được

*(Work matrix: #23, #24, #25, #26)*

**Changes**
- `src/shared/messaging/index.ts` - thêm `{ type: 'asset.uploadToFlow'; workflowId: string; nodeId: string }`; `workflow.run` thêm `force?: boolean`.
- `src/background/index.ts` - handler `asset.uploadToFlow`: đọc blob từ `assetRepo`, lấy tab Flow + `projectId`, gọi `uploadImage` (`maseQ`), patch node `uploadedMediaId/uploadedProjectId/uploadedSha256`; không có tab/project → trả lỗi `NO_FLOW_PROJECT` / `TAB_LOST` cho UI.
- `src/providers/flow/rpc/generate.ts:436` - `resolveRefs`: ref local có `uploadedMediaId` và `uploadedProjectId === projectId` và `uploadedSha256` khớp → dùng luôn; ngược lại upload rồi trả id mới cho engine lưu; bỏ cache RAM theo run id.
- `src/providers/flow/rpc/generate.ts` - Flow báo media không tồn tại với id đã lưu → upload lại một lần từ blob và dùng id mới; lỗi lần hai thì báo lỗi rõ ràng.
- `src/engine/executors.ts` + `src/engine/RunManager.ts` - nhận id upload mới từ driver và patch vào node Asset tương ứng (một lần ghi sau khi generate).
- `src/engine/executors.ts` - `promptExecutor`: system = `data.systemPrompt?.trim() || PRESET_SYSTEM[preset]`; `systemPrompt` được đưa vào `reuseHash`; `outputEdited && formattedOutput` → luôn dùng lại (nhãn "Đã sửa tay"); `ctx.force` → bỏ qua dùng lại và RunManager đặt `outputEdited: false`.
- `src/engine/RunManager.ts` - chế độ `node` với `force: true` truyền `force` vào context của đúng node đích.
- `tests/unit/flow-upload-reuse.test.ts` (mới) - lần 2 không gọi `maseQ`; đổi project/sha → upload lại; media không còn → upload lại 1 lần.
- `tests/unit/prompt-reuse.test.ts` - thêm ca `systemPrompt` ghi đè, `outputEdited` giữ khi đổi ảnh, `force` gọi Gemini và xoá `outputEdited`.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test`
- Manual: Chọn ảnh local khi tab Flow mở → node hiện "Đã có trên Flow"; chạy 2 lần → Console không có `maseQ` ở lần 2.

---

## Migration / Rollback Notes

- Logic dùng lại chỉ chạy khi `reusePrompt` bật; node cũ được migrate thành tắt (xem plan Common, Phase 1) nên workflow video không đổi hành vi.
- Rollback: tắt công tắc trên node là quay về gọi Gemini mỗi lần.

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
