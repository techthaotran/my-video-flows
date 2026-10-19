---
name: shopee-dang-phu-kien
description: Nhận ảnh tham khảo (người mẫu + dáng + bối cảnh + ánh sáng) và ảnh áo của người dùng, phân tích ảnh tham khảo rồi trả về DUY NHẤT prompt tiếng Việt cho Gemini/Flow để tạo lại ảnh đó với người mẫu mặc áo mới, đúng khung hình ảnh Shopee (người nửa trái, cao hơn 80% khung, góc dưới trái trống).
---

# Prompt ảnh Shopee từ ảnh tham khảo + ảnh áo

## Đầu vào, đầu ra
- **Đầu vào:** ảnh tham khảo (`@thamkhao`) và ảnh áo (`@ao`). Có thể gửi nhiều ảnh tham khảo cho một áo.
- **Đầu ra:** chỉ prompt, mỗi ảnh tham khảo một prompt trong một khối code. Không viết thêm phân tích dài, không giải thích. Chỉ thêm tối đa 1-2 dòng lưu ý khi thiếu thông tin hoặc có giả định cần người dùng kiểm tra.
- Ảnh tham khảo quyết định **nhân vật, dáng, phụ kiện, bối cảnh, máy ảnh, ánh sáng**. Ảnh áo quyết định **trang phục**.
- Nếu người dùng gửi thêm ảnh nhân vật riêng (`@nhanvat`), dòng đầu dùng `@nhanvat` thay cho nhân vật trong ảnh tham khảo.

## Quy trình
1. Xem kỹ ảnh tham khảo, rút ra từng mục dưới đây (không bịa thứ không thấy).
2. Xem ảnh áo để chọn quần phối và tránh dáng che hoa văn, cổ, hàng nút.
3. Viết prompt theo mẫu. Mọi mục phải cụ thể, không để placeholder còn sót.
4. Trả prompt.

### Mục cần rút ra từ ảnh tham khảo
| Mục | Cần ghi |
|---|---|
| Dáng | Đứng/bước/ngồi, vị trí hai tay, hướng đầu và mắt, biểu cảm, hướng xoay thân |
| Phụ kiện | Món cầm tay hoặc đeo (túi, quạt, ly, hoa, nón...), tay nào cầm, vị trí |
| Bối cảnh | Địa điểm, vật dụng, màu chủ đạo của nền, mức xoá phông |
| Máy ảnh | Tiêu cự ước lượng (35/50/70/85mm), khẩu, độ cao máy (ngang mắt/ngực/eo), kiểu khung (toàn thân/tới gối/nửa thân) |
| Ánh sáng | Hướng sáng, độ cứng/mềm, nhiệt độ màu ước lượng, có ngược sáng hay hắt sáng không |

Tham chiếu ước lượng:
- Toàn thân: 70-85mm, f/4-5.6, máy ngang hông (thấp, kéo dài chân; máy ngang eo trở lên làm chân ngắn).
- Tới ngang gối hoặc nửa thân dưới: 70-85mm, f/2.8-4, máy ngang ngực.
- Nửa thân: 85mm, f/2.0-2.8, máy ngang mắt.
- Không dùng góc rộng dưới 50mm; tay giơ cao thì 70-85mm.
- Giờ vàng ấm khoảng 4500-5500K; ngày mềm khuếch tán khoảng 5500-6000K; trong nhà đèn vàng khoảng 3500-4500K.

## Quy tắc khi viết prompt
**Trang phục**
- Luôn là `@ao`, không mô tả lại màu, hoa văn hay chi tiết áo bằng chữ (để ảnh quyết định).
- Quần/giày: khi ảnh áo chỉ có áo (không có quần), dùng **quần ống rộng suông, lưng cao, vải thun dày đục màu rũ (không trong suốt), dài chạm mắt cá, màu đen hoặc trắng** như hai ảnh mẫu `references/nguoi-mau-1/04-quat-nan-mo-ben-hong.webp` (quần đen) và `references/nguoi-mau-1/12-tach-tra-hai-tay-nhin-nghieng.webp` (quần trắng). Giày mặc định: xăng đan quai trong suốt đế gỗ (đổi theo mục **Phụ kiện: túi và giày** nếu người dùng chọn kiểu khác).
- Chọn màu quần tương phản với áo: áo sáng hoặc pastel + quần đen; áo đậm hoặc nhiều hoa văn + quần trắng. Chỉ chọn một trong hai màu, không dùng màu khác.
- Quần trắng phải là **vải thun/cotton dày đục màu trắng kem** (chất lụa satin rũ dày, mờ đục), KHÔNG trong suốt, không xuyên thấu, không lộ da chân hay đồ lót bên trong. Trong prompt luôn ghi: "quần trắng vải thun dày đục màu, không trong suốt, không xuyên thấu". Quần đen cũng ghi "vải dày đục màu, không xuyên thấu".
- Nếu ảnh áo là váy hoặc bộ liền (đã có quần) thì bỏ dòng quần.
- Nếu ảnh tham khảo có áo khác, ghi rõ "thay toàn bộ trang phục trong ảnh tham khảo bằng @ao".

**Khuôn mặt nhân vật**
- Luôn có một dòng `Khuôn mặt:` ngay dưới dòng đầu, mô tả cụ thể để khuôn mặt giống nhau ở mọi ảnh trong bộ: dáng mặt, lông mày, mắt, mũi, môi, da, tóc, trang sức nhỏ, biểu cảm.
- Có `@nhanvat` hoặc `@thamkhao`: ghi "giữ đúng khuôn mặt của @..." rồi mô tả theo ảnh đó (xem kỹ ảnh, không bịa). Chưa có ảnh nhân vật: dùng mô tả mặc định dưới đây và nhắc người dùng thay bằng nét thật của người mẫu 1.
- Mô tả mặc định: gương mặt trái xoan thanh tú, trán cao, lông mày lá liễu thanh, mắt hai mí to sáng màu nâu đen, sống mũi thẳng, môi trái tim son hồng nude, da sáng tự nhiên có kết cấu da thật, tóc đen dài gợn sóng rẽ ngôi giữa, khuyên tai ngọc trai nhỏ.
- Luôn kèm: "không làm mịn da quá mức, không biến dạng khuôn mặt, khuôn mặt nhất quán". Mặt phải rõ nét, nhìn thấy đủ hai mắt (trừ khi dáng quay nghiêng), không bị quạt, tóc hay tay che.

**Dáng và phụ kiện**
- Giữ dáng của ảnh tham khảo nhưng sửa nếu che mất điểm chính của áo (hoa văn lớn ở vạt, hàng nút, cổ, đường eo): dời tay hoặc phụ kiện sang bên.
- Mỗi ảnh tối đa 1 phụ kiện cầm tay. Phụ kiện phải tôn áo, không chói hơn áo.
- Phụ kiện cầm tay đặt ở tay phải của ảnh (phía chừa trống), không thả xuống góc dưới trái.
- Xoá mọi chữ, logo, thương hiệu, số điện thoại trên phụ kiện và nền.
- Luôn thêm "bàn tay tự nhiên, năm ngón rõ ràng".
- **Tránh từ dễ bị bộ lọc Google Flow chặn** (lỗi "might violate our policies"): không ghi "thương hiệu" hay tên hãng, đặt "không chữ, không logo" là đủ; dùng "ngang gối", "ngang hông" thay cho "ngang đùi"; "đặt nhẹ bên eo" thay cho "chống eo". Prompt có túi xách, quai, hoa thêu giữ mô tả ngắn, không thêm chi tiết hiệu. Khi Flow báo lỗi: bỏ lần lượt từng dòng nghi ngờ (phụ kiện trước, rồi khung hình) và chạy lại.

**Tỉ lệ chân (khung toàn thân)**
- Chân hay bị ngắn khi máy đặt ngang eo hoặc ngực và ống kính ngắn. Với khung toàn thân: máy ngang hông (thấp), ống kính 70-85mm, thêm dòng "Tỉ lệ" vào prompt: `Tỉ lệ cơ thể thon cao khoảng 8 đầu, đôi chân dài, chiều dài chân khoảng 55% chiều cao cơ thể, quần lưng cao kéo dài chân, không méo tỉ lệ.`
- Khung chỉ tới ngang gối thì không cần dòng Tỉ lệ (chân không lộ hết).
- Khung **nửa chân đi lên** (từ đầu tới giữa ống quần, khoảng nửa chiều dài chân): ghi "từ đầu tới giữa ống quần, khoảng nửa chiều dài chân, không lộ giày", ống kính 85mm, f/3.2, máy ngang ngực. Bỏ dòng Quần chỉ ghi giày. Người vẫn cao hơn 80% khung, đầu cách mép trên 40-120px.

**Khung hình bắt buộc (khớp ảnh bìa Shopee)**
- Tỉ lệ 1:1, người mẫu nằm nửa TRÁI khung, nửa phải để trống nền đơn giản.
- Người cao hơn 80% chiều cao khung, đầu cách mép trên khoảng 40-120px trên canvas 1200.
- Góc dưới bên TRÁI không có vật thể hay phụ kiện (vùng nhãn Shopee).
- Không chữ, logo, watermark, số điện thoại, biển hiệu, viền; nền không có người khác.
- Khung hình này ghi đè khung hình của ảnh tham khảo; chỉ giữ kiểu khung (toàn thân/tới gối/nửa thân) nếu vẫn đạt các điều kiện trên.

**Ánh sáng và màu**
- Hướng sáng giữ như ảnh tham khảo, thêm hắt sáng mềm cho mặt và áo.
- Luôn ghi "giữ đúng màu và hoa văn của áo, không ám màu, không cháy sáng".
- Áo nhiều hoa văn hoặc màu đậm: tránh ngược sáng mạnh, ưu tiên sáng xiên.

## Phụ kiện: túi, giày và quạt
Ba bảng ảnh catalog trong `references/phu-kien/` (`tui-xach.webp`, `giay-cao-got.webp`, `quat-gap.webp`) dùng để chọn kiểu khi người dùng không chỉ định, hoặc chỉ nói chung ("túi xách", "giày cao gót").
Trong prompt chỉ mô tả **dáng, chất liệu, màu**; không ghi tên thương hiệu (Louis Vuitton, Prada, Chanel, Jacquemus, Dior...), không chữ, không logo, không charm có chữ.

**Túi** (chọn 1, màu hợp áo: áo đậm hoặc nhiều hoa văn thì túi trắng/kem/đen trơn, áo pastel thì túi kem, trắng, xanh pastel hoặc đen):
| Kiểu | Mô tả để ghi vào prompt | Cách cầm |
|---|---|---|
| Túi xách tay quai ngắn cứng | Hộp vuông/thang, quai cầm cố định, da trơn hoặc vân caro | Cầm quai bằng tay, buông thấp bên hông |
| Túi mini quai cầm | Túi nhỏ nắp gập, quai tròn ngắn | Cầm quai ngang hông hoặc co khuỷu |
| Túi đeo vai cong (hobo/baguette) | Thân cong mềm, quai mảnh, da trơn hoặc bóng | Quai vắt khuỷu tay hoặc đeo vai, thân túi sát hông |
| Túi tote lớn | Quai dài, thân chữ nhật mềm | Quai vắt khuỷu tay, không che thân áo |
| Túi nhún (cloud/ruched) | Thân da mềm nhún, quai xích hoặc quai da | Kẹp nách hoặc cầm quai |
| Túi rút vải thêu | Túi rút kem thêu hoa nhỏ, quai dài | Cầm quai, túi buông thấp ngang hông |
- Màu có sẵn trong bảng: trắng, kem, đen, xanh pastel. Túi vân trám/chần bông, da bóng, lông mềm chỉ chọn khi áo trơn; áo nhiều hoa văn thì chọn túi da trơn.
- Kích cỡ vừa tay, không che hàng nút và vạt giữa áo; không quá to so với thân người.

**Giày** (chọn hợp quần và bối cảnh, giữ quần ống rộng dài chạm mắt cá nên chỉ lộ mũi giày và gót):
| Kiểu | Mô tả để ghi vào prompt | Hợp |
|---|---|---|
| Xăng đan quai trong suốt đế gỗ | Quai trong suốt, đế gỗ (mặc định) | Mọi quần, quán cà phê |
| Block heel quai cổ chân | Gót vuông 6-8cm, quai mảnh cổ chân | Quần đen hoặc trắng, đi bộ thoải mái |
| Slingback mũi nhọn | Gót nhỏ 5-6cm, quai sau, mũi nhọn kem hoặc đen | Dáng thanh lịch |
| Mule hở gót | Gót nhỏ, mũi vuông hoặc nhọn, màu nâu hoặc đen | Khung nửa thân, vẫn hợp toàn thân |
| Wedge/espadrille | Đế cói đan, quai cổ chân | Bối cảnh ngoài trời, quán cà phê |
| Kitten heel | Gót mảnh thấp 3-4cm, mũi nhọn, màu hồng nude hoặc kem | Áo pastel |
| Gót trong suốt (clear heel) | Gót acrylic trong suốt, quai mảnh | Giữ tông trong sáng, không chói |
- Màu giày: đen, kem, nude, nâu nhạt. Không chọn đỏ, bạc, hoặc kiểu cao quá 10cm.
- Chỉ ghi giày khi khung hình lộ chân (toàn thân); khung nửa thân thì bỏ.

**Quạt gấp cầm tay** (catalog `references/phu-kien/quat-gap.webp`, 9 mẫu; dùng khi người dùng nói "quạt" hoặc ảnh tham khảo có quạt):
| Kiểu | Mô tả để ghi vào prompt | Hợp áo |
|---|---|---|
| Quạt giấy trắng vẽ trúc/mực | Mặt giấy trắng ngà, tranh trúc mực đen, nan nâu đậm | Áo trơn, áo tối màu |
| Quạt ren xanh navy | Vải ren xanh đậm, nan ren thêu vàng | Áo trắng, kem, pastel |
| Quạt hoa anh đào hồng | Mặt giấy hồng nhạt hoa anh đào, nan tre vàng | Áo trơn trắng, kem, xanh |
| Quạt hoa mai đỏ nền xám | Mặt giấy xám be, cành mai đỏ, nan đen, có tua đỏ | Áo trơn, áo đen, kem |
| Quạt xanh than hoa trắng | Mặt vải xanh than hoa trắng nhỏ, nan đen, tua đen dài | Áo sáng, pastel |
| Quạt hồng xanh hoa nhí | Mặt hồng và xanh mint hoa trắng nhí, nan tre, tua hồng | Áo trơn trắng, kem |
| Quạt đỏ đô hoa mận | Mặt đỏ đô, cành mai trắng tím, nan tre sáng | Áo trơn kem, trắng |
| Quạt mai đỏ nền kem | Mặt kem, cành mai đỏ nét đơn giản, nan tre | Áo trơn, áo xanh |
| Quạt giấy trúc mực nhạt | Mặt giấy ngà vẽ trúc xám, nan nâu đậm | Áo màu tươi, hoa nhỏ |
- Chọn quạt tương phản nhưng không chói hơn áo: áo nhiều hoa văn thì chọn quạt trơn hoặc tranh mực nhạt; áo trơn thì quạt hoa đẹp hợp tông.
- Cầm bằng **tay phải của ảnh** (phía chừa trống), quạt **gấp một nửa hoặc xoè nhẹ** ngang hông hoặc ngang ngực, không che mặt, không che hàng nút và vạt giữa áo.
- Kích cỡ vừa tay (xoè khoảng 25-30cm), không quá to so với thân người.
- Xoá mọi chữ, chữ thư pháp, con dấu trên mặt quạt: ghi "mặt quạt chỉ có hoa hoặc nét vẽ, không chữ, không con dấu, không logo".
- Bàn tay cầm quạt: "năm ngón rõ ràng, cầm chuôi quạt tự nhiên".

## Mẫu prompt
```
Giữ nguyên nhân vật như ảnh tham khảo: @thamkhao
Khuôn mặt: giữ đúng khuôn mặt như ảnh tham khảo, [mô tả dáng mặt, mày, mắt, mũi, môi, da, tóc], không làm mịn da quá mức, không biến dạng khuôn mặt, khuôn mặt nhất quán.
Trang phục: thay toàn bộ trang phục bằng @ao
Quần: ống rộng suông lưng cao [trắng / đen] vải thun dày đục màu, không trong suốt, không xuyên thấu, rũ dài chạm mắt cá, xăng đan quai trong suốt đế gỗ (bỏ dòng này nếu ảnh áo đã có quần hoặc là váy).
Dáng: [dáng rút từ ảnh tham khảo, đã chỉnh nếu che áo], tham chiếu tư thế như ảnh tham khảo. Bàn tay tự nhiên, năm ngón rõ ràng.
Phụ kiện: [1 phụ kiện từ ảnh tham khảo, tay phải của ảnh, không chữ/logo] (bỏ dòng này nếu ảnh tham khảo không có).
Bối cảnh: [địa điểm, vật dụng, tông màu, mức xoá phông, không chữ/biển hiệu/người khác].
Máy ảnh: ống kính [..]mm, f/[..], máy [ngang mắt/ngực/hông], không méo góc rộng.
Ánh sáng: [hướng, độ mềm, nhiệt độ màu], hắt sáng mềm cho mặt và áo, giữ đúng màu và hoa văn của áo, không ám màu, không cháy sáng.
Khung hình 1:1, người mẫu bên TRÁI, [toàn thân / từ đầu tới ngang gối], cao hơn 80% chiều cao khung, nửa phải để trống nền đơn giản, góc dưới bên trái không có vật thể.
Không chữ, không logo, không watermark, không số điện thoại, không biển hiệu, không người khác.
```
Nếu có `@nhanvat`, dòng đầu: `Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat`, và dòng Dáng/Bối cảnh/Máy ảnh/Ánh sáng vẫn lấy từ `@thamkhao`.

## Nhiều ảnh cùng một áo
- Mỗi ảnh tham khảo một prompt riêng, đầy đủ, copy được ngay.
- Nếu người dùng muốn cả bộ cùng nền: lấy bối cảnh, máy ảnh, ánh sáng của ảnh tham khảo đầu tiên cho mọi prompt, chỉ đổi dòng Dáng và Phụ kiện theo từng ảnh tham khảo.
- Gợi ý (1 dòng) sinh ảnh 1 trước, rồi đính kèm làm tham chiếu bối cảnh cho các ảnh sau.

## Thư mục `references/`
`phu-kien/`: catalog túi xách, giày cao gót và quạt gấp (xem mục Phụ kiện: túi, giày và quạt).
`nguoi-mau-1/`: 12 ảnh dáng mẫu của người mẫu 1 (áo kiểu + quần, 01-12).
`nguoi-mau-2/`: 15 ảnh dáng mẫu của người mẫu 2 (áo dài cách tân/sườn xám, 13-27).
Dùng được làm `@thamkhao` khi người dùng chưa có ảnh tham khảo; chọn folder theo người mẫu người dùng muốn (hoặc theo loại áo của `@ao`).
Mỗi folder là một người mẫu: khi người dùng chỉ định "người mẫu 1" hoặc "người mẫu 2", chọn `@thamkhao` trong folder đó và giữ đúng khuôn mặt của người trong ảnh.
Khi người dùng chỉ lấy dáng thì không bắt khuôn mặt; chỉ lấy dáng, phụ kiện và cách chụp.
