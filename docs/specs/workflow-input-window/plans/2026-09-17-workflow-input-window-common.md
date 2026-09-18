# Implementation Plan Common: Cửa sổ "Chạy" cho workflow (Workflow Input Window)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-17-workflow-input-window.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- "Common" trong extension này là code chạy được ở cả UI page lẫn service worker: `src/shared/`, `src/storage/`, hàm thuần trong `src/engine/` không phụ thuộc `chrome.*` hay React.

---

## Phase 1 - Type message, repo ghi theo node, trạng thái gần nhất, hàm isMergeReady ✅

*(Work matrix: #1, #2, #3, #4)*

**Changes**
- `src/shared/messaging/index.ts` - thêm `RunnerOpenPayload`, `EditorOpenPayload`, `WorkflowRegeneratePayload`, `WorkflowRegenerateResult`, `RunDoneEvent` (có `workflowId?`) đúng như data contract section C.2; thêm 3 member vào `UiToSwMessage`; thay member `run.done` của `SwToUiEvent` bằng `({ type: 'run.done' } & RunDoneEvent)`.
- `src/storage/repos/workflowRepo.ts` - thêm hằng mã lỗi `WORKFLOW_ERROR = { deleted: 'WORKFLOW_DELETED', nodeNotFound: 'WORKFLOW_NODE_NOT_FOUND', notFound: 'WORKFLOW_NOT_FOUND' } as const` và hàm nội bộ `workflowError(code)` tạo `Error` có `code`.
- `src/storage/repos/workflowRepo.ts` - thêm `patchNodeData(workflowId, nodeId, patch)`:
  - trong `db.transaction('rw', db.workflows, ...)`: đọc bản ghi, guard không tồn tại / `deletedAt` / không có node;
  - gộp `patch` vào `data` của node rồi `validateNodeData`;
  - bump `updatedAt`, `put`; không tạo revision, không xoá draft; trả workflow đã upgrade.
- `src/storage/repos/workflowRepo.ts` - thêm `saveFromEditor(workflow, dirtyNodeIds: ReadonlySet<string>)`:
  - trong transaction: đọc bản DB, dựng `Map` id → node của bản DB một lần;
  - node của editor không thuộc `dirtyNodeIds` mà có trong DB thì lấy `data` của DB;
  - sau đó đi qua đúng luồng `save` hiện tại (validate, revision, xoá draft) bằng một hàm nội bộ `writeWorkflow(parsed, tx)` tách ra từ `save` để không lặp code.
- `src/storage/repos/runRepo.ts` - sửa `listByWorkflow`: `sortBy('startedAt')` trước rồi `reverse()` + `slice(0, limit)` trên mảng, để luôn là các run mới nhất.
- `src/storage/repos/runRepo.ts` - thêm `latestNodeRuns(workflowId, limit = 20): Promise<Map<string, NodeRun>>`:
  - lấy run qua `listByWorkflow`;
  - đọc một lần `db.nodeRuns.where('runId').anyOf(runIds)`;
  - gom một vòng, giữ bản có `run.startedAt` lớn hơn, cùng run thì so `finishedAt ?? startedAt`.
- `src/engine/mergeReady.ts` (mới) - hàm thuần, không import `chrome`/React:
  - `firstMergeNode(wf)`: node `mergeVideo` đầu tiên không disabled theo `topoSort`, bắt lỗi vòng và trả `undefined`;
  - `mergeClipNodeIds(wf, mergeNodeId)`: id node video nối vào cổng video của Merge (bỏ disabled), sắp bằng `orderedClipIds(order, ids)`;
  - `isMergeReady(wf, mergeNodeId)`: có ít nhất 1 clip và mọi clip "có video": node generate/merge có `previewOutputId`, node asset có `assetId` hoặc `flowMediaId` (asset Flow vẫn coi là có video để bước ghép báo lỗi `FLOW_ASSET_NO_UPLOAD` rõ ràng theo AC-06.8, thay vì chờ mãi).
- `tests/unit/workflow-repo-patch.test.ts` (mới):
  - `patchNodeData` gộp đúng field, không tạo revision;
  - ném `WORKFLOW_DELETED` / `WORKFLOW_NODE_NOT_FOUND`;
  - hai patch liên tiếp vào hai node đều còn;
  - `saveFromEditor` giữ data DB cho node không dirty và lấy data editor cho node dirty, cấu trúc lấy từ editor.
- `tests/unit/run-repo-latest.test.ts` (mới):
  - `latestNodeRuns` chọn đúng bản mới nhất qua nhiều run;
  - node không có trong 20 run thì không có key;
  - `listByWorkflow` trả đúng thứ tự mới → cũ.
- `tests/unit/merge-ready.test.ts` (mới):
  - đủ clip, thiếu clip, không có clip;
  - clip disabled bị bỏ;
  - thứ tự theo `order` và clip mới xếp cuối;
  - nhiều Merge chọn node đầu (A-01);
  - graph có vòng không ném lỗi.

```ts
// src/engine/mergeReady.ts - hợp đồng
export function firstMergeNode(wf: Workflow): WorkflowNode | undefined;
export function mergeClipNodeIds(wf: Workflow, mergeNodeId: string): string[];
export function isMergeReady(wf: Workflow, mergeNodeId: string): boolean;
```

**Verify**
- Automated: `pnpm typecheck` · `pnpm test`
- Manual: N/A

---

## Phase 2 - Đồng bộ tài liệu ✅

*(Work matrix: #17)*

**Changes**
- `docs/WORKFLOW.md` - sửa `SCHEMA_VERSION` thành `5` ở phần đầu và bảng hằng số 4.4.
- `docs/WORKFLOW.md` - bảng 4.2 thêm `workflow.regenerate` (mode `only` + tự ghép khi đủ clip).
- `docs/WORKFLOW.md` - section 2.6 thêm mục cửa sổ "Chạy" (`src/features/runner/`, `runner.open`, đọc bằng `useLiveQuery`, ghi bằng `patchNodeData`) và mục editor gộp thay đổi bên ngoài theo node.
- `docs/WORKFLOW.md` - section 5 thêm dòng index: `src/engine/mergeReady.ts`, `src/features/runner/`, `src/pages/runner/`.

**Verify**
- Automated: N/A
- Manual: Đọc lại `docs/WORKFLOW.md`, đối chiếu tên file/hàm với code đã merge.

---

## Migration / Rollback Notes

- Không có migration dữ liệu: không đổi shape, không đổi Dexie version.
- Rollback: revert commit; `patchNodeData` ghi đúng shape cũ nên dữ liệu đã ghi vẫn đọc được bằng code cũ.
- Revision: sau thay đổi, chỉ lần lưu của editor tạo revision; patch từ cửa sổ "Chạy"/SW không tạo, nên lịch sử 20 revision không bị lấp bởi mỗi lần chạy.

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
