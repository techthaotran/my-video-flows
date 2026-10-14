---
name: shopee-dang-phu-kien
description: Thư viện dáng (pose) và phụ kiện cầm tay/tóc/trang sức cho người mẫu ảo Shopee, gồm nhóm A (áo kiểu cổ V + quần ống rộng) và nhóm B (áo dài cách tân/sườn xám cổ đứng) - chọn dáng và phụ kiện hợp sản phẩm, soạn đoạn prompt tiếng Việt cho Gemini/Flow, giữ đúng khung hình ảnh bìa Shopee (người nửa trái, góc dưới trái trống).
---

# Dáng người mẫu và phụ kiện - ảnh Shopee

Dùng cùng skill nhân vật (`shopee-nguoi-mau-ao`, `shopee-nguoi-mau-ao-2`): skill nhân vật quyết định **ai** (mặt, tóc), skill này quyết định **dáng gì, cầm gì, đeo gì**.
Ảnh mẫu 27 dáng nằm ở `references/` (đánh số 01-27, tên file mô tả dáng): 01-12 là nhóm A, 13-27 là nhóm B. Khi sinh ảnh, đính kèm ảnh dáng mong muốn làm tham chiếu tư thế, cùng ảnh nhân vật và ảnh sản phẩm.
Trang phục trong ảnh mẫu chỉ là ví dụ (áo cổ V cài nút ngọc trai + quần ống rộng đen/trắng); luôn mặc **đúng sản phẩm** của người dùng, không sao chép màu áo của ảnh mẫu.

## Thư viện dáng
| # | Dáng | Hợp với | Ghi chú |
|---|---|---|---|
| 01 | Một tay cầm túi rút thả thấp, tay kia hơi đưa ra trước, nghiêng người cười | Áo dài tay, mặc hằng ngày | Túi nằm thấp bên người, dễ đụng góc dưới trái: đặt túi ở tay phải |
| 02 | Hai tay chắp trước bụng cầm quạt gấp có tua đỏ, nhìn thẳng | Đồ lễ, truyền thống, bìa an toàn | Dáng cân đối, phù hợp mặc định cho ảnh bìa |
| 03 | Một tay xách túi rút, tay kia đặt hông, đứng thẳng, cười nhẹ | Bìa chính, thấy rõ cả áo và quần | Tay chống hông giúp lộ eo và phom áo |
| 04 | Quạt nan mở cầm ở hông, tay kia buông nhẹ, bước nhẹ | Đồ đi chơi, đi lễ | Quạt nằm cạnh thân, không che hàng nút |
| 05 | Hai tay cầm quai túi trước bụng, nhìn nghiêng ra cửa sổ | Ảnh phụ, dáng mềm | Mắt không nhìn ống kính, hợp ảnh nhẹ nhàng |
| 06 | Một tay buông, tay kia xách túi, đầu hơi nghiêng | Ảnh phụ, đổi nhịp | |
| 07 | Một tay vuốt tóc, tay kia xách túi, bước đi | Ảnh động, trẻ trung | Tay vuốt tóc che một bên mặt: chọn khi mặt vẫn thấy rõ |
| 08 | Hai tay cầm ly cà phê giấy trước ngực, cười | Ảnh phụ, phong cách đời thường | Ly nằm trước ngực, che nhẹ hàng nút: kiểm tra |
| 09 | Hai tay cầm quai túi trước bụng, nhìn thẳng, đứng thẳng | Bìa an toàn, thấy rõ phom áo | Túi ở giữa thân, không che hàng nút phía trên |
| 10 | Một tay giơ quạt nan cao bên đầu, tay kia chạm eo | Ảnh nhấn mạnh, bắt mắt | Quạt che một phần nền, không che mặt |
| 11 | Hai tay chắp trước bụng, bước đi nhẹ | Bìa mặc định, an toàn nhất | Không có phụ kiện, tập trung vào áo |
| 12 | Hai tay cầm tách trà hoa văn trước ngực, nhìn nghiêng cười | Ảnh phụ, dịu dàng | |

### Nhóm B: áo dài cách tân / sườn xám cổ đứng (13-27)
Dùng cho váy dài ôm cổ đứng, cài khuy vải xéo, tay lỡ/ngắn/sát nách. Dáng thanh lịch, nhiều khoảng thở hơn nhóm A.
| # | Dáng | Hợp với | Ghi chú |
|---|---|---|---|
| 13 | Một tay tựa cột gỗ, tay kia buông, cười nhẹ | Ảnh bìa, thấy rõ cổ, khuy, tay áo | Cột gỗ nằm bên trái ảnh: dùng bối cảnh không đặt vật ở góc dưới trái |
| 14 | Một tay vuốt lọn tóc, tay kia buông, cười | Ảnh phụ, trẻ trung | Tay không che cổ áo và khuy |
| 15 | Một tay cầm quạt gấp có tua thả thấp, tay kia tựa bàn, nhìn nghiêng | Ảnh phụ, nửa thân | Quạt thả thấp, không che thân váy |
| 16 | Một tay cầm quạt gấp mở trước eo, tay kia đặt cổ tay, đứng thẳng | Bìa chính toàn thân | Rõ chiều dài váy và giày |
| 17 | Một tay thả cành hoa xuống, tay kia tựa trụ, nhìn nghiêng | Ảnh phụ, thơ mộng | Cành hoa thả thấp bên người |
| 18 | Hai tay ra sau lưng/chống eo, đứng thẳng, nhìn thẳng | Bìa an toàn, rõ phom ôm | Không phụ kiện, tập trung vào váy |
| 19 | Một tay giơ cành sen/hoa cuống dài lên cao, tay kia ra sau lưng | Ảnh nhấn mạnh, nghệ thuật | Cành hoa không che mặt |
| 20 | Một tay giơ quạt tròn giấy bên đầu, tay kia thả, vòng ngọc ở cổ tay | Ảnh phụ, phong cách cổ điển | Quạt nằm bên cạnh đầu, mặt vẫn thấy rõ |
| 21 | Hai tay cầm quạt tròn lụa trước ngực/bụng | Ảnh phụ, váy hoa nhỏ | Quạt che một phần thân: chỉ dùng khi hoạ tiết ở vạt dưới |
| 22 | Hai tay chắp trước bụng cầm quạt nhỏ gập, nhìn thẳng | Bìa an toàn | Quạt nhỏ, không che khuy |
| 23 | Một tay giơ chạm cổ/ngực, tay kia ra sau, nhìn nghiêng | Ảnh phụ, dịu dàng | Giữ tay cách cổ áo, không che khuy |
| 24 | Ngón tay chạm má/tai, tay kia tựa lan can, hơi nghiêng | Ảnh phụ, lãng mạn | Tay dễ lỗi: kiểm tra kỹ |
| 25 | Đi bộ nhẹ, một tay cầm cành lá nhỏ thả thấp, nhìn xuống | Ảnh phụ, váy trắng/nhạt, bối cảnh đồng cỏ | Cành thả tay phải ảnh |
| 26 | Một tay đút/để sau lưng, người hơi xoay, váy bay nhẹ | Ảnh phụ, thấy xẻ tà | Dáng động, hợp váy voan |
| 27 | Ngồi xích đu, một tay nắm dây, tay kia đặt đùi, cười | Ảnh phụ, lifestyle | Chỉ dùng ảnh phụ; ngồi nên khung rộng hơn, vẫn giữ người cao > 80% khung |

Chọn dáng nhóm B:
- **Ảnh bìa chính:** 13, 16, 18, 22.
- **Ảnh phụ:** 14, 15, 17, 19, 20, 21, 23, 24, 25, 26, 27.

Chọn dáng theo mục đích:
- **Ảnh bìa chính:** 02, 03, 09, 11 (thân thẳng, rõ cổ - nút - phom - quần).
- **Ảnh phụ (đổi nhịp):** 01, 04, 05, 06, 07, 08, 10, 12.
- Một bộ ảnh cho cùng sản phẩm: dùng 4-6 dáng khác nhau, **không lặp hai dáng liền nhau**.

## Phụ kiện
| Phụ kiện | Mô tả để ghi vào prompt | Lưu ý |
|---|---|---|
| Túi rút thêu hoa | Túi rút vải kem/trắng ngà, quai dây mảnh, thêu hoa sen/hồng pastel ở thân túi | Hợp mọi màu áo; cầm bằng quai, túi treo thả |
| Quạt nan gấp | Quạt nan gỗ chạm khắc hoa văn đỏ, nan mở nửa vòng; hoặc quạt gấp khép có tua đỏ | Hợp áo trắng/pastel; không che hàng nút |
| Ly cà phê giấy / tách trà | Ly giấy trắng nắp trắng hoặc tách sứ hoa văn nhỏ | Dùng cho ảnh đời thường, đặt ngang ngực |
| Khuyên tai | Khuyên ngọc trai nhỏ hoặc nụ tròn | Giữ nhất quán với nhân vật |
| Giày/dép | Guốc/xăng đan quai trong suốt, đế gỗ cao vừa | Giữ cho cả bộ ảnh; không đổi sang giày thể thao |
| Quần phối | Quần ống rộng đen hoặc trắng, chất lụa rũ | Chọn màu quần tương phản với áo: áo sáng + quần đen, áo đậm + quần trắng |

Phụ kiện thêm cho nhóm B (áo dài cách tân/sườn xám):
| Phụ kiện | Mô tả để ghi vào prompt | Lưu ý |
|---|---|---|
| Quạt tròn lụa | Quạt tròn cán đen/gỗ, mặt lụa trong vẽ cành hoa | Hợp váy xanh/xám nhạt; cầm bằng một hoặc hai tay |
| Quạt giấy tròn/gấp | Quạt giấy kem, vẽ tranh thủy mặc, hoặc quạt gấp tua | Không viết chữ rõ nét trên mặt quạt |
| Cành hoa/cành lá | Cành sen, hoa cuống dài, cành lá nhỏ | Thả thấp hoặc giơ cao; không che mặt |
| Trâm/lược cài tóc | Trâm ngọc, kẹp tóc ngọc trai, hoa nhỏ cài tóc, tua rủ | Búi tóc thấp hoặc nửa búi |
| Khuyên tai | Khuyên ngọc trai hoặc khuyên giọt dài | |
| Vòng tay | Vòng ngọc trắng/xanh, chuỗi hạt | Một bên cổ tay |
| Giày | Giày búp bê, cao gót quai ngang | |

Quy tắc phụ kiện:
- Mỗi ảnh tối đa **1 phụ kiện cầm tay** (túi HOẶC quạt HOẶC ly). Không cầm 2 thứ cùng lúc.
- Phụ kiện phải **tôn sản phẩm, không át**: cùng tông pastel/kem, không màu chói hơn áo.
- Không chữ, logo, thương hiệu trên túi/ly/quạt. Hoa thêu trên túi giữ đơn giản.
- Không để phụ kiện che cổ áo, hàng nút, hoặc đường eo.

## Góc máy, tiêu cự, ánh sáng theo dáng
Ghi **máy ảnh và ánh sáng** vào mọi prompt. Giá trị mặc định của từng nhân vật nằm ở skill nhân vật (người mẫu 1: giờ vàng; người mẫu 2: ngày mềm); bảng dưới chỉnh theo kiểu khung và dáng.

| Kiểu khung | Tiêu cự | Khẩu | Góc máy | Dùng cho |
|---|---|---|---|---|
| Toàn thân | 50-70mm | f/3.5-5.6 | Ngang eo, thẳng; chân dài tự nhiên | Bìa chính (nhóm A: 02, 03, 09, 11; nhóm B: 16, 18, 22) |
| Tới ngang gối/đùi | 70-85mm | f/2.8-4 | Ngang ngực | Ảnh bìa hoặc phụ có phụ kiện cầm tay |
| Nửa thân | 85mm | f/2.0-2.8 | Ngang mắt, nghiêng lên 0-5 độ | Ảnh phụ, dáng nhìn nghiêng (05, 12, 15, 17, 23, 24) |
| Cận mặt-vai | 105mm | f/2.0-2.8 | Ngang mắt | Chỉ ảnh cận chi tiết cổ/khuy |

Ghi chú theo dáng:
- Dáng tay giơ cao (10, 19, 20): dùng 70-85mm để tay và phụ kiện không méo to; **không dùng góc rộng**.
- Dáng ngồi (27): máy ngang tầm mắt người ngồi, 85mm; không chụp từ trên xuống.
- Dáng bước đi (07, 11, 25): thêm "bắt khoảnh khắc chuyển động, vải tung nhẹ, không nhoè" (màn trập nhanh).
- Cầm túi/quạt: lấy nét vào mặt và áo, phụ kiện nét vừa đủ, không nét hơn áo.

Ánh sáng theo dáng và sản phẩm:
- **Hướng sáng:** từ trước-trên 30-45 độ, có hắt sáng phía trước; tránh sáng đỉnh đầu làm bóng mắt.
- **Ngược sáng:** chỉ dùng khi áo/váy sáng màu và có hắt sáng bù (tỉ lệ 1:2); với áo màu đậm hoặc hoa văn nhiều (như áo tím hồng-xanh ngọc), ưu tiên sáng xiên bên, không ngược sáng mạnh.
- **Màu:** ánh sáng trung tính hoặc ấm nhẹ; không để ánh sáng ám màu làm sai màu áo. Ghi "giữ đúng màu và hoa văn của sản phẩm" trong prompt.
- **Phơi sáng:** da và áo trắng không cháy; vùng tối còn chi tiết; nền sáng vừa phải để không lấn người mẫu.
- Một bộ ảnh cùng sản phẩm: **giữ cùng kiểu ánh sáng và tông màu** cho cả bộ, đổi dáng và bối cảnh.

## Khung hình bắt buộc (khớp skill ảnh bìa)
- Tỉ lệ 1:1 (hoặc 4:5 rồi crop), người mẫu ở **nửa TRÁI**, nửa phải chừa trống; **góc dưới bên TRÁI không có vật/chữ/phụ kiện** (vùng nhãn Shopee).
- Người cao hơn 80% khung; đầu cách mép trên khoảng 40-120px trên canvas 1200.
- Phụ kiện cầm tay đặt ở tay **phải của ảnh** (bên phía chừa trống), không thả thấp về phía dưới trái. Nhiều ảnh mẫu ở `references/` có túi thấp bên trái ảnh: nếu dùng các dáng đó, yêu cầu **lật gương hoặc đổi tay** trong prompt.
- Nền sạch, ít người và biển hiệu; **không có chữ nào trong nền** (một số ảnh mẫu có biển hiệu quán cà phê: không bắt chước).
- Không có khung viền, watermark, số điện thoại.

## Quy trình
1. Hỏi/xác nhận: sản phẩm, nhân vật (1 hay 2), mục đích ảnh (bìa hay ảnh phụ), số lượng ảnh cần.
2. Chọn dáng theo bảng và 1 phụ kiện phù hợp (hoặc không phụ kiện cho ảnh bìa an toàn).
3. Soạn prompt theo mẫu dưới, gửi kèm: ảnh nhân vật, ảnh sản phẩm, ảnh dáng mẫu (từ `references/`).
4. Sinh 2-4 biến thể mỗi dáng; chọn ảnh tốt nhất.
5. **Kiểm tra trước khi giao:**
   - Bàn tay đủ 5 ngón, cầm phụ kiện tự nhiên (quai túi nằm đúng trong tay, không xuyên qua tay).
   - Phụ kiện không méo; túi/quạt không đổi hình giữa các ảnh của cùng bộ.
   - Cổ áo, hàng nút, phom áo không bị che.
   - Góc dưới trái trống; người cao > 80% khung, ở nửa trái; nền không có chữ.
6. Bàn giao, gợi ý bước tiếp: dựng tag/footer bằng skill `shopee-anh-bia-thoi-trang`.

## Mẫu prompt (tiếng Việt)
Quy ước đính kèm: ảnh nhân vật gắn tên `nhanvat`, ảnh sản phẩm (áo) gắn tên `ao`.
Hai dòng đầu của prompt luôn đúng dạng `Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat` và `Trang phục: @ao`; không mô tả lại mặt, tóc hay chi tiết áo trong prompt, để ảnh tham chiếu quyết định.
Mô tả quần, giày, dáng, phụ kiện, máy ảnh, ánh sáng, bối cảnh, khung hình thì vẫn ghi bằng chữ.
```
Giữ nguyên nhân vật như ảnh tham chiếu: @nhanvat
Trang phục: @ao
Quần: [ống rộng trắng kem / đen] chất lụa rũ, xăng đan quai trong suốt đế gỗ.
Dáng: [mô tả dáng, vd "đứng thẳng, hai tay chắp nhẹ trước bụng, bước một chân nhẹ, nhìn thẳng ống kính, cười nhẹ"],
tham chiếu tư thế như ảnh dáng đính kèm. Bàn tay tự nhiên, năm ngón rõ ràng.
Phụ kiện: [vd "tay phải xách túi rút vải kem thêu hoa hồng pastel bằng quai dây mảnh, túi thả tự nhiên bên hông phải"].
Bối cảnh: [quán cà phê cửa kính sáng / sân vườn nắng nhẹ], nền hơi mờ, không có chữ hay biển hiệu.
Máy ảnh: ống kính [85mm / 70mm], khẩu [f/2.8], góc máy [ngang tầm mắt / ngang eo], không méo góc rộng.
Ánh sáng: [giờ vàng ấm 5000K / ngày mềm khuếch tán 5800K], hướng sáng từ trước-trên, có hắt sáng cho mặt và áo, giữ đúng màu và hoa văn sản phẩm, không cháy sáng.
Khung hình 1:1, người mẫu bên TRÁI cao hơn 80% chiều cao khung, nửa phải để trống nền đơn giản,
góc dưới bên trái không có vật thể hay phụ kiện. Không chữ, không logo, không watermark.
```

## Bộ ảnh cùng nhân vật, cùng áo, cùng nền, khác dáng
Khi người dùng cần một bộ ảnh đồng nhất (cùng sản phẩm), tách prompt thành phần **cố định** và phần **đổi**:
- **Cố định (giống hệt ở mọi ảnh):** `@nhanvat`, `@ao`, dòng `Quần`, `Bối cảnh`, `Máy ảnh`, `Ánh sáng`, `Khung hình`.
- **Đổi theo ảnh:** chỉ dòng `Dáng` (kèm phụ kiện) và ảnh dáng đính kèm.
Quy tắc:
- Chọn **một** bối cảnh, một tiêu cự, một kiểu ánh sáng cho cả bộ; không đổi giữa các ảnh.
- Chọn dáng khác nhau rõ rệt (đứng, bước, giơ tay, xách túi), tránh hai dáng gần giống nhau.
- Chọn dáng không che hoa văn quan trọng của áo.
- Giữ bối cảnh nhất quán: sinh ảnh 1 trước, rồi đính kèm ảnh đó làm tham chiếu bối cảnh cho các ảnh sau.
- Ghi từng prompt đầy đủ (không để placeholder) để copy thẳng.

## Lưu ý
- Ảnh trong `references/` là ví dụ dáng và phụ kiện, không phải nhân vật cần giữ: chỉ dùng để tham chiếu tư thế, không bắt khuôn mặt của chúng.
- Một số ảnh nhóm B có icon logo nhỏ của nguồn ở góc (vòng tròn trắng hình áo): không đưa vào ảnh sinh ra.
- Nhóm B dùng khi sản phẩm là áo dài cách tân/sườn xám; nhóm A dùng cho áo bà ba/áo kiểu + quần. Không trộn lẫn dáng và phụ kiện hai nhóm trong cùng một ảnh.
- Tay là chỗ AI hay lỗi nhất: nếu tay méo, thêm "bàn tay tự nhiên, năm ngón rõ ràng" và sinh lại, ưu tiên dáng ít chạm tay vào phụ kiện (02, 09, 11).
- Thêm dáng/phụ kiện mới: thêm ảnh vào `references/` rồi thêm một dòng vào bảng, không viết lại cả skill.
