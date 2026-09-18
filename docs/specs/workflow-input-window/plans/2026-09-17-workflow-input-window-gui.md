# Implementation Plan GUI: Cửa sổ "Chạy" cho workflow (Workflow Input Window)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-17-workflow-input-window.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- Giao diện theo dark theme, font IBM Plex và component `src/components/ui/*` hiện có; không có bản prototype riêng.
Bố cục: thanh trên cùng cố định; thân chia 2 cột (trái khoảng 320px, cuộn riêng; phải chiếm phần còn lại, gồm danh sách cảnh cuộn ở trên và khung video cuối ở dưới).
- Không có thư viện form: ô nhập là input/textarea điều khiển bằng state cục bộ, ghi khi `onBlur`; select ghi ngay khi đổi.

---

## Phase 1 - Cửa sổ "Chạy" ✅

*(Work matrix: #10, #11, #12, #13, #14)*

**Changes**

*Tách phần dùng chung (#10)*
- `src/media/layout.ts` - thêm `moveInOrder(order: readonly string[], index: number, delta: number): string[]` (trả mảng mới, giữ nguyên nếu vượt biên).
- `src/features/editor/nodes/MergeVideoBody.tsx` - hàm `move` gọi `moveInOrder`; `ExportButton` chuyển sang `MediaPreview.tsx` thành `ExportVideoButton` và import lại.
- `src/features/editor/nodes/MediaPreview.tsx` - export `ExportVideoButton({ url, disabled, className? })` (giữ nguyên hành vi tải mp4, bỏ `stopPropagation` ra phía gọi trong editor nếu cần).
- `src/shared/media.ts` - thêm `localAssetPatch(file, assetId, kind)` trả object patch của node Asset khi chọn file local (`assetId`, `kind`, `mime`, `originalName`, `missing: false`, `source: 'local'`, xoá `flowMediaId`/`flowPreviewUrl`).
- `src/features/editor/nodes/WorkflowNodeView.tsx` - `applyLocalFile` dùng `localAssetPatch` (giữ phần tự đổi label audio ở editor).
- `tests/unit/merge-video.test.ts` - thêm case cho `moveInOrder`; `tests/unit/media-kind.test.ts` - thêm case cho `localAssetPatch`.

*Page (#11)*
- `src/pages/runner/index.html`, `src/pages/runner/main.tsx` (mới) - chép khuôn `src/pages/editor/*`, `<title>` lấy từ `strings`, render `RunnerApp`; không import CSS của React Flow.
- `vite.config.ts` - thêm `runner: resolve(root, 'src/pages/runner/index.html')` vào `rollupOptions.input`.

*Selector (#12)*
- `src/features/runner/selectors.ts` (mới) - type `RunnerAssetSlot`, `RunnerGenerateItem`, `RunnerPromptRef`, `RunnerMergeInfo` đúng data contract section B.3, và:
  - `buildRunnerView(wf): RunnerView | { graphError: string }` gọi `topoSort` một lần (bọc try/catch), dựng `Map` id → node một lần, rồi một vòng qua `order` để tạo `assetSlots`, `generateItems`, `merge` (dùng `firstMergeNode`, `mergeClipNodeIds`);
  - `generateItems`: clip của Merge theo thứ tự ghép trước, sau đó node còn lại theo thứ tự chạy; `promptNodes` lấy từ cạnh vào cổng text theo thứ tự cạnh (A-02);
  - bỏ node disabled, `note`, `text`, `unknown`;
  - `selectMergeReady(wf, merge)` gọi `isMergeReady`;
  - `selectCanEdit(wf)`, `selectIsRunning(state)`.
- `tests/unit/runner-selectors.test.ts` (mới): số ô bằng số Asset; node disabled bị ẩn; thứ tự clip theo `order`; node không nối Merge xếp sau; không có Merge → `merge: null`; chỉ có generateImage; nhiều Prompt; graph có vòng → `graphError`; locked/deleted → không sửa được.

*Store + actions (#13)*
- `src/features/runner/store.ts` (mới) - `useRunnerStore` với `RunnerState`, `RunnerNodeStatus`, `RunnerHydrateInput` và quy tắc `applyEvent` đúng data contract section B.2.
- `src/features/runner/actions.ts` (mới) - các action trong data contract section B.4:
  - mọi action ghi bắt lỗi một chỗ qua `withUserError(fn)` rồi hiện thông báo tiếng Việt;
  - `pickLocalAsset` kiểm tra `mediaKindOf(file) === slot.kind` trước khi `assetRepo.put`;
  - `pickFlowAsset` chặn ô `audio` (A-04);
  - `sendToSw` trả `ok: false` → báo lỗi, không retry.
- `tests/unit/runner-store.test.ts` (mới):
  - `hydrate` từ `latestNodeRuns`;
  - `applyEvent` bỏ qua node lạ;
  - thêm run chưa theo dõi khi có `node.status` của node thuộc workflow;
  - `run.done` theo `workflowId` gỡ run và chuyển node đang chạy sang `cancelled`.
- `tests/unit/runner-actions.test.ts` (mới): chọn file sai loại bị từ chối, node không đổi; chọn đúng loại ghi patch; `moveClip` ghi `order` mới; workflow bị khoá thì action ghi không chạy.

*Component + chuỗi (#14)*
- `src/features/runner/RunnerApp.tsx` (mới):
  - đọc `id` từ URL;
  - `useLiveQuery(() => workflowRepo.get(id))`;
  - `loadRunnerState` khi mount và mỗi lần kênh nối lại;
  - `connectRunEvents(applyEvent)`, đặt `document.title`;
  - trạng thái: đang nạp / không tồn tại / đã xoá (banner + khoá) / lỗi graph.
- `src/features/runner/RunnerToolbar.tsx` (mới) - tên workflow, badge khoá, nút Chạy toàn bộ, Dừng (bật khi `selectIsRunning`), Mở editor node.
- `src/features/runner/AssetSlotList.tsx` (mới):
  - mỗi ô hiện label, id/slug, preview (dùng lại cách đọc URL asset của `useAssetUrl`), trạng thái thiếu file;
  - nút chọn file (`accept` theo `kind`) và nút chọn từ Flow (`FlowAssetPicker` với `kind`, ẩn cho audio);
  - empty state.
- `src/features/runner/GenerateItemList.tsx` (mới) - danh sách `GenerateItemCard`, mỗi thẻ gồm:
  - preview (`useOutputUrl` + `NodeVideoPlayer` / ảnh), trạng thái + progress + lỗi, id/slug;
  - `PromptNodeFields` cho từng Prompt (preset select, instruction textarea, output Gemini read-only);
  - textarea prompt riêng, select model / tỉ lệ / thời lượng (dùng `VIDEO_MODELS`, `IMAGE_MODELS`, `ASPECT_RATIOS`, `VIDEO_DURATIONS`);
  - nút ↑↓ khi thuộc Merge, nút Tạo lại;
  - empty state.
- `src/features/runner/FinalVideoPanel.tsx` (mới) - ẩn khi `merge` null; trạng thái/progress của node Merge; "đang chờ đủ clip" khi `!selectMergeReady`; `NodeVideoPlayer` + `ExportVideoButton`.
- `src/features/runner/EditableText.tsx` (mới) - textarea/input có state cục bộ, đồng bộ lại khi giá trị workflow đổi và ô không được focus, gọi `onCommit` khi blur nếu giá trị khác (dùng cho mọi ô chữ, DRY).
- `src/shared/strings.ts` - thêm nhóm chuỗi `runner*`:
  - tiêu đề, nút "Tải lên", "Chạy toàn bộ", "Dừng", "Mở editor node", "Tạo lại", "Tải video";
  - các empty state, "đang chờ đủ clip", "workflow đã bị xoá", "workflow đang khoá";
  - lỗi sai loại media, lỗi graph.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` · `pnpm build`
- Manual: `pnpm dev`, mở `chrome-extension://<id>/src/pages/runner/index.html?id=<workflowId>`:
  - kiểm AC-02.x, AC-03.x, AC-04.x, AC-05.x, AC-06.x trên workflow mẫu 13 node;
  - soi pixel: không tràn ngang ở 1280x800, cột trái cuộn riêng, trạng thái lỗi đọc được, dark theme đúng token.

---

## Phase 2 - Editor đồng bộ theo node, side panel ✅

*(Work matrix: #15, #16)*

**Changes**
- `src/features/editor/store.ts`:
  - thêm `dirtyNodeIds: Set<string>` (không đưa vào `temporal` partialize) và `lastSyncedAt: number`;
  - `updateNodeData` thêm id vào `dirtyNodeIds`; `markSaved` xoá hết; `loadWorkflow` đặt `lastSyncedAt = wf.updatedAt`.
- `src/features/editor/store.ts` - thêm `applyExternalWorkflow(wf)`:
  - bỏ qua nếu `wf.updatedAt <= lastSyncedAt`;
  - `temporal.getState().pause()`;
  - dựng `Map` id → node của `wf`, một vòng qua `nodes`: node không dirty → thay `data.data`, cập nhật `slug`/`label`; node dirty → giữ;
  - cập nhật `name` nếu editor chưa sửa tên, `locked` luôn theo DB (cập nhật cờ `locked` trong view model);
  - đặt `lastSyncedAt`, không bật `dirty`, `resume()`.
- `src/features/editor/EditorApp.tsx`:
  - `useLiveQuery(() => workflowRepo.get(workflowId))` → `applyExternalWorkflow`;
  - `handleSave` gọi `workflowRepo.saveFromEditor(wf, store.dirtyNodeIds)`, sau đó `markSaved` và cập nhật `lastSyncedAt` theo kết quả trả về;
  - giữ nguyên draft/revision.
- `src/features/editor/EditorApp.tsx` - `setLocked` của editor ghi ngay bằng `workflowRepo.setLocked` (thêm vào repo, cùng kiểu `setEnabled`) để cửa sổ "Chạy" khoá ngay theo AC-07.4 thay vì chờ lưu.
- `src/storage/repos/workflowRepo.ts` - thêm `setLocked(id, locked)`.
- `tests/unit/editor-external-sync.test.ts` (mới):
  - node không dirty nhận data mới;
  - node dirty giữ bản editor;
  - thay đổi ngoài không vào undo và không bật `dirty`;
  - bản cũ hơn `lastSyncedAt` bị bỏ qua;
  - `locked` theo DB.
- `src/features/sidepanel/SidePanelApp.tsx`:
  - `openEditor` gửi qua `sendToSw({ type: 'editor.open', workflowId })` có type;
  - thêm `openRunner(workflowId)` gửi `runner.open`;
  - `WorkflowRow` thêm nút icon "Tải lên" cạnh toggle và mục cùng tên trong menu ⋮;
  - `onDelete` → `softDelete` rồi `sendToSw({ type: 'workflow.cancel', workflowId })`;
  - xoá workspace có workflow (force) → gửi `workflow.cancel` cho từng workflow bị xoá;
  - chuỗi hardcode "Đã chọn" ở thanh chọn nhiều chuyển vào `strings` (AGENTS.md quy tắc 2).
- `src/shared/strings.ts` - thêm `selectedCount(n)`, `openRunner`.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` · `pnpm build`
- Manual: chạy toàn bộ kịch bản master plan section 6, đặc biệt:
  - sửa song song editor + cửa sổ "Chạy";
  - khoá workflow;
  - xoá khi đang chạy;
  - hai nút trên item side panel hiển thị gọn, không đẩy toggle xuống dòng ở chiều rộng side panel mặc định.

---

## Migration / Rollback Notes

- Không có dữ liệu cần migrate.
- Rollback Phase 2 độc lập với Phase 1: editor quay về `save` cả document, cửa sổ "Chạy" vẫn chạy nhưng mất bảo đảm không ghi đè khi editor mở song song.

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
