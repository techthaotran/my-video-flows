---
name: shopee-dong-dau-logo
description: Đóng dấu logo shop (logo "tn" vòng tròn) lên một hoặc nhiều ảnh - mặc định góc dưới bên phải, logo đen trên nền trắng bo góc, không ghi đè ảnh gốc. Dùng khi người dùng muốn thêm logo vào hình, chèn watermark, đóng dấu logo cho ảnh sản phẩm/người mẫu.
---

# Đóng dấu logo lên ảnh

Dùng khi người dùng gửi ảnh và muốn **thêm logo shop vào hình** (ảnh sản phẩm, ảnh người mẫu, ảnh chi tiết vải...).

## Logo
- Logo mặc định: `references/logo-tn.png` (chữ "tn" trong vòng tròn, đen, nền trong suốt, 642×676).
- Muốn dùng logo khác: đặt PNG nền trong suốt vào `references/` rồi truyền `logo_file`. Từ logo nền trắng, tách nền bằng cách lấy độ tối làm alpha (alpha = (235 - độ sáng) / 215).

## Mặc định
- Vị trí: **góc dưới bên phải**, rộng 11% chiều rộng ảnh, lề 3%.
- **Logo đen trên nền trắng bo góc** (`badge`, mặc định bật): lề trong 16%, bo góc 22% bề ngang logo, nền trắng đục 95%, bóng đổ rất nhẹ. Tắt bằng `"badge": false` (khi đó màu logo `auto`: nền tối (độ sáng TB < 120) thì logo trắng, ngược lại đen). Kiểu `center` không có nền.
- Lưu vào folder con `logo/` bên trong folder của ảnh khi người dùng đóng dấu cả folder. Không đóng dấu ảnh bìa và ảnh trung gian.
- Xuất JPG quality 92, subsampling 4:4:4. Không bao giờ ghi đè file gốc (mặc định ra thư mục `out/`, tên `<tên>_logo.jpg`).

## Quy trình
1. Hỏi 1 câu nếu chưa rõ: có đổi vị trí / cỡ logo không (mặc định giữ nguyên, không hỏi nếu người dùng không nhắc).
2. Ghi `config.json` (đường dẫn tương đối so với file config):
```json
{
  "position": "bottom-right",
  "size_pct": 11,
  "jobs": [{"src": "a.jpg"}, {"src": "b.png", "position": "top-left"}]
}
```
   Các khoá: `position` (bottom-right | bottom-left | top-right | top-left | center), `size_pct`, `margin_pct`, `opacity`, `color` (auto | black | white), `badge` (true | false), `badge_pad_pct`, `badge_radius_pct`, `badge_opacity`, `out_dir`, `quality`, `logo_file`; mỗi job ghi đè được mọi khoá và có thêm `out`. `center` mặc định mờ 25%, rộng 40%.
3. Chạy: `uv run --with pillow --with numpy python -I scripts/stamp_logo.py config.json`.
4. **Mở ảnh kết quả xem bằng mắt**: logo không che mặt, tay, chữ hay thẻ giá; đủ nét, đủ tương phản. Nếu đè lên vật quan trọng thì đổi `position` hoặc `size_pct` rồi chạy lại.

## Lưu ý
- Ảnh bìa Shopee 1:1: **góc dưới bên TRÁI phải để trống** (nhãn Shop Yêu Thích / Mall / Giảm giá / Freeship), nên giữ logo ở góc dưới phải hoặc trên. Không dùng `bottom-left` cho ảnh bìa.
- Ảnh bìa dựng bằng skill `shopee-anh-bia-thoi-trang` đã có logo shop trong thẻ trắng, không đóng dấu thêm trừ khi người dùng yêu cầu.
- Chỉ đóng dấu logo của chính shop người dùng.
