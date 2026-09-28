# VC-004 — File cũ không sha256 → missing

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-004
- Nguồn tạo test case: PLAN | BUSINESS_OLD | ERROR_HANDLING
- Trích dẫn requirement/invariant: common plan Phase 3 — file cũ không `sha256` trên node → import được nhưng Asset `missing: true` (không gán nhầm)
- Hành vi cũ: có thể gán theo thứ tự index
- Hành vi mới mong đợi: missing=true, assetId undefined sau commit, assetCount=0
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: 1 passed
- Kết luận: Legacy không hash → missing; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Workflow node local không có field sha256; zip vẫn chứa asset blob theo hash

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t 'không có sha256'`
3. Quan sát 1 passed
4. Evidence: `evidence/step-01-vitest.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest -t 'không có sha256' | pass | 1 passed | PASS | step-01-vitest.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-oracle.txt`

## Giới hạn và dọn dẹp
- Không import file `.xflow` thật do người dùng xuất từ bản cũ
