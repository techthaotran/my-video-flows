# 07 — VC-006: IMAGE_RESOLUTIONS + exportWorkspace wiring

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-006
- Nguồn tạo test case: PLAN | BUSINESS_NEW | SYSTEM_IMPACT
- Trích dẫn: GUI plan Phase 4 — generateImage dùng `IMAGE_RESOLUTIONS`; SidePanel nút Export workspace → `exportWorkspace`
- Hành vi mới mong đợi: SelectField resolution options `[...IMAGE_RESOLUTIONS]`; `onExportWorkspace` gọi `exportWorkspace(current.id)`
- Phương pháp: static-trace
- Phạm vi: STATIC
- Kết quả mong đợi: Editor generateImage dùng IMAGE_RESOLUTIONS; generateVideo giữ RESOLUTIONS; SidePanel nút title `strings.exportWorkspace`
- Kết quả thực tế: đúng wiring trong EditorApp + SidePanelApp
- Kết luận: Contract VC-006 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Source EditorApp / SidePanelApp / schema

## Cách tái hiện thủ công
1. Grep `IMAGE_RESOLUTIONS` trong `EditorApp.tsx` (generateImage SelectField)
2. Xác nhận generateVideo vẫn dùng `RESOLUTIONS` (không trộn)
3. Trong SidePanel: `onExportWorkspace` → `exportWorkspace(current.id)`; Button `title={strings.exportWorkspace}`
4. Đối chiếu evidence

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static wiring | IMAGE_RESOLUTIONS + exportWorkspace | có cả hai | PASS | evidence/step-01-static-trace.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không chạy export zip thật trong verify này
