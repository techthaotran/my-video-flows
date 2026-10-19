# Kịch bản: Áo bà ba chấm bi - quán cà phê vỉa hè (2 clip x 8 giây)

- Độ dài: 16 giây, khung dọc 9:16, gồm 2 clip 8 giây.
- Mỗi clip là một cảnh quay liền, không cắt, để Google Flow tạo trong một lần.
- Dùng cho: video bán hàng Shopee/TikTok, và bản lookbook (xem cuối file).
- Cảnh 3D tham khảo: `studio3d/scenes/cafe-street.json` (mở `pnpm studio3d`, chọn `cafe-street.json`).
- Ảnh tham chiếu: `studio3d/public/refs/cafe-street.jpg`.
- Workflow Google Flow: export previz "Theo shots" (tắt nhãn nhân vật) rồi chạy `pnpm studio3d:flow studio3d/scenes/cafe-street.json --previz <mp4>` để ra `studio3d/flows/cafe-street.xflow.zip` (có sẵn ảnh người mẫu và previz từng clip), import trong side panel rồi bấm Generate.
  Quy trình đầy đủ: skill `tao-video`, `docs/STUDIO3D.md`.

## Nhân vật và sản phẩm

Người mẫu nữ trẻ người Việt, tóc đen dài thẳng, trang điểm nhẹ, cười tươi.
Áo bà ba cách tân màu hồng chấm bi trắng, cổ tim, tay dài raglan, hàng nút ngọc trai phía trước, chiết eo, xẻ tà hai bên.
Quần đen ống rộng, chất mềm rủ.
Giày cao gót quai trong, đế gỗ, tay cầm quạt gỗ.
Bối cảnh: vỉa hè lát đá trước quán cà phê, ghế mây và bàn tròn mặt đá, mái hiên, cây xanh, ánh sáng ban ngày dịu.

## Clip 1 - Bước tới (0-8s, ống 50mm, máy ngang hông)

| Thời gian | Hành động | Máy quay | Chữ trên màn hình |
|---|---|---|---|
| 0-2,5s | Đứng tạo dáng, vén tóc, cười | Toàn thân, đẩy vào chậm | ÁO BÀ BA CHẤM BI |
| 2,5-5s | Bước 2-3 bước (khoảng 1m) về phía máy rồi dừng | Lùi theo, giữ trọn người | Phom ôm eo, tôn dáng |
| 5-8s | Đứng yên, tay chạm nhẹ hàng nút | Đẩy vào tới khung nửa người, thấy cổ tim và nút ngọc | Cổ tim · nút ngọc trai |

Lời thoại: "Cuối tuần đi cà phê, mặc gì cho xinh? Áo bà ba cách tân chấm bi, ôm eo tôn dáng, cổ tim với hàng nút ngọc thật duyên."

## Clip 2 - Vòng quanh (8-16s, ống 35mm)

| Thời gian | Hành động | Máy quay | Chữ trên màn hình |
|---|---|---|---|
| 8-11s | Đứng nghiêng nhẹ, tà áo và ống quần lay động | Đi vòng từ phía trước sang bên phải, ngang hông | Xẻ tà · quần ống rộng |
| 11-14s | Đi khoảng 1m về phía bàn ghế mây rồi quay lại nhìn máy | Lùi ra, nâng lên ngang tầm mắt, thấy cả hiên quán | Đi chơi · đi làm · dạo phố |
| 14-16s | Cười, vẫy tay chào | Đẩy vào nhẹ về phía người mẫu | [Giá] · Bấm giỏ hàng |

Lời thoại: "Phối quần ống rộng, đi chơi, đi làm hay dạo phố đều hợp. Bấm giỏ hàng chọn màu ngay nhé!"

Ghi chú:
- Lời thoại khoảng 65 âm tiết cho 16 giây, đọc nhịp vừa, vui.
- `[Giá]` để trống, điền giá thật khi dựng.
  Kịch bản không ghi chất liệu vải vì chưa có thông tin.
- Chữ trên màn hình thêm trong CapCut (extension không chèn chữ).
  Đặt chữ ở 1/3 trên hoặc dưới khung, tránh che mặt và vùng nút áo.

## Prompt cho Google Flow

Prompt gốc nằm trong `shots[].prompt` của `cafe-street.json`; khi xuất workflow, prompt được ghép thêm dòng tiêu đề, phần chung và mô tả nhân vật trong khối `flow`.
Sửa prompt thì sửa trong file cảnh rồi chạy lại `pnpm studio3d:flow`.

**Clip 1**

```
Video dọc 9:16 dài 8 giây, một cảnh quay liền không cắt, phong cách thời trang thực tế.
Diễn biến: [Model] đứng trên vỉa hè, vén tóc ra sau tai và mỉm cười nhìn máy; sau đó bước 2-3 bước thong thả về phía máy rồi dừng lại; cuối clip đứng yên, đầu ngón tay chạm nhẹ hàng nút ngọc trên áo.
Máy quay: ống 50mm, ngang hông. Đầu clip đẩy vào chậm; khi người mẫu bước tới thì máy lùi theo, luôn thấy trọn người; cuối clip máy đẩy vào tới khung từ thắt lưng trở lên, thấy rõ cổ tim, hàng nút ngọc và chấm bi.
```

**Clip 2**

```
Video dọc 9:16 dài 8 giây, một cảnh quay liền không cắt, phong cách thời trang thực tế.
Diễn biến: [Model] đứng nghiêng nhẹ, gió làm tà áo xẻ và ống quần rộng lay động; sau đó đi khoảng một mét về phía dãy ghế mây và bàn tròn, quay lại nhìn máy, cười tươi và vẫy tay chào.
Máy quay: ống 35mm. Máy đi vòng mượt từ phía trước sang bên phải người mẫu ở ngang hông, rồi lùi ra và nâng lên ngang tầm mắt để thấy cả hiên quán, ghế mây, cây xanh; cuối clip đẩy vào nhẹ về phía người mẫu đang vẫy tay.
```

## Bản lookbook

- Bỏ lời thoại, dùng nhạc nền nhẹ (acoustic hoặc lo-fi).
- Chỉ giữ chữ tên mẫu ở đầu clip 1, bỏ chữ `[Giá] · Bấm giỏ hàng`.
- Cuối clip 2 có thể đổi "vẫy tay chào" thành "cười, nhìn ra xa" trong prompt.
