# Implementation Plan [Common | API | GUI]: [Tên tính năng/task] · [ENG-XXXX]

> Context & current state, design decisions, out of scope, references:
> xem [master plan](./YYYY-MM-DD-ENG-XXXX-description.md) section 1, 2, 5, 7.
> File này chỉ chứa: phần **lệch** so với master plan, và các **phase thi công**.

## Deviations from Master Plan

Chỉ ghi điều **chỉ đúng với phần này** và chưa có ở master plan (ràng buộc riêng, quyết định riêng, thư viện riêng). Không có gì → giữ nguyên `N/A`.

- N/A

---

## Phase 1 — [tên mô tả]

*(Work matrix: #1, #3)*

**Changes**
- `path/to/file.ts` — [thay đổi, 1 dòng]
- `path/to/other.ts` — [thay đổi, 1 dòng]

```[language]
// Chỉ đưa code khi ý đồ không diễn đạt nổi bằng 1 dòng bullet
```

**Verify**
- Automated: `[lệnh]` · `[lệnh]`
- Manual: [1 dòng, hoặc N/A]

---

## Phase 2 — [tên mô tả]

*(Work matrix: #5)*

**Changes**
- `path/to/file.ts` — [thay đổi, 1 dòng]

**Verify**
- Automated: `[lệnh]`
- Manual: [1 dòng, hoặc N/A]

---

## Migration / Rollback Notes

[Cách xử lý dữ liệu hoặc hệ thống hiện có, cách quay lui nếu hỏng. Không có → N/A]

---

**Execution rule**: xong 1 phase và mọi verify tự động pass → dừng, chờ người dùng xác nhận verify thủ công trước khi sang phase kế.
