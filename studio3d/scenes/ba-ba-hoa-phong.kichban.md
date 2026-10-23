# Kịch bản: Áo bà ba hoa - lookbook phòng gỗ (1 clip x 8 giây)

- Độ dài: 8 giây, khung dọc 9:16, một clip quay liền không cắt.
- Dùng cho: video bán hàng Shopee/TikTok, lookbook.
- Tham khảo nhịp máy từ video lookbook sườn xám (tilt chân lên, bước, vén rèm), đổi thành áo bà ba + quần trắng.
- Cảnh 3D: `studio3d/scenes/ba-ba-hoa-phong.json` (mở `pnpm studio3d`, chọn `ba-ba-hoa-phong.json`).
- Ảnh người mẫu chung với video vườn: `output/áo-bà-ba-đỏ-cam/7.jpg` → `studio3d/public/refs/ba-ba-hoa-phong-model.jpg` (cùng file với `ba-ba-hoa-vuon-model.jpg`).
- Ảnh bối cảnh: `studio3d/public/refs/ba-ba-hoa-phong.jpg`.
- Mọi clip phải cùng khuôn mặt [Model]; không generic face khác ảnh.
- Workflow: export previz "Theo shots" (tắt nhãn nhân vật) rồi `pnpm studio3d:flow studio3d/scenes/ba-ba-hoa-phong.json --previz <mp4>`.

## Nhân vật và sản phẩm

Cùng một người mẫu với `ba-ba-hoa-vuon`.
Người mẫu hư cấu do AI, không nhận diện người nổi tiếng.
Mặt oval, da sáng hồng hào, tóc đen dài sóng ngôi giữa phủ vai, lông mày đậm, mắt hạnh nhân, môi đầy, trang điểm nhẹ.
Áo bà ba cách tân, cổ tim, tay dài, chiết eo.
Thân áo ombre cam đỏ ở ngực chuyển xuống xanh ngọc ở tà.
Họa tiết hoa mẫu đơn hồng, tím nhạt, trắng.
Hàng nút ngọc trai giữa thân trước.
Dáng ngực đầy, áo ôm vừa phần ngực, hàng nút nằm phẳng.
Quần ống rộng trắng.
Giày cao gót mũi nhọn bạc.
Không nón lá, không túi, không sườn xám.

Bối cảnh: phòng gỗ ấm, đèn bàn, hoa đào, rèm voan trắng.

## Clip 1 - Tilt lên rồi bước qua rèm (0-8s, ống 35mm)

| Thời gian | Hành động | Máy quay | Chữ trên màn hình |
|---|---|---|---|
| 0-2,5s | Bước chậm trên sàn gỗ bóng | Cận giày và gấu quần, tilt lên toàn thân | ÁO BÀ BA HOA |
| 2,5-5s | Đi khoảng 1m về phía máy, dừng, hai tay chạm nhẹ ngang eo | Toàn thân, lùi theo giữ trọn người | Cổ tim · ôm ngực |
| 5-8s | Bước qua khe rèm trắng, một tay vén rèm | Đẩy vào khung từ eo trở lên, thấy ngực, cổ tim, hàng nút | [Giá] · Bấm giỏ hàng |

Lời thoại: "Áo bà ba hoa ombre, cổ tim, ôm ngực tôn dáng, phối quần trắng ống rộng đi chơi là xinh."

Ghi chú:
- `[Giá]` để trống.
- Chữ trên màn hình thêm trong CapCut.
- Previz ma-nơ-canh không làm được dáng ngực; phần này nằm trong prompt Flow.

## Prompt cho Google Flow

Prompt gốc nằm trong `shots[].prompt` của `ba-ba-hoa-phong.json`.
