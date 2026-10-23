# Studio 3D và quy trình tạo video

Studio 3D là công cụ dev (chạy bằng `pnpm studio3d`, port 5002) để AI dựng cảnh 3D mô hình trắng (previz), người dùng duyệt rồi export mp4.
Previz này là tham chiếu chuyển động và góc máy: Google Flow (Omni) nhận từng đoạn previz làm video đầu vào và vẽ lại thành người mẫu, trang phục, bối cảnh thật.
Studio 3D không nằm trong extension, không gọi Flow/Gemini, không có backend.

Muốn AI làm trọn từ đầu tới cuối: dùng skill `.claude/skills/tao-video/SKILL.md`.
Riêng bước dựng cảnh 3D từ ảnh: skill `.claude/skills/studio3d-scene/SKILL.md`.

## Quy trình chuẩn

| # | Bước | Ai làm | Kết quả |
|---|---|---|---|
| 1 | Nhận đầu vào: ảnh bối cảnh (hoặc ý tưởng), ảnh người mẫu mặc sản phẩm, mô tả sản phẩm, nền tảng (Shopee/TikTok), độ dài | Người dùng | Ảnh chép vào `studio3d/public/refs/` |
| 2 | Viết kịch bản: chia thành clip 4-10 giây, mỗi clip một cảnh quay liền | AI | `studio3d/scenes/<slug>.kichban.md` |
| 3 | Dựng cảnh 3D + camera + shot + khối `flow` | AI (skill `studio3d-scene`) | `studio3d/scenes/<slug>.json` |
| 4 | Kiểm cảnh | AI | `pnpm studio3d:check studio3d/scenes/<slug>.json` không còn `LỖI` |
| 5 | Xem và duyệt previz | Người dùng | Tick "Tôi đã duyệt cảnh này" |
| 6 | Export previz cả cảnh | Người dùng, hoặc AI khi được bảo | `~/Downloads/<slug>.mp4` |
| 7 | Xuất workflow kèm previz | AI | `pnpm studio3d:flow studio3d/scenes/<slug>.json --previz <mp4>` → `studio3d/flows/<slug>.xflow.zip` |
| 8 | Import zip, bấm Generate từng clip | Người dùng (AI không mở được trang extension) | Clip Omni theo đúng previz |
| 9 | Duyệt clip, tạo lại clip hỏng, Ghép video | Người dùng, AI soát giúp | Video cuối; chữ và lời thoại thêm trong CapCut |

### Quy tắc bắt buộc

- **Mỗi shot là một clip Flow, dài 4-10 giây, quay liền không cắt.**
  Omni chỉ nhận tối đa 10 giây video đầu vào, và một đường máy liên tục cho kết quả tốt hơn nhiều lần cắt trong cùng clip.
  Kịch bản ngắn thì gộp thành ít shot dài (ví dụ 2 x 8 giây).
- **Export previz ở góc "Theo shots" cho cả cảnh, tắt "Nhãn nhân vật".**
  Script cắt file theo thời gian của từng shot, nên file phải dài đúng bằng cảnh và mỗi đoạn phải là camera của shot đó.
  Nhãn trên đầu nhân vật lọt vào previz thì Omni có thể vẽ lại cả chữ.
- **Model của khối `flow` phải là Omni Flash** khi có previz: chỉ Omni nhận video tham chiếu (chỉnh sửa video `jIps6` / `abra_edit`).
  Clip ra dài đúng bằng đoạn previz, không theo thời lượng của node.
- **Ảnh `[Model]` nên là ảnh người mẫu đã qua Flow/AI** (ảnh gen, ảnh lookbook), tránh ảnh người thật có thể nhận diện.
  Flow chặn với lỗi lọc người nổi tiếng (`PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED`) khi video hoặc ảnh tham chiếu là người thật; previz ma-nơ-canh thì không bị.
- **Không tự retry khi Flow lỗi**: đọc lỗi trên node, sửa prompt hoặc ảnh rồi mới bấm lại.
  Mỗi clip Omni 720p khoảng 20 credit.

### Sự cố đã gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Upload video lên Flow thất bại: Could not establish connection` | Tab Flow mất content script sau khi reload extension | Extension tự inject lại; vẫn lỗi thì reload tab `flow.google.com` |
| Node treo ở bước upload video | Tab Flow mở từ trước bản cập nhật, content script cũ không biết lệnh upload | Extension báo lỗi sau 3 phút; reload tab Flow rồi chạy lại |
| Chạy nhầm project | Có nhiều tab Flow mở | Chỉ để một tab Flow, đúng project cần dùng |
| Clip ra ngắn hơn previz | Đoạn previz đếm sai số khung | Đã sửa: extension đọc fps thật của clip (Studio 3D export 30 fps) |
| "Google Flow từ chối vì… lọc người nổi tiếng" | Video hoặc ảnh tham chiếu là người thật | Dùng previz ma-nơ-canh và ảnh `[Model]` do AI tạo |

## Dùng Studio 3D

1. `pnpm studio3d` rồi mở http://localhost:5002 (đang chạy sẵn thì chỉ cần mở trang).
2. Chọn file cảnh ở ô trên cùng bên phải.
3. Xem trước:
   - Timeline dưới khung xem chia màu theo từng shot; bấm hoặc kéo để tua.
   - Phím tắt: phím cách phát/dừng, mũi tên trái/phải đi từng khung, `0` xem theo shots, `1`-`9` chọn camera.
   - Mục "Góc máy": mỗi camera một thẻ có ảnh xem trước chạy trực tiếp và tiêu cự mm; thẻ đang lên hình có nhãn đỏ.
     Bấm thẻ để xem qua góc đó (cũng là góc sẽ export); dòng "Xuất theo" dưới nút Export cho biết góc đang chọn.
   - Mục "Kịch bản": danh sách shot (camera, thời gian, `note`); bấm để nhảy tới shot.
   - Thẻ "Sơ đồ từ trên" (phím `P`): nhìn thẳng từ trên xuống, thấy mọi máy quay (thân máy, khung nhìn theo đúng tiêu cự và tỉ lệ khung, nhãn "tên · mm"), quỹ đạo máy, đường đi nhân vật (mũi tên ở điểm cuối) và tên các khối bối cảnh; khối treo cao (mái hiên...) được ẩn để không che.
   - Mục "Hiển thị": nhãn nhân vật (có trong video export, tắt trước khi export previz), máy quay và đường đi (không vào video export trừ khi xuất từ góc sơ đồ), camera tự do, lồng ảnh gốc (kèm thanh độ mờ).
4. Muốn sửa thì nhờ agent sửa file JSON (Vite tự tải lại trang).
5. Tick "Tôi đã duyệt cảnh này" thì nút Export mp4 mới sáng lên.
   Mỗi lần tải lại cảnh, dấu duyệt tự bỏ.

## Định dạng cảnh

Schema đầy đủ: `src/studio3d/schema.ts`. Ví dụ: `studio3d/scenes/demo.json`, `studio3d/scenes/cafe-street.json` (kèm kịch bản `cafe-street.kichban.md`).
Đơn vị là mét, trục Y hướng lên, góc tính bằng độ, `yaw: 0` là nhìn về +Z.
Quy ước đặt toạ độ khi dựng từ ảnh: xem skill `studio3d-scene`.

- `style`: `clay` (mặc định, mô hình trắng: khối xám có viền, nhân vật xanh, ánh sáng đều) hoặc `color` (màu theo manifest).
- `environment.blocks[]`: khối tĩnh của bối cảnh `{ id?, label?, shape: box | cylinder | sphere, pos, size, yaw?, color? }`.
  `pos` là tâm mặt đáy, `size` là `[rộng X, cao Y, sâu Z]`.
- `reference`: `{ image, camera?, opacity }` - ảnh bối cảnh gốc dưới `studio3d/public/` (thường là `refs/...`, thư mục không commit) và camera tái tạo góc chụp.
- `actors[]`: nhân vật hoặc vật thể. `model` là id trong manifest, `label` là nhãn hiện trên đầu.
  `keys[]` là các mốc `{ t, pos, clip?, ease? }`, tăng dần theo `t`.
  Nhân vật tự quay theo hướng đi.
  `clip` bỏ trống thì tự chọn `walk` khi đang đi, `idle` khi đứng; ma-nơ-canh khối còn có `wave` và `sit` (ngồi, chân duỗi trước).
- `cameras[]`: nhiều góc camera, mỗi góc `{ id, label?, focal?, fov?, keys[] }` với key `{ t, pos, lookAt, focal?, fov?, ease? }`.
  `focal` là tiêu cự tương đương full-frame (mm), ưu tiên hơn `fov`, và được nội suy theo mm.
  Khung dọc (9:16) tính theo cạnh cảm biến 36mm cho khớp cách hiểu tiêu cự của điện thoại.
  `ease` đặt ở key đích, áp cho đoạn đi tới key đó (`linear`, `easeIn`, `easeOut`, `easeInOut`).
  File cũ chỉ có `camera` (một góc) vẫn đọc được, tự thành camera `main`.
- `shots[]`: danh sách cắt cảnh `{ t, camera, note?, prompt? }`, từ `t` trở đi dùng camera đó.
  `note` là mô tả ngắn hiện trong mục Kịch bản; `prompt` là diễn biến và máy quay gửi Flow (có `[Model]`).
  Bỏ trống thì dùng camera đầu tiên suốt cảnh.
- `flow`: thiết lập xuất workflow Flow, xem mục dưới.
- `notes`: ghi chú chung của cảnh (giả định, số ước lượng), hiện trong mục "Ghi chú cảnh" thu gọn.

Di chuyển nhân vật hay camera đều là thêm key mới.

## Kiểm tra cảnh (`pnpm studio3d:check [file...]`)

Không truyền file thì kiểm mọi file trong `studio3d/scenes/`.
`LỖI` (thoát mã 1): JSON hỏng, sai schema, id trùng, keys không tăng dần, model/camera không tồn tại, thiếu ảnh reference; có khối `flow` thì thêm thiếu prompt, thiếu `[Model]`, thiếu ảnh người mẫu, shot dài quá 10 giây.
`CẢNH BÁO`: nhân vật đi xuyên khối cao từ 0,2m trở lên (thảm, bậc thấp được bỏ qua).
Cuối mỗi file in tóm tắt kích thước bối cảnh để soát tỉ lệ.
Logic nằm ở `src/studio3d/analysis.ts`.

## Thư viện model (`studio3d/public/models/manifest.json`)

Mỗi entry: `{ id, kind: character | prop, file?, height?, clips?, fallback? }`.

- Có `file` (đường dẫn .glb tính từ `studio3d/public/models/`): dùng model thật.
  Model được scale theo `height` và đặt chân chạm đất.
  `clips` ánh xạ tên clip dùng trong cảnh (`walk`, `idle`...) sang tên clip thật trong file glb.
  Ở `style: clay`, vật liệu của model bị thay bằng màu mô hình trắng.
- Không có `file`, hoặc tải lỗi: dùng hình khối thay thế (`fallback`: `humanoid`, `box`, `cylinder`, `sphere`).
  Cảnh vẫn chạy và UI hiện cảnh báo.

Hiện manifest chỉ có hình khối thay thế.
Để dùng model đẹp, bỏ file .glb có rig vào `studio3d/public/models/` rồi thêm `file` và `clips` cho entry tương ứng.
Chỉ dùng model có giấy phép phù hợp.

## Export mp4

Export theo góc đang chọn ở mục "Góc máy": "Theo shots" cho bản dựng đầy đủ (dùng làm previz cho Flow), hoặc một camera để xuất riêng một góc.
Render từng khung ở thời gian cố định (`t = i / fps`, mặc định 30 fps), chép sang canvas 2D rồi encode mp4 bằng mediabunny (WebCodecs) ngay trên trang.
Preview và export dùng chung `Stage.seek(t)` nên ra cùng khung hình.
Ảnh gốc lồng lên chỉ để căn chỉnh, không vào video.
Tên file tải về lấy theo tên file cảnh (ví dụ `cafe-street.mp4`; trùng tên thì Chrome thêm ` (1)`).

"Tải sơ đồ máy quay (PNG)" xuất sơ đồ từ trên ở thời điểm đang xem (1600x1200), kèm chú thích từng máy: tên, tiêu cự, thời điểm lên hình.
Dùng khi đưa previz cho một AI video khác không nhận video đầu vào.
Chưa có audio.

## Xuất workflow Google Flow (`pnpm studio3d:flow <file cảnh> [--previz <mp4>]`)

Đóng gói cảnh thành `studio3d/flows/<slug>.xflow.zip` (không commit vì chứa ảnh cá nhân).
Import trong side panel của extension là có ngay ảnh người mẫu, previz từng clip, prompt và các node nối sẵn, chỉ còn bấm Generate.

- Cảnh cần khối `flow`: `character` (ảnh người mẫu dưới `studio3d/public/`), `characterPrompt` (bắt đầu bằng `[Model]:`), `common` (các dòng chung: giữ trang phục, bối cảnh, ánh sáng), `model` (mặc định Omni Flash), `resolution`.
- Mỗi shot là một clip Flow và cần `prompt` (diễn biến + máy quay, có `[Model]`).
  Shot dài quá 10 giây bị báo lỗi.
- `--previz <mp4>`: file export "Theo shots" của cả cảnh.
  Script kiểm độ dài khớp cảnh (lệch tối đa 0,15 giây), cắt từng shot bằng `ffmpeg` (encode lại để cắt đúng khung, bỏ tiếng) rồi gắn mỗi đoạn làm Asset `Video reference` nối thẳng vào Generate Video của clip đó.
  Cần `ffmpeg` (`brew install ffmpeg`) và `flow.model` là Omni.
- Prompt gửi Flow = dòng tiêu đề tự sinh (tỉ lệ, thời lượng) + (có previz: hai dòng dẫn "dùng `[Video reference]` làm tham chiếu chuyển động và góc máy, thay ma-nơ-canh bằng `[Model]`") + `prompt` của shot + `common` + `characterPrompt`.
- `--audio <mp3|m4a|wav>`: file nhạc đã tách sẵn. Node ghép tự nạp (Asset Audio voice, thay tiếng clip).
- Workflow: Asset Model -> Prompt -> Generate Video cho từng clip (+ Asset previz -> Generate Video), rồi Merge Video -> Auto Download; `retry: 0`.
- Không có previz: bố cục và góc máy chỉ đi qua chữ trong prompt (Omni dùng ảnh tham chiếu `MZZa6b`).
- Logic ở `src/studio3d/flowWorkflow.ts` (có test import thật qua `parseImportFile`/`commitImport`), cắt previz ở `scripts/studio3d-flow.ts`.
- Không đặt file workflow trong `studio3d/scenes/`: Studio đọc mọi `*.json` ở đó như file cảnh.
- Chi tiết phía Flow (RPC `jIps6`, upload video, giới hạn): `docs/providers/flow.md`, mục "Video reference".

## Việc chưa làm

- Export previz từng shot ngay trong Studio (hiện export cả cảnh rồi script cắt).
- Chỉnh tay trong Studio: cây cảnh, gizmo kéo thả, timeline thêm/xoá key, ghi ngược ra JSON.
- Lưới độ sâu từ ảnh (Depth Anything) làm lớp tham khảo khi căn khối.
- Hoạt ảnh cho prop, vật thể gắn vào tay nhân vật.
- Model GLB thật (cần người dùng cung cấp).
