---
name: shopee-banner-shop
description: Dựng banner trang trí shop Shopee theo phong cách pastel (chữ viết tay hồng + tiêu đề in hoa xanh đậm, sao lấp lánh) - mẫu "loi-ich" (Lợi ích khi mua hàng, 2-5 thẻ icon) và mẫu "ban-chay" (Top sản phẩm bán chạy, người mẫu tách nền + lưới 4 ảnh sản phẩm). Dùng khi người dùng cần banner, ảnh trang trí gian hàng, ảnh cam kết/lợi ích, ảnh top bán chạy cho shop.
---

# Banner trang trí shop Shopee

Dùng khi người dùng muốn **banner trang trí gian hàng** (Shop Decoration) kiểu như hai ảnh mẫu trong `references/`:
- `references/mau-loi-ich.webp` - "Lợi ích [Michi86] KHI MUA HÀNG" + 4 thẻ xanh có icon.
- `references/mau-ban-chay.webp` - "Top sản phẩm BÁN CHẠY" + người mẫu lớn bên trái + lưới 2×2 ảnh sản phẩm.

Không dùng cho ảnh bìa sản phẩm (dùng `shopee-anh-bia-thoi-trang`).

## Hai mẫu

Chuẩn Shopee: **tỉ lệ 2:1 - 1200×600px, tối đa 2.0 MB, JPG/JPEG/PNG**. Cả hai mẫu mặc định 1200×600; script tự giảm quality JPG nếu file vượt 2MB. Ô banner yêu cầu 1200×518 thì truyền `"height": 518` (bố cục tự co lại).

| `template` | Bố cục 1200×600 (mặc định) | Nội dung bắt buộc |
|---|---|---|
| `loi-ich` | chữ viết tay + logo shop, tiêu đề căn giữa, hàng 2-5 thẻ icon | `script`, `title`, `items` (`icon` + `label` 1-2 dòng), `brand` (tuỳ chọn) |
| `ban-chay` | người mẫu cột trái, "Top sản phẩm BÁN CHẠY" + logo shop 1 hàng, 4 ảnh sản phẩm xếp 1 hàng | `script`, `title`, `products` (đúng 4 ảnh), `hero` (tuỳ chọn), `brand` (luôn truyền logo shop) |

- Bản cao như ảnh mẫu (chỉ khi người dùng yêu cầu): `"height": 680` cho `loi-ich`, `"height": 1362` cho `ban-chay` (lưới 2×2, người mẫu lớn bên trái).
- Icon có sẵn (vẽ nét trắng): `truck` (xe tải chữ FREE - miễn phí vận chuyển), `return` (đổi trả), `gift` (quà tặng), `headset` (tư vấn), `shield` (chính hãng), `chat` (phản hồi), `star` (đánh giá), `heart` (khách quen). Icon khác: truyền đường dẫn PNG trắng nền trong suốt.

## Quy chuẩn
- **Toàn bộ chữ do người dùng đưa** (tên shop, lợi ích, tiêu đề). Không tự bịa cam kết shop không có (ví dụ "đổi trả 30 ngày", "chính hãng"). Thiếu thì hỏi 1 câu; nếu người dùng nói "giống mẫu" thì dùng đúng chữ trong mẫu và chỉ thay tên shop.
- Bố cục chữ: dòng chữ viết tay (`script`, Great Vibes, màu `accent`, viền trắng mảnh) + tiêu đề in hoa cực đậm (`title`, Be Vietnam Pro Black, màu `primary`, giãn chữ nhẹ). Mẫu `loi-ich` căn giữa, khung tên shop nằm cạnh chữ viết tay; mẫu `ban-chay` chữ viết tay lệch trái, tiêu đề lệch phải bên dưới.
- Nhãn thẻ: in hoa, Be Vietnam Pro ExtraBold, tối đa 2 dòng, mỗi dòng 1-3 từ. Script tự thu nhỏ chữ nếu dòng quá dài và báo lỗi nếu nhãn đè lên icon.
- Font nằm trong `references/fonts/` (OFL, đủ dấu tiếng Việt). Không đổi sang font hệ thống: Great Vibes là font viết tay duy nhất đã kiểm có đủ `ợ ẩ ả ỡ`; các font script trên macOS thiếu dấu → ô vuông.
- Màu mặc định = tông xanh pastel của mẫu. Đổi tông bằng `theme` (ví dụ hồng: `primary #E2457A`, `card_top #F27AA0`, `card_bottom #E2457A`, `accent #1F4FA8`, `bg_top #FFF6F8`, `bg_bottom #F9C9D7`, `sparkle #E2457A`). Luôn giữ 2 màu: một màu chủ (tiêu đề + thẻ) và một màu nhấn tương phản (chữ viết tay + tên shop).
- Xuất JPG quality 92, subsampling 4:4:4 (chữ không lem). Không ghi đè ảnh nguồn.

## Nền
- Mặc định: gradient pastel + quầng sáng trắng ở 4 góc + sao lấp lánh 4 cánh. Đủ dùng, sạch.
- Muốn nền hoa/ruy băng giống hệt mẫu: tạo ảnh nền bằng Gemini/Flow rồi truyền `background` (cover-fit). Prompt gợi ý (tỉ lệ 2:1; bản cao 1200×680 ≈ 16:9, 1200×1362 ≈ 7:8):
  > Ảnh nền banner thương mại điện tử, gradient xanh pastel nhạt (trắng xanh ở trên, xanh da trời nhạt ở dưới). Hoa cẩm tú cầu và hoa nhỏ màu xanh nhạt, trắng, mờ nhẹ, chỉ ở 4 góc và mép dưới; vài dải ruy băng lụa xanh nhạt uốn lượn ở góc trên. Toàn bộ vùng giữa trống, sạch, sáng. Không chữ, không logo, không người, không sản phẩm. Phong cách mềm mại, nữ tính, ánh sáng dịu.
- Nền có hoa thì xem kỹ ảnh cuối: hoa không được nằm dưới chữ hoặc thẻ.

## Ảnh người mẫu và sản phẩm (mẫu `ban-chay`)
- `hero`: tốt nhất là PNG đã tách nền. Ảnh thường → thêm `"hero_cutout": true` (tách bằng `u2net_human_seg.onnx`, mặc định `~/models/u2net_human_seg.onnx`, đổi bằng `model`). Người mẫu đặt sát đáy bên trái, cao 95% banner ở bản ngang (600/518) (74% ở bản cao), chỉnh bằng `hero_height`. Ảnh nguồn nên thấy từ đầu đến ít nhất ngang đùi.
- `products`: 4 ảnh, cắt cover vào khung dọc bo góc viền trắng. Mặc định giữ phần trên ảnh (`focus [0.5, 0.3]`) để không mất mặt/cổ áo; chỉnh `focus` từng ảnh nếu bị cắt mất áo.
- `"auto_center": true` (cấp job): tự tách người và căn tâm người mẫu giữa từng khung - nên bật mặc định, khi đó `box` chỉ cần giới hạn chiều dọc (ví dụ `[0, 500, 1792, 1950]` với ảnh 1792×2400). `focus` riêng của ảnh vẫn được ưu tiên.
- Cùng một bố cục dùng được cho banner khác ("Bộ sưu tập ÁO BÀ BA", "Hàng mới về"...): chỉ đổi `script`/`title` theo chữ người dùng đưa.
- Ảnh toàn thân (ví dụ 1493×2000) đưa thẳng vào khung sẽ thấy người nhỏ: thêm `"box": [l, t, r, b]` (px ảnh nguồn) để cắt lấy từ đầu tới ngang đùi trước, ví dụ `[250, 120, 1250, 1400]`.
- Chọn `hero` là ảnh tay không cầm vật mỏng (quạt) ra ngoài người: tách nền sẽ mất vật đó, để lại bàn tay nắm hụt. Ảnh đeo túi thì ổn. Tách nền hỏng (quần/váy bị khuyết do lẫn với hoa lá phía sau) thì đổi ảnh `hero` khác.
- Khung ảnh bản ngang hẹp và cao (~196×420 ở 2:1): người mẫu lệch trong ảnh nguồn thì chỉnh `focus` x (ví dụ `[0.3, 0.3]`) để không bị cắt tay/áo.
- Ảnh nguồn nhỏ hơn khung sẽ mờ: báo người dùng gửi ảnh gốc lớn hơn.

## Quy trình
1. Gom thông tin: mẫu nào, tên shop / logo, chữ viết tay, tiêu đề, các lợi ích hoặc 4 ảnh sản phẩm + ảnh người mẫu, tông màu (mặc định xanh như mẫu).
2. Chuẩn bị model (chỉ khi `hero_cutout`):
   ```bash
   mkdir -p ~/models && curl -sSL -o ~/models/u2net_human_seg.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx
   ```
3. Viết `config.json` cạnh ảnh nguồn (định dạng đầy đủ ở docstring đầu `scripts/shopee_banner.py`; đường dẫn tương đối so với file config):
   ```json
   {"brand": {"text": "Michi86"},
    "jobs": [
      {"template": "loi-ich", "out": "loi-ich.jpg", "script": "Lợi ích", "title": "KHI MUA HÀNG",
       "items": [{"icon": "truck", "label": ["MIỄN PHÍ", "VẬN CHUYỂN"]}, {"icon": "return", "label": ["ĐỔI TRẢ", "KHI LỖI"]},
                 {"icon": "gift", "label": ["QUÀ TẶNG", "VÔ VÀN"]}, {"icon": "headset", "label": ["TƯ VẤN", "NHIỆT TÌNH"]}]},
      {"template": "ban-chay", "out": "ban-chay.jpg", "script": "Top sản phẩm", "title": "BÁN CHẠY",
       "hero": "nguoi-mau.jpg", "hero_cutout": true, "products": ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]}]}
   ```
   Logo thay cho chữ tên shop: `"brand": {"logo": "logo.png"}` (PNG nền trong suốt, khung tự to hơn). Logo không có tên shop thì thêm `"text"` để xếp logo trái, chữ phải; logo đã có tên (như `logo-thao-ngoc.png` của skill `shopee-anh-bia-thoi-trang`) thì chỉ dùng logo, không lặp tên.
4. Chạy (thêm `--with onnxruntime --with opencv-python-headless` khi có `hero_cutout`):
   ```bash
   uv run --with pillow --with numpy python -I .claude/skills/shopee-banner-shop/scripts/shopee_banner.py config.json
   ```
5. **Xem ảnh cuối bằng mắt** trước khi giao: không ô vuông thay dấu; chữ không chạm mép, không đè sao/hoa; nhãn không đè icon; viền tách nền người mẫu sạch (không còn mảng nền cũ, tóc không bị cụt); mặt trong 4 ảnh sản phẩm không bị cắt. Lỗi thì chỉnh config rồi chạy lại.
6. Gửi file (SendUserFile), tên dạng `banner-<mau>-<shop>.jpg`; trả lời ngắn: đã làm gì, lưu ý còn lại.
