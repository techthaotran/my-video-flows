# VC-REV-002-STRINGS — Không hardcode chuỗi 2K ngoài strings.ts

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-REV-002-STRINGS
- Nguồn tạo test case: RULE_FORMAT | SECURITY
- Trích dẫn requirement/invariant: AGENTS.md — UI tiếng Việt qua `strings.ts`; contract user: 0 hardcode `Tải ảnh 2K` / `SPrCad không trả` trong logic src (chỉ định nghĩa ở strings.ts)
- Hành vi cũ: N/A
- Hành vi mới mong đợi: literal chỉ trong `src/shared/strings.ts`; code dùng `strings.flowFetchingImage2k` / `strings.flowImage2kEmpty`
- Chức năng liên quan: `generate.ts` progress/error 2K
- Phương pháp: static-trace (rg)
- Phạm vi được chứng minh: STATIC
- Nhóm rủi ro/coverage: rule-format COVERED
- Kết quả mong đợi: 0 match ngoài strings.ts; usage qua keys
- Kết quả thực tế: ngoài `strings.ts` = 0; generate.ts dùng `strings.*`
- Kết luận: Không hardcode chuỗi 2K ngoài strings.ts — PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Working tree `src/`

## Cách tái hiện thủ công
1. Tại repo root chạy: `rg -n 'Tải ảnh 2K|SPrCad không trả' src/ --glob '!**/strings.ts'`
2. Mong đợi: không có dòng khớp.
3. Chạy `rg -n 'flowFetchingImage2k|flowImage2kEmpty' src/` — thấy định nghĩa trong strings.ts và dùng trong generate.ts.
4. Evidence: `evidence/step-01-grep.txt`
5. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | rg literals ngoài strings.ts | 0 | 0 | PASS | evidence/step-01-grep.txt |
| 02 | usage qua strings keys | generate.ts dùng keys | đúng | PASS | evidence/step-01-grep.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-grep.txt`

## Giới hạn và dọn dẹp
- Oracle: “must be 0” hiểu là 0 ngoài `strings.ts` (file canonical bắt buộc chứa literal)
