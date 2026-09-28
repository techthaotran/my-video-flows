# Verify report — Fashion Image Common Phase 3

## Deterministic checks
- `pnpm typecheck`: PASS
- `pnpm test`: PASS (29 files / 244 tests)
- `pnpm exec vitest run tests/unit/transfer-hash.test.ts` (focused filters): PASS (7/7 cases covered across VC-001…009)

## Authentication
- API auth: NOT_REQUIRED
- GUI auth: NOT_REQUIRED
- Account source: N/A

## Service readiness
- N/A (không có runtime service contract)
- Endpoint source: N/A

## Screenshot permission
- Status: GRANTED
- Check evidence: `_gates/screenshot-permission.md`

## Contract results

### VC-TYPECHECK — NOT_REPRODUCED (oracle PASS; no defect claimed)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: typecheck non-zero exit hoặc lỗi tsc
- Evidence: `test-cases/PASS-01-vc-typecheck/`

### VC-FULL-TEST — NOT_REPRODUCED (oracle PASS)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: bất kỳ test FAIL hoặc số test < ~244
- Evidence: `test-cases/PASS-02-vc-full-test/` (244 passed)

### VC-001 — NOT_REPRODUCED (oracle PASS)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: sau shuffle, node scene/model/outfit lệch hash
- Coverage: positive + adversarial(shuffle); negative/boundary/concurrency N/A
- Evidence: `test-cases/PASS-03-vc-001-shuffle/`

### VC-002 — NOT_REPRODUCED (oracle PASS)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: kind≠workspace hoặc import không tạo workspace mới
- Evidence: `test-cases/PASS-04-vc-002-workspace/`

### VC-003 — NOT_REPRODUCED (oracle PASS)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: mất flowMediaId hoặc thiếu warning theo node
- Evidence: `test-cases/PASS-05-vc-003-flow/`

### VC-004 — NOT_REPRODUCED (oracle PASS)
- Method: package-test
- Coverage scope: STATIC
- Refutation criterion: legacy không sha256 mà vẫn gán assetId / missing≠true
- Evidence: `test-cases/PASS-06-vc-004-legacy/`

### VC-005 — NOT_REPRODUCED (oracle PASS)
- Method: package-test + static-trace
- Coverage scope: STATIC
- Refutation criterion: Editor không gọi ingest/remap hoặc ingest không putFromHash; insert giữ foreign assetId
- Evidence: `test-cases/PASS-07-vc-005-insert/`

### VC-007 — NOT_REPRODUCED (oracle PASS)
- Method: static-trace
- Coverage scope: STATIC
- Refutation criterion: literal `(nhập)` trong `src/storage/transfer`
- Evidence: `test-cases/PASS-08-vc-007-strings/`

### VC-008 — NOT_REPRODUCED (oracle PASS)
- Method: static-trace
- Coverage scope: STATIC
- Refutation criterion: còn `hashIdx` hoặc `void d` trong transfer
- Evidence: `test-cases/PASS-09-vc-008-no-dead/`

### VC-009 — NOT_REPRODUCED (oracle PASS)
- Method: package-test + static-trace
- Coverage scope: STATIC
- Refutation criterion: export JSON thiếu node.data.sha256
- Evidence: `test-cases/PASS-10-vc-009-stamp/`

## Browser decision
- Playwright CLI gate: PASSED
- Browser contract: NOT_NEEDED
- Session model: NOT_APPLICABLE
- Reason: mọi contract là package/static; user ghi Screenshot NOT_NEEDED

## Evidence summary
- Summary: `test-cases/summary.md`
- PASS: 10 | NG: 0 | BLOCKED: 0
- Overall Phase 3 gate: **PASS**
- Remediation: (none)

## Note
- Không kết luận merge-safe; chỉ xác nhận contracts Phase 3 tự động.
- Manual verify (Export workspace «Trước Gương 3» → import so từng Asset) vẫn theo plan, ngoài phạm vi run này.
