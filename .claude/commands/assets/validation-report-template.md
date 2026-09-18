# Validation Report: [Tên plan]

> Date: YYYY-MM-DD · Plan: `path/to/plan.md` · Commit range: `HEAD~N..HEAD`

## 1. Result Summary

| Phase | Status | Note |
|-------|--------|------|
| Phase 1: [Tên] | ✅ Hoàn thành đầy đủ | |
| Phase 2: [Tên] | ⚠️ Có vấn đề | 1 automated check fail |
| Phase 3: [Tên] | ❌ Chưa triển khai | Không tìm thấy thay đổi liên quan |

## 2. Automated Verification

### Phase 1: [Tên]
- [x] `make test-component` — pass
- [x] `npm run typecheck` — pass

### Phase 2: [Tên]
- [x] `make build` — pass
- [ ] `make lint` — **FAIL**: 3 warnings tại `path/to/file.ts:42`

## 3. Design Decisions (master plan, section 2) — Actual vs Committed

| Principle | Committed in plan | Actual | Verdict |
|-----------|-------------------|--------|---------|
| YAGNI | Không thêm interface, dùng plain function | Đúng như cam kết | ✅ Khớp |
| DRY | Extract logic dùng chung vào `utils/x.ts` | Logic bị lặp lại ở 2 nơi | ⚠️ Deviation — cần extract |

## 4. Deviations (không ảnh hưởng hành vi)
- [Mô tả, file:line — vô hại/cải tiến]

## 5. Issues (ảnh hưởng hành vi / chất lượng)
| ID | Issue | File:line | Severity | Proposed fix |
|----|-------|-----------|----------|--------------|
| ISS-01 | ... | ... | Cao/Trung bình/Thấp | [Diff hoặc mô tả fix cụ thể — CHƯA áp dụng] |

## 6. Flow Diagram (master plan, section 3) — Actual vs Planned
[So sánh luồng trong plan vs. luồng code thực tế; nêu rõ nếu khớp hoàn toàn hoặc chỗ nào lệch]

## 7. Manual Checks Still Required
- [ ] [Nguyên văn dòng `Manual` của từng phase, và master plan section 6]

### Work Matrix Coverage (master plan, section 4)
| Row | Item | Phase | Status |
|-----|------|-------|--------|
| #1 | [tên] | Phase 1 (common) | ✅ |

## 8. Next Steps
- [Ưu tiên fix nào trước; có nên tạo lại validation sau khi fix không]
