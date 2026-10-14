---
name: shopee-nguoi-mau-ao
description: Tạo ảnh người mẫu ảo "người mẫu 1" (nữ Việt, tóc đen dài, dáng thanh) mặc sản phẩm thời trang/áo dài/áo bà ba để dùng làm ảnh Shopee - soạn prompt tiếng Việt cho Gemini/Flow, giữ nhân vật nhất quán, khung hình đúng chuẩn ảnh bìa Shopee 1:1.
---

# Người mẫu ảo Shopee - "Người mẫu 1"

Dùng khi người dùng muốn tạo ảnh người mẫu ảo mặc một sản phẩm (ảnh sản phẩm họ gửi) để làm ảnh bìa hoặc ảnh phụ Shopee.
Skill này chỉ soạn prompt và hướng dẫn sinh ảnh (Gemini / Flow trong workflow của dự án), không có script xử lý ảnh.
Sau khi có ảnh, dựng tag/footer bằng skill `shopee-anh-bia-thoi-trang`.

Ảnh tham khảo nhân vật nằm ở `references/` (cận mặt, nửa thân, toàn thân). Luôn đính kèm 1-3 ảnh này làm ảnh tham chiếu khi sinh ảnh.

## Đặc điểm nhân vật (giữ cố định, không đổi giữa các ảnh)
- Nữ trẻ người Việt, khoảng 22-26 tuổi, dáng thanh, cao ráo, cổ dài, vai thon.
- Khuôn mặt trái xoan, da sáng mịn tự nhiên, gò má hồng nhẹ, mắt một mí/hai mí mảnh, lông mày thanh, sống mũi thanh, môi hồng nâu (son nude trầm).
- Tóc đen nâu, dài thẳng qua ngực, rẽ giữa, tóc mái hai bên mềm; có kiểu nửa búi cao phía sau hoặc xoã hoàn toàn.
- Phụ kiện cố định: khuyên tai ngọc trai tròn. Có thể thêm nhẫn mảnh ở tay.
- Trang điểm nhẹ kiểu Á, mắt nhắm hờ hoặc nhìn xuống / nhìn nghiêng, biểu cảm dịu dàng, nhẹ nhàng, nụ cười rất nhẹ hoặc không cười.
- Tư thế: đứng thẳng, dáng mềm, một tay cầm hoa hoặc tựa lan can; không tạo dáng gợi cảm quá mức.

## Phong cách ảnh
- Ánh sáng nắng vàng ấm (golden hour), ngược sáng nhẹ làm viền tóc sáng, da mịn, hậu cảnh xoá phông mềm.
- Bối cảnh mặc định: hiên nhà gỗ cổ / mái ngói rêu / lan can gỗ chạm, màu ấm. Có thể đổi bối cảnh theo sản phẩm nhưng giữ tông ấm, nền không quá sáng chói.
- Màu ảnh ấm, hơi film, độ nét cao ở mặt và chất vải, không bệt da.

## Bối cảnh sang trọng (khi người dùng yêu cầu)
Tông nền trung tính ấm (kem, gỗ óc chó, vàng đồng) để không lấn màu áo; xoá phông mềm, không chữ, không người khác.
- Sảnh khách sạn 5 sao: sàn cẩm thạch, đèn chùm pha lê, tường ốp gỗ, cột đá.
- Hành lang vòm kiểu Pháp: cột đá, cửa sổ vòm cao, nắng vàng xiên.
- Phòng khách biệt thự: sofa nhung kem, tường ốp gỗ chạm, rèm lụa, đèn vàng ấm kết hợp cửa sổ lớn.
- Hiên biệt thự có vườn: cột trắng, hoa hồng, đài phun nước đá, giờ vàng.
- Ngoài quán cà phê (sang trọng): vỉa hè lát đá trước quán kiểu Pháp với ghế mây và bàn cẩm thạch tròn; sân vườn quán với bàn ghế sắt uốn, chậu cây lớn, cửa kính khung đen; mặt tiền gỗ ấm với cửa kính lớn và hiên có bàn gỗ; hiên có giàn hoa và đèn dây vàng nhẹ. Quán vắng, **không biển hiệu chữ, không thực đơn, không khách**.
Tránh: bối cảnh quá rực rỡ, nhiều màu chói, đồ trang trí lớn ở góc dưới trái.

## Máy ảnh và ánh sáng (người mẫu 1)
- **Máy/ống kính:** như máy full-frame, tiêu cự **85mm** (chân dung nửa thân) hoặc **70mm** (toàn thân), khẩu **f/2.0-2.8**: nền xoá mềm, mặt sắc. Không dùng góc rộng dưới 50mm (méo mặt, chân dài giả).
- **Góc máy:** ngang tầm mắt tới hơi thấp (ngang ngực), nghiêng lên nhẹ 0-5 độ; toàn thân thì đặt máy ngang eo. Không chụp từ trên xuống.
- **Ánh sáng:** giờ vàng (golden hour), nhiệt độ màu khoảng 4500-5500K. Nắng ngược sáng nhẹ tạo viền sáng ở tóc và vai, **bù sáng phía trước (hắt sáng mềm) cho mặt và áo** nên mặt, da và màu vải không bị tối; tỉ lệ sáng-tối khoảng 1:2.
- **Phơi sáng:** da và vải sáng không cháy, vùng tối còn chi tiết; không để ngược sáng làm áo đổi màu hoặc mất hoa văn.
- Không dùng đèn flash trực diện, không có bóng gắt cắt ngang mặt.

## Khung hình bắt buộc (khớp skill ảnh bìa)
- Tỉ lệ 1:1 (hoặc 4:5 rồi crop), người mẫu nằm **nửa TRÁI**, chừa **nửa phải** để dựng chữ, **góc dưới trái không có vật/chữ chen vào** (vùng nhãn Shopee).
- **Người mẫu cao hơn 80% khung hình** (từ đỉnh đầu tới mép dưới thấy được), đầu cách mép trên khoảng 40-120px trên canvas 1200. Ưu tiên khung nửa thân tới ngang đùi hoặc toàn thân sát khung, không để người nhỏ giữa nền rộng.
- Không có chữ, logo, watermark, khung viền trong ảnh sinh ra.
- Giữ trang phục là nhân vật chính: cổ áo, nút/cài, chất vải, màu phải rõ.

## Quy trình
1. Xin ảnh sản phẩm (mặt trước, nếu có thêm mặt sau/chi tiết). Hỏi nếu thiếu: tên sản phẩm, màu, kiểu (áo dài, bà ba, đầm...), bối cảnh mong muốn.
2. Soạn prompt theo mẫu dưới, gửi kèm ảnh nhân vật tham chiếu (`references/`) và ảnh sản phẩm.
3. Sinh 2-4 biến thể (khác góc / tư thế), chọn ảnh giữ đúng nhân vật và đúng sản phẩm nhất.
4. **Kiểm tra trước khi giao:**
   - Mặt đúng nhân vật (xem mục đặc điểm), khuyên tai ngọc trai còn đủ.
   - Sản phẩm đúng màu, đúng kiểu, không bị biến dạng, không thêm hoạ tiết lạ.
   - Bàn tay đủ 5 ngón, không méo; tóc không dính vào vải bất thường.
   - Người cao > 80% khung, nằm nửa trái, góc dưới trái trống.
5. Báo người dùng ảnh nào là bản tốt nhất, gợi ý bước tiếp: dựng tag/footer bằng skill `shopee-anh-bia-thoi-trang`.

## Mẫu prompt (tiếng Việt)
Quy ước đính kèm: ảnh nhân vật gắn tên `nhanvat`, ảnh sản phẩm (áo) gắn tên `ao`.
Hai dòng đầu của prompt luôn đúng dạng `Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat` và `Trang phục: @ao`; không mô tả lại mặt, tóc hay chi tiết áo trong prompt, để ảnh tham chiếu quyết định.
Mô tả quần, giày, dáng, phụ kiện, máy ảnh, ánh sáng, bối cảnh, khung hình thì vẫn ghi bằng chữ.
```
Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat
Trang phục: @ao
Quần: [ống rộng trắng kem / đen] chất lụa rũ, xăng đan quai trong suốt đế gỗ.
Tư thế: đứng thẳng, [tay cầm hoa lan / tựa lan can], dáng mềm mại, biểu cảm dịu dàng.
Máy ảnh: full-frame, ống kính 85mm, f/2.2, máy ngang tầm mắt (toàn thân: 70mm, máy ngang eo), không méo góc rộng.
Bối cảnh: [hiên gỗ cổ, mái ngói rêu, lan can chạm khắc], nắng vàng giờ vàng (khoảng 5000K) ngược sáng nhẹ tạo viền sáng ở tóc, hắt sáng mềm phía trước cho mặt và áo, xoá phông mềm.
Khung hình: tỉ lệ 1:1, người mẫu nằm bên TRÁI khung, cao hơn 80% chiều cao khung, nửa phải để trống nền đơn giản,
góc dưới bên trái không có vật thể. Không chữ, không logo, không watermark, không viền.
Chất lượng cao, chi tiết mặt và vải sắc nét, màu ấm kiểu film.
```
Phần "Đặc điểm nhân vật" ở trên dùng để chọn và kiểm tra ảnh nhân vật `nhanvat`, không dán vào prompt.

## Lưu ý
- Đây là người mẫu ảo dựa trên ảnh tham khảo do người dùng cung cấp. Chỉ dùng cho shop của người dùng; không gắn tên hay danh tính người thật.
- Nếu mặt bị lệch qua nhiều ảnh, thêm lại ảnh tham chiếu cận mặt và rút ngắn phần mô tả để mô hình bám ảnh hơn bám chữ.
- Nếu người dùng gửi thêm nhân vật khác, tạo skill/thư mục riêng (`nguoi-mau-2`...) thay vì trộn đặc điểm vào đây.
