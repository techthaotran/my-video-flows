# VC-003 — promptResultEmpty trong strings; không placeholder hardcode

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-003
- Nguồn tạo test case: PLAN | RULE_FORMAT
- Trích dẫn requirement/invariant: Common plan Phase 5 `#22`; AGENTS.md UI qua strings.ts
- Hành vi mới mong đợi: ô Kết quả dùng `strings.promptResultEmpty`; không hardcode "Chưa có kết quả…" trong component
- Phương pháp: static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: key tồn tại; EditorApp placeholder = `promptOutput || strings.promptResultEmpty`
- Kết quả thực tế: strings.ts:339; EditorApp dùng strings; không literal "Chưa có kết quả phân tích" ngoài strings
- Kết luận: Chuỗi placeholder Kết quả đi qua strings.ts đúng quy tắc.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `rg promptResultEmpty src/shared/strings.ts src/features/editor`
2. Mở EditorApp textarea Kết quả - placeholder phải qua strings
3. Evidence: `evidence/step-01-grep.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | grep strings + Editor | qua strings | đúng | PASS | step-01-grep.txt |

## Giới hạn và dọn dẹp
- Instruction textarea vẫn có placeholder hardcode cũ (ngoài phạm vi VC-003 Kết quả)
