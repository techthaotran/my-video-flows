# VC-007 — Không hardcode `(nhập)` trong transfer

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-007
- Nguồn tạo test case: RULE_FORMAT | PLAN
- Trích dẫn requirement/invariant: AGENTS.md UI qua strings.ts; transfer dùng `strings.importSuffix`
- Hành vi mới mong đợi: không literal `(nhập)` trong `src/storage/transfer`; dùng `strings.importSuffix`
- Phương pháp: static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: NO_MATCH_TRANSFER; transfer:495 dùng `strings.importSuffix`; strings.ts:58 định nghĩa `'(nhập)'`
- Kết luận: Không hardcode trong transfer; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Nguồn hiện tại trên disk

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `rg -n '\(nhập\)' src/storage/transfer` → không match
3. `rg -n 'importSuffix' src/storage/transfer/index.ts src/shared/strings.ts`
4. Evidence: `evidence/step-01-grep.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | grep `(nhập)` in transfer | 0 hit | NO_MATCH | PASS | step-01-grep.txt |
| 2 | dùng strings.importSuffix | có | line 495 | PASS | step-01-grep.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-grep.txt`

## Giới hạn và dọn dẹp
- Chỉ kiểm tra transfer; chuỗi vẫn nằm đúng chỗ trong strings.ts
