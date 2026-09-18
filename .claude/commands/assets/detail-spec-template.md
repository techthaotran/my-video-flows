# Requirement Analysis: [Tên tính năng]

> Date: YYYY-MM-DD · Status: Đã chốt với user

## 1. Context & Goal
- **Current problem:** ...
- **Goal:** ... (điều gì được coi là thành công)
- **Users involved:** ...

## 2. Scope
**In scope:**
- ...

**Out of scope:**
- ...

## 3. User Stories & Acceptance Criteria

### US-01: [Tên story]
**Là** [actor], **tôi muốn** [hành động], **để** [giá trị đạt được].

**Acceptance criteria:**
- [ ] AC-01.1: Bối cảnh [bối cảnh], Khi [hành động], Thì [kết quả mong đợi]
- [ ] AC-01.2: ...

### US-02: ...

## 4. Business Rules
| ID | Rule | Note |
|----|------|------|
| BR-01 | ... | ... |

## 5. Edge Cases & Error Handling
| ID | Situation | Expected behaviour |
|----|-----------|--------------------|
| EC-01 | ... | ... |

## 6. Impact on the Existing System
*Chỉ mô tả hiện trạng và phạm vi bị ảnh hưởng — KHÔNG thiết kế DB schema, store, hay API ở đây (xem `/03-create-schema-store`).*
- **Current business flow:** (các bước người dùng đang trải qua hôm nay)
- **Related code areas:** `path/to/file.ts:123` — vai trò trong luồng
- **Data to persist (business level):** ví dụ "lý do huỷ đơn", "thời điểm duyệt" — không nêu tên bảng/field
- **Constraints & risks:** tương thích ngược, dữ liệu cũ, hiệu năng, đồng thời...

## 7. Assumptions
- **GD-01:** ... *(user chưa xác nhận, sẽ implement theo cách này nếu không có phản hồi khác)*

## 8. Open Questions
- **Q-01:** ... — *chờ ai trả lời*
