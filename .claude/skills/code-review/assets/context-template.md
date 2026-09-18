# Review Context

> Artifact tạm của một review run. Đây là source ledger, không phải spec hoặc implementation plan
> mới và không thay thế các tài liệu gốc.

## 1. Review scope

- Diff fingerprint:
- Changed files/modules:
- User-supplied scope:

## 2. Task specification and acceptance criteria

- Status: CONFIRMED | MISSING | NOT_APPLICABLE
- Sources with `file:line` citations:
- Required behavior:
- Acceptance criteria:

## 3. Approved implementation plan

- Status: CONFIRMED | MISSING | NOT_APPLICABLE
- Master plan source:
- Common/API/GUI plan sources:
- Intended design and verification criteria:
- Approval status, if documented:

## 4. Spec ↔ Plan ↔ Diff traceability

| Requirement/criterion | Spec source | Plan item | Implemented diff/code | Status |
| --- | --- | --- | --- | --- |

Status: ALIGNED | MISSING_IN_PLAN | MISSING_IN_CODE | EXTRA_IN_CODE | CONFLICT

## 5. Workflow được duyệt

- Status: CONFIRMED | MISSING | NOT_APPLICABLE
- Nguồn workflow/wiki với citation:
- Actor, trigger, các bước, trạng thái và nhánh lỗi:
- Điểm bắt đầu/kết thúc và side effect:

## 6. Business logic cũ và mới

| Rule | OLD (code/wiki hiện tại) | NEW (spec/plan/workflow) | Giữ tương thích? | Nguồn |
| --- | --- | --- | --- | --- |

- Không dùng code mới làm nguồn tự chứng minh requirement mới.
- Logic cũ phải được trace từ code hiện tại và wiki/tài liệu nếu có.

## 7. Hành vi của user

| Actor/state | Hành động | Kết quả mong đợi | Error/empty/loading/permission state | Nguồn |
| --- | --- | --- | --- | --- |

## 8. Logic hiện tại và phạm vi ảnh hưởng

- Luồng hiện tại trước thay đổi:
- Luồng sau thay đổi:
- Caller/consumer/dependent bị ảnh hưởng:
- Regression/compatibility surface:
- Chức năng liên quan nhưng không đổi và lý do:

## 9. Architecture and conventions

- Status: CONFIRMED | MISSING | NOT_APPLICABLE
- `CLAUDE.md` / README / convention sources:
- Relevant boundaries and patterns:

## 10. Contracts, schema, and invariants

- API/DTO contracts:
- DB schema/index/migrations:
- Events/queues/external contracts:
- Business/security invariants:

## 11. Callers, dependents, and system flow

- Callers/consumers:
- End-to-end request/event → state → side-effect flow:
- Compatibility surface:

## 12. Performance, security, error handling và format/rules

- Performance budget, data size, latency, complexity, loop/I/O/allocation risks:
- Auth/authorization, tenant/trust boundary, secret/PII/input validation risks:
- Error, timeout, retry, partial failure, rollback và fallback behavior:
- Coding rules, API/schema/response format, naming và compatibility rules:
- Refactor skill: KISS | DRY | YAGNI | SOLID | Clean Code | Performance | Error handling —
  APPLICABLE | NOT_APPLICABLE | GAP, kèm evidence cụ thể; không dùng checklist chung chung.

## 13. Runtime and production constraints

- Service topology:
- Traffic/data size/latency:
- Timeout/retry/concurrency:
- Resource/security/compatibility constraints:
- Unknowns must remain explicit; never infer production facts.

## 14. Source conflicts

For each conflict, quote no more than necessary and cite both sources:

- Conflict ID:
- Spec claim/source:
- Plan/code/invariant claim/source:
- Blocked review/verification decision:
- Human owner needed:

## 15. Context gaps and assumptions

- `CONTEXT_GAP` items:
- Explicit assumptions allowed by a cited source:
- Unverified assumptions that must not support a correctness conclusion:

## 16. Completeness gate

- Spec/acceptance criteria: READY | BLOCKED | N/A
- Plan: READY | MISSING | N/A
- Workflow/wiki: READY | MISSING | N/A
- Business logic OLD/NEW: READY | BLOCKED | N/A
- User behavior: READY | BLOCKED | N/A
- Current-system impact/dependents: READY | BLOCKED | N/A
- Architecture/conventions: READY | BLOCKED | N/A
- Contracts/schema/invariants: READY | BLOCKED | N/A
- Performance/security/error/rules/format: READY | BLOCKED | N/A
- Refactor skill checklist: READY | BLOCKED
- Dependencies/versions: READY | BLOCKED | N/A
- Runtime/production constraints: READY | BLOCKED | N/A
- Decision: READY_FOR_REVIEW | PARTIAL_REVIEW_WITH_GAPS | BLOCKED_BY_SOURCE_CONFLICT

Precedence is always: confirmed spec → approved plan → approved workflow/wiki and established
business invariants → actual diff/current code → conventions/runtime constraints. A plan cannot
override a spec; new diff/code cannot define its own requirement.
