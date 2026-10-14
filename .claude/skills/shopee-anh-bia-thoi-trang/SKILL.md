---
name: shopee-anh-bia-thoi-trang
description: Tạo ảnh bìa Shopee 1:1 cho áo bà ba/thời trang từ ảnh người mẫu - làm nét, dịu nền chói, rõ mặt, xoá logo của shop, đổi màu áo theo ảnh mẫu, dựng tag + icon + footer chuẩn mobile.
---

# Ảnh bìa Shopee thời trang (chuẩn mobile, 1:1)

Dùng khi người dùng gửi ảnh người mẫu mặc sản phẩm (áo bà ba, thời trang) và muốn ảnh bìa / thumbnail đăng Shopee, hoặc muốn sửa ảnh bìa bị mờ, chói, lệch, icon khó hiểu.

## Quy chuẩn bắt buộc
- Vuông 1:1, xuất **1200×1200 JPG quality 92, subsampling 4:4:4** (chữ đỏ không lem viền), dung lượng < 2MB để Shopee không nén lại.
- **Góc dưới bên TRÁI để trống hoàn toàn** (nhãn Shop Yêu Thích / Mall / Giảm giá / Freeship của Shopee). Người mẫu ở nửa TRÁI, chữ/tag ở nửa PHẢI.
- Chữ in hoa, font không chân nét cực đậm, không bóng mờ, tương phản cao. Mỗi tag 2-4 từ. **Không ghi giá.**
- Font phải có đủ dấu tiếng Việt: dùng **Inter Display ExtraBold/Black** (`/usr/share/fonts/opentype/inter/`). KHÔNG dùng Poppins (thiếu glyph Ẻ, Ổ, Ả, Ẵ, Ễ → hiện ô vuông). Nếu font khác, kiểm tra cmap có đủ `ẺỔẢẴỄỀĐƠ` trước.
- Không thêm viền hoa văn bao quanh.

## Bố cục chuẩn (toạ độ trên canvas 1200)
- Ảnh người mẫu: cột trái rộng 760px, cao full 1200; mép phải hoà dần (fade 60px) vào cột nền be `#F6ECDC`.
- Header: hộp trắng bo tròn (500,28)-(1176,236): tiêu đề đỏ đậm `#7A1416` (mặc định "ÁO BÀ BA THUN LẺ") + thanh xanh navy `#283E64` chữ trắng ("THOÁNG MÁT • CO GIÃN"). **Chữ phải căn giữa trong khung** - đo lề trái/phải sau khi dựng, lệch > 4px là sửa.
- 3 capsule bên phải (x 600-1184, cao 168, tâm y 380/592/804): nền trắng, viền đỏ đậm + gờ dưới 7px, huy hiệu tròn đỏ `#BA2A16` r=70 chứa icon trắng đặc.
- Footer góc dưới PHẢI (x ≥ 560, y ≥ 1036) nền đỏ đậm: "HÀNG CÓ SẴN", "ĐỔI TRẢ 7 NGÀY".

## Icon (đã được người dùng duyệt - giữ đúng kiểu này)
Icon trắng đặc, nét dày, cùng một phong cách; footer dùng **cùng kiểu huy hiệu** với capsule (đĩa đỏ, viền trắng, icon trắng) - không dùng dấu tick.
| Tag | Icon | Tránh |
|---|---|---|
| CO GIÃN 4 CHIỀU | miếng vải (vân sóng) + 4 mũi tên kéo ra 4 phía | cuộn vải nét mảnh; chỉ 4 mũi tên (giống icon "di chuyển") |
| SIZE 45 - 75KG | áo thun có chữ size (mặc định `S-XL`, đổi bằng `size_label`) | thước kẻ, quả cân "KG", cân sức khoẻ |
| ĐI CHƠI • ĐI LỄ | túi xách nữ hình thang + ngôi sao lấp lánh | mặt cười; cặp hình chữ nhật (trông như cặp công sở) |
| HÀNG CÓ SẴN (footer) | xe tải giao hàng | |
| ĐỔI TRẢ 7 NGÀY (footer) | 2 mũi tên xoay vòng, số 7 ở giữa | |

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
2. Với mỗi ảnh: đọc kích thước, xác định **tâm mặt** và **gốc crop** (vùng 1267×2000 px nguồn cho ảnh ~1800×2400; người mẫu nằm giữa vùng crop, đầu cách mép trên ~120-250px). Vẽ elip thử lên ảnh, crop xem để chỉnh toạ độ - đừng đoán mù. Xác định hộp logo nếu cần xoá.
3. Viết config JSON (định dạng trong docstring script), chạy `python3 -I shopee_thumb.py cfg.json`. Đổi `title/subtitle/tags/size_label/footer` theo sản phẩm (vd áo voan thì không ghi "THUN").
4. **Kiểm tra trước khi giao**: xem ảnh full; zoom mặt trước/sau (không viền lạ, da không sạn); xem mask người; đo lề header; chắc chắn góc dưới trái không có chữ; người mẫu không bị capsule/header che (nhất là tay giơ lên mặt).
5. Gửi file (SendUserFile), tên dạng `bia-shopee-<sp>-<mau>.jpg`; trả lời ngắn: đã làm gì, lưu ý còn lại, gợi ý 1 bước tiếp nếu có.

Nguồn ảnh nên là ảnh chụp sạch (chưa có chữ/khung). Nếu ảnh đầu vào đã là ảnh bìa có sẵn khung chữ, sửa trực tiếp trên ảnh đó (dịch khối chữ cho cân, vẽ lại icon vào đúng vòng tròn cũ bằng cách tô đĩa màu nền rồi dán icon mới) thay vì dựng lại.

## Script
Script dựng ảnh nằm trong thư mục skill: `scripts/shopee_thumb.py` (định dạng config JSON ghi ở docstring đầu file). Copy nó ra thư mục làm việc rồi chạy:
`python3 -I shopee_thumb.py cfg.json`
