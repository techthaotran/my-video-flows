---
name: shopee-nguoi-mau-ao-2
description: Tạo ảnh người mẫu ảo "người mẫu 2" (nữ Việt tươi cười, tóc nâu tết bím một bên, phong cách miền quê dịu dàng) mặc áo bà ba/áo dài cách tân/đồ truyền thống để dùng làm ảnh Shopee - soạn prompt tiếng Việt cho Gemini/Flow, giữ nhân vật nhất quán, khung hình đúng chuẩn ảnh bìa Shopee 1:1.
---

# Người mẫu ảo Shopee - "Người mẫu 2"

Dùng khi người dùng muốn tạo ảnh người mẫu ảo mặc một sản phẩm (ảnh sản phẩm họ gửi) để làm ảnh bìa hoặc ảnh phụ Shopee, với nhân vật số 2 (tươi vui, gần gũi, hợp áo bà ba / đồ truyền thống).
Skill này chỉ soạn prompt và hướng dẫn sinh ảnh (Gemini / Flow trong workflow của dự án), không có script xử lý ảnh.
Sau khi có ảnh, dựng tag/footer bằng skill `shopee-anh-bia-thoi-trang`.
Nhân vật 1 (dịu dàng, tóc xoã, ánh vàng cổ điển) nằm ở skill `shopee-nguoi-mau-ao`.

Ảnh tham khảo nằm ở `references/` (đồng lúa, hiên gỗ bên hồ sen). Luôn đính kèm cả 2 ảnh làm ảnh tham chiếu khi sinh ảnh.
Watermark trên 2 ảnh tham chiếu (chữ + số điện thoại, ngôi sao AI) đã được xoá; ảnh sinh ra vẫn không được có chữ/watermark.

## Đặc điểm nhân vật (giữ cố định, không đổi giữa các ảnh)
- Nữ trẻ người Việt, khoảng 20-25 tuổi, dáng thanh mảnh, cao, eo nhỏ.
- Khuôn mặt thon, da sáng mịn, gò má hồng nhẹ, mắt to sáng, lông mày thanh, nụ cười tươi rạng rỡ lộ răng đều (biểu cảm mặc định là cười tươi).
- Tóc nâu hạt dẻ / nâu đen, **tết bím một bên vắt qua vai phải trước ngực**, rẽ giữa hoặc mái thưa (mái bay) hai bên; một vài sợi tóc mai lơi nhẹ.
- Trang sức mảnh: dây chuyền vàng mảnh, lắc tay vàng mảnh. Không khuyên tai nổi bật.
- Trang điểm nhẹ tự nhiên, son hồng cam tươi.
- Tư thế: đứng thẳng thoải mái, hai tay chắp nhẹ phía trước (hoặc cầm nón lá), hơi nghiêng người, nhìn thẳng ống kính.

## Phong cách ảnh
- Ánh sáng ngày tự nhiên, sáng và trong, màu tươi xanh (đồng lúa, hồ sen, tre), không chói gắt.
- Bối cảnh mặc định: ruộng lúa xanh, hoặc hiên nhà gỗ bên hồ sen/sông; có thể đổi theo sản phẩm nhưng giữ cảm giác quê mộc, trong lành, gần gũi.
- Màu sạch kiểu ảnh điện thoại cao cấp: sắc nét, tự nhiên, không lọc film nặng.
- Trang phục tham chiếu: áo bà ba trắng cổ V cài nút, tay dài, ôm eo + quần đen ống rộng, nón lá. Đổi sang sản phẩm của người dùng theo ảnh sản phẩm.

## Máy ảnh và ánh sáng (người mẫu 2)
- **Máy/ống kính:** như ảnh điện thoại cao cấp / máy full-frame, tiêu cự **50-70mm** (toàn thân, thấy cả bối cảnh) hoặc **85mm** (nửa thân), khẩu **f/2.8-4**: nền hơi mờ nhưng còn nhận ra ruộng/hồ/hiên. Không dưới 35mm.
- **Góc máy:** ngang tầm mắt tới ngang ngực, thẳng hoặc nghiêng nhẹ; không chụp từ trên xuống, không chụp sát từ dưới lên.
- **Ánh sáng:** ánh sáng ngày mềm, khuếch tán (trời trong có mây mỏng hoặc bóng râm mở), nhiệt độ khoảng 5500-6000K, hướng sáng 45 độ từ bên trên-trước, bóng nhẹ; da sáng hồng, nụ cười rạng rỡ.
- **Phơi sáng:** sáng, trong, màu xanh tươi nhưng không cháy trời; áo trắng giữ chi tiết vải, không ám xanh lá từ cỏ/ruộng.
- Không dùng nắng gắt giữa trưa, không ngược sáng mạnh.

## Khung hình bắt buộc (khớp skill ảnh bìa)
- Tỉ lệ 1:1 (hoặc 4:5 rồi crop), người mẫu nằm **nửa TRÁI**, chừa **nửa phải** để dựng chữ, **góc dưới trái không có vật/chữ chen vào** (vùng nhãn Shopee).
- **Người mẫu cao hơn 80% khung hình** (từ đỉnh đầu tới mép dưới thấy được), đầu cách mép trên khoảng 40-120px trên canvas 1200. Ưu tiên khung nửa thân tới ngang đùi hoặc toàn thân sát khung.
- Không cầm vật to (nón lá, giỏ) che dưới trái hoặc che sản phẩm; nếu cần nón lá, cầm ở tay phải/đội trên đầu hoặc bỏ.
- Không có chữ, logo, watermark, số điện thoại, khung viền trong ảnh sinh ra.
- Sản phẩm là nhân vật chính: cổ áo, hàng nút, chất vải, màu phải rõ.

## Quy trình
1. Xin ảnh sản phẩm (mặt trước, nếu có thêm mặt sau/chi tiết). Hỏi nếu thiếu: tên sản phẩm, màu, kiểu, bối cảnh mong muốn.
2. Soạn prompt theo mẫu dưới, gửi kèm 2 ảnh nhân vật (`references/`) và ảnh sản phẩm.
3. Sinh 2-4 biến thể, chọn ảnh giữ đúng nhân vật và đúng sản phẩm nhất.
4. **Kiểm tra trước khi giao:**
   - Mặt và kiểu tóc đúng nhân vật (bím một bên, nụ cười tươi).
   - Sản phẩm đúng màu, kiểu, số nút, không biến dạng, không thêm hoạ tiết lạ.
   - Bàn tay đủ 5 ngón, không méo; bím tóc không dính/biến dạng.
   - Không có chữ/watermark lạ; người cao > 80% khung, nằm nửa trái, góc dưới trái trống.
5. Báo người dùng ảnh nào tốt nhất, gợi ý bước tiếp: dựng tag/footer bằng skill `shopee-anh-bia-thoi-trang`.

## Mẫu prompt (tiếng Việt)
Quy ước đính kèm: ảnh nhân vật gắn tên `nhanvat`, ảnh sản phẩm (áo) gắn tên `ao`.
Hai dòng đầu của prompt luôn đúng dạng `Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat` và `Trang phục: @ao`; không mô tả lại mặt, tóc hay chi tiết áo trong prompt, để ảnh tham chiếu quyết định.
Mô tả quần, giày, dáng, phụ kiện, máy ảnh, ánh sáng, bối cảnh, khung hình thì vẫn ghi bằng chữ.
```
Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat
Trang phục: @ao
Quần: [ống rộng đen / trắng] chất lụa rũ, xăng đan quai trong suốt đế gỗ.
Tư thế: đứng thẳng thoải mái, [hai tay chắp nhẹ phía trước / tựa lan can], hơi nghiêng người, cười tươi nhìn thẳng ống kính.
Máy ảnh: ống kính 50-70mm (toàn thân) hoặc 85mm (nửa thân), f/3.2, máy ngang tầm mắt, không méo góc rộng.
Bối cảnh: [ruộng lúa xanh / hiên gỗ bên hồ sen], ánh sáng ngày mềm khuếch tán (khoảng 5800K) từ phía trước-trên, bóng nhẹ, nền hơi mờ nhẹ.
Khung hình: tỉ lệ 1:1, người mẫu nằm bên TRÁI khung, cao hơn 80% chiều cao khung, nửa phải để trống nền đơn giản,
góc dưới bên trái không có vật thể. Không chữ, không logo, không watermark, không số điện thoại, không viền.
Chất lượng cao, chi tiết mặt và vải sắc nét.
```
Phần "Đặc điểm nhân vật" ở trên dùng để chọn và kiểm tra ảnh nhân vật `nhanvat`, không dán vào prompt.

## Lưu ý
- Đây là người mẫu ảo dựa trên ảnh tham khảo do người dùng cung cấp. Chỉ dùng cho shop của người dùng; không gắn tên hay danh tính người thật.
- Nếu mặt bị lệch qua nhiều ảnh, thêm lại ảnh tham chiếu và rút ngắn phần mô tả để mô hình bám ảnh hơn bám chữ.
- Hai ảnh tham chiếu khác nhau về mái tóc (một ảnh rẽ giữa, một ảnh mái thưa) nên prompt cho chọn 1 trong 2; cố định một kiểu cho cả bộ ảnh của cùng sản phẩm.
