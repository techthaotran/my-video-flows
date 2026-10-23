# Kịch bản: Áo bà ba hoa - ngồi xuồng kênh dừa (2 clip x 8 giây)

- Độ dài: 16 giây, khung dọc 9:16, gồm 2 clip 8 giây.
- Mỗi clip là một cảnh quay liền, không cắt, để Google Flow tạo trong một lần.
- Dùng cho: video bán hàng Shopee/TikTok, và bản lookbook (xem cuối file).
- Cảnh 3D tham khảo: `studio3d/scenes/ba-ba-hoa-xuong.json` (mở `pnpm studio3d`, chọn `ba-ba-hoa-xuong.json`).
- Ảnh tham chiếu: `studio3d/public/refs/ba-ba-hoa-xuong.jpg` (bối cảnh), `studio3d/public/refs/ba-ba-hoa-xuong-model.jpg` (người mẫu).
- Workflow Google Flow: export previz "Theo shots" (tắt nhãn nhân vật) rồi chạy `pnpm studio3d:flow studio3d/scenes/ba-ba-hoa-xuong.json --previz <mp4>` để ra `studio3d/flows/ba-ba-hoa-xuong.xflow.zip` (có sẵn ảnh người mẫu và previz từng clip), import trong side panel rồi bấm Generate.
  Quy trình đầy đủ: skill `tao-video`, `docs/STUDIO3D.md`.

## Nhân vật và sản phẩm

Người mẫu nữ trẻ người Việt, tóc đen dài sóng nhẹ xõa vai, trang điểm nhẹ, vẻ mặt dịu.
Áo bà ba cách tân, cổ tim, tay dài, chiết eo.
Thân áo ombre cam đỏ ở ngực chuyển dần xuống xanh ngọc ở tà.
Họa tiết hoa mẫu đơn hồng, tím nhạt, trắng và cánh hoa rơi.
Hàng nút tròn nhỏ màu ngọc trai chạy giữa thân trước.
Quần ống rộng trắng.
Đội nón lá Việt Nam.
Không đeo túi.
Bối cảnh: kênh dừa nước miền Tây, xuồng gỗ đang trôi chậm, tàu dừa vòm trên đầu, ánh nắng lọt qua kẽ lá.

## Clip 1 - Chạm nón lá (0-8s, ống 35mm, máy trên xuồng đối diện)

| Thời gian | Hành động | Máy quay | Chữ trên màn hình |
|---|---|---|---|
| 0-2,5s | Ngồi trên mũi xuồng đang trôi, nhìn máy, hai tay đặt nhẹ | Toàn thân, thấy xuồng và vòm dừa | ÁO BÀ BA HOA |
| 2,5-5,5s | Tay phải nâng lên, nghiêng chạm vành nón lá | Đẩy vào chậm, giữ trọn người | Cổ tim · ombre cam - xanh |
| 5,5-8s | Giữ tay trên vành nón, nhìn máy | Đẩy vào khung nửa người, thấy nón, cổ tim, hoa áo | Nút ngọc · chiết eo |

Lời thoại: "Cuối tuần đi kênh dừa, mặc áo bà ba hoa cho mát mà vẫn xinh. Cổ tim, hàng nút ngọc, màu cam đổ xuống xanh ngọc rất dịu."

## Clip 2 - Xuồng trôi trong hầm dừa (8-16s, ống 50mm)

| Thời gian | Hành động | Máy quay | Chữ trên màn hình |
|---|---|---|---|
| 8-11s | Ngồi yên trên xuồng đang lướt, tay vẫn chạm nón, gió làm tà áo khẽ bay | Đi vòng từ phía trước sang trái, ngang ngực | Họa tiết hoa mẫu đơn |
| 11-14s | Quay mặt nhìn sang bờ dừa đang lướt qua, rồi nhìn lại máy | Lùi ra nhẹ, thấy hầm dừa và mặt nước | Đi chơi miền Tây |
| 14-16s | Mỉm cười, tay hạ xuống vành nón một chút nhưng vẫn chạm | Đẩy vào khoe thân áo và hàng nút | [Giá] · Bấm giỏ hàng |

Lời thoại: "Phối quần trắng ống rộng, đội nón lá, ngồi xuồng cũng nổi bật. Bấm giỏ hàng chọn size ngay nhé!"

Ghi chú:
- Lời thoại khoảng 65 âm tiết cho 16 giây, đọc nhịp vừa, vui.
- `[Giá]` để trống, điền giá thật khi dựng.
  Kịch bản không ghi chất liệu vải vì chưa có thông tin.
- Chữ trên màn hình thêm trong CapCut (extension không chèn chữ).
  Đặt chữ ở 1/3 trên hoặc dưới khung, tránh che mặt, nón lá và hàng nút áo.
- Người mẫu trong ảnh lookbook không đội nón và có túi kem: video này đội nón lá, không đeo túi cho khớp bối cảnh xuồng.

## Prompt cho Google Flow

Prompt gốc nằm trong `shots[].prompt` của `ba-ba-hoa-xuong.json`; khi xuất workflow, prompt được ghép thêm dòng tiêu đề, phần chung và mô tả nhân vật trong khối `flow`.
Sửa prompt thì sửa trong file cảnh rồi chạy lại `pnpm studio3d:flow`.

**Clip 1**

```
Phong cách lookbook thời trang, footage stock generic.
Diễn biến: [Model] ngồi trên mũi xuồng gỗ đang trôi chậm trên kênh dừa nước; đầu clip nhìn máy, hai tay đặt nhẹ; rồi tay phải nâng lên, nghiêng chạm vành nón lá; cuối clip giữ tay trên vành nón, nhìn máy.
Máy quay: ống 35mm, ngang ngực, đặt trên xuồng đối diện. Đầu clip thấy trọn người, xuồng và vòm dừa; đẩy vào chậm; cuối clip khung từ thắt lưng trở lên, thấy rõ nón lá, cổ tim, hoa áo và hàng nút.
Xuồng lướt về phía máy, mặt nước gợn nhẹ, tàu dừa hai bên lướt ra sau.
```

**Clip 2**

```
Phong cách lookbook thời trang, footage stock generic.
Diễn biến: [Model] vẫn ngồi trên xuồng đang lướt trong hầm dừa; tay phải chạm vành nón lá; nhìn sang bờ dừa đang trôi qua rồi nhìn lại máy, mỉm cười; cuối clip tay hạ nhẹ trên vành nón nhưng vẫn chạm.
Máy quay: ống 50mm. Máy đi vòng mượt từ phía trước sang bên trái ở ngang ngực, rồi lùi ra thấy hầm dừa và mặt nước; cuối clip đẩy vào khoe thân áo hoa, chiết eo và hàng nút ngọc.
Xuồng tiếp tục trôi chậm, ánh nắng lọt qua kẽ lá, tà áo khẽ bay.
```

## Bản lookbook

- Bỏ lời thoại, dùng nhạc nền nhẹ (acoustic hoặc nhạc miền Tây nhẹ).
- Chỉ giữ chữ tên mẫu ở đầu clip 1, bỏ chữ `[Giá] · Bấm giỏ hàng`.
- Cuối clip 2 có thể đổi "mỉm cười" thành "nhìn ra xa theo hướng xuồng đang đi" trong prompt.
