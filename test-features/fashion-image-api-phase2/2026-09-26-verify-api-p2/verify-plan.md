# Verify plan — Fashion Image API Phase 2

- Workflow: COMPLETE
- Diff scope: working tree Phase 2 (fashion preset, prompt reuse, 2K SPrCad, template, video regression) — contracts do user cung cấp; không có frozen code-review run
- Screenshot permission: GRANTED (`_gates/screenshot-permission.md`)
- Playwright CLI: GATE_ONLY; browser contract: NOT_NEEDED (mọi case package/static/cli)
- Auth: NOT_REQUIRED
- Service readiness: NOT_REQUIRED

## Coverage matrix (source → trạng thái)

| Category | Status | Case |
| --- | --- | --- |
| SPEC | CONTEXT_GAP | Không có spec riêng Phase 2 ngoài plan API |
| PLAN | COVERED | 01–09 từ `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-api.md` Phase 2 |
| WORKFLOW | COVERED | 05 video-regression; 06 forwardRefs scene |
| BUSINESS_OLD | COVERED | 05 video continuation / migrate defaults |
| BUSINESS_NEW | COVERED | 03 reuse hash; 04 fashion compose; 07 SPrCad 2K |
| USER_BEHAVIOR | NOT_APPLICABLE | Manual Flow/Gemini ngoài phạm vi verify tự động |
| SYSTEM_IMPACT | COVERED | 01 typecheck; 02 full suite |
| PERFORMANCE | NOT_APPLICABLE | Không có contract hiệu năng Phase 2 |
| SECURITY | COVERED | 07 CAPTCHA_SLOT / sanitized logs; 08 strings (không hardcode) |
| ERROR_HANDLING | COVERED | 04 JSON hỏng; 09 fenced parse |
| RULE_FORMAT | COVERED | 08 strings.ts; AGENTS UI tiếng Việt |
| REFACTOR | NOT_APPLICABLE | Không yêu cầu invariant refactor runtime riêng |

## Cases (thứ tự tuần tự)

| # | ID | Contract | Method | Auth | Service | Mutable | Isolation | Evidence folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | VC-TYPECHECK | pnpm typecheck | package-test | none | none | none | none | test-cases/…-typecheck |
| 02 | VC-FULL-TEST | pnpm test (~237+) | package-test | none | none | none | vitest | test-cases/…-full-test |
| 03 | VC-REUSE-HASH | prompt-reuse.test.ts | package-test | none | none | none | vitest | test-cases/…-reuse-hash |
| 04 | VC-FASHION-COMPOSE | fashion-compose + fenced JSON | package-test | none | none | none | vitest | test-cases/…-fashion-compose |
| 05 | VC-VIDEO-REGRESSION | video-regression + continuation | package-test | none | none | none | vitest | test-cases/…-video-regression |
| 06 | VC-FORWARD-SCENE | scene forwardRefs:false | package-test | none | none | none | vitest | test-cases/…-forward-scene |
| 07 | VC-SPR-CAD-SAFE | CAPTCHA_SLOT, logs, 2K, no maseQ | package-test + static | none | none | none | vitest/read | test-cases/…-spr-cad-safe |
| 08 | VC-REV-002-STRINGS | no hardcoded 2K strings in src/ | static-trace/grep | none | none | none | read-only | test-cases/…-strings |
| 09 | VC-REV-001-FENCE | extractJsonPayload / fenced parse | package-test | none | none | none | vitest | test-cases/…-fence |
