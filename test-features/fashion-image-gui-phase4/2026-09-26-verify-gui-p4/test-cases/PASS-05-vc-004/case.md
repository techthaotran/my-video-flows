# 05 — VC-004: Editor ẩn reuse fashionCompose; fashionScene auto forwardRefs

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-004
- Nguồn tạo test case: PLAN | BUSINESS_NEW | USER_BEHAVIOR (wiring)
- Trích dẫn: GUI plan Phase 4 — ẩn "Dùng lại" với `fashionCompose`; chọn `fashionScene` → `forwardRefs: false`
- Hành vi mới mong đợi: Switch reusePrompt chỉ render khi preset !== fashionCompose; onChange fashionScene set forwardRefs false
- Phương pháp: static-trace
- Phạm vi: STATIC
- Kết quả mong đợi: điều kiện `(d.preset) !== 'fashionCompose'` bọc Switch reuse; spread forwardRefs false khi fashionScene
- Kết quả thực tế: đúng tại EditorApp ~951–966
- Kết luận: Contract VC-004 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Source `EditorApp.tsx` panel node prompt

## Cách tái hiện thủ công
1. Mở `src/features/editor/EditorApp.tsx` khối `nodeType === 'prompt'`
2. Xác nhận `onChange` preset: `...(v === 'fashionScene' ? { forwardRefs: false } : {})`
3. Xác nhận Switch `reusePrompt` nằm trong `(d.preset) !== 'fashionCompose'`
4. Đối chiếu `evidence/step-01-static-trace.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static EditorApp | hide reuse + auto forwardRefs | có cả hai | PASS | evidence/step-01-static-trace.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không chứng minh pixel Switch trên canvas editor (GUI case)
