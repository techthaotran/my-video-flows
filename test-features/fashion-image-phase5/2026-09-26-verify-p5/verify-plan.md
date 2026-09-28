# Verify plan — Fashion Image Phase 5 (#20–#28)

- Workflow: COMPLETE
- Diff scope: working tree Phase 5 (common schema v7 + API upload/reuse + GUI Asset/Prompt) — không có frozen code-review run; contracts do user cung cấp
- Screenshot permission: GRANTED (`_gates/screenshot-permission.md`)
- Playwright CLI: GATE PASSED; browser contract OPTIONAL cho VC-011 (static đủ; playwright nếu cần)
- Auth: NOT_REQUIRED
- Service readiness: NOT_REQUIRED cho package/static; build dùng `dist/` nếu GUI
- Overall Phase 5 gate: PASS

## Coverage matrix (source → trạng thái)

| Category | Status | Case |
| --- | --- | --- |
| SPEC | CONTEXT_GAP | Không có raw-spec riêng Phase 5; dùng plan |
| PLAN | COVERED | Common/API/GUI Phase 5 trong `docs/plans/fashion-image/*` |
| WORKFLOW | COVERED | VC-007/009 upload Flow / không maseQ lại flowMediaId |
| BUSINESS_OLD | COVERED | VC-009 FLOW_ASSET_NO_UPLOAD / không upload lại Flow asset |
| BUSINESS_NEW | COVERED | VC-001…008, VC-011 uploaded*, outputEdited, force, Skill/Kết quả |
| USER_BEHAVIOR | COVERED (static) / optional GUI | VC-011 Phân tích / Skill / Kết quả |
| SYSTEM_IMPACT | COVERED | VC-BUILD typecheck+test+build |
| PERFORMANCE | NOT_APPLICABLE | Không contract perf Phase 5 |
| SECURITY | COVERED (partial) | VC-006 export strips uploaded*; không log secret (không case riêng) |
| ERROR_HANDLING | COVERED | VC-002 stuck error vs uploaded; VC-004 retry image-only |
| RULE_FORMAT | COVERED | VC-003 strings promptResultEmpty |
| REFACTOR | COVERED | VC-005 migrate v6→v7; VC-006 strip on export |

## Cases (thứ tự tuần tự)

| # | ID | Contract | Method | Auth | Service | Mutable | Isolation | Evidence folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | VC-BUILD | pnpm typecheck · test (~259) · build | package-test | none | none | none | none | …-vc-build |
| 02 | VC-001 | outputEdited sync từ executor → RunManager patch | package-test | none | none | fake-idb | vitest | …-vc-001 |
| 03 | VC-002 | Asset UI ưu tiên uploadedMediaId hơn lỗi upload kẹt | static-trace | none | none | none | read-only | …-vc-002 |
| 04 | VC-003 | promptResultEmpty trong strings; không placeholder hardcode | static-trace | none | none | none | read-only | …-vc-003 |
| 05 | VC-004 | stale upload retry chỉ image | static-trace | none | none | none | read-only | …-vc-004 |
| 06 | VC-005 | schema migrate v6→v7 | package-test | none | none | none | vitest | …-vc-005 |
| 07 | VC-006 | export strips uploaded* | package-test | none | none | fake-idb | vitest | …-vc-006 |
| 08 | VC-007 | flow-upload-reuse tests | package-test | none | none | vitest mocks | vitest | …-vc-007 |
| 09 | VC-008 | prompt systemPrompt / outputEdited / force | package-test | none | none | vitest mocks | vitest | …-vc-008 |
| 10 | VC-009 | flowMediaId never maseQ | static-trace | none | none | none | read-only | …-vc-009 |
| 11 | VC-011 | Phân tích / Skill / Kết quả wiring | static-trace (+ playwright optional) | none | none | none | read-only | …-vc-011 |

## Refutation criteria

- VC-BUILD: bất kỳ lệnh FAIL hoặc test count lệch lớn khỏi ~259 → NG
- VC-001: RunManager không patch `outputEdited` từ executor / test fail → NG
- VC-002: UI vẫn hiện lỗi khi đã có `uploadedMediaId` → NG
- VC-003: thiếu `promptResultEmpty` hoặc hardcode placeholder trong Editor → NG
- VC-004: nút Upload lại / upload path chạy cho video hoặc non-image → NG
- VC-005: migrate v6→v7 fail hoặc SCHEMA_VERSION !== 7 → NG
- VC-006: export còn `uploadedMediaId/ProjectId/Sha256` → NG
- VC-007: flow-upload-reuse test fail → NG
- VC-008: systemPrompt/outputEdited/force test fail → NG
- VC-009: đường `flowMediaId` gọi upload/maseQ → NG
- VC-011: thiếu force/Skill/Kết quả/strings wiring → NG
