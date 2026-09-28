# Implementation Plan GUI: Workflow tạo hình thời trang (Flow)

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./2026-09-26-fashion-image-workflow.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

- Trong repo này "GUI" = `src/features/editor`, `src/features/sidepanel`, `src/features/runner`.
- Verify UI bằng `playwright-cli`: `pnpm build`, chạy Chromium với `--load-extension=dist` (profile tạm), mở trang editor/sidepanel theo `chrome-extension://<id>/...`; dữ liệu mẫu (workflow, output) nạp bằng script trong trang extension.

---

## Phase 4 - Node Prompt, độ phân giải, export/import workspace, thumbnail

*(Work matrix: #16, #17, #18, #19)*

**Changes**
- `src/features/editor/EditorApp.tsx:946` - danh sách preset lấy từ `PROMPT_PRESETS`; chọn `fashionScene` thì tự đặt `forwardRefs: false`.
- `src/features/runner/selectors.ts:14`, `src/features/runner/GenerateItemList.tsx:20` - bỏ danh sách preset lặp, dùng `PROMPT_PRESETS`.
- `src/features/editor/EditorApp.tsx` - panel node Prompt thêm 2 `Switch`: "Dùng lại prompt cũ" (`reusePrompt`) và "Chuyển tiếp ảnh xuống node sau" (`forwardRefs`); ẩn "Dùng lại" với `fashionCompose` (không gọi AI).
- `src/features/editor/nodes/WorkflowNodeView.tsx:275` - nhãn nhỏ "Dùng lại" / "Mới phân tích" theo message trạng thái của lần chạy gần nhất.
- `src/features/editor/EditorApp.tsx:1005` - node Generate Image dùng `IMAGE_RESOLUTIONS`; node Generate Video giữ `RESOLUTIONS`.
- `src/features/sidepanel/SidePanelApp.tsx` - cạnh bộ chọn workspace thêm nút "Export workspace" (gọi `exportWorkspace`) và import nhận file `kind: 'workspace'` (preview hiện cảnh báo asset Flow).
- `src/features/sidepanel/SidePanelApp.tsx:623` - dòng workflow: dải tối đa 4 thumbnail vuông (ảnh dùng `blob`; video dùng frame đầu qua `<video preload="metadata">`, có biểu tượng play) và dòng "N ảnh · M video" cạnh số node; dữ liệu từ một lần gọi `getOutputStats` cho cả danh sách qua `useLiveQuery`; object URL được revoke khi unmount.
- Workflow chưa có output → không hiện dải thumbnail, chỉ hiện "0 ảnh".

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` · `pnpm build` · `playwright-cli`: screenshot sidepanel có dải thumbnail + đếm (dữ liệu mẫu 5 ảnh, 2 video), screenshot panel node Prompt có 2 công tắc, dropdown độ phân giải ảnh có 2K; không lỗi console.
- Manual: Nhìn danh sách workspace thật: thumbnail không méo, không tràn dòng ở độ rộng sidepanel; export workspace rồi import lại chạy trơn tru.

---

## Phase 5 - Upload ngay khi chọn ảnh, panel phân tích

*(Work matrix: #27, #28)*

**Changes**
- `src/features/editor/nodes/WorkflowNodeView.tsx:463` - sau `assetRepo.put` gửi `asset.uploadToFlow`; node hiện "Đang upload lên Flow…" → "Đã có trên Flow" hoặc lỗi + nút "Upload lại".
- `src/features/editor/EditorApp.tsx` - panel node Prompt: nút "Phân tích" (chưa có kết quả) / "Phân tích lại" (gửi `workflow.run` mode `node` + `force: true`).
- `src/features/editor/EditorApp.tsx` - ô "Skill" (textarea) hiện `systemPrompt` hoặc mặc định của preset, sửa thì lưu `systemPrompt`, nút "Khôi phục mặc định" xoá field; ẩn với preset `custom` và `fashionCompose`.
- `src/features/editor/EditorApp.tsx` - ô "Kết quả" sửa được; sửa thì lưu `formattedOutput` + `outputEdited: true`.
- `src/features/editor/nodes/WorkflowNodeView.tsx` - nhãn "Đã sửa tay" khi `outputEdited`.

**Verify**
- Automated: `pnpm typecheck` · `pnpm test` · `pnpm build` · `playwright-cli`: screenshot panel Prompt có nút Phân tích, ô Skill, ô Kết quả, nhãn "Đã sửa tay"; node Asset hiện trạng thái lỗi khi không có tab Flow.
- Manual: Chọn ảnh khi Flow mở → "Đã có trên Flow"; sửa Skill rồi Phân tích lại → kết quả đổi theo.

---

## Migration / Rollback Notes

N/A

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
