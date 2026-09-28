# VC-005 — schema migrate v6→v7

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-005
- Nguồn tạo test case: PLAN | REFACTOR | BUSINESS_NEW
- Trích dẫn requirement/invariant: Common plan Phase 5 `#20` SCHEMA_VERSION 7; migrate v6→v7
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Kết quả mong đợi: SCHEMA_VERSION=7; workflow v6 migrate → 7; field uploaded*/systemPrompt/outputEdited optional
- Kết quả thực tế: 5 tests PASS; expect schemaVersion 7; uploadedMediaId undefined sau migrate
- Kết luận: Migrate v6→v7 đạt.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/schema-v6-migrate.test.ts`
2. Xác nhận test có case schemaVersion 6 → 7
3. Evidence: step-01-vitest.txt, step-02-schema-trace.txt

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest schema migrate | PASS | 5 passed | PASS | step-01-vitest.txt |
| 2 | SCHEMA_VERSION | 7 | 7 | PASS | step-02-schema-trace.txt |
