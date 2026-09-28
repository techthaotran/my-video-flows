# VC-001 — Remap 3 ảnh đúng dù đảo thứ tự manifest

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-001
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: common plan Phase 3 — «workflow 3 ảnh export → import đúng từng node dù đảo thứ tự asset trong manifest»
- Hành vi cũ: có thể gán theo thứ tự (hashIdx) → sai khi shuffle
- Hành vi mới mong đợi: ghép theo `data.sha256`; scene/model/outfit khớp hash dù assets reverse
- Chức năng liên quan: `remapMediaAssets`, `parseImportFile`, `commitImport`
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC
- Nhóm rủi ro/coverage: positive / adversarial (shuffle)
- Kết quả mong đợi: 1 test pass
- Kết quả thực tế: 1 passed | 6 skipped
- Kết luận: Shuffle remap theo hash đạt; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Fixture trong `tests/unit/transfer-hash.test.ts`: 3 PNG marker khác nhau, manifest assets reverse 2 lần

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t '3 ảnh export'`
3. Quan sát: 1 passed
4. Evidence: `evidence/step-01-vitest.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest -t '3 ảnh export' | pass | 1 passed | PASS | step-01-vitest.txt |

## Trạng thái và side effect
- fake-idb reset trong beforeEach

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-test-oracle.txt` — đoạn oracle shuffle trong test

## Giới hạn và dọn dẹp
- Oracle dùng fixture zip tự dựng, không phải file export thật từ UI
