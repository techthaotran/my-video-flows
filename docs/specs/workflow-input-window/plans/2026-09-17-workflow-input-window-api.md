# Implementation Plan API: Cửa sổ "Chạy" cho workflow (Workflow Input Window)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-17-workflow-input-window.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- "API" trong extension này là service worker: `src/background/index.ts` (định tuyến message, quản lý cửa sổ) và `src/engine/RunManager.ts` (chạy workflow). Không có HTTP endpoint.

---

## Phase 1 - Ghi theo node, chặn workflow đã xoá, run.done có workflowId ✅

*(Work matrix: #5, #6, #7)*

**Changes**
- `src/engine/RunManager.ts` - `ctx.patchNodeData` (khoảng dòng 406) gọi `workflowRepo.patchNodeData(workflow.id, nodeId, patch)` thay cho đọc + `save`; lỗi `WORKFLOW_DELETED` / `WORKFLOW_NODE_NOT_FOUND` được log `warn` và bỏ qua (node đã bị xoá khỏi workflow thì không cần ghi), vẫn broadcast `node.data`.
- `src/engine/RunManager.ts` - chỗ gắn `previewOutputId` (khoảng dòng 483) và `formattedOutput` (khoảng dòng 507) dùng cùng một hàm private `patchNodeSafely(workflowId, nodeId, patch)` bọc logic trên (DRY cho 3 chỗ ghi).
- `src/engine/RunManager.ts` - `runWorkflow`: guard `workflow.deletedAt` → ném `Error(strings.workflowDeleted)` trước khi tạo run.
- `src/engine/RunManager.ts` - `executeRun`: đầu hàm đọc lại `workflowRepo.get`; đã xoá → cập nhật run `cancelled`, broadcast `run.done` với `status: 'cancelled'`, trả về ngay (xử lý job xếp hàng trước khi xoá).
- `src/engine/RunManager.ts` - `executeRun` trả `Promise<RunStatus>` (`success` / `error` / `cancelled`); `runWorkflow` giữ nguyên chữ ký (job bỏ qua giá trị trả về).
- `src/engine/RunManager.ts` - mọi `broadcast({ type: 'run.done', ... })` truyền thêm `workflowId: workflow.id`.
- `src/shared/strings.ts` - thêm `workflowDeleted: 'Workflow đã bị xoá'`.
- `tests/unit/run-only-node.test.ts` - bổ sung assert `run.done.workflowId`.
- `tests/unit/run-deleted-guard.test.ts` (mới):
  - `runWorkflow` trên workflow đã xoá ném lỗi;
  - xoá mềm sau khi xếp hàng → run kết thúc `cancelled`, driver không bị gọi.
- `tests/unit/run-patch-node-data.test.ts` (mới):
  - trong lúc run, sửa field node khác bằng `patchNodeData` → sau run cả `previewOutputId` lẫn field vừa sửa đều còn (không bị ghi đè).

**Verify**
- Automated: `pnpm typecheck` · `pnpm test`
- Manual: `pnpm dev`, chạy một workflow ở editor như trước → preview và output Gemini vẫn hiện đúng; Console không có lỗi mới.

---

## Phase 2 - Tạo lại + tự ghép, handler cửa sổ ✅

*(Work matrix: #8, #9)*

**Changes**
- `src/engine/RunManager.ts` - thêm `regenerate(workflowId, nodeId): Promise<string>`:
  - guard: workflow không tồn tại / đã xoá / node không phải `generateImage`/`generateVideo` / node disabled → ném `Error` với chuỗi từ `strings`;
  - tạo run (`mode: 'only'`, `fromNodeId: nodeId`), xếp một job: `status = await executeRun(run.id, wf, { mode: 'only', nodeId })`;
  - `status !== 'success'` → dừng;
  - đọc lại workflow; đã xoá → dừng; `firstMergeNode` không có hoặc `nodeId ∉ mergeClipNodeIds` → dừng; `!isMergeReady` → log `info` "chờ đủ clip" và dừng;
  - ngược lại `await this.runWorkflow(wfId, { mode: 'only', nodeId: merge.id })`;
  - trả `run.id` ngay sau khi xếp job.
- `src/engine/RunManager.ts` - `regenerate` tạo run bằng `runRepo.create` và xếp job qua `this.enqueue` có sẵn (không đi qua `runWorkflow` cho bước đầu); bước ghép gọi `runWorkflow`, vốn chỉ xếp hàng rồi trả `runId`, nên run ghép không chạy lồng trong slot của job hiện tại; log rõ `runId` của cả hai run.
- `src/background/windows.ts` (mới) - `openOrFocusWindow(windows: Map<string, number>, workflowId, pagePath): Promise<void>`:
  - có cửa sổ thì `chrome.windows.update({ focused: true })`, lỗi thì xoá khỏi map và mở mới;
  - mở mới bằng `chrome.windows.create({ type: 'popup', width: POPUP_WINDOW_SIZE.width, height: POPUP_WINDOW_SIZE.height, url })` với hằng `POPUP_WINDOW_SIZE = { width: 1280, height: 800 } as const` trong cùng file;
  - tự gỡ khỏi map ở `windows.onRemoved`.
- `src/background/index.ts` - bỏ listener riêng cho `editor.open` và hàm `openEditor`; thêm vào `handleUiMessage`:
  - `case 'editor.open'` → `openOrFocusWindow(editorWindows, id, 'src/pages/editor/index.html')`;
  - `case 'runner.open'` → `openOrFocusWindow(runnerWindows, id, 'src/pages/runner/index.html')`;
  - `case 'workflow.regenerate'` → `{ ok: true, data: { runId } }` từ `runManager.regenerate`.
- `src/shared/strings.ts` - thêm chuỗi lỗi: `regenerateNotGenerateNode`, `regenerateNodeDisabled`, `nodeNotFound`, `mergeWaitingClips`.
- `tests/unit/run-regenerate.test.ts` (mới, theo khuôn `run-only-node.test.ts`):
  - 3 cảnh + Merge, cảnh 2 thiếu video: tạo lại cảnh 2 → driver chỉ nhận 1 lệnh generate, sau đó compose được gọi với 3 clip đúng thứ tự;
  - cảnh 3 cũng không có video → không compose (AC-05.3);
  - cảnh 3 lỗi lần trước nhưng còn `previewOutputId` → vẫn compose (AC-05.4);
  - generate lỗi → không compose;
  - cảnh sau dùng cảnh 2 làm cảnh trước không bị chạy lại (AC-05.5);
  - node không phải generate / disabled → lỗi.
- `tests/unit/background-windows.test.ts` (mới): mở lần đầu gọi `windows.create` đúng kích thước; lần hai gọi `windows.update`; `update` lỗi → mở mới; `onRemoved` gỡ khỏi map.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test`
- Manual: Trong DevTools của side panel, gửi `chrome.runtime.sendMessage({ type: 'workflow.regenerate', workflowId, nodeId })` cho workflow mẫu → Console chỉ thấy một lệnh generate rồi một run ghép; side panel vẫn mở editor bình thường.

---

## Migration / Rollback Notes

- Không có dữ liệu cần migrate.
- `run.done.workflowId` là field optional nên UI cũ vẫn chạy.
- Rollback: revert phase; handler `editor.open` cũ và listener riêng khôi phục cùng lúc.

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
