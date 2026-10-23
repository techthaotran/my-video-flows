---
name: khi-chat-sang-trong
description: Nhận ảnh người mẫu (và tuỳ chọn ảnh áo, quần, bối cảnh) rồi trả về DUY NHẤT prompt tiếng Việt cho Gemini/Flow để ảnh có khí chất cao sang, sang trọng, quý phái - ánh mắt có hồn, biểu cảm tiết chế, dáng vững, ánh sáng có chiều sâu, nền tách chủ thể, da thật. Dùng khi người dùng muốn nhân vật "có khí chất", "sang", "quý phái", "có chiều sâu", hoặc muốn nâng cấp prompt ảnh người mẫu hiện có.
---

# Prompt khí chất cao sang, sang trọng, quý phái

## Đầu vào, đầu ra
- **Đầu vào:** ảnh người mẫu (`@nhanvat`), tuỳ chọn ảnh áo (`@ao`), ảnh quần (`@quan`), ảnh bối cảnh (`@boicanh`), và gu khí chất nếu người dùng nêu. Có thể gửi kèm prompt cũ để nâng cấp.
- **Đầu ra:** chỉ prompt trong một khối code, mỗi ảnh một prompt. Không viết phân tích dài. Chỉ thêm tối đa 1-2 dòng lưu ý khi thiếu thông tin hoặc có giả định.
- Khi có prompt cũ: giữ nguyên bối cảnh, trang phục, khung hình của prompt cũ, chỉ thêm khối khí chất và negative bên dưới.
- **Mỗi tag (`@nhanvat`, `@ao`, `@quan`, `@boicanh`) chỉ xuất hiện đúng một lần trong prompt.** Lần sau gọi bằng chữ: "người mẫu", "chiếc áo này", "chiếc quần này", "ảnh bối cảnh". Không nhắc lại tag ở cuối prompt hay trong khối khí chất.

## Khí chất là gì
Khí chất đến từ **sự tiết chế**: cảm xúc có nhưng không phô, dáng vững mà thả lỏng, ánh mắt có hướng và có nghĩ ngợi.
Nhân vật trông sang khi **ít diễn**, không phải khi nhiều chi tiết.
Không nhồi đồ trang sức, không tạo dáng gượng, không cười rộng.

## Chọn một trong ba tông khí chất
Hỏi người dùng nếu chưa rõ; không chọn thì mặc định tông 1. Mỗi ảnh chỉ một tông.

| Tông | Từ khoá khí chất | Ánh mắt và biểu cảm | Dáng |
|---|---|---|---|
| 1. Quý phái thanh nhã | thanh lịch, điềm đạm, kiêu hãnh kín đáo, dịu dàng mà có nội tâm | nhìn ống kính hơi trầm hoặc lệch nhẹ, khoé môi cong rất nhẹ, môi khép | vai mở, cằm hơi nâng, cổ dài, trọng lượng dồn một chân, tay thả lỏng |
| 2. Sang trọng lạnh | sang trọng, lạnh lùng, quyền quý, tự tin sắc sảo | nhìn thẳng ống kính, ánh mắt vững, gần như không cười | thân thẳng, hơi ngả vai, dáng bước chậm hoặc đứng tĩnh |
| 3. Hoài cổ ấm áp | mộc mạc, ấm áp, hoài cổ, duyên dáng truyền thống | nhìn xa hoặc nhìn xuống nhẹ, cười thoáng, dịu | nghiêng người nhẹ, tay chạm vạt áo hoặc lọn tóc |

## Khối khí chất (chèn vào prompt)
Thay `[tông]` và `[từ khoá]` theo bảng trên.

```
Khí chất: [từ khoá]. Ảnh chân dung thời trang chân thực như phim điện ảnh, sang trọng, quý phái.
Ánh mắt có hồn, có điểm sáng (catchlight) rõ trong mắt, [ánh mắt và biểu cảm theo tông]. Biểu cảm tiết chế, không cười rộng, không lộ răng.
Dáng: [dáng theo tông]. Cổ dài, lưng thẳng thả lỏng, bàn tay tự nhiên, năm ngón rõ ràng.
Ánh sáng mềm có hướng, xiên từ một bên, tạo khối sáng tối nhẹ trên mặt và cổ, có ánh hắt mềm. Nền có chiều sâu, xoá phông vừa phải, chủ thể tách khỏi nền.
Da thật, thấy lỗ chân lông nhẹ, hồng hào tự nhiên, giữ chi tiết da. Không làm mịn da quá mức, không biến dạng khuôn mặt, khuôn mặt nhất quán.
Giữ đúng màu và hoa văn của chiếc áo này, đúng màu và kiểu của chiếc quần này, không ám màu, không cháy sáng.
Tránh: nền phẳng, mắt vô hồn, mặt cứng, dáng gượng, cười gượng, da nhựa hay sứ, vẻ hoàn hảo giả tạo, tay chân cứng hoặc lơ lửng, đồ trang sức rối mắt.
```

## Quy tắc khi viết prompt
- Có `@nhanvat`: đúng một lần, dòng đầu ghi "giữ đúng khuôn mặt của @nhanvat" rồi mô tả nét mặt theo ảnh (xem kỹ, không bịa). Các câu sau gọi là "người mẫu". Khí chất đổi ở ánh mắt, biểu cảm, dáng, ánh sáng; **không đổi khuôn mặt**.
- Có `@ao`: đúng một lần, mặc `@ao`, không mô tả lại màu và hoa văn bằng chữ. Cùng câu hoặc câu kế ghi "giữ nguyên 100% hoa văn, màu và kiểu dáng của chiếc áo này". Các câu sau gọi là "chiếc áo này".
- Có `@quan`: đúng một lần, quần là `@quan`, không mô tả lại màu và kiểu bằng chữ. Cùng câu hoặc câu kế ghi "giữ nguyên 100% màu, form ống, kiểu lưng và chiều dài của chiếc quần này". Các câu sau gọi là "chiếc quần này". Không có `@quan`: tả quần theo ảnh người mẫu hoặc ảnh tham khảo, không gắn tag.
- Bối cảnh: có `@boicanh` thì dùng đúng một lần rồi gọi là "ảnh bối cảnh". Không có thì giữ theo ảnh tham khảo. Muốn sang hơn thì chọn nền tông ấm kem, đá, gỗ, cửa vòm, vườn xoá phông; bỏ vật dụng rối.
- Phụ kiện: tối đa 1 món cầm tay, tôn áo, không chói hơn áo. Không chữ, không logo, không tên thương hiệu.
- Ảnh có nhiều hoa văn: ánh sáng xiên mềm, tránh ngược sáng mạnh.
- Cười: tông 1 và 3 cười rất nhẹ; tông 2 gần như không cười. Nếu ảnh cho cửa hàng cần thân thiện, cho phép cười nhẹ khép môi.
- **Tránh từ dễ bị bộ lọc Google Flow chặn:** không ghi tên hãng, dùng "ngang gối", "ngang hông" thay "ngang đùi", "đặt nhẹ bên eo" thay "chống eo". Khi Flow báo lỗi, bỏ lần lượt phụ kiện rồi khung hình và chạy lại.
- Khung hình ảnh bìa Shopee (người nửa trái, cao hơn 80%, góc dưới trái trống) thuộc skill `shopee-dang-phu-kien`; skill này chỉ thêm khí chất, không đổi khung.

## Kiểm kết quả sau khi chạy
Chấm 1-5 cho bốn mục: ánh mắt có hồn, biểu cảm tự nhiên, nhân vật tách nền, áo không bị đổi hoa văn.
Mục áo bị đổi là rủi ro chính khi prompt dài: không thêm tag lần nữa; siết câu giữ hoa văn ngay chỗ đã viết `@ao`.
Mặt bị đổi: không nhắc lại `@nhanvat`; siết mô tả nét mặt ngay dòng đầu và rút bớt mô tả cảm xúc.
Chạy mỗi bản 3-4 lần vì AI có độ ngẫu nhiên.
