---
name: studio3d-scene
description: Dựng cảnh 3D mô hình trắng cho Studio 3D (pnpm studio3d) từ một ảnh bối cảnh hoặc một ý tưởng - ước lượng phòng, tường, đồ vật thành các khối, đặt camera khớp góc chụp, rồi viết kịch bản (nhân vật di chuyển, nhiều góc máy, cắt cảnh) thành file studio3d/scenes/*.json. Dùng khi người dùng gửi ảnh bối cảnh và muốn dựng cảnh 3D, làm video tham khảo chuyển động/góc máy, previz, hoặc nhờ sửa một cảnh Studio 3D.
---

# Dựng cảnh Studio 3D từ ảnh

Kết quả là một file `studio3d/scenes/<slug>.json` hợp lệ.
Người dùng mở `pnpm studio3d`, xem, duyệt rồi tự export mp4.
Schema chuẩn: `src/studio3d/schema.ts`.
Tổng quan: `docs/STUDIO3D.md`.

## Quy ước toạ độ (bắt buộc)

- Đơn vị mét, trục Y hướng lên, sàn ở `y = 0`.
- Camera chụp ảnh gốc (id `photo`) nhìn về phía **-Z**.
  Trong ảnh: bên trái = -X, bên phải = +X, càng sâu vào trong ảnh = càng âm Z.
- Gốc toạ độ `[0, 0, 0]` đặt trên sàn, ở giữa khu vực chính của bối cảnh.
- `yaw` tính bằng độ quanh trục Y; nhân vật `yaw: 0` nhìn về +Z (tức là nhìn về phía camera `photo`).
- Khối `pos` là **tâm mặt đáy**, `size` là `[rộng X, cao Y, sâu Z]`.

## Quy trình

### 1. Chuẩn bị ảnh

1. Chép ảnh vào `studio3d/public/refs/<slug>.<đuôi>` (thư mục này không commit).
2. Đọc kích thước ảnh: `sips -g pixelWidth -g pixelHeight <ảnh>`.
3. Đặt `size` của cảnh cùng tỉ lệ với ảnh, cạnh dài 1280, cả hai số chẵn (ví dụ 4:3 thành 1280x960, 9:16 thành 720x1280).
   Lệch tỉ lệ thì ảnh gốc lồng lên sẽ không khớp khối.

### 2. Đọc ảnh, ước lượng kích thước thật

Xem ảnh và ghi ra (trong suy nghĩ, không cần ghi file):

- Loại không gian: phòng, hành lang, phố, sân...
- Các mặt lớn: sàn, tường trái/phải/sau, trần (thường bỏ), cột, cửa, bậc thang.
- Đồ vật lớn: bàn, ghế, tủ, quầy, giường, xe... Bỏ qua đồ lặt vặt nhỏ hơn khoảng 30cm.
- Thước đo từ vật quen thuộc:
  cửa đi cao 2,1m rộng 0,9m; trần nhà ở 2,7-3,2m (sảnh lớn 4-8m); mặt bàn 0,75m; mặt ghế 0,45m; quầy bar 1,1m; người 1,7m; ô gạch lát 0,6m; bậc thang cao 0,17m.
- Đường hội tụ (mép tường, mép sàn, gạch lát) cho biết hướng các bức tường.
  Tường song song với mép ảnh thì `yaw: 0`; tường chạy sâu vào ảnh thì là khối hẹp X, dài Z.

### 3. Ước lượng camera chụp ảnh (`photo`)

- Độ cao: ảnh chụp ngang tầm mắt thì 1,5-1,6m; chụp từ trên cao thì cao hơn.
- Đường chân trời (nơi các đường hội tụ gặp nhau) nằm giữa ảnh thì máy để thẳng: `lookAt` cùng độ cao với `pos`.
  Đường chân trời cao hơn giữa ảnh thì máy chúc xuống, và ngược lại.
- Tiêu cự: điện thoại thường 24-26mm, góc rộng 13-16mm, ảnh chân dung 50-85mm.
  Dùng `focal` (mm), không dùng `fov`.
- Đặt `pos` của `photo` ở `+Z`, cách khu vực chính đủ xa để thấy hết những gì ảnh thấy.
- Khai báo `"reference": { "image": "refs/<slug>.<đuôi>", "camera": "photo", "opacity": 0.5 }`.

### 4. Dựng khối bối cảnh (`environment.blocks`)

- Mỗi khối có `id` ngắn và `label` tiếng Việt (ví dụ `"id": "wall-left", "label": "Tường trái"`).
- Tường là khối mỏng dày 0,15-0,2m, cao tới trần.
  Tường sau đặt ở Z âm xa nhất; tường bên đặt ở X âm/dương.
- Không cần khối sàn: `ground: true` đã có sàn.
- Cột tròn dùng `"shape": "cylinder"` với `size[0]` là đường kính.
- Thường 10-60 khối là đủ.
  Ưu tiên đúng tỉ lệ và khoảng cách của vật lớn hơn là nhiều chi tiết.
- Chừa lối đi cho nhân vật: không đặt khối chắn đường đi đã định.
- Không đặt `color` khi `style` là `clay` (mô hình trắng tự tô xám).

### 5. Kịch bản: nhân vật, máy quay, cắt cảnh

- Nhân vật dùng model trong `studio3d/public/models/manifest.json` (`kind: "character"`), đặt `label` như "Nhân vật 1".
- Di chuyển là thêm key `{ t, pos }`; nhân vật tự quay theo hướng đi, tự chọn clip `walk`/`idle`.
  Giữ quãng đi ngắn (vài bước, khoảng 1m mỗi shot) để nhân vật luôn nằm gọn trong khung của các góc máy; đi xa thì dễ ra khỏi khung hoặc quá sát máy.
  Đổi động tác bằng `clip` (`wave`, `run`...) ở key bắt đầu động tác.
- Luôn giữ camera `photo` (khớp ảnh gốc) và thêm các góc phục vụ kịch bản, ví dụ:
  - `wide`: toàn cảnh, đứng yên hoặc dolly chậm, 24-35mm.
  - `follow`: bám theo nhân vật, key camera trùng thời điểm với key nhân vật, `lookAt` vào ngực nhân vật (y khoảng 1,3).
  - `close`: cận mặt, 50-85mm.
- `shots` chọn camera lên hình theo thời gian.
  Mỗi shot nên dài 2-5 giây và có `note` một câu mô tả việc xảy ra trong shot (hiện trong danh sách kịch bản để người dùng duyệt).
- `notes` của cảnh chỉ ghi giả định và số ước lượng (tiêu cự, độ cao máy, kích thước phòng), không lặp lại mô tả shot.

### 6. Workflow Google Flow (khi người dùng muốn tạo video bằng Flow)

Làm trọn quy trình tạo video theo skill `tao-video` (`.claude/skills/tao-video/SKILL.md`).
Phần thuộc file cảnh:

- Thêm khối `flow` vào cảnh: `character` (ảnh người mẫu dưới `studio3d/public/`), `characterPrompt` bắt đầu bằng `[Character]:` (tả người mẫu và trang phục thật chi tiết), `common` (giữ nguyên trang phục, bối cảnh, ánh sáng), `model: "Omni Flash"`.
- Mỗi shot thêm `prompt`: diễn biến và máy quay (ống kính, hướng máy chạy), dùng `[Character]`.
  Mỗi shot là một clip Flow 4-10 giây, quay liền không cắt, một camera; kịch bản ngắn thì gộp thành ít shot dài (ví dụ 2 x 8 giây).
- Sau khi người dùng duyệt và export previz "Theo shots" (tắt nhãn nhân vật): `pnpm studio3d:flow studio3d/scenes/<slug>.json --previz <mp4>`.

### 7. Kiểm tra và tự sửa

1. Chạy `pnpm studio3d:check studio3d/scenes/<slug>.json`.
   Sửa hết `LỖI`.
   `CẢNH BÁO` đi xuyên khối thì đổi đường đi hoặc dời khối.
2. Đọc dòng tóm tắt kích thước: phòng ở nhà mà rộng hơn 15m, hay trần cao 10m, là đang sai tỉ lệ.
3. Nếu có trình duyệt (Claude Code desktop: preview `studio3d`): mở cảnh, chọn góc `photo`, bật "Lồng ảnh gốc", chụp màn hình, so mép tường/đồ vật với ảnh rồi chỉnh `pos`/`size` hoặc camera `photo`.
   Lặp 2-3 vòng.
   Không có trình duyệt thì nhờ người dùng mở và nhận xét.
4. Mở góc "Sơ đồ từ trên" (phím `P`) để soát vị trí máy quay so với nhân vật và bối cảnh.
   Nhắc người dùng gửi kèm "sơ đồ máy quay (PNG)" cùng video khi đưa cho AI video.
5. Báo cho người dùng: tên file, các shot, chỗ nào còn đoán (ví dụ "chiều sâu phòng ước lượng 8m").

## Không làm

- Không sửa `src/studio3d/*` để "chiều" một cảnh; cảnh phải đúng schema hiện có.
- Không export mp4 khi người dùng chưa duyệt cảnh; đã duyệt và người dùng bảo thì AI export theo skill `tao-video` bước 5.
- Không commit ảnh trong `studio3d/public/refs/`.
