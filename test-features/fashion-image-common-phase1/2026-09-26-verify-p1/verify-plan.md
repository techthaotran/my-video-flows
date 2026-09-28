# Verify plan — Fashion Image Common Phase 1

- Workflow: COMPLETE
- Diff scope: working tree Phase 1 (schema v6, Dexie v2, hash, strings) — không có frozen code-review run; contracts do user cung cấp
- Screenshot permission: GRANTED (`_gates/screenshot-permission.md`)
- Playwright CLI: GATE_ONLY; browser contract: NOT_NEEDED (mọi case package/static/cli)
- Auth: NOT_REQUIRED
- Service readiness: NOT_REQUIRED

## Coverage matrix (source → trạng thái)

| Category | Status | Case |
| --- | --- | --- |
| SPEC | CONTEXT_GAP | Không có spec riêng Phase 1 ngoài plan |
| PLAN | COVERED | 01–07 từ `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-common.md` Phase 1 |
| WORKFLOW | NOT_APPLICABLE | Không đụng workflow runtime Flow |
| BUSINESS_OLD | COVERED | 01 migrate v5 defaults; 03 draft migrate |
| BUSINESS_NEW | COVERED | 01–02 schema/stats/hash |
| USER_BEHAVIOR | NOT_APPLICABLE | Manual load extension ngoài phạm vi verify tự động |
| SYSTEM_IMPACT | COVERED | 06 typecheck, 07 full suite |
| PERFORMANCE | NOT_APPLICABLE | Không có contract hiệu năng Phase 1 |
| SECURITY | COVERED | 05 secrets / không ship sample |
| ERROR_HANDLING | NOT_APPLICABLE | Không có contract lỗi Phase 1 riêng |
| RULE_FORMAT | COVERED | 04 strings + SCHEMA_VERSION; AGENTS UI tiếng Việt |
| REFACTOR | NOT_APPLICABLE | Không yêu cầu invariant refactor runtime |

## Cases (thứ tự tuần tự)

| # | ID | Contract | Method | Auth | Service | Mutable | Isolation | Evidence folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | VC-MIGRATE | schema v6 migrate + validate | package-test | none | none | none | vitest isolated | test-cases/…-migrate |
| 02 | VC-DEXIE-HASH-STATS | Dexie backfill, stats, hash | package-test | none | none | fake-idb in test | vitest isolated | test-cases/…-dexie |
| 03 | VC-REV-001 | draft restore via migrateWorkflow | static-trace + test | none | none | none | read-only | test-cases/…-draft |
| 04 | VC-AGENTS-STRINGS | strings + SCHEMA_VERSION | static-trace/grep | none | none | none | read-only | test-cases/…-strings |
| 05 | VC-SECRETS | no secret log; no .tmp image ship | static-trace/diff | none | none | none | read-only | test-cases/…-secrets |
| 06 | VC-TYPECHECK | pnpm typecheck | package-test | none | none | none | none | test-cases/…-typecheck |
| 07 | VC-FULL-SUITE | pnpm test | package-test | none | none | none | vitest | test-cases/…-full-suite |

