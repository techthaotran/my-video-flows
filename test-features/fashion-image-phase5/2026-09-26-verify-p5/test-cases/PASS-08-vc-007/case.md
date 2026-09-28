# VC-007 — flow-upload-reuse tests

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-007
- Nguồn tạo test case: PLAN | WORKFLOW | BUSINESS_NEW
- Trích dẫn requirement/invariant: API plan `#24` tests/unit/flow-upload-reuse.test.ts
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Kết quả mong đợi: 4 tests PASS (reuse, project/sha đổi, media gone, video no wrap)
- Kết quả thực tế: 4 passed
- Kết luận: Upload reuse / re-upload contract đạt.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/flow-upload-reuse.test.ts`
2. Evidence: step-01-vitest.txt, step-02-test-names.txt
