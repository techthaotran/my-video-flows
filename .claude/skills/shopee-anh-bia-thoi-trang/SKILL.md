---
name: shopee-anh-bia-thoi-trang
description: Tạo ảnh bìa Shopee (1:1 và 3:4) cho áo bà ba/thời trang từ ảnh người mẫu - làm nét, dịu nền chói, rõ mặt, xoá logo của shop, đổi màu áo theo ảnh mẫu, dựng 1 thẻ trắng thương hiệu (logo đen, tiêu đề navy, chữ nhấn vàng, dòng size nhỏ, thẻ "màu có sẵn" với vòng tròn biến thể màu) chữ to đọc rõ ở ô 188px trên điện thoại, né vùng nhãn Shopee.
---

# Ảnh bìa Shopee thời trang (chuẩn mobile, 1:1 và 3:4)

Dùng khi người dùng gửi ảnh người mẫu mặc sản phẩm (áo bà ba, thời trang) và muốn ảnh bìa / thumbnail đăng Shopee, hoặc muốn sửa ảnh bìa bị mờ, chói, lệch, chữ khó đọc.
Mục tiêu của ảnh bìa là tăng lượt bấm vào sản phẩm.

## Đọc được trên điện thoại là yêu cầu số 1
- Trên app Shopee, ảnh bìa hiện ở ô **nhỏ hơn 188×188px**, tức ảnh 1200px bị thu nhỏ khoảng 6,4 lần.
- Tiêu đề phải ≥ 84px trên canvas 1200 (khoảng 13px trên điện thoại); script dừng và báo lỗi nếu nhỏ hơn. Chữ nhỏ (dòng size, "MÀU CÓ SẴN") cỡ 64px (chữ hoa cao ~45px, ~7px trên điện thoại, là mức tối thiểu đọc được; 33px trước đây bị vỡ nét); không quá 60% cỡ tiêu đề. Không thêm viền làm đậm chữ: viền lấp khe giữa hai dấu chồng (Ẵ, Ẫ) và chữ "SẴN" không đọc được. Không vừa một dòng thì xuống 2 dòng ở chỗ ngắt cân nhất, không ngắt cạnh dấu "-" (ra "SIZE" / "40 - 85 KG"); chỉ co chữ (tối thiểu 56px) khi 2 dòng vẫn không vừa. Nhãn ngắn ("MÀU CÓ SẴN") thì ngược lại: co chữ trước để luôn một dòng, giống nhau trên mọi ảnh.
- Ít chữ: chỉ tên shop, tiêu đề và size; mỗi dòng 1-2 từ. Không dòng phụ chữ nhỏ (dòng như "Đủ loại kích thước" ở cỡ 188px không đọc được, đã bỏ).
- **Luôn thu ảnh cuối về 188px và xem** trước khi giao. Chữ nào không đọc được ở cỡ đó thì bỏ hoặc phóng to.

## Quy chuẩn bắt buộc
- Xuất **JPG quality 92, subsampling 4:4:4** (chữ không lem viền), dung lượng < 2MB để Shopee không nén lại.
- **Xuất 2 ảnh từ một ảnh nguồn: 1:1 (1200×1200) và 3:4 (1200×1600).** Dùng `outputs` trong job (xem docstring script). Cùng thẻ, cùng quy tắc. Ảnh 3:4 cao hơn nên crop có chiều cao = `crop_w × 4/3`; người mẫu vẫn phải cao > 80% khung (≥ 1280px trên canvas 1600). Chọn `crop` riêng cho từng tỉ lệ rồi kiểm tra từng ảnh.
- Ảnh người mẫu phủ kín toàn bộ khung (không viền, không cột nền, không fade); thẻ nằm TRÊN nền ảnh, ở cột trống bên phải người mẫu.
- Không ghi giá. Không thêm viền hoa văn bao quanh. Không icon.
- Font phải đủ dấu tiếng Việt:
  - Chữ to (tiêu đề): **Avenir Next Condensed Demi Bold** (`/System/Library/Fonts/Avenir Next Condensed.ttc`, index 2). Font hẹp nên chữ to vẫn vừa cột trống. Linux lùi về DIN Condensed Bold / Inter Display.
  - Chữ nhỏ (dòng size, "MÀU CÓ SẴN"): **Helvetica Neue Condensed Bold** (`/System/Library/Fonts/HelveticaNeue.ttc`, index 4). Đã so 9 font ở đúng cỡ 188px: font này giữ dấu trăng + dấu ngã của Ẵ tách nhau rõ nhất; font rộng (Arial, Verdana, Avenir Bold, SF Pro) phải co còn ~48px mới vừa thẻ nên dấu dính lại. Linux lùi về DIN Condensed Bold / Inter Display.
  - Tên shop: **Avenir Next Bold** (`Avenir Next.ttc` index 0).
  - **KHÔNG dùng** Avenir Next Condensed Bold/Heavy/Medium, Avenir Next Heavy, Arial Narrow, Impact, Poppins, Arial Black: thiếu glyph Ẻ, Ổ, Ả, Ẵ, Ễ, Ặ → hiện ô vuông.
  - Cách kiểm font: dùng `fontTools` đọc `getBestCmap()` và so với `ẺỔẢẴỄỀĐƠẶẬỆƯ` (đừng kiểm bằng `getmask().getbbox()`, ô vuông cũng có hình). Luôn xem ảnh cuối để chắc không có ô vuông.
- **Người mẫu phải cao hơn 80% khung hình**: từ đỉnh đầu tới mép dưới (theo mask người) ≥ 960px trên canvas 1200, đầu cách mép trên ~40-120px. Vùng crop là hình **vuông** (`crop_w = crop_h`) trong ảnh nguồn. Chọn vị trí để người mẫu nằm nửa trái, chừa cột phải trống ≥ 300px ở dải hàng của thẻ (y 314 đến ~840) (ví dụ ảnh 1493×2000 có người ở giữa dùng crop 1100×1100 tại [230, 40]). Người lệch phải thì dời crop sang phải và thu nhỏ crop để người lùi sang trái.

## Vùng nhãn Shopee (không đặt thẻ vào)
Toạ độ trên canvas rộng 1200 (nhãn co theo chiều rộng nên ảnh 3:4 dùng cùng số px; vùng 02 tính từ mép dưới):
- **Vùng 01** (nhãn Yêu thích, trên trái): x 0-356, y 94-218.
- **Vùng 03** (voucher / giảm giá, trên phải): x 875-1200, y 0-290.
- **Vùng 02** (khung Freeship / Hoàn xu, dưới trái): x 0-746, 183px cuối.

Script tự kiểm: thẻ nào chạm một trong ba vùng thì báo "LỖI ... vùng nhãn Shopee" và không giao ảnh.
Toạ độ đo từ sơ đồ người dùng gửi; nếu Shopee đổi vị trí nhãn, sửa các hằng số `ZONE_*` trong script.

## Bố cục chuẩn (toạ độ trên canvas 1200)
- **Một thẻ trắng** bo góc 30px, bóng nhẹ, thẳng lề phải x = 1176, bắt đầu ở y = 314 (ngay dưới vùng 03), rộng tối đa 470px, tối thiểu 300px. Từ trên xuống, căn giữa theo trục thẻ:
  1. Hàng thương hiệu: dấu tròn "tn" của logo (màu đen, cao 64px) + tên shop `brand` (mặc định `"THẢO NGỌC"`, Avenir Next Bold đen) xếp ngang. Dưới là đường kẻ xám nhạt.
  2. Tiêu đề 1-2 dòng (`headline`, ví dụ `["FORM", "DỄ MẶC"]`): chữ in hoa navy, Condensed Demi Bold, tự co theo bề rộng thẻ (tối đa 170px).
     Cụm bán hàng chính tô vàng `#FFB822` bằng `highlight` (ví dụ `"DỄ MẶC"`, phải trùng nguyên văn một phần của dòng tiêu đề). Chỉ tô một cụm. Hai dòng tiêu đề giãn 1.22 lần cỡ chữ để đọc tách dòng ở ô nhỏ.
  3. Ô nền xanh nhạt `#ECF1F8` chữ navy, chữ nhỏ (`material`, ví dụ `"SIZE 40 - 85 KG"`, tự xuống 2 dòng khi cần; danh sách thì nối bằng dấu cách; `""` để ẩn). Ô này phải kém nổi hơn chữ nhấn: nền nhạt, chữ nhỏ hơn hẳn tiêu đề.
- **Thẻ màu** (tuỳ chọn, khi có `swatches`): thẻ trắng thứ hai ngay dưới thẻ trên, cách 24px, **rộng bằng đúng thẻ trên**. Trên là chữ `swatch_label` (mặc định `"MÀU CÓ SẴN"`, navy, cùng cỡ dòng size), dưới là hàng vòng tròn trơn đường kính 64px, viền trắng, bóng nhẹ, chồng lên nhau (bước 0.66 đường kính, nhiều màu thì chồng sát hơn cho vừa thẻ; vòng sau đè vòng trước). Mỗi phần tử `swatches` là `"#hex"`, `[r, g, b]` hoặc `{"img", "center", "size"}` (trung vị màu một vùng vải trơn ~60px, như skill `shopee-anh-can-canh-vai`). Bề rộng chung của hai thẻ tính theo người mẫu trên cả hai dải hàng, nên thẻ màu dài thêm có thể chạm tay/túi xách: script báo lỗi thì dời crop sang phải (người mẫu lùi sang trái) rồi chạy lại.
  - **Hỏi người dùng mẫu áo có những màu nào** trước khi thêm; không tự đoán từ số ảnh hay số folder. Áo một màu thì bỏ `swatches`. Thứ tự màu giống nhau ở mọi ảnh của cùng mẫu.
- Không có nhãn "ÁO LẺ" hay dòng phụ nào khác trên ảnh bìa. Thông tin áo lẻ để ở tiêu đề sản phẩm.
- Màu thương hiệu cố định (`THEME` trong script): **thẻ trắng, tiêu đề navy `#082666`, chữ nhấn vàng `#FFB822`, logo + tên shop đen**. Dùng giống nhau trên mọi ảnh bìa để khách nhận ra shop trong danh sách tìm kiếm. Không đổi màu theo từng áo. Không thay bằng vàng nhạt hơn (vd `#FFD23F`, tương phản ~1.4:1, mất chữ ở ô 188px). Nếu cần nhấn rõ hơn: `accent_stroke` (viền navy quanh chữ nhấn) hoặc `accent_bg` (dải màu sau chữ).
- **Logo nằm trong thẻ, không đặt ở góc phải trên** (vùng 03 bị nhãn voucher che). Chữ nhỏ "THẢO NGỌC / FASHION" trong file logo không đọc được ở ô 188px nên script chỉ lấy dấu tròn và vẽ lại tên shop bằng chữ to.
- **Thẻ tuyệt đối không được che người mẫu (kể cả tay, túi xách, tóc).** Script đo mask người, thu hẹp thẻ để chừa ≥ 24px; thẻ còn < 300px thì dừng và báo lỗi: đổi vùng crop rồi chạy lại. Sau khi dựng, thẻ vẫn chạm mask thì báo "LỖI ... đè lên người mẫu" và không giao ảnh. Vẫn phải nhìn ảnh cuối bằng mắt.
- **Toàn bộ nội dung chữ do người dùng truyền vào** (`headline`, `highlight`, `material`, `swatches`, `swatch_label`). Không tự bịa thông số (chất liệu, size, giá). Thiếu thông tin thì hỏi.
- **Chữ phải căn giữa trong thẻ** - đo lề trái/phải sau khi dựng, lệch > 4px là sửa.

## Logo
- Logo cố định của shop Thảo Ngọc Fashion: `references/logo-thao-ngoc.png` (đen, nền trong suốt). Dùng mặc định, không cần truyền. Script tự cắt khối mực trên cùng (dấu tròn) và tô theo màu `logo` của THEME (mặc định đen).
- Muốn đổi logo shop khác: đặt PNG nền trong suốt vào `references/` rồi truyền `logo_file` và `brand` trong config. Từ ảnh logo nền trắng, tách nền bằng cách lấy độ tối làm alpha (alpha = (235 - độ sáng) / 215).

## Sửa ảnh (theo thứ tự)
1. **Logo/watermark**: chỉ xoá logo khi người dùng xác nhận logo là của chính shop họ (hỏi 1 câu nếu chưa rõ; nếu là shop khác thì không xoá). Watermark của công cụ AI (ngôi sao lấp lánh) thì xoá được. Logo trong khung nền đặc → `cv2.inpaint`; logo đè lên chữ → vẽ lại phần chữ bị che (tô màu nền + dựng lại nét chữ), rồi zoom kiểm tra.
2. **Tách người mẫu** bằng `u2net_human_seg.onnx` (OpenCV 5 không còn CascadeClassifier; mediapipe mới không còn `solutions`).
3. **Đổi màu áo theo ảnh sản phẩm mẫu** (khi người dùng gửi ảnh áo trơn và muốn "giữ màu giống hình"): đo màu nền vải (median LAB của pixel bão hoà) ở ảnh mẫu và ở áo, dịch a/b, nâng L theo dạng `255-(255-L)*k` để giữ nếp vải; chỉ áp lên pixel cùng hue với nền vải trong vùng áo ∩ mask người → hoa văn, da, nền giữ nguyên. Báo người dùng: áo trong bóng nắng sẽ trầm hơn ảnh studio một chút.
4. **Dịu nền chói phía sau** (không đụng người mẫu, không đụng khung chữ/logo): nén vùng sáng theo L làm mờ σ10, giảm nhẹ độ vàng ở vùng sáng; tăng nhẹ clarity trên người mẫu để áo nổi.
5. **Làm rõ mặt**: mask elip mềm quanh mặt; tách base/detail bằng bilateral, **chỉ tăng nét ở cạnh mạnh** (mắt, mày, môi) - tăng nét toàn mặt làm da lợn cợn, đã bị loại. Nâng nhẹ midtone (gamma 0.94).
6. Upscale/downscale bằng LANCZOS, unsharp nhẹ (r=1, 40-60%). Ảnh gốc < 1024px thì báo người dùng nên gửi file gốc lớn hơn.

## Quy trình
1. Chuẩn bị (1 lần mỗi phiên):
   ```bash
   mkdir -p /home/claude/models && curl -sSL -o /home/claude/models/u2net_human_seg.onnx \
     https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx
   ```
   Chạy script ngay trong thư mục skill (không copy ra ngoài: script tìm logo mặc định theo đường dẫn `../references/`).
2. Với mỗi ảnh: đọc kích thước, xác định **tâm mặt** và **gốc crop vuông** (`crop: [left, top]`, `crop_w = crop_h`). Chạy tách mask trước để biết người nằm ở đâu theo từng dải hàng, rồi chọn crop sao cho: người cao > 80% khung, đầu cách mép trên ~40-120px, cột phải có chỗ trống cho thẻ (không chạm 3 vùng nhãn). Chỉ cắt đến chỗ không dính logo/watermark của shop nếu không muốn xoá (xoá trên nền gạch/cỏ dễ ra vệt, tránh nếu crop né được). Vẽ elip thử lên ảnh để chỉnh `face`.
3. Viết config JSON (định dạng trong docstring script), chạy `python3 -I <thư mục skill>/scripts/shopee_thumb.py cfg.json`. Điền `headline/highlight/material/swatches` (và `brand` nếu không phải Thảo Ngọc) đúng theo thông tin người dùng đưa.
4. **Kiểm tra trước khi giao**: xem ảnh full; zoom mặt trước/sau (không viền lạ, da không sạn); đo lề trái/phải chữ trong thẻ; thu ảnh về 188px và xem chữ còn đọc được; phủ 3 vùng nhãn Shopee lên ảnh, chắc chắn không thẻ nào nằm trong đó; đo bbox mask người trên canvas 1200: cao > 960px; thẻ không che người mẫu (nhất là tay giơ lên mặt).
5. Gửi file (SendUserFile), tên dạng `bia-shopee-<sp>-<mau>.jpg`; trả lời ngắn: đã làm gì, lưu ý còn lại, gợi ý 1 bước tiếp nếu có.

Nguồn ảnh nên là ảnh chụp sạch (chưa có chữ/khung). Nếu ảnh đầu vào đã là ảnh bìa có sẵn khung chữ, sửa trực tiếp trên ảnh đó (dịch khối chữ cho cân, vẽ lại phần cần đổi) thay vì dựng lại.

## Script
Script dựng ảnh nằm trong thư mục skill: `scripts/shopee_thumb.py` (định dạng config JSON ghi ở docstring đầu file). Chạy tại chỗ:
`python3 -I <thư mục skill>/scripts/shopee_thumb.py cfg.json`
