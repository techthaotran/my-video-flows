---
name: shopee-anh-bia-thoi-trang
description: Tạo ảnh bìa Shopee (1:1 và 3:4) cho áo bà ba/thời trang từ ảnh người mẫu - làm nét, dịu nền chói, rõ mặt, xoá logo của shop, đổi màu áo theo ảnh mẫu, dựng 2 thẻ trắng (logo shop + tiêu đề + chất liệu) chuẩn mobile.
---

# Ảnh bìa Shopee thời trang (chuẩn mobile, 1:1)

Dùng khi người dùng gửi ảnh người mẫu mặc sản phẩm (áo bà ba, thời trang) và muốn ảnh bìa / thumbnail đăng Shopee, hoặc muốn sửa ảnh bìa bị mờ, chói, lệch, chữ khó đọc.

## Quy chuẩn bắt buộc
- Vuông 1:1, xuất **1200×1200 JPG quality 92, subsampling 4:4:4** (chữ không lem viền), dung lượng < 2MB để Shopee không nén lại.
- **Góc dưới bên TRÁI để trống hoàn toàn** (nhãn Shop Yêu Thích / Mall / Giảm giá / Freeship của Shopee). Ảnh người mẫu phủ kín toàn bộ khung 1:1 (**không còn cột nền be/vàng**); hai thẻ trắng nằm TRÊN nền ảnh, ở chỗ trống cạnh người mẫu.
- **Xuất 2 ảnh từ một ảnh nguồn: 1:1 (1200×1200) và 3:4 (1200×1600).** Dùng `outputs` trong job (xem docstring script). Cùng bố cục, cùng thẻ, cùng quy tắc (góc dưới trái trống, thẻ cùng phía phải, không che người). Ảnh 3:4 cao hơn nên crop có chiều cao = `crop_w × 4/3`; người mẫu vẫn phải cao > 80% khung (≥ 1280px trên canvas 1600). Chọn `crop` riêng cho từng tỉ lệ rồi kiểm tra từng ảnh.
- Tiêu đề chữ in hoa, font không chân nét cực đậm, không bóng mờ cho chữ, tương phản cao. Mỗi dòng tiêu đề 2-4 từ. **Không ghi giá.**
- Font phải có đủ dấu tiếng Việt: dùng font **không chân (sans-serif)** dễ đọc: **Avenir Next Bold (đậm) + Avenir Next Medium (dòng nhỏ)** trên macOS (`/System/Library/Fonts/Avenir Next.ttc`, face index 0 và 5); trên Linux lùi về Inter Display. **KHÔNG dùng Avenir Next Heavy (index 8)**, Poppins, Arial Black: thiếu glyph Ẻ, Ổ, Ả, Ẵ, Ễ, Ặ → hiện ô vuông. Cách kiểm font: dùng `fontTools` đọc `getBestCmap()` và so với `ẺỔẢẴỄỀĐƠẶẬỆƯ` (đừng kiểm bằng `getmask().getbbox()`, ô vuông cũng có hình). Luôn xem ảnh cuối để chắc không có ô vuông.
- Không thêm viền hoa văn bao quanh.
- **Người mẫu phải cao hơn 80% khung hình**: từ đỉnh đầu tới mép dưới (theo mask người) ≥ 960px trên canvas 1200, đầu cách mép trên ~40-120px. Vùng crop là hình **vuông** (`crop_w = crop_h`) trong ảnh nguồn; chọn vị trí để mỗi thẻ có đủ chỗ trống cạnh người (trên: ≥ 200px, dưới phải: ≥ 160px). **Cả hai thẻ phải cùng một phía (phải), thẳng lề phải x = 1176** vì góc dưới trái dành cho nhãn Shopee. Nếu người đứng lệch phải trong ảnh nguồn, chọn crop sao cho dải hàng chứa thẻ trên chỉ có đầu/tóc (vừa dời crop xuống vừa **thu nhỏ vùng crop** để người mẫu to và lùi sang trái; ví dụ ảnh 1493×2000 có người lệch phải dùng crop 1100×1100 tại [393, 300], cắt tới gấu áo, nhờ vậy cả hai thẻ đều rộng và chữ to), không dời thẻ sang trái.

## Bố cục chuẩn (toạ độ trên canvas 1200)
- Ảnh người mẫu phủ kín 1200×1200 (không viền, không cột nền, không fade). Thẻ vẽ đè lên nền ảnh.
- **Thẻ 1 (trên phải)**: thẻ trắng bo góc, bóng nhẹ, **nhỏ gọn** (rộng tối đa ~375px = 70% bản đầu, tự thu nhỏ theo chỗ trống; cao theo nội dung), neo góc phải trên, cách mép 28px, **cùng phía và thẳng lề phải với thẻ 2** (mặc định `card1_side: "right"`; `"left"`/`"auto"` chỉ dùng khi người dùng yêu cầu). Hằng số `CARD1_SCALE = 0.70` trong script; chỉnh ở đó nếu cần to/nhỏ hơn. Xếp giữa theo trục dọc, từ trên xuống:
  1. Logo shop **to** (`references/logo-thao-ngoc.png`, PNG nền trong suốt 800px, cao `LOGO_H = 250` ở tỉ lệ 1.0, vẽ siêu mẫu x2 từ file gốc nên nét chữ "THẢO NGỌC / FASHION" không vỡ). Ảnh cuối chỉ sắc nét ảnh nền, không sắc nét lại logo và chữ.
  2. (Tuỳ chọn) nhãn nhỏ xám dưới logo (`brand_tag`). **Mặc định để trống, KHÔNG ghi "CHÍNH HÃNG".**
  3. Đường kẻ mảnh xám nhạt.
  4. Tiêu đề 1-2 dòng, **là phần nhấn mạnh nhất** của thẻ: chữ in hoa Avenir Next Bold, xanh navy đậm `#082666`, khoảng cách dòng thoáng (1.2 lần cỡ chữ) và cách đường kẻ ~28px (`headline`, ví dụ `["THUN CO GIÃN","DỄ MẶC"]`).
  5. Dòng phụ chữ thường, Avenir Next Medium, cỡ vừa (46px ở tỉ lệ 1.0), cách tiêu đề ~18px (`subline`, ví dụ "Áo lẻ - Áo bà ba").
- **Thẻ 2 (dưới phải)**: thẻ trắng nhỏ, **nhỏ gọn** (rộng ~291px, cao ~112px = 70% bản đầu, hằng số `CARD2_SCALE`, `CARD2_H`; hai dòng cách nhau thoáng), neo góc phải dưới (x1 = 1176, y1 = 1176), cùng phong cách; dòng 1 chữ hoa đậm, dòng 2 chữ thường (`material`, ví dụ `["SIZE 40 - 85 KG","Đủ loại kích thước"]`, truyền `[]` để ẩn).
- **Thẻ tuyệt đối không được che người mẫu (kể cả tay, túi xách, tóc).** Script tự đo mask người trên canvas, thu nhỏ thẻ (logo, chữ theo) để chừa ≥ 28px khỏi người. Nếu thẻ trên còn rộng < 200px hoặc thẻ dưới < 160px thì script dừng và báo lỗi: đổi vùng crop để chừa chỗ trống rồi chạy lại. Sau khi dựng, script kiểm lại lần cuối, thẻ nào vẫn chạm mask thì báo "LỖI ... đè lên người mẫu" và không giao ảnh. Vẫn phải nhìn ảnh cuối bằng mắt.
- Chỉ một màu nhấn: **xanh navy đậm `#082666`** trên nền trắng (đậm hơn bản `#1F3A6B` cũ). Không capsule đỏ, không icon, không footer đỏ.
- **Toàn bộ nội dung chữ do người dùng truyền vào** (`headline`, `subline`, `material`, và `brand_tag` nếu có). Không tự bịa thông số (chất liệu, size, giá). Thiếu thông tin thì hỏi.
- **Chữ phải căn giữa trong thẻ** - đo lề trái/phải sau khi dựng, lệch > 4px là sửa.

## Logo
- Logo cố định của shop Thảo Ngọc Fashion: `references/logo-thao-ngoc.png` (đen, nền trong suốt, 800×838). Dùng mặc định, không cần truyền.
- Muốn đổi logo shop khác: đặt PNG nền trong suốt vào `references/` rồi truyền `logo_file` trong config. Từ ảnh logo nền trắng, tách nền bằng cách lấy độ tối làm alpha (alpha = (235 - độ sáng) / 215).

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
   Copy `scripts/shopee_thumb.py` trong thư mục skill ra thư mục làm việc.
2. Với mỗi ảnh: đọc kích thước, xác định **tâm mặt** và **gốc crop vuông** (`crop: [left, top]`, `crop_w = crop_h`). Chạy tách mask trước để biết người nằm ở đâu theo từng dải hàng, rồi chọn crop sao cho: người cao > 80% khung, đầu cách mép trên ~40-120px, hai thẻ có chỗ trống (góc dưới trái để trống). Chỉ cắt đến chỗ không dính logo/watermark của shop nếu không muốn xoá (xoá trên nền gạch/cỏ dễ ra vệt, tránh nếu crop né được). Vẽ elip thử lên ảnh để chỉnh `face`.
3. Viết config JSON (định dạng trong docstring script), chạy `python3 -I shopee_thumb.py cfg.json`. Điền `brand_tag/headline/subline/material` đúng theo thông tin người dùng đưa.
4. **Kiểm tra trước khi giao**: xem ảnh full; zoom mặt trước/sau (không viền lạ, da không sạn); đo lề trái/phải chữ trong thẻ; chắc chắn góc dưới trái không có chữ; đo bbox mask người trên canvas 1200: cao > 960px; thẻ không che người mẫu (nhất là tay giơ lên mặt).
5. Gửi file (SendUserFile), tên dạng `bia-shopee-<sp>-<mau>.jpg`; trả lời ngắn: đã làm gì, lưu ý còn lại, gợi ý 1 bước tiếp nếu có.

Nguồn ảnh nên là ảnh chụp sạch (chưa có chữ/khung). Nếu ảnh đầu vào đã là ảnh bìa có sẵn khung chữ, sửa trực tiếp trên ảnh đó (dịch khối chữ cho cân, vẽ lại phần cần đổi) thay vì dựng lại.

## Script
Script dựng ảnh nằm trong thư mục skill: `scripts/shopee_thumb.py` (định dạng config JSON ghi ở docstring đầu file). Copy nó ra thư mục làm việc rồi chạy:
`python3 -I shopee_thumb.py cfg.json`
