# 06 — VC-005: thumbs alt rỗng + revokeObjectURL trong SidePanel

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-005
- Nguồn tạo test case: PLAN | REFACTOR | PERFORMANCE
- Trích dẫn: GUI plan Phase 4 — object URL revoke khi unmount; workflow không output → "0 ảnh", không dải thumb
- Hành vi mới mong đợi: `URL.revokeObjectURL` trong cleanup effect; `img alt=""`; thumbs rỗng / không media → không render strip
- Phương pháp: static-trace
- Phạm vi: STATIC
- Kết quả mong đợi: revoke trong cleanup; `alt=""`; `hasMedia && thumbs.length > 0` mới render; empty dùng `strings.workflowOutputEmpty`
- Kết quả thực tế: `WorkflowOutputThumbs` revoke tất cả URL khi unmount; `alt=""`; `WorkflowRow` ẩn thumbs khi empty; label `0 ảnh`
- Kết luận: Contract VC-005 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Source `SidePanelApp.tsx` `WorkflowOutputThumbs` / `WorkflowRow`

## Cách tái hiện thủ công
1. Mở `src/features/sidepanel/SidePanelApp.tsx`
2. Trong `WorkflowOutputThumbs` useEffect: cleanup gọi `URL.revokeObjectURL`
3. Trong JSX thumb image: `alt=""`
4. Trong `WorkflowRow`: chỉ render thumbs khi `hasMedia && stats.thumbs.length > 0`; không media → `strings.workflowOutputEmpty` (`0 ảnh`)
5. Đối chiếu evidence

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static SidePanel | revoke + alt="" + empty hide | đủ cả ba | PASS | evidence/step-01-static-trace.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không đo leak object URL runtime trong browser
