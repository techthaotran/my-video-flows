---
name: finding-format
description: Định dạng bắt buộc (tiếng Việt) cho một finding do AI Reviewer trả về và AI Verify đối chiếu bằng finding ID.
---

# Format 1 finding — bắt buộc viết bằng tiếng Việt

Mỗi finding phải đủ 11 trường sau, đúng thứ tự. Tên biến/hàm/file giữ nguyên tiếng Anh, phần diễn giải
viết tiếng Việt.

1. **Vị trí** — `file:line`
2. **Mức độ nghiêm trọng** — CRITICAL / HIGH / MEDIUM / LOW (thang định nghĩa trong `CLAUDE.md`)
3. **Độ tin cậy** — số phần trăm (90-100 = đã chứng minh/reproduce được; 70-89 = có execution path
   rõ ràng; 50-69 = còn cần xác minh, chỉ nêu nếu impact đặc biệt lớn; dưới 50 = không nêu)
4. **Xác suất xảy ra** — LIKELY / POSSIBLE / RARE / UNKNOWN; tách khỏi impact/severity
5. **Nguồn requirement/invariant** — ticket/spec/schema/contract có citation; nếu thiếu thì không
   tạo bug finding chắc chắn, chuyển thành `CONTEXT_GAP`
6. **Giả định / invariant bị vi phạm**
7. **Trạng thái đầu vào / input** — điều kiện hoặc dữ liệu khởi tạo cần có để trigger
8. **Đường thực thi (reachable path)** — luồng gọi thực tế, bao gồm contract nối các domain khi diff
   có thay đổi liên quan
9. **Hiện tượng quan sát được & tác động**
10. **Bằng chứng & trạng thái xác minh** — trích code/log cụ thể; ghi rõ `CONFIRMED`,
   `NOT_REPRODUCED`, `REFUTED`, `BLOCKED`, hoặc còn chờ AI Verify
11. **Đề xuất fix** — ngắn gọn, đúng trọng tâm, không lan man sang refactor không liên quan

## Mẫu

```
### REV-001 — [HIGH][85%] apps/api/ai/src/modules/payment/payment.service.ts:42
- Xác suất: LIKELY
- Nguồn invariant: `detail-spec.md:31` và unique business rule trong `payment.schema.ts:18`
- Giả định bị vi phạm: số dư không được âm sau khi rút tiền
- Input: hai request rút tiền cùng paymentId chạy song song
- Đường thực thi: PaymentController.withdraw → PaymentService.withdraw → check-then-act không có
  transaction/lock bao quanh
- Hiện tượng & tác động: có thể rút vượt số dư, double spend
- Bằng chứng: dòng 42-48 đọc balance rồi ghi lại ngoài transaction; chưa chạy test để verify
- Đề xuất fix: bọc check-then-act trong transaction hoặc dùng optimistic lock trên field balance
```

## Khi không có finding

Nếu không có finding nào đạt bar, trả đúng câu:
`Không tìm thấy vấn đề actionable với độ tin cậy cao.`

Không dùng các câu khẳng định tuyệt đối như "code an toàn", "mọi thứ đều đúng".

## CONTEXT_GAP

`CONTEXT_GAP` không phải bug finding và không có severity giả. Ghi rõ thông tin nào thiếu, quyết định
nào bị ảnh hưởng, đã tìm ở đâu, và human/code owner nào cần xác nhận.
