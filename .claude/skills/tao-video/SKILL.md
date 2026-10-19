---
name: tao-video
description: Làm video thời trang (Shopee/TikTok, lookbook) từ ảnh bối cảnh hoặc ý tưởng và ảnh người mẫu, theo quy trình chuẩn của repo - viết kịch bản chia clip 4-10 giây, dựng previz 3D mô hình trắng trong Studio 3D, export, xuất workflow Google Flow kèm previz từng clip (Omni chỉnh sửa video theo chuyển động và góc máy), rồi hướng dẫn chạy và soát kết quả. Dùng khi người dùng nói "tạo video", "làm video quảng cáo/bán hàng", "video cho áo này", "làm tiếp video cảnh X", hoặc muốn AI video theo đúng chuyển động/góc máy.
---

# Tạo video thời trang qua Studio 3D + Google Flow

Quy trình đầy đủ, quy tắc và sự cố đã gặp: `docs/STUDIO3D.md` (đọc mục "Quy trình chuẩn" trước khi làm).
Chi tiết phía Flow: `docs/providers/flow.md`, mục "Video reference".
Ví dụ hoàn chỉnh: `studio3d/scenes/cafe-street.json` + `studio3d/scenes/cafe-street.kichban.md`.

Kết quả cuối của skill: file `studio3d/flows/<slug>.xflow.zip` có previz từng clip, và người dùng biết chính xác bước bấm tiếp theo.

## 1. Thu đầu vào

Cần đủ trước khi làm (thiếu thì hỏi một lần, gộp các câu hỏi):

- Ảnh bối cảnh, hoặc mô tả ý tưởng bối cảnh.
- Ảnh người mẫu mặc sản phẩm (sẽ là `[Model]`).
  Ưu tiên ảnh đã gen bằng Flow/Gemini hoặc ảnh lookbook; ảnh người thật có thể nhận diện dễ bị Flow chặn (lọc người nổi tiếng).
- Sản phẩm: tên, màu, chất liệu, chi tiết cần khoe (nút, cổ, tà...).
  Không bịa chất liệu hay giá; để `[Giá]` nếu chưa có.
- Nền tảng và độ dài (mặc định: dọc 9:16, 2 clip x 8 giây = 16 giây).

Chép ảnh vào `studio3d/public/refs/<slug>.<đuôi>` (bối cảnh) và `studio3d/public/refs/<slug>-model.<đuôi>` (người mẫu).
`slug` ngắn, không dấu, gạch nối (ví dụ `cafe-street`).

## 2. Kịch bản

Viết `studio3d/scenes/<slug>.kichban.md` theo mẫu `cafe-street.kichban.md`: nhân vật và sản phẩm, mỗi clip một bảng (thời gian, hành động, máy quay, chữ trên màn hình), lời thoại, prompt cho Flow.

- Mỗi clip 4-10 giây, **một cảnh quay liền không cắt**, một camera.
  Omni chỉ nhận tối đa 10 giây previz.
- Mỗi clip một động tác chính và một đường máy rõ (đẩy vào, lùi theo, đi vòng, nâng máy).
- Nhân vật đi ngắn (khoảng 1m mỗi clip) để luôn nằm gọn trong khung.
- Chữ trên màn hình và lời thoại chỉ để người dùng làm trong CapCut, không đưa vào prompt Flow.

Cho người dùng xem tóm tắt kịch bản (mỗi clip một dòng) trước khi dựng 3D.

## 3. Dựng cảnh 3D

Làm theo skill `studio3d-scene` (đọc `.claude/skills/studio3d-scene/SKILL.md`), với các điều bắt buộc sau cho video Flow:

- `size` 720x1280 cho video dọc (hoặc theo tỉ lệ ảnh bối cảnh khi chỉ cần previz ngang).
- Mỗi clip của kịch bản là đúng một `shot` (`t` = giây bắt đầu clip), camera riêng cho shot đó.
- Mỗi shot có `note` (một câu) và `prompt`: diễn biến + máy quay, dùng `[Model]`, tả đúng như previz.
- Khối `flow`: `character` = ảnh người mẫu ở bước 1, `characterPrompt` bắt đầu bằng `[Model]:` (người mẫu + trang phục thật chi tiết), `common` (giữ nguyên trang phục; bối cảnh; ánh sáng), `model: "Omni Flash"`, `resolution: 720`.

Chạy `pnpm studio3d:check studio3d/scenes/<slug>.json`, sửa hết `LỖI`, xử lý `CẢNH BÁO` đi xuyên khối.

## 4. Người dùng duyệt previz

Báo người dùng mở http://localhost:5002 (chưa chạy thì `pnpm studio3d`), chọn `<slug>.json`, xem từng shot.
Sửa JSON theo nhận xét, chạy lại check, lặp tới khi người dùng ưng.

## 5. Export previz

Người dùng tự export, hoặc AI làm qua trình duyệt khi người dùng bảo:

1. Mục "Hiển thị": **bỏ tick "Nhãn nhân vật"**.
2. Mục "Góc máy": chọn thẻ **"Theo shots"** (dòng "Xuất theo" dưới nút Export phải ghi "Theo shots").
3. Tick "Tôi đã duyệt cảnh này" (chỉ khi người dùng đã duyệt ở bước 4).
4. Bấm "Export mp4", chờ dòng "Đã export xong".
5. File ở `~/Downloads/<slug>.mp4`; trùng tên thì là `<slug> (1).mp4` - lấy file mới nhất: `ls -t ~/Downloads/<slug>*.mp4 | head -1`.

## 6. Xuất workflow Flow

```bash
pnpm studio3d:flow studio3d/scenes/<slug>.json --previz "<đường dẫn mp4 vừa export>"
```

- Script tự kiểm độ dài previz khớp cảnh và cắt từng shot; lỗi "previz dài Xs nhưng cảnh dài Ys" nghĩa là export sai góc hoặc sai cảnh - quay lại bước 5.
- Cần `ffmpeg`; thiếu thì báo người dùng `brew install ffmpeg`.
- Kết quả: `studio3d/flows/<slug>.xflow.zip`.

## 7. Người dùng chạy trên extension

AI không mở được trang extension, nên báo người dùng đúng các bước:

1. Chỉ để **một** tab `flow.google.com`, đúng project muốn dùng, đã đăng nhập.
2. Vừa cập nhật code extension thì reload extension ở `chrome://extensions` và reload tab Flow.
3. Side panel → Import `studio3d/flows/<slug>.xflow.zip`.
4. Bấm Generate trên từng node clip (mỗi clip Omni 720p khoảng 20 credit; hỏi trước khi bảo chạy hàng loạt).
5. Ưng hết thì bấm Ghép video; chữ và lời thoại thêm trong CapCut.

## 8. Soát kết quả

- Node báo lỗi: đối chiếu bảng "Sự cố đã gặp" trong `docs/STUDIO3D.md`.
  Không tự bảo chạy lại khi chưa sửa nguyên nhân.
- Clip ra: so với previz cùng shot (dáng, hướng đi, đường máy, khung cuối).
  Lệch nhiều thì sửa `prompt` của shot (nói rõ hơn đường máy) hoặc chỉnh previz, xuất lại workflow, chỉ Generate lại clip đó.
- Clip ngắn hơn shot: kiểm tra extension đã reload bản mới (đọc fps thật của previz).

## Không làm

- Không gửi Flow ảnh hay video người thật không phải người mẫu của shop.
- Không đưa chữ trên màn hình, giá, lời thoại vào prompt Flow.
- Không commit ảnh trong `studio3d/public/refs/` hay file trong `studio3d/flows/`.
- Không bấm Generate hay tiêu credit Flow khi người dùng chưa đồng ý.
