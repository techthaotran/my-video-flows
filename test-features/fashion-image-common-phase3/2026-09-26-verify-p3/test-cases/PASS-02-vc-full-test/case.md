# VC-FULL-TEST — Suite Vitest toàn repo

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-FULL-TEST
- Nguồn tạo test case: PLAN | SYSTEM_IMPACT
- Trích dẫn requirement/invariant: `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-common.md` Phase 3 Verify — `pnpm test`
- Hành vi cũ: N/A
- Hành vi mới mong đợi: ≥ ~244 tests pass, gồm `transfer-hash.test.ts`
- Chức năng liên quan có thể bị ảnh hưởng: toàn bộ unit suite
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC
- Nhóm rủi ro/coverage: regression
- Kết quả mong đợi: tất cả test pass, khoảng 244+
- Kết quả thực tế: 29 files / 244 tests passed, exit 0
- Kết luận: Full suite đạt ngưỡng ~244+; contract PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED; không cần service

## Dữ liệu kiểm thử
- Vitest + jsdom + fake-indexeddb (cấu hình sẵn)

## Cách tái hiện thủ công
1. Thư mục `/Users/ggj/MyWork/my-video-flows`.
2. Chạy `pnpm test`.
3. Quan sát dòng `Tests  244 passed` (hoặc cao hơn) và exit 0.
4. Evidence: `evidence/step-01-pnpm-test.txt`, `evidence/step-01-summary-lines.txt`.
5. Dọn dẹp: không cần.

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | `pnpm test` | ~244+ pass | 244 pass / 29 files | PASS | step-01-*.txt |

## Trạng thái và side effect
- Không đổi source; fake-idb trong process test

## Danh sách bằng chứng gốc
- `evidence/step-01-pnpm-test.txt` — đuôi log vitest
- `evidence/step-01-summary-lines.txt` — dòng đếm Tests / transfer-hash

## Giới hạn và dọn dẹp
- Không thay manual export/import trên extension thật
