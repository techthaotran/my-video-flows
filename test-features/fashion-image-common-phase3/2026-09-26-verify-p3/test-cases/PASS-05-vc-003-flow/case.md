# VC-003 — Flow flowMediaId giữ nguyên + cảnh báo

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-003
- Nguồn tạo test case: PLAN | BUSINESS_NEW | ERROR_HANDLING
- Trích dẫn requirement/invariant: common plan Phase 3 — node có `flowMediaId` giữ id; preview cảnh báo asset Flow theo từng node
- Hành vi mới mong đợi: warnings = importFlowAssetMissing(label) × N; flowMediaId không mất sau commit
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: 1 passed
- Kết luận: Flow id + warning đạt; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- 2 node asset source=flow với flow-media-a/b

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t 'node Asset Flow'`
3. Quan sát 1 passed
4. Evidence: `evidence/step-01-vitest.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest -t 'node Asset Flow' | pass | 1 passed | PASS | step-01-vitest.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-coverage.txt`

## Giới hạn và dọn dẹp
- Không chứng minh UI preview dialog hiển thị chuỗi cảnh báo
