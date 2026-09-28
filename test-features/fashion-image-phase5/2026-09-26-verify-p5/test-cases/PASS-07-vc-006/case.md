# VC-006 — export strips uploaded*

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-006
- Nguồn tạo test case: PLAN | SECURITY | REFACTOR
- Trích dẫn requirement/invariant: Common plan `#21` export xoá uploaded*
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Kết quả mong đợi: export không còn uploadedMediaId/ProjectId/Sha256
- Kết quả thực tế: transfer UPLOADED_FIELDS; vitest -t uploaded → 1 passed
- Kết luận: Export bỏ uploaded* đạt.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t uploaded`
2. Evidence: step-01-vitest.txt, step-02-coverage.txt
