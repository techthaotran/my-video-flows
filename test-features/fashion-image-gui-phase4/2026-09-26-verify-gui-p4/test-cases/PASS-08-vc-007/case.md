# 08 — VC-007: promptReused / promptFresh trong WorkflowNodeView

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-007
- Nguồn tạo test case: PLAN | RULE_FORMAT | BUSINESS_NEW
- Trích dẫn: GUI plan Phase 4 — nhãn nhỏ "Dùng lại" / "Mới phân tích" theo statusMessage lần chạy gần nhất
- Hành vi mới mong đợi: node prompt hiện `data.statusMessage` khi bằng `strings.promptReused` hoặc `strings.promptFresh`
- Phương pháp: static-trace
- Phạm vi: STATIC
- Kết quả mong đợi: so sánh với strings; hiển thị statusMessage
- Kết quả thực tế: WorkflowNodeView ~277–280; strings `promptReused: 'Dùng lại'`, `promptFresh: 'Mới phân tích'`
- Kết luận: Contract VC-007 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Source WorkflowNodeView + strings

## Cách tái hiện thủ công
1. Mở `src/features/editor/nodes/WorkflowNodeView.tsx` khối `nodeType === 'prompt'`
2. Xác nhận điều kiện `statusMessage === strings.promptReused || === strings.promptFresh`
3. Xác nhận `src/shared/strings.ts` có hai khóa đó
4. Đối chiếu evidence

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static NodeView + strings | promptReused/Fresh UI | có | PASS | evidence/step-01-static-trace.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không chạy node prompt thật để emit statusMessage
