# Verify plan — Fashion Image GUI Phase 4

- Workflow: COMPLETE
- Diff scope: working tree GUI Phase 4 (editor / sidepanel / runner) — không có frozen code-review run; contracts do user cung cấp
- Screenshot permission: GRANTED (`_gates/screenshot-permission.md`)
- Playwright CLI: GATE PASSED; browser contract USED (`PASS-09-vc-gui`) — extension load OK (khác prior phases BLOCKED)
- Auth: NOT_REQUIRED
- Service readiness: NOT_REQUIRED cho package/static; extension dùng `dist/` sau `pnpm build`
- Overall Phase 4 gate: PASS

## Coverage matrix (source → trạng thái)

| Category | Status | Case |
| --- | --- | --- |
| SPEC | CONTEXT_GAP | Không có spec riêng Phase 4 ngoài plan GUI |
| PLAN | COVERED | 01–08 từ `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-gui.md` Phase 4 |
| WORKFLOW | NOT_APPLICABLE | Không đụng Flow RPC generate |
| BUSINESS_OLD | COVERED | Video resolution / reuse mặc định còn; generate video giữ RESOLUTIONS |
| BUSINESS_NEW | COVERED | 02–08 thumbs ≤4, fashionScene forwardRefs, preset label, hide reuse, revoke, IMAGE_RESOLUTIONS, promptReused UI |
| USER_BEHAVIOR | TEST_GAP / BLOCKED nếu extension | Manual sidepanel thumbnail + export; playwright extension nếu blocked |
| SYSTEM_IMPACT | COVERED | 01 typecheck + test + build |
| PERFORMANCE | COVERED | 02 getOutputStats không giữ toàn bộ blob |
| SECURITY | NOT_APPLICABLE | Không contract secrets Phase 4 |
| ERROR_HANDLING | NOT_APPLICABLE | Không contract lỗi riêng Phase 4 |
| RULE_FORMAT | COVERED | 03–04, 07 strings / promptPresetLabel |
| REFACTOR | COVERED | 02 bounded hydrate; 05 revokeObjectURL cleanup |

## Cases (thứ tự tuần tự)

| # | ID | Contract | Method | Auth | Service | Mutable | Isolation | Evidence folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | VC-BUILD | pnpm typecheck · test · build | package-test | none | none | none | none | test-cases/…-vc-build |
| 02 | VC-001 | getOutputStats ≤4 thumbs, không giữ all blobs | package-test + static | none | none | fake-idb | vitest | test-cases/…-vc-001 |
| 03 | VC-002 | GenerateItemList fashionScene → forwardRefs false | static-trace | none | none | none | read-only | test-cases/…-vc-002 |
| 04 | VC-003 | promptPresetLabel / strings cho preset UI | package-test + static | none | none | none | vitest | test-cases/…-vc-003 |
| 05 | VC-004 | Editor: fashionCompose ẩn reuse; fashionScene auto forwardRefs | static-trace | none | none | none | read-only | test-cases/…-vc-004 |
| 06 | VC-005 | thumbs empty + revokeObjectURL trong SidePanel | static-trace | none | none | none | read-only | test-cases/…-vc-005 |
| 07 | VC-006 | IMAGE_RESOLUTIONS + exportWorkspace wiring | static-trace | none | none | none | read-only | test-cases/…-vc-006 |
| 08 | VC-007 | promptReused / promptFresh trong WorkflowNodeView | static-trace | none | none | none | read-only | test-cases/…-vc-007 |
| 09 | VC-GUI | playwright-cli extension screenshots (plan verify) | playwright-cli | none | build dist | profile tạm | named session | test-cases/…-vc-gui |

## Refutation criteria (tóm tắt)

- VC-BUILD: bất kỳ lệnh FAIL → NG
- VC-001: test fail hoặc code hydrate toàn bộ blob / thumbs >4 → NG
- VC-002: fashionScene không set forwardRefs:false → NG
- VC-003: UI chỉ hiện raw `fashionScene` / thiếu promptPresetLabel → NG
- VC-004: vẫn hiện reuse cho fashionCompose hoặc không auto forwardRefs false → NG
- VC-005: thiếu revokeObjectURL hoặc không xử lý thumbs rỗng → NG
- VC-006: generateImage không dùng IMAGE_RESOLUTIONS hoặc thiếu exportWorkspace → NG
- VC-007: thiếu nhãn promptReused/promptFresh → NG
