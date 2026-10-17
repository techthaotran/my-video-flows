---
name: shopee-anh-quan
description: Nhận ảnh quần của người dùng (và tuỳ chọn ảnh tham khảo cách chụp, chất liệu, các màu khác của cùng mẫu quần) rồi trả về prompt tiếng Việt cho Gemini/Flow để tạo ảnh 3:4 chụp trọn chiếc quần trải phẳng (không người mẫu), thấy đầy đủ từ lưng đến gấu, nền và đồ trang trí sang trọng; khi quần có nhiều màu thì ghép hàng vòng tròn biến thể màu ở góc trên bên phải bằng script.
---

# Prompt ảnh sản phẩm quần trải phẳng (3:4)

## Đầu vào, đầu ra
- **Đầu vào:** ảnh quần (`@quan`). Tuỳ chọn: ảnh tham khảo cách chụp (`@thamkhao`), ảnh cận cảnh vải thật (`@vai`), chất liệu do người dùng nói (thun lạnh, tăm, linen...), số ảnh cần tạo, số màu.
- **Đầu ra:** chỉ prompt, mỗi ảnh một prompt trong một khối code. Không phân tích dài. Tối đa 1-2 dòng lưu ý khi thiếu thông tin hoặc có giả định.
- Ảnh chụp **chiếc quần**, không có người mẫu. Mục đích: khách thấy **đầy đủ dáng quần** (lưng, form ống, chiều dài, gấu) và bề mặt vải.
- `@quan` quyết định quần (màu, kiểu lưng, form ống, chiều dài, túi, đường may). `@thamkhao` (nếu có) chỉ quyết định **cách đặt quần và góc máy**; phông nền và đồ trang trí luôn theo luật "sang" bên dưới, không lấy nền rẻ (thảm lông, thảm cói) từ ảnh tham khảo.
- **Mỗi tag chỉ xuất hiện một lần trong prompt.** Các lần sau gọi là "chiếc quần này", "ảnh tham khảo".
- **Không đính kèm `@vai` vào Flow** (Flow dán nguyên ảnh vải vào khung). Xem `@vai` rồi tả bề mặt vải bằng chữ.

## Quy trình
1. Xem `@quan`: kiểu lưng (thun, cạp bản, dây rút), form ống (suông, ống rộng, loe, côn), chiều dài, túi, đường may, nhãn ở lưng.
2. Xem `@thamkhao` (nếu có): quần đặt chéo hay thẳng, ống xoè hay khép, gấp hay trải, góc máy. Không bịa thứ không thấy.
3. Chọn bố cục (bảng dưới), phông nền, đồ trang trí.
4. Viết prompt theo mẫu, không để placeholder còn sót.
5. Trả prompt.

## Bố cục (mỗi ảnh một kiểu; mặc định dùng Q1-Q3 vì quần phải hiện đầy đủ)
| Kiểu | Mô tả để ghi vào prompt | Vùng quần trong khung |
|---|---|---|
| Q1. Đặt chéo, hai ống xoè chữ V | Quần trải phẳng nằm chéo trong khung, lưng ở phía trên hơi lệch trái, hai ống xoè nhẹ hình chữ V về phía dưới bên phải | Trọn quần, không cắt mép |
| Q2. Gấp đôi dọc | Quần gấp đôi theo chiều dọc, hai ống chồng khít, đặt thẳng đứng hơi nghiêng, gấu hơi xoè để thấy độ rủ và đường may gấu | Trọn quần nhìn nghiêng, thấy rõ form ống |
| Q3. Trải thẳng mặt trước | Quần trải phẳng thẳng đứng giữa khung, hai ống song song cách nhau một khe nhỏ, lưng phẳng, thấy túi và đường ly (nếu có) | Trọn quần, đối xứng |
| Q4. Cận lưng và nửa trên | Cận lưng quần và nửa trên hai ống, phần dưới cắt ngang mép khung | Lưng, túi, đáy quần |
| Q5. Cận gấu gấp lật | Cận gấu hai ống, một góc gấu gấp lật nhẹ để thấy mặt trái, độ dày vải, đường may gấu | Gấu chiếm 60-70% khung |

- Q4, Q5 chỉ dùng khi người dùng muốn thêm ảnh chi tiết; bộ ảnh luôn có ít nhất một ảnh Q1, Q2 hoặc Q3.
- Q1-Q3: luôn ghi "thấy đầy đủ từ lưng đến gấu, không phần nào bị cắt mép khung" và giữ đúng chiều dài so với bề ngang lưng (Flow hay vẽ quần ngắn lại hoặc ống hẹp đi).

## Quy tắc khi viết prompt
**Quần**
- Luôn là `@quan`, giữ đúng màu, kiểu lưng, form ống, chiều dài, túi. Không mô tả lại màu bằng chữ.
- Quần phẳng, gọn, không nhàu; nếp rũ mềm tự nhiên. Mặt phải hướng về máy.
- **Mặt trong lưng quần trơn hoàn toàn, không nhãn, không mác size, không chữ.** Không logo, không mã sản phẩm.
- Combo (quần đi kèm áo hoặc món gấp): chỉ thêm khi người dùng nói rõ; đặt ở góc dưới, không đặt ở góc trên bên phải.

**Bề mặt vải**
- Q1-Q3: "đủ nét để thấy bề mặt vải" (hạt dệt, độ mịn, độ bóng, độ rủ, nếp chun lưng). Q4, Q5: "chụp đủ gần để thấy rõ bề mặt vải".
- Có `@vai`: tả đúng những gì thấy. Không có: tả theo `@quan`, không bịa.
- **Chỉ ghi tên chất liệu khi người dùng cung cấp.** Không bịa chất liệu.
- Prompt không bao giờ yêu cầu Flow vẽ vòng tròn, mũi tên hay chú thích. Vòng tròn ghép bằng script.

**Phông nền và đồ trang trí (phải nhìn sang)**
- Cả khung như ảnh catalogue cao cấp: nền sạch, chất liệu nền đắt tiền, ít đồ, nhiều khoảng thở quanh quần. Không dùng: thảm lông, thảm cói, giấy kraft, cành khô, lá khô, vải bố thô, mặt bàn nhựa, nền giấy nhăn, hoa nhựa màu chói.
- Mặt nền chọn một: đá travertine be mịn, đá cẩm thạch trắng hoặc kem vân xám mảnh, gỗ óc chó hoặc gỗ sồi sáng đánh bóng mờ, lụa satin trơn tông kem/champagne. Không vết bẩn, không trầy xước.
- Quần sáng: travertine be, gỗ óc chó, satin champagne. Quần đậm: cẩm thạch trắng, satin kem. Bộ nhiều màu có cả sáng lẫn đậm: dùng chung travertine be mịn hoặc cẩm thạch kem vân mảnh.
- Được lộ một nền thứ hai ở góc dưới (nếp lụa satin, bậu cửa đá) không quá 10% khung.
- Tối đa 2 đồ trang trí nhỏ nhìn đắt tiền, không chữ, không logo, không nhãn: bó hoa hồng kem hoặc hoa lan trắng tươi, lọ nước hoa thuỷ tinh trơn không nhãn, chuỗi ngọc trai, lắc tay vàng mảnh, kính râm gọng đen trơn, khay đá cẩm thạch nhỏ, túi xách da trơn không khoá logo.
- Đồ trang trí đặt ở khoảng trống cạnh ống quần hoặc góc dưới, không che quần, không chói hơn quần.
- Tông màu tối đa 3: màu quần, tông nền, một điểm nhấn trắng ngà hoặc vàng nhạt. Không màu chói, không đồ nhựa.

**Máy ảnh và ánh sáng**
- Q1, Q3: 50mm, f/5.6, nhìn thẳng từ trên xuống 90 độ, toàn bộ quần nét đều.
- Q2: 50mm, f/5.6, nhìn thẳng từ trên xuống hoặc chếch rất nhẹ, toàn bộ quần nét đều.
- Q4: 70mm, f/5.6, chếch xuống khoảng 65 độ. Q5: macro 100mm, f/4, chếch xuống khoảng 45 độ, phần còn lại mờ dần.
- Ánh sáng cửa sổ mềm từ phía trên bên trái khoảng 5500K, bóng đổ mềm nhẹ quanh mép quần, **luôn ghi** "giữ đúng màu của quần, không ám màu, không cháy sáng". Quần đậm thêm "vẫn thấy rõ chi tiết vải ở vùng tối".
- Thuỷ tinh, ngọc trai, kim loại: "có điểm phản sáng nhỏ tinh tế, không loá".

**Khung hình**
- Tỉ lệ **3:4** (1200×1600). Q1-Q3: quần chiếm khoảng 80% khung. Q4, Q5: khoảng 85%.
- Không chữ, logo, watermark, số điện thoại, viền; không người, không tay người.

**Tránh từ dễ bị Google Flow chặn:** không ghi "thương hiệu" hay tên hãng. Khi Flow báo lỗi, bỏ lần lượt dòng đồ trang trí, rồi dòng bề mặt vải, và chạy lại.

## Mẫu prompt
```
Tham chiếu cách đặt quần và góc máy từ ảnh: @thamkhao, chỉ lấy bố cục, không lấy quần, phông nền, đồ trang trí hay chữ trong ảnh tham khảo.
Ảnh sản phẩm chụp trọn chiếc quần @quan, không có người mẫu, giữ đúng kiểu dáng, kiểu lưng, form ống, chiều dài và màu của chiếc quần này.
Bố cục: [kiểu Q1-Q5, mô tả cách đặt quần], thấy đầy đủ từ lưng đến gấu, không phần nào bị cắt mép khung, quần phẳng gọn không nhàu.
Phông nền: [mặt nền cao cấp, tông ...], sạch, không vết bẩn, không trầy xước, nhìn sang trọng như ảnh catalogue cao cấp, nhiều khoảng thở quanh quần.
Đồ trang trí: [tối đa 2 món nhìn đắt tiền, không chữ, không nhãn, vị trí], không che quần.
Bề mặt vải: đủ nét để thấy [mô tả bề mặt vải; tên chất liệu nếu người dùng cung cấp].
Góc trên bên phải: để trống nền, không đồ vật, không vệt nắng, không có phần quần, khoảng 50% bề ngang và 15% chiều cao khung.
Mặt trong lưng quần trơn hoàn toàn, không nhãn, không mác size, không chữ.
Máy ảnh: ống kính [..]mm, f/[..], [góc máy], toàn bộ quần nét đều.
Ánh sáng: cửa sổ mềm từ phía trên bên trái khoảng 5500K, bóng đổ mềm nhẹ quanh mép quần, giữ đúng màu của quần, không ám màu, không cháy sáng.
Tông màu hài hoà: [màu quần, tông nền, điểm nhấn], không màu chói, không đồ nhựa.
Khung hình 3:4, quần chiếm khoảng 80% khung.
Không vòng tròn, không chữ, không logo, không nhãn, không watermark, không số điện thoại, không người, không tay người.
```
- Bỏ dòng `@thamkhao` khi không có ảnh tham khảo.
- Bỏ dòng "Góc trên bên phải" khi quần chỉ có một màu.
- Q4, Q5: thay "thấy đầy đủ từ lưng đến gấu..." bằng vùng cận cảnh tương ứng.

## Nhiều ảnh, nhiều màu
- **Trước khi viết prompt, hỏi số màu và màu nào ứng với ảnh nào** nếu người dùng chưa nói. Không tự đoán.
- Mỗi màu dùng cùng bộ bố cục (ví dụ Q1 + Q2); prompt cùng bố cục giống hệt nhau về nền, đồ trang trí, ánh sáng, chỉ khác `@quan` (quần đậm thêm câu vùng tối).
- Gợi ý (1 dòng): chạy màu đầu tiên trước, rồi đính kèm ảnh ưng ý làm tham chiếu nền cho các màu sau.

## Vòng tròn biến thể màu và dấu ngôi sao
Dùng chung script của skill `shopee-anh-can-canh-vai` (đường dẫn tính từ thư mục skill này):
- Xoá dấu ngôi sao Flow trước: `uv run --with opencv-contrib-python-headless --with numpy python -I ../shopee-anh-can-canh-vai/scripts/xoa_dau_sao.py in.jpg out.jpg`, mở file `*_chk.png` kiểm tra.
- Ghép vòng tròn: `uv run --with pillow python -I ../shopee-anh-can-canh-vai/scripts/bien_the_mau.py config.json`, mở ảnh kết quả kiểm tra trước khi gửi.
- Màu vòng tròn lấy trung vị vùng khoảng 60px ở thân ống quần (giữa đùi), tránh nếp gấp, bóng tối, lưng thun; hoặc ghi thẳng `"color": [r, g, b]`. Thứ tự vòng tròn giống nhau ở mọi ảnh.
- `patches` trong config dùng để xoá nhãn ở lưng quần nếu Flow vẫn vẽ ra.
- Không chữ trên ảnh (không tên màu).
