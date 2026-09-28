# Implementation Plan Common: Workflow tạo hình thời trang (Flow)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-26-fashion-image-workflow.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- Trong repo này "Common" = `src/shared/schema`, `src/shared/strings.ts`, `src/shared/utils`, `src/storage` (Dexie, repos, transfer).

---

## Phase 1 - Schema v6, Dexie v2, hash nội dung, chuỗi UI

*(Work matrix: #2, #3, #4, #5)*

**Changes**
- `src/shared/schema/index.ts` - `SCHEMA_VERSION` 5 → 6.
- `src/shared/schema/index.ts` - thêm `PROMPT_PRESETS` (as const) gồm preset cũ + `fashionScene`, `fashionModel`, `fashionOutfit`, `fashionColor`, `fashionCompose`; `PromptNodeDataSchema.preset` dùng `z.enum(PROMPT_PRESETS)`.
- `src/shared/schema/index.ts` - `PromptNodeDataSchema` thêm `reusePrompt: z.boolean().default(true)`, `reuseHash: z.string().optional()`, `forwardRefs: z.boolean().default(true)`.
- `src/shared/schema/index.ts` - thêm `IMAGE_RESOLUTIONS` (giá trị chốt theo kết quả Phase 0, ví dụ `['1K', '2K']`); `GenerateImageNodeDataSchema.resolution` đổi sang `z.enum(IMAGE_RESOLUTIONS).default('1K')`; `RESOLUTIONS` giữ nguyên cho video.
- `src/shared/schema/index.ts` - `migrateWorkflow` thêm nhánh v5 → v6: node `prompt` thiếu field thì đặt `reusePrompt: false`, `forwardRefs: true` **trước** khi parse (để default `true` của zod không áp lên node cũ); node `generateImage` đổi `resolution` số → `'1K'`.
- `src/shared/schema/index.ts` - `OutputSchema` thêm `workflowId: z.string().optional()`.
- `src/storage/db.ts` - `this.version(2)` thêm index `outputs: 'id, nodeRunId, createdAt, workflowId'`; `.upgrade()` backfill `workflowId` bằng một lượt đọc `nodeRuns` + `runs` dựng `Map<nodeRunId, workflowId>` rồi ghi một lượt.
- `src/storage/repos/runRepo.ts:128` - ghi `workflowId` khi lưu output.
- `src/storage/repos/runRepo.ts` - thêm `getOutputStats(workflowIds, thumbLimit = 4)` trả `{ images, videos, thumbs: OutputRecord[] }` theo từng workflow, đi qua index `workflowId`.
- `src/shared/utils` - thêm `hashBlobContent(blob): Promise<string>` (SHA-256 hex của nội dung).
- `src/shared/strings.ts` - nhãn 5 preset mới, "Dùng lại prompt cũ", "Chuyển tiếp ảnh xuống node sau", nhãn "Dùng lại" / "Mới phân tích", lỗi JSON thời trang, "Độ phân giải ảnh", "N ảnh · M video", export/import workspace, cảnh báo asset Flow thiếu.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` (test mới `tests/unit/schema-v6-migrate.test.ts`: workflow v5 có node prompt → `reusePrompt: false`; node mới → `true`; `tests/unit/output-stats.test.ts`: backfill + đếm ảnh/video + thumbnail mới nhất; `hashBlobContent` khác nhau với hai blob cùng size)
- Manual: Load extension với dữ liệu cũ → workspace "Trước Gương 1-3" mở được, không lỗi console.

---

## Phase 3 - Export/import theo hash và theo workspace

*(Work matrix: #13, #14, #15)*

**Changes**
- `src/storage/transfer/index.ts` - khi export, ghi `sha256` vào `data` của từng node Asset local (đã có sẵn trong `AssetRecord`).
- `src/storage/transfer/index.ts` - `remapMediaAssets` chỉ ghép theo `data.sha256`; bỏ nhánh gán "theo thứ tự" (`hashIdx`); không khớp hash thì `missing: true` và thêm cảnh báo.
- `src/storage/transfer/index.ts` - bỏ đoạn code chết trong `parseImportFile` (biến `d`, `sha`, `void d`, so sánh `schemaVersion` với chính nó); đếm `assetCount` theo hash có trong file.
- `src/storage/transfer/index.ts` - thêm `exportWorkspace(workspaceId)` gọi `exportWorkflows({ kind: 'workspace', workspaceIds: [id], workflowIds: <mọi workflow chưa xoá của workspace> })`.
- `src/storage/transfer/index.ts` - import `kind: 'workspace'` mặc định `createWorkspaceFromFile: true`.
- `src/storage/transfer/index.ts` - node Asset có `flowMediaId` giữ nguyên media id; preview thêm cảnh báo "Asset Flow chỉ dùng được với tài khoản Flow gốc" cho từng node.
- File cũ không có `sha256` trong node: vẫn import được, node Asset báo thiếu ảnh thay vì gán nhầm.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` (`tests/unit/transfer-hash.test.ts`: workflow 3 ảnh export → import đúng từng node dù đảo thứ tự asset trong manifest; workspace export/import tạo workspace mới; node Flow có cảnh báo; file cũ không `sha256` → `missing: true`)
- Manual: Export workspace "Trước Gương 3" → import lại → so từng node Asset đúng ảnh.

---

## Phase 5 - Schema v7: upload Flow và panel phân tích

*(Work matrix: #20, #21, #22)*

**Changes**
- `src/shared/schema/index.ts` - `SCHEMA_VERSION` 6 → 7.
- `src/shared/schema/index.ts` - `AssetNodeDataSchema` thêm `uploadedMediaId`, `uploadedProjectId`, `uploadedSha256` (optional string).
- `src/shared/schema/index.ts` - `PromptNodeDataSchema` thêm `systemPrompt: z.string().optional()`, `outputEdited: z.boolean().default(false)`.
- `src/shared/schema/index.ts` - `migrateWorkflow` nhánh v6 → v7: chỉ nâng version (field mới đều optional/default an toàn).
- `src/storage/transfer/index.ts` - khi export xoá `uploadedMediaId/uploadedProjectId/uploadedSha256` khỏi node Asset; file ảnh local vẫn đóng gói.
- `src/shared/strings.ts` - "Đang upload lên Flow…", "Đã có trên Flow", "Upload lên Flow lỗi: mở tab Flow rồi bấm Upload lại", "Upload lại", "Phân tích", "Phân tích lại", "Skill", "Khôi phục mặc định", "Kết quả", "Đã sửa tay".

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` (`tests/unit/schema-v6-migrate.test.ts` thêm ca v6 → v7; `tests/unit/transfer-hash.test.ts` thêm ca export không còn `uploaded*`)
- Manual: N/A

---

## Migration / Rollback Notes

- Schema v6 và Dexie v2 chỉ thêm field/index; `migrateWorkflow` giữ tương thích file `.xflow.zip/.xflow.json` cũ.
- Rollback: extension cũ gặp workflow v6 sẽ báo cần cập nhật (đã có kiểm tra version); Dexie không hạ version được, nên trước khi cài bản mới người dùng nên chạy "Backup" hiện có.

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
