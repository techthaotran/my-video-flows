# VC-FULL-TEST — Chạy toàn bộ suite Vitest

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-FULL-TEST
- Nguồn tạo test case: PLAN | SYSTEM_IMPACT
- Trích dẫn requirement/invariant: `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-api.md` Phase 2 Verify → `pnpm test`; expect ~237+
- Hành vi cũ: N/A
- Hành vi mới mong đợi: toàn bộ test pass, số test ≥ 237
- Chức năng liên quan có thể bị ảnh hưởng: engine, Flow RPC, schema, fashion
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY (unit)
- Nhóm rủi ro/coverage: positive/regression COVERED; còn lại phụ thuộc từng file test
- Kết quả mong đợi: ≥ 237 tests pass, exit 0
- Kết quả thực tế: 237 passed (28 files), exit 0
- Kết luận: Full suite đạt ngưỡng 237+; contract VC-FULL-TEST đạt.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED; auth/service NOT_REQUIRED

## Dữ liệu kiểm thử
- Fixture trong `tests/unit` / `tests/fixtures` (Vitest + fake-indexeddb)

## Cách tái hiện thủ công
1. Tại `/Users/ggj/MyWork/my-video-flows` chạy `pnpm test`.
2. Quan sát dòng `Tests  237 passed` (hoặc cao hơn) và exit 0.
3. Đối chiếu `evidence/step-01-pnpm-test.txt`.
4. Cleanup: không cần.

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | `pnpm test` | ≥237 pass, exit 0 | 237 passed, exit 0 | PASS | evidence/step-01-pnpm-test.txt |

## Trạng thái và side effect
- Không ghi IndexedDB thật; fake-idb trong test

## Danh sách bằng chứng gốc
- `evidence/step-01-pnpm-test.txt` — full Vitest output

## Giới hạn và dọn dẹp
- Không chứng minh Flow/Gemini thật; chỉ unit mock
