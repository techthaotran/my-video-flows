---
name: shopee-anh-can-canh-vai
description: Nhận ảnh áo của người dùng (và tuỳ chọn ảnh cận cảnh tham khảo, thông tin chất liệu, các màu khác của cùng mẫu áo) rồi trả về prompt tiếng Việt cho Gemini/Flow để tạo ảnh 3:4 chụp cận cảnh chiếc áo (không người mẫu), thấy rõ bề mặt vải; khi áo có nhiều màu thì ghép hàng vòng tròn biến thể màu ở góc trên bên phải bằng script.
---

# Prompt ảnh cận cảnh áo, thấy rõ chất liệu vải (3:4)

## Đầu vào, đầu ra
- **Đầu vào:** ảnh áo (`@ao`). Tuỳ chọn: ảnh chụp cận cảnh vải thật của chính chiếc áo (`@vai`, dùng làm chuẩn bề mặt vải), ảnh cận cảnh tham khảo (`@thamkhao`, ví dụ áo treo trên móc gỗ nhìn gần cổ áo), chất liệu do người dùng nói (lụa, chiffon, thun lạnh...), số ảnh cần tạo.
- **Đầu ra:** chỉ prompt, mỗi ảnh một prompt trong một khối code. Không phân tích dài, không giải thích. Tối đa 1-2 dòng lưu ý khi thiếu thông tin hoặc có giả định.
- Ảnh này chụp **chiếc áo**, không có người mẫu. Mục đích: khách nhìn thấy bề mặt, độ mịn, độ rủ và cách dệt của vải.
- `@ao` quyết định áo (màu, hoa văn, kiểu cổ, nút). `@thamkhao` (nếu có) chỉ quyết định **bố cục, góc máy, phông nền, ánh sáng**.
- **Mỗi tag (`@ao`, `@thamkhao`...) chỉ xuất hiện một lần trong prompt.** Các lần sau gọi là "chiếc áo này", "ảnh tham khảo".
- **Không đính kèm `@vai` vào Flow.** Flow dán nguyên ảnh vải vào khung (sai màu, sai vị trí). Xem `@vai` để tả bề mặt vải bằng chữ trong prompt.

## Quy trình
1. Xem `@ao` để biết kiểu cổ, hàng nút, mảng hoa văn, vùng nào có vải rõ nhất.
2. Xem `@thamkhao` (nếu có), rút ra: cách đặt áo (treo móc/trải phẳng), vùng cận cảnh, phông nền, đồ trang trí, ánh sáng. Không bịa thứ không thấy.
3. Chọn bố cục (bảng dưới), phông nền, đồ trang trí.
4. Viết prompt theo mẫu. Không để placeholder còn sót.
5. Trả prompt.

## Bố cục (chọn một mỗi ảnh; nhiều ảnh thì mỗi ảnh một kiểu)
| Kiểu | Mô tả để ghi vào prompt | Vùng áo trong khung |
|---|---|---|
| A. Treo móc gỗ, cận cổ áo | Áo treo trên móc gỗ sáng màu, nhìn gần phần cổ áo và vai | Cổ, vai, một phần thân trên |
| B. Trải phẳng, nhìn từ trên xuống | Áo trải phẳng trên nền trơn, nhìn thẳng từ trên xuống, cận hàng nút và thân trước | Hàng nút, ngực, eo |
| C. Gấp góc vạt | Một góc vạt áo hoặc tay áo được gấp nhẹ để thấy độ rủ và mép vải | Vạt, tay áo, mép may |
| D. Flat-lay xéo kiểu lifestyle | Áo trải trên mặt đá/bàn sáng, máy chếch xuống khoảng 60-70 độ, áo đặt hơi xéo, móc đen đặt sau cổ áo, quần (nếu có trong `@ao`) trải chồng một phần ở cạnh khung, một món phụ kiện bị cắt ngang mép khung | Gần nguyên thân áo, mép dưới, hàng nút |
| E. Cận chi tiết (viền, nút, đường may) | Máy sát vào một chi tiết như viền tua rua, hàng nút, đường may, cổ, nhìn chếch xuống, phần còn lại của áo mờ dần | Chi tiết chiếm 60-70% khung |

## Quy tắc khi viết prompt
**Áo**
- Luôn là `@ao`, giữ đúng màu, hoa văn, kiểu cổ, hàng nút. Không mô tả lại màu hay hoa văn bằng chữ.
- Áo phải phẳng, gọn, không nhàu nát; nếp rũ mềm tự nhiên.
- Mặt phải của áo hướng về máy. Không chữ, không logo, không mã sản phẩm. **Nhãn cổ để trống hoặc bỏ nhãn**, không in tên thương hiệu hay size.

**Bề mặt vải (điểm chính của ảnh)**
- Chụp đủ gần để thấy rõ bề mặt vải: hạt dệt, độ mịn, độ bóng, độ rủ, nếp may. Nét sắc ở vùng vải, hoa văn đúng như `@ao`.
- Có `@vai`: mô tả bằng chữ đúng những gì thấy ở ảnh đó (hạt dệt, lỗ lưới, độ bóng, độ rủ, đường vắt sổ), không đính kèm ảnh. Không có `@vai`: tự mô tả theo `@ao`, không bịa.
- Vải thun lưới in: lỗ li ti dạng vạch dọc ngắn xếp so le ở cả hai mặt, mặt phải in hoa hơi bóng, mặt trái nhạt màu thấy hoa văn in hằn mờ, mép vạt vắt sổ.
- Chất liệu: chỉ mô tả cảm giác bề mặt (mềm mịn, hơi bóng, rủ nhẹ, mịn mát...). **Chỉ ghi tên chất liệu (lụa, cotton, chiffon, thun lạnh...) nếu người dùng cung cấp.** Không bịa chất liệu.
- Vải linen/đũi: thấy rõ sợi dọc ngang, những đoạn sợi dày mỏng không đều (slub), nếp nhăn mịn tự nhiên nhẹ, hơi lì không bóng. Chỉ ghi khi `@ao` hay người dùng xác nhận là linen/đũi.
- Chi tiết thủ công (viền tua rua, đường viền ren, nút gỗ/nút sừng): tả rõ từng sợi tua xoã tự nhiên, nút khâu chắc, đúng như `@ao`.
- Prompt không bao giờ yêu cầu Flow vẽ vòng tròn (kính lúp hay biến thể màu), mũi tên hay chú thích: Flow vẽ lại nội dung trong vòng tròn, không khớp áo thật. Vòng tròn ghép bằng script (mục "Vòng tròn biến thể màu").

**Phông nền và đồ trang trí (phải nhìn sang)**
- Cả khung phải nhìn như ảnh catalogue cao cấp: nền sạch, chất liệu nền đắt tiền, ít đồ nhưng chọn kỹ, nhiều khoảng thở. Không dùng đồ nhìn rẻ hay quê: thảm cói, giấy kraft, cành khô, lá khô, vải bố thô, mặt bàn nhựa, nền giấy nhăn.
- Mặt nền chọn một trong: đá cẩm thạch trắng hoặc kem vân xám mảnh, đá travertine be mịn, gỗ óc chó hoặc gỗ sồi sáng đánh bóng mờ, lụa satin trơn trải phẳng tông kem/champagne/xám bạc. Nền không hoa văn nổi, không vết bẩn, không trầy xước.
- Chọn nền tương phản dịu với áo: áo sáng (trắng, kem, pastel) thì nền travertine be, gỗ óc chó hoặc satin champagne; áo đậm (đen, navy, rêu, nâu) thì nền cẩm thạch trắng hoặc satin kem để áo nổi. Bộ nhiều màu (có cả màu sáng lẫn đậm) dùng chung một nền trung gian hợp mọi màu, ví dụ travertine be mịn hoặc cẩm thạch kem vân mảnh.
- Kiểu D, E: được phép lộ nền thứ hai ở một góc khung để có chiều sâu (bậu cửa đá, tường thạch cao kem, một nếp lụa satin), không lấn quá 15% khung.
- Tối đa 2 đồ trang trí nhỏ, chọn món nhìn đắt tiền, không chữ, không logo, không nhãn: lọ nước hoa thuỷ tinh trơn không nhãn, khay đá cẩm thạch nhỏ, chuỗi ngọc trai, nhẫn hoặc lắc tay vàng mảnh, kính râm gọng đen trơn, cành hoa lan trắng hoặc hoa hồng kem tươi, ly thuỷ tinh trong, móc gỗ sáng hoặc móc đen trơn. Không dùng sách, tạp chí, giấy có chữ.
- Tông màu toàn khung hài hoà, tối đa 3 tông (màu áo + tông nền + một tông nhấn kim loại vàng nhạt hoặc trắng ngà). Không màu chói, không đồ nhựa.
- Kiểu D: phụ kiện đặt sát mép khung và bị cắt một phần, nhìn như chụp tạp chí thời trang, không bày ngay ngắn giữa khung. Móc đen nằm sau cổ áo, không che hàng nút.
- **Móc áo (áo trải phẳng có móc):** luôn ghi đủ câu sau vào prompt, Flow hay vẽ móc lệch, thò ra ngoài vai hoặc nằm đè lên áo: "móc gỗ trơn nằm bên trong áo, căn giữa cổ áo, thanh móc song song và nghiêng cùng góc với đường vai, hai đầu móc nằm trọn trong vai áo không thò ra ngoài, chỉ thấy móc kim loại nhô lên đúng giữa sau cổ và một đoạn thanh gỗ ngắn qua khoảng hở cổ chữ V".
- Đồ trang trí không che vùng áo chính và không chói hơn áo.

**Máy ảnh và ánh sáng**
- Kiểu A: ống kính macro 85-100mm, f/4, máy chếch xuống khoảng 30 độ.
- Kiểu B: nhìn thẳng từ trên xuống 90 độ, 85mm, f/5.6.
- Kiểu C: máy chếch xuống khoảng 45 độ, 85-100mm, f/4.
- Kiểu D: máy chếch xuống khoảng 60-70 độ, 50-85mm, f/5.6, hơi có phối cảnh tự nhiên (phần áo gần máy lớn hơn một chút), toàn thân áo vẫn nét.
- Kiểu E: macro 100mm, f/4, chếch xuống khoảng 40 độ, nét sắc ở chi tiết, phần còn lại mờ dần.
- Kiểu D có thể thêm một vệt nắng cửa sổ xiên mềm lên nền ở góc khung (tạo bóng chéo nhẹ, không chạm lên vùng vải chính). Kim loại và thuỷ tinh có điểm phản sáng nhỏ tinh tế, không loá.
- Ánh sáng cửa sổ mềm từ phía trên bên trái khoảng 5500K, bóng đổ mềm nhẹ, **luôn ghi** "giữ đúng màu và hoa văn của áo, không ám màu, không cháy sáng".
- Nét ảnh sắc ở bề mặt vải, phông nền hơi mờ nhẹ.

**Khung hình**
- Tỉ lệ **3:4** (1200×1600), áo chiếm khoảng 80-90% khung (kiểu D: áo và quần chiếm khoảng 85%, quần được phép bị cắt ngang mép khung).
- Không chữ, logo, watermark, số điện thoại, viền; không người, không tay người.

**Tránh từ dễ bị Google Flow chặn:** không ghi "thương hiệu" hay tên hãng; dùng "không chữ, không logo" là đủ. Khi Flow báo lỗi, bỏ lần lượt từng dòng nghi ngờ (đồ trang trí trước, rồi bề mặt vải) và chạy lại.

## Mẫu prompt
```
Ảnh sản phẩm cận cảnh chiếc áo @ao, không có người mẫu, giữ đúng kiểu dáng, kiểu cổ, hàng nút, màu và hoa văn của chiếc áo này.
Bố cục: [kiểu A/B/C/D/E, mô tả đặt áo và vùng cận cảnh].
Phông nền: [mặt nền cao cấp: cẩm thạch/travertine/gỗ óc chó/satin, tông ..., mức xoá phông], nhìn sang trọng như ảnh catalogue cao cấp.
Đồ trang trí: [tối đa 2 món nhỏ nhìn đắt tiền, không chữ, không nhãn] (bỏ dòng này nếu không dùng).
Bề mặt vải: chụp đủ gần để thấy rõ [mô tả bề mặt vải: hạt dệt, độ mịn, độ bóng, độ rủ; ghi tên chất liệu nếu người dùng cung cấp].
Góc trên bên phải: [chỉ khi có biến thể màu] để trống nền, không đồ vật, không vệt nắng, không có phần áo hay móc, khoảng 50% bề ngang và 15% chiều cao khung.
Mặt trong cổ áo trơn hoàn toàn, không nhãn, không mác size, không chữ.
Máy ảnh: ống kính [..]mm, f/[..], [góc máy], nét sắc ở bề mặt vải.
Ánh sáng: cửa sổ mềm từ phía trên bên trái khoảng 5500K, bóng đổ mềm nhẹ, giữ đúng màu và hoa văn của áo, không ám màu, không cháy sáng.
Khung hình 3:4, áo chiếm khoảng 85% khung.
Không vòng tròn, không chữ, không logo, không nhãn, không watermark, không số điện thoại, không người, không tay người.
```
Nếu có `@thamkhao`, thêm dòng đầu: `Tham chiếu bố cục, phông nền và ánh sáng từ ảnh: @thamkhao`, và nhắc rõ "không lấy áo, nhãn hay chữ trong @thamkhao".

## Nhiều ảnh cùng một áo
- Mỗi ảnh một prompt riêng, copy được ngay, đổi kiểu bố cục (A-E) và vùng cận cảnh. Bộ 3 ảnh gợi ý: D (toàn cảnh lifestyle), B hoặc C (độ rủ), E (chi tiết viền/nút).
- Giữ chung tông phông nền và ánh sáng để cả bộ đồng nhất.
- Gợi ý (1 dòng): sinh ảnh 1 trước, rồi đính kèm làm tham chiếu phông nền cho các ảnh sau.

## Vòng tròn biến thể màu (áo có nhiều màu)
- **Trước khi viết prompt, hỏi người dùng áo có bao nhiêu màu và màu nào ứng với ảnh/folder nào.** Không tự đoán từ số folder hay số ảnh (các folder có thể là mẫu áo khác).
- Mỗi màu một ảnh cận cảnh, một prompt riêng; mọi prompt giống hệt nhau về bố cục, phông nền, đồ trang trí, ánh sáng, chỉ khác `@ao`, để cả bộ đồng nhất.
- Prompt phải có dòng "Góc trên bên phải để trống" (mẫu trên). Vệt nắng và đồ trang trí đặt ở các góc còn lại.
- Sau khi người dùng lưu ảnh Flow (bản 2K), ghép hàng vòng tròn bằng `scripts/bien_the_mau.py`:
  - Mỗi vòng tròn chỉ là màu trơn, không hoạ tiết, không đánh dấu màu đang hiển thị. Màu lấy trung vị một vùng nhỏ (khoảng 60px) ở màu nền chính của áo (thường là ngực), tránh hoa lớn, bóng tối, tóc, tay, túi; hoặc ghi thẳng `"color": [r, g, b]`.
  - Thứ tự vòng tròn giống nhau ở mọi ảnh.
  - Cùng config có `patches` để xoá nhãn cổ áo.
- **Xoá dấu ngôi sao Flow** (góc dưới phải) bằng `scripts/xoa_dau_sao.py` trước khi ghép vòng tròn: `uv run --with opencv-contrib-python-headless --with numpy python -I scripts/xoa_dau_sao.py in.jpg out.jpg`. Mở file `*_chk.png` kiểm tra (nhất là khi dấu nằm trên vật có vân như quạt, vành đĩa). Lưu ảnh sạch vào đúng folder màu, tên `can-canh-3x4.jpg`.
  - Chạy: `uv run --with pillow python -I scripts/bien_the_mau.py config.json`. Mở ảnh kết quả kiểm tra trước khi gửi.
- Không chữ trên ảnh (không tên màu).
