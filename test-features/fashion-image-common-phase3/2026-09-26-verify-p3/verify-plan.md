# Verify plan — Fashion Image Common Phase 3

- Workflow: COMPLETE
- Diff scope: working tree Phase 3 (transfer hash + workspace) — không có frozen code-review run; contracts do user cung cấp
- Screenshot permission: GRANTED (`_gates/screenshot-permission.md`)
- Playwright CLI: GATE_ONLY; browser contract: NOT_NEEDED (mọi case package/static/cli)
- Auth: NOT_REQUIRED
- Service readiness: NOT_REQUIRED

## Coverage matrix (source → trạng thái)

| Category | Status | Case |
| --- | --- | --- |
| SPEC | CONTEXT_GAP | Không có spec riêng Phase 3 ngoài plan |
| PLAN | COVERED | 01–10 từ `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-common.md` Phase 3 |
| WORKFLOW | NOT_APPLICABLE | Không đụng workflow runtime Flow generate |
| BUSINESS_OLD | COVERED | 06 legacy file không sha256 → missing |
| BUSINESS_NEW | COVERED | 03–05, 07, 10 hash remap / workspace / Flow / insert / stamp |
| USER_BEHAVIOR | NOT_APPLICABLE | Manual export/import workspace ngoài phạm vi verify tự động |
| SYSTEM_IMPACT | COVERED | 01 typecheck, 02 full suite |
| PERFORMANCE | NOT_APPLICABLE | Không có contract hiệu năng Phase 3 |
| SECURITY | NOT_APPLICABLE | Không có contract secrets Phase 3 |
| ERROR_HANDLING | COVERED | 06 missing khi không khớp hash; 05 Flow warning |
| RULE_FORMAT | COVERED | 08 strings `(nhập)`; 09 không hashIdx/void d |
| REFACTOR | COVERED | 09 bỏ nhánh chết hashIdx / void d |

## Cases (thứ tự tuần tự)

| # | ID | Contract | Method | Auth | Service | Mutable | Isolation | Evidence folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | VC-TYPECHECK | pnpm typecheck | package-test | none | none | none | none | test-cases/…-typecheck |
| 02 | VC-FULL-TEST | pnpm test (~244+) | package-test | none | none | vitest | vitest | test-cases/…-full-test |
| 03 | VC-001 | shuffle 3 ảnh remap theo hash | package-test | none | none | fake-idb | vitest | test-cases/…-shuffle |
| 04 | VC-002 | exportWorkspace / kind workspace | package-test | none | none | fake-idb | vitest | test-cases/…-workspace |
| 05 | VC-003 | flowMediaId + warning | package-test | none | none | fake-idb | vitest | test-cases/…-flow |
| 06 | VC-004 | legacy no sha256 → missing | package-test | none | none | fake-idb | vitest | test-cases/…-legacy |
| 07 | VC-005 | insert putFromHash + remap | static+test | none | none | fake-idb | read+vitest | test-cases/…-insert |
| 08 | VC-007 | no hardcoded `(nhập)` in transfer | static-trace | none | none | none | read-only | test-cases/…-strings |
| 09 | VC-008 | no hashIdx / void d | static-trace | none | none | none | read-only | test-cases/…-no-dead |
| 10 | VC-009 | export stamp sha256 | package-test | none | none | fake-idb | vitest | test-cases/…-stamp |
