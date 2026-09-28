# VC-008 — prompt systemPrompt / outputEdited / force

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-008
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: API plan `#25` `#26`
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Kết quả mong đợi: 3 ca systemPrompt/outputEdited/force PASS
- Kết quả thực tế: 3 passed | 6 skipped (filter)
- Kết luận: Skill override, giữ edited, force reanalyze đạt ở executor.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/prompt-reuse.test.ts -t 'systemPrompt|outputEdited|force'`
2. Evidence: step-01-vitest.txt, step-02-coverage.txt
