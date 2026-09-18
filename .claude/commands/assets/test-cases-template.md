# Test Cases: [Tên tính năng]

## Overview

- **Feature**: [Tên]
- **Requirement source**: [path tới PRD / analysis / plan]
- **Scope**: [Trong phạm vi / Ngoài phạm vi — tóm tắt]
- **Coverage**: [Tóm tắt layers: unit / integration / manual]
- **Priority**: 🔴 High (chặn release) · 🟡 Medium · 🟢 Low — trong mỗi mục, case 🔴 luôn đứng trước
- **Last updated**: [YYYY-MM-DD]

### Requirement ID Mapping
_(chỉ thêm section này nếu nguồn yêu cầu không tự đánh số)_

| ID | Source |
|----|--------|
| REQ-001 | `path/to/prd.md` — mục "Đăng nhập" |

## Current Test Coverage

[Test hiện có, khoảng trống, pattern cần tuân theo — kèm file:line]

### Key Findings
- [Phát hiện kèm tham chiếu]
- [Ràng buộc / out-of-scope từ plan]

## Out of Scope

[Liệt kê rõ phần không test — đồng bộ với `## 5. Out of Scope` của master plan nếu có]

## Test Strategy

### Unit tests
- [Cần test gì]
- [Edge case quan trọng]

### Integration tests
- [Kịch bản end-to-end / API / module boundary]

### Manual steps
1. [Bước cụ thể]
2. [Bước khác]

## Test Case Catalogue

### High Priority (🔴 — read first)

_(Liệt kê mọi case High trước khi vào chi tiết từng category. Sắp xếp theo thứ tự sẽ chạy / review.)_

| ID | Title | Category |
|----|-------|----------|
| 🔴 TC-F-001 | [Tiêu đề] | Unit / Functional |
| 🔴 TC-ERR-001 | [Tiêu đề] | Error Handling |

### 1. Unit / Functional

_(Trong mục: 🔴 rồi 🟡 rồi 🟢)_

#### 🔴 TC-F-001: [Tiêu đề]
- **Requirement**: [REQ / US / phase của plan]
- **Verification type**: Automated | Manual
- **Priority**: 🔴 High
- **Preconditions**:
  - [Điều kiện]
- **Test Steps**:
  1. [Bước]
  2. [Bước]
- **Expected Results**:
  - [Kết quả đo được]
- **Postconditions**: [Trạng thái sau test]
- **Command / test location** (nếu automated): `make test-...` hoặc `path/to/spec.ts`

#### 🟡 TC-F-002: [Tiêu đề]
- **Priority**: 🟡 Medium
[Cùng cấu trúc]

#### 🟢 TC-F-003: [Tiêu đề]
- **Priority**: 🟢 Low
[Cùng cấu trúc]

### 2. Edge Case

#### 🔴 TC-E-001: [Tiêu đề]
[Cùng cấu trúc — heading + Priority field đều có emoji]

### 3. Error Handling

#### 🔴 TC-ERR-001: [Tiêu đề]
[Cùng cấu trúc]

### 4. State Transition (nếu có)

#### 🟡 TC-ST-001: [Tiêu đề]
[Cùng cấu trúc]

### 5. Integration

#### 🔴 TC-INT-001: [Tiêu đề]
[Cùng cấu trúc]

### 6. Manual Verification

#### 🟡 TC-M-001: [Tiêu đề]
[Cùng cấu trúc — Verification type: Manual]

## Requirement Coverage Matrix

| Requirement ID | Test Cases | Verification type | Priority | Coverage |
|---------------|------------|-------------------|----------|----------|
| REQ-001 | 🔴 TC-F-001, 🟡 TC-E-001 | Automated | 🔴 / 🟡 | ✓ Đủ |
| REQ-002 | 🟢 TC-M-001 | Manual | 🟢 | ⚠ Một phần |

## Suite Completion Criteria

### Automated
- [ ] Unit test pass: `[lệnh cụ thể]`
- [ ] Integration / e2e pass: `[lệnh cụ thể]`
- [ ] Typecheck / lint (nếu liên quan): `[lệnh]`

### Manual
- [ ] [Kịch bản UI / UX]
- [ ] [Performance / edge thủ công]
- [ ] [Không regression tính năng liên quan]

## Notes
- [Giả định]
- [Hạn chế đã biết]

## References

- Plan: `thoughts/shared/plans/...`
- Analysis: `thoughts/analysis/...`
- Existing tests / similar implementation: `[file:line]`
- Testing principles: `references/testing-principles.md`
