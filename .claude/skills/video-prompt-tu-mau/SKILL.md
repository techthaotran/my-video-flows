---
name: video-prompt-tu-mau
description: Nhận một video mẫu (người mẫu thời trang đang diễn), ảnh nhân vật, ảnh bối cảnh và tuỳ chọn ảnh đạo cụ, rồi cắt video mẫu thành các clip 10 giây tắt tiếng, xem từng khung hình để rút ra cỡ cảnh, chuyển động máy và cử chỉ, và trả về prompt tiếng Việt theo khung chuẩn (đầu vào, khóa nhân vật, khóa bối cảnh, hành động, kỹ thuật, không được) cho mỗi clip để Flow/Omni tạo lại cảnh quay đó với nhân vật và bối cảnh mới. Dùng khi người dùng gửi video và nói "viết prompt theo video này", "thay nhân vật và background", "lấy cảnh quay từ video", "tách video thành các clip 10s", "prompt video 1/2/3", hoặc muốn một video AI có chuyển động và góc máy giống video tham khảo.
---

# Prompt video từ video mẫu (thay nhân vật + bối cảnh)

## Đầu vào, đầu ra
- **Đầu vào:** video mẫu (`@mau`), ảnh nhân vật (`@nhanvat`, mặc trang phục sẽ dùng), ảnh bối cảnh (`@bg`). Tuỳ chọn: ảnh đạo cụ (quạt, túi...), yêu cầu riêng (tay áo, quạt, độ dài).
- **Đầu ra:** mỗi clip 10 giây một prompt trong một khối code, theo khung ở mục 3. Kèm các file clip mẫu đã cắt. Không giải thích dài, chỉ thêm vài dòng lưu ý khi có giả định cần người dùng kiểm tra.
- Thiếu nhân vật hoặc bối cảnh thì hỏi một lần. Không bịa trang phục hay chi tiết bối cảnh không thấy trong ảnh.

## Quy trình
1. **Cắt clip mẫu:** `./.claude/skills/video-prompt-tu-mau/scripts/split_clips.sh <video> <thư_mục_ra> 10 mau`.
   Script cắt clip 10 giây tắt tiếng, kéo giãn clip cuối nếu ngắn hơn 10 giây, xuất frame cuối từng clip (để làm ảnh đầu cho clip sau) và bảng frame đánh số giây.
   Lưu ra thư mục người dùng chỉ định, mặc định cạnh video gốc.
2. **Xem bảng frame** của từng clip (`bang_frame_*.png`) bằng Read. Nếu cần chi tiết hơn, tách thêm frame 2 hoặc 4 khung/giây. Không viết prompt khi chưa xem frame.
3. **Rút ra từng giây** cho mỗi clip (xem bảng rút ra bên dưới), ghi nháp trước khi viết.
4. **Xem ảnh nhân vật và bối cảnh**, liệt kê chi tiết cần khóa (đếm chính xác số vật thể, thứ tự màu, vị trí).
5. **Viết prompt** theo khung. Mọi mục phải cụ thể, không để chỗ trống.
6. Trả prompt từng clip, nhắc nối clip bằng frame cuối.

### Bảng rút ra từ video mẫu (mỗi giây)
| Mục | Ghi |
|---|---|
| Cỡ cảnh | Cận mặt, cận nửa người, trung cảnh, gần toàn thân, toàn thân xa; máy lùi, tiến hay đứng yên; có cắt tối không |
| Hướng cơ thể | Đối diện, 3/4, nghiêng, quay lưng hẳn (phải ghi rõ "quay lưng hẳn", không để mô hình xoay nghiêng) |
| Tay | Tay nào làm gì, vị trí so với mặt và bụng |
| Chân | Đứng, bước tới, bước lùi, xoay |
| Đạo cụ | Trạng thái (xòe, gập, cầm tay nào), có khuất không |
| Cử chỉ mặt | Nhắm mắt, nghiêng đầu, cười, hướng nhìn |
| Nhịp | Chậm, nhanh, dừng một nhịp ở đâu |

## 3. Khung prompt (mỗi clip)

Khung gọn đã chạy được. Giữ đúng thứ tự mục và tên mục.

```
[ĐẦU VÀO]
Nhân vật: <tên file>, <mô tả cố định: khuôn mặt, tóc, phụ kiện đầu, trang phục>.
Đạo cụ: <tên file>, giữ nguyên hình dạng và hoa văn.        (bỏ nếu không có)
Bối cảnh: <tên file>, dùng làm toàn bộ phông nền.
Khung đầu: frame cuối của clip trước.                      (clip 2 trở đi)
Chuyển động: <tên file clip mẫu>. Chỉ sao chép thứ tự động tác, cỡ cảnh, chuyển động máy, hướng cơ thể, nhịp bước và cử chỉ tay. Không sao chép khuôn mặt, trang phục (kể cả <khác biệt đã biết, vd tay áo rộng>), bối cảnh, màu sắc của video này.

[GIỮ NGUYÊN NHÂN VẬT, SUỐT VIDEO]
- <Từng chi tiết dễ mất hoặc dễ đổi: tay áo, đạo cụ, tóc, phụ kiện, trang phục, khuôn mặt, số ngón tay>

[BỐI CẢNH, KHÓA CỨNG]
Mọi khung hình là đúng căn phòng/cảnh trong <file bg>, nhìn từ một hướng, giữ nguyên vị trí và chi tiết:
- <Từng vùng: trái, phải trên, góc dưới, tường, sàn, ánh sáng. Đếm đúng số lượng vật thể>
Vật thể phụ (giá treo, tranh, đồ trang trí) đứng yên, giống hệt ảnh. Không thêm, bớt, đổi chỗ vật thể nào, không thay nền trơn hay nền đen.
Máy đặt cố định một vị trí, đổi cỡ cảnh bằng zoom mượt. Khi cận cảnh, nền chỉ là phần tương ứng của chính cảnh đó, không bịa nền khác. Khi cảnh xa, thấy đủ, nhân vật đứng ở khoảng trống, không che vật thể chính của nền.

[HÀNH ĐỘNG]
<Đoạn văn liền mạch, không mốc giây. Mỗi động tác bắt đầu từ tư thế kết thúc của động tác trước. Ghi rõ cỡ cảnh và chuyển động máy theo thứ tự. Câu cuối: chuyển động liên tục, nhịp chậm duyên dáng, mô hình tự chia thời gian cho vừa 10 giây.>

[KỸ THUẬT]
Dọc 9:16, cỡ cảnh đổi theo mô tả, nền luôn rõ nét. Ánh sáng nhân vật hòa với ánh sáng của <file bg>. Mượt 60fps, siêu thực 8K, 10 giây, không âm thanh.

[KHÔNG ĐƯỢC]
<Gom mọi lỗi đã gặp: mất đạo cụ, đổi tay, tóc mất, mất phụ kiện, đổi trang phục, nền bị đổi hoặc bịa, xoay nghiêng thay cho quay lưng hẳn, giữ một cỡ cảnh suốt video, thêm người, chữ, logo>
```

Dạng có mốc giây ("Từ giây 0 đến giây 1, ...") chỉ dùng khi người dùng yêu cầu. Mặc định dùng đoạn văn liền mạch vì nhịp mượt hơn, đổi lại kém kiểm soát thời điểm.

## Quy tắc đã rút từ lần chạy thật
Mỗi quy tắc đến từ một lỗi đã gặp. Áp dụng mặc định.

1. **Mô hình bám prompt chữ nhiều hơn video mẫu.** Muốn giống mẫu, prompt phải ghi rõ cỡ cảnh, chuyển động máy, hướng cơ thể của từng đoạn. Cấm câu "máy cố định, không zoom" khi video mẫu có đổi cỡ cảnh.
2. **Quay lưng phải ghi "quay lưng hẳn, dừng một nhịp".** Chỉ ghi "xoay lưng" thì mô hình xoay nghiêng 90 độ.
3. **Đạo cụ cầm tay (quạt, túi) hay biến mất:** ghi tay nào cầm ở mọi đoạn, cho phép bị che một phần nhưng vẫn "trong tay", và đặt đạo cụ vào mục KHÔNG ĐƯỢC. Nếu có ảnh đạo cụ, đưa vào đầu vào để mô hình không tự vẽ khác.
4. **Tóc dễ biến mất khi quay lưng hoặc đưa tay lên tóc:** mô tả độ dài tóc cụ thể, ghi tóc phủ giữa lưng khi quay lưng, và chỉ chạm tóc mai, không vén ra sau.
5. **Tay áo theo ảnh nhân vật, không theo video mẫu:** nếu video mẫu mặc áo tay rộng, ghi rõ tay áo ôm cổ tay và "không sao chép tay áo của video mẫu". Cấm "ống tay áo rộng", "tay áo rũ" trong phần hành động.
6. **Bối cảnh phải khóa theo từng vật:** liệt kê vị trí, đếm đúng số lượng, thứ tự màu. Khi cận cảnh, ghi nền chỉ là phần tương ứng của căn phòng và cấm bịa nền. Prompt không khóa thì mô hình vẽ lại căn phòng.
7. **Ảnh bối cảnh nên có cùng tỉ lệ với video (9:16).** Ảnh 3:4 buộc mô hình tự thêm trần và sàn. Gợi ý người dùng mở rộng ảnh sang 9:16 trước, hoặc dùng ảnh ghép sẵn nhân vật vào nền làm khung đầu.
8. **Nối clip bằng frame cuối.** Clip sau mở đầu ở đúng tư thế kết thúc của clip trước. Clip trước nên kết bằng tư thế ổn định (đứng thẳng, đạo cụ ở vị trí rõ ràng).
9. **Đoạn mở đầu bằng cảnh đặc biệt** (quạt che màn hình, cắt tối) phải được mô tả đúng như người dùng chỉ định và chỉ xuất hiện một lần.
10. **Cắt cảnh tối giữa video** trong video mẫu: ghi thành "một nhịp tối nhẹ rồi sáng lại", chỉ một lần, không để mô hình cắt thêm.
11. **Không mô tả hát, mấp máy môi, lời thoại.** Video không có âm thanh, nên chỉ ghi biểu cảm và nụ cười.

## Kiểm sau khi người dùng chạy
Khi người dùng gửi video đã sinh:
1. Tách frame 1 khung mỗi giây cho cả video sinh ra và clip mẫu (cùng script).
2. So từng giây: cỡ cảnh, hướng cơ thể, tay, đạo cụ, tóc, nền.
3. Báo bảng giống/khác, nêu nguyên nhân (prompt hay mô hình), chỉ ra câu cần sửa. Không báo "giống 90%" nếu chưa so từng giây.
4. Sửa đúng chỗ lệch, không viết lại toàn bộ prompt.

## Việc không làm
- Không dùng dấu gạch dài (em dash), chỉ dùng gạch ngang thường "-" (quy ước repo).
- Không viết nội dung tiếng Anh trong prompt, trừ tên file và thông số kỹ thuật (9:16, 60fps, 8K).
- Không đổi trang phục hay bối cảnh người dùng đã chốt.
- Không tự bịa số lượng vật thể trong ảnh bối cảnh. Đếm từ ảnh, nếu không chắc thì ghi và nhờ người dùng xác nhận.
