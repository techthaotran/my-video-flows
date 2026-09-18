# Requirement Analysis: Cửa sổ "Chạy" cho workflow (Workflow Input Window)

> Date: 2026-09-17 · Status: Đã chốt với user
> Nguồn: `docs/specs/raw-spec-workflow-input-window.md`

## 1. Context & Goal

- **Current problem:** Muốn thay nhân vật, trang phục, bối cảnh, sửa prompt rồi tạo video, user phải thao tác trên editor dạng node.
Việc này đòi hỏi hiểu node, cổng, cạnh, nên khó dùng và dễ sai.
Kết quả từng cảnh và video ghép cuối nằm rải rác trên canvas.
- **Goal:** Có một cửa sổ dạng form, sinh ra từ chính workflow, để user upload asset, sửa prompt và cấu hình chính, chạy, xem kết quả từng cảnh và video ghép cuối, tạo lại từng cảnh lỗi mà không cần mở canvas.
Cửa sổ hiển thị đầy đủ thông tin cần thiết của các node liên quan.
Thành công khi user chạy trọn một workflow tạo video (upload → sửa prompt → chạy → tạo lại cảnh lỗi → tải video cuối) mà không phải mở editor node.
- **Users involved:** User nội bộ của extension (người dựng workflow và người chỉ chạy), không phân quyền.

## 2. Scope

**In scope:**
- Nút "Tải lên" trên mỗi item workflow ở side panel, mở cửa sổ "Chạy"; nút mở editor node giữ nguyên.
- Cửa sổ "Chạy": thanh trên cùng (Chạy toàn bộ, Dừng, Mở editor node), cột trái (ô upload), cột phải trên (kết quả từng node tạo ảnh/video), cột phải dưới (video ghép cuối).
- Upload asset từ máy hoặc chọn media từ Google Flow.
- Sửa prompt (node Prompt và node tạo ảnh/video), preset Gemini, cấu hình chính của node tạo ảnh/video.
- Đổi thứ tự ghép video.
- Tạo lại từng cảnh; tự ghép lại khi đủ clip.
- Tải video ghép cuối.
- Hiển thị id, slug, trạng thái, tiến độ, lỗi của node.
- Đồng bộ hai chiều giữa cửa sổ "Chạy" và editor node.

**Out of scope:**
- Thêm, xoá node hoặc nối cạnh từ cửa sổ "Chạy".
- Sửa hoặc hiển thị cấu hình ghép (logo, audio, fps, bitrate) và cấu hình tải về tự động trong cửa sổ "Chạy".
- Hiển thị node ghi chú (note).
- Đổi loại media của ô upload.
- Nhớ kích thước, vị trí cửa sổ.
- Tự tạo lại các cảnh phía sau khi tạo lại một cảnh.
- Bản nháp tách riêng khỏi workflow.
- Cloud, chia sẻ, backend, gói/hạn mức, provider khác Flow và Gemini.

## 3. User Stories & Acceptance Criteria

### US-01: Mở cửa sổ "Chạy" từ side panel
**Là** user, **tôi muốn** mở một cửa sổ nhập liệu trực tiếp từ danh sách workflow, **để** chạy workflow mà không cần canvas.

**Acceptance criteria:**
- [ ] AC-01.1: Bối cảnh side panel có workflow, Khi nhìn vào item, Thì thấy 2 nút: mở editor node và "Tải lên".
- [ ] AC-01.2: Bối cảnh chưa mở cửa sổ "Chạy" cho workflow A, Khi bấm "Tải lên" trên A, Thì mở một cửa sổ popup 1280x800 có tiêu đề "Chạy" kèm tên workflow A.
- [ ] AC-01.3: Bối cảnh cửa sổ "Chạy" của A đang mở, Khi bấm "Tải lên" trên A lần nữa, Thì cửa sổ cũ được đưa lên trước, không mở cửa sổ mới.
- [ ] AC-01.4: Bối cảnh cửa sổ "Chạy" của A đã đóng, Khi bấm "Tải lên", Thì mở cửa sổ mới bình thường.
- [ ] AC-01.5: Bối cảnh cửa sổ "Chạy" đang mở, Khi bấm "Mở editor node", Thì editor của đúng workflow đó mở ra (hoặc được đưa lên trước nếu đã mở).

### US-02: Upload asset theo từng ô
**Là** user, **tôi muốn** thay nhân vật, trang phục, bối cảnh, audio bằng các ô upload, **để** không phải tìm node Asset trên canvas.

**Acceptance criteria:**
- [ ] AC-02.1: Bối cảnh workflow có N node Asset, Khi mở cửa sổ, Thì cột trái có đúng N ô, tên ô theo nhãn asset (Character, Outfit, Background, Video reference, Video expand, Audio voice).
- [ ] AC-02.2: Bối cảnh ô ảnh, Khi chọn một ảnh từ máy, Thì ô hiện preview mới và node Asset tương ứng nhận ảnh đó.
- [ ] AC-02.3: Bối cảnh ô bất kỳ, Khi chọn media từ Google Flow, Thì ô hiện preview media Flow, và asset đó không bị tải về hay upload lại khi chạy.
- [ ] AC-02.4: Bối cảnh ô ảnh, Khi chọn một file video hoặc audio, Thì bị từ chối với thông báo tiếng Việt, ô giữ nguyên giá trị cũ.
- [ ] AC-02.5: Bối cảnh workflow không có node Asset, Khi mở cửa sổ, Thì cột trái hiện trạng thái rỗng.
- [ ] AC-02.6: Bối cảnh file asset đã bị mất, Khi mở cửa sổ, Thì ô hiện trạng thái thiếu file để user chọn lại.

### US-03: Xem và sửa thông tin từng node tạo ảnh/video
**Là** user, **tôi muốn** thấy kết quả, trạng thái, prompt, cấu hình của từng cảnh ở cùng một chỗ, **để** chỉnh và kiểm tra nhanh.

**Acceptance criteria:**
- [ ] AC-03.1: Bối cảnh workflow có node tạo video, Khi mở cửa sổ, Thì mỗi node là một mục ở cột phải phía trên, gồm: preview kết quả gần nhất, trạng thái, id, slug, ô prompt, cấu hình chính (model, tỉ lệ khung hình, thời lượng), nút Tạo lại.
  Mỗi node tạo video cho đúng một video; cửa sổ không hiển thị và không sửa số lượng.
- [ ] AC-03.2: Bối cảnh node tạo video có node Prompt nối vào, Khi xem mục đó, Thì thấy cả nội dung của node Prompt và prompt riêng của node tạo video, sửa được cả hai.
- [ ] AC-03.3: Bối cảnh node Prompt dùng preset Gemini, Khi xem mục đó, Thì thấy preset đang chọn, đổi được preset, và thấy kết quả Gemini gần nhất.
- [ ] AC-03.4: Bối cảnh workflow chỉ có node tạo ảnh, Khi mở cửa sổ, Thì mục hiện preview ảnh thay cho video.
- [ ] AC-03.5: Bối cảnh workflow không có node tạo ảnh/video, Khi mở cửa sổ, Thì cột phải phía trên hiện trạng thái rỗng.
- [ ] AC-03.6: Bối cảnh user sửa prompt hoặc cấu hình, Khi rời ô nhập, Thì giá trị được lưu vào workflow; đóng rồi mở lại cửa sổ vẫn thấy giá trị mới.
- [ ] AC-03.7: Bối cảnh node đang bị tắt, Khi mở cửa sổ hoặc khi node bị tắt lúc cửa sổ đang mở, Thì mục hoặc ô tương ứng không xuất hiện.
- [ ] AC-03.8: Bối cảnh node bị xoá khỏi workflow, Khi cửa sổ cập nhật, Thì mục hoặc ô tương ứng không còn xuất hiện.
- [ ] AC-03.9: Bối cảnh đang gõ trong ô prompt, Khi rời ô nhập, Thì giá trị được tự lưu, không có nút Lưu.

### US-04: Chạy và dừng toàn bộ workflow
**Là** user, **tôi muốn** chạy và dừng cả workflow từ thanh trên cùng, **để** tạo toàn bộ video trong một lần bấm.

**Acceptance criteria:**
- [ ] AC-04.1: Bối cảnh không có run nào của workflow, Khi bấm Chạy toàn bộ, Thì workflow chạy toàn bộ, trạng thái và tiến độ từng mục cập nhật realtime.
- [ ] AC-04.2: Bối cảnh workflow đang chạy, Khi nhìn thanh trên cùng, Thì nút Dừng bấm được; nút Chạy toàn bộ và Tạo lại không bị khoá, yêu cầu mới đi theo cơ chế hàng đợi chạy hiện có.
- [ ] AC-04.3: Bối cảnh workflow đang chạy, Khi bấm Dừng, Thì run bị huỷ, các node đang chờ/đang chạy chuyển sang trạng thái đã huỷ, nút Chạy toàn bộ bấm lại được.
- [ ] AC-04.4: Bối cảnh một node lỗi, Khi run kết thúc, Thì mục đó hiện lỗi tiếng Việt dễ hiểu, hệ thống không tự thử lại.
- [ ] AC-04.5: Bối cảnh service worker bị Chrome tắt giữa lúc chạy, Khi cửa sổ nối lại, Thì trạng thái các node đang chạy hiện đúng, không bị treo ở trạng thái cũ.

### US-05: Tạo lại một cảnh lỗi
**Là** user, **tôi muốn** tạo lại riêng cảnh bị lỗi, **để** không tốn quota tạo lại các cảnh đã ổn.

**Acceptance criteria:**
- [ ] AC-05.1: Bối cảnh cảnh 2 lỗi, cảnh 1 và 3 đã có video, Khi bấm Tạo lại ở cảnh 2, Thì chỉ cảnh 2 được gửi lên Flow; cảnh 1 và 3 không bị tạo lại.
- [ ] AC-05.2: Bối cảnh AC-05.1, Khi cảnh 2 tạo xong, Thì video ghép tự chạy lại với video mới của cảnh 2 và video hiện có của cảnh 1, 3.
- [ ] AC-05.3: Bối cảnh cảnh 2 và cảnh 3 cùng lỗi (không có video nào), Khi tạo lại cảnh 2 thành công, Thì không tự ghép; khung video cuối hiện trạng thái đang chờ đủ clip.
- [ ] AC-05.4: Bối cảnh cảnh 3 lỗi ở lần gần nhất nhưng vẫn còn video cũ, Khi tạo lại cảnh 2 thành công, Thì vẫn tự ghép, dùng video cũ của cảnh 3.
- [ ] AC-05.5: Bối cảnh cảnh 3 dùng cảnh 2 làm cảnh trước, Khi tạo lại cảnh 2, Thì cảnh 3 giữ nguyên kết quả cũ, không bị tạo lại.
- [ ] AC-05.6: Bối cảnh node tạo ảnh/video phía trước chưa từng có kết quả, Khi bấm Tạo lại, Thì báo lỗi rõ, không tự tạo ngầm node phía trước.
- [ ] AC-05.7: Bối cảnh cửa sổ đang chạy, Khi đóng cửa sổ, Thì run vẫn tiếp tục; mở lại cửa sổ thấy đúng trạng thái và kết quả.

### US-06: Sắp xếp, xem và tải video ghép cuối
**Là** user, **tôi muốn** sắp thứ tự cảnh, xem và tải video ghép cuối, **để** có sản phẩm hoàn chỉnh.

**Acceptance criteria:**
- [ ] AC-06.1: Bối cảnh workflow có node ghép video, Khi mở cửa sổ, Thì các mục ở cột phải trên được xếp theo thứ tự ghép.
- [ ] AC-06.2: Bối cảnh có từ 2 clip, Khi bấm ↑ hoặc ↓ ở một mục, Thì thứ tự đổi ngay, được lưu vào workflow, và lần ghép sau theo thứ tự mới.
- [ ] AC-06.3: Bối cảnh đang ghép, Khi xem cột phải dưới, Thì thấy thanh tiến độ ghép.
- [ ] AC-06.4: Bối cảnh ghép xong, Khi xem cột phải dưới, Thì phát được video cuối và có nút Tải video.
- [ ] AC-06.5: Bối cảnh ghép xong, Khi bấm Tải video, Thì file mp4 được tải về máy.
- [ ] AC-06.6: Bối cảnh workflow không có node ghép video, Khi mở cửa sổ, Thì khung video cuối bị ẩn, các mục xếp theo thứ tự chạy.
- [ ] AC-06.7: Bối cảnh có node tạo video không nối vào node ghép, Khi mở cửa sổ, Thì mục đó xếp sau toàn bộ clip của node ghép, theo thứ tự chạy.
- [ ] AC-06.8: Bối cảnh một clip nối vào node ghép là asset Flow chỉ có id, Khi ghép, Thì báo lỗi rõ (asset Flow không có file), không tải về hay upload lại.

### US-07: Đồng bộ với editor và các trạng thái đặc biệt của workflow
**Là** user, **tôi muốn** cửa sổ "Chạy" và editor node luôn thấy cùng dữ liệu, **để** không bị ghi đè hoặc nhầm lẫn.

**Acceptance criteria:**
- [ ] AC-07.1: Bối cảnh editor và cửa sổ "Chạy" cùng mở một workflow, Khi sửa prompt ở cửa sổ "Chạy", Thì editor hiện giá trị mới mà không cần tải lại.
- [ ] AC-07.2: Bối cảnh AC-07.1, Khi sửa prompt, cấu hình, asset hoặc thêm/xoá node ở editor, Thì cửa sổ "Chạy" cập nhật theo (thêm/bớt ô, mục tương ứng).
- [ ] AC-07.3: Bối cảnh hai bên cùng mở, Khi mỗi bên lần lượt sửa hai field khác nhau, Thì cả hai thay đổi đều được giữ, không bên nào ghi đè mất thay đổi của bên kia.
- [ ] AC-07.4: Bối cảnh hai bên sửa cùng một field, Khi cả hai đã lưu, Thì cả hai bên hiện cùng một giá trị là giá trị đang nằm trong workflow.
- [ ] AC-07.5: Bối cảnh workflow bị khoá, Khi mở cửa sổ "Chạy", Thì mọi ô upload, prompt, cấu hình, nút ↑↓ bị khoá; Chạy toàn bộ, Dừng, Tạo lại, Tải video vẫn dùng được.
- [ ] AC-07.6: Bối cảnh cửa sổ đang mở, Khi workflow được đổi tên ở nơi khác, Thì tiêu đề cửa sổ đổi theo.
- [ ] AC-07.7: Bối cảnh cửa sổ đang mở, Khi workflow bị xoá, Thì run đang chạy của workflow bị dừng, cửa sổ hiện thông báo workflow đã bị xoá và khoá mọi thao tác; user tự đóng cửa sổ.

## 4. Business Rules

| ID | Rule | Note |
|----|------|------|
| BR-01 | Mỗi node Asset tương ứng đúng một ô upload; không có danh sách nhãn cố định. | Ô sinh theo workflow |
| BR-02 | Ô upload chỉ nhận cùng loại media (ảnh/video/audio) với node Asset hiện tại. | Không đổi loại |
| BR-03 | Asset lấy từ Google Flow không bao giờ bị tải về rồi upload lại. | Quy tắc 6 AGENTS.md |
| BR-04 | Sửa được trong cửa sổ "Chạy": asset, prompt của node Prompt, preset Gemini, prompt và cấu hình chính (model, tỉ lệ khung hình, thời lượng) của node tạo ảnh/video, thứ tự ghép. | Cấu hình khác chỉ sửa ở editor |
| BR-05 | Chỉ đọc: id, slug, trạng thái, tiến độ, lỗi, kết quả. | |
| BR-06 | Dữ liệu workflow là nguồn duy nhất: cửa sổ "Chạy", editor node và service worker đều đọc và ghi vào đó; mọi bên hiển thị theo giá trị hiện có trong workflow. | Không có bản nháp riêng; sửa trùng field thì giá trị lưu sau cùng là giá trị hiển thị |
| BR-06a | Tự lưu khi rời ô nhập, không có nút Lưu. | |
| BR-07 | Workflow bị khoá: chỉ xem và chạy (chạy toàn bộ, dừng, tạo lại, tải video). | Giống editor |
| BR-08 | Tạo lại một cảnh chỉ gửi đúng node đó lên Flow; các node tạo ảnh/video phía trước dùng lại kết quả đang hiển thị. | Không đốt quota ngoài ý muốn |
| BR-09 | Tạo lại cảnh N không tạo lại các cảnh phía sau dùng N làm cảnh trước. | Cảnh sau giữ kết quả cũ |
| BR-10 | Sau khi tạo lại thành công, tự ghép lại khi mọi clip đầu vào đều có video (kể cả video từ lần chạy cũ); thiếu thì chờ. | "Có video là đủ" |
| BR-11 | Mỗi node tạo ảnh/video trong cửa sổ tương ứng đúng một kết quả; chỉ node ghép video mới gộp nhiều video. Cửa sổ không hiển thị, không sửa số lượng. | |
| BR-12 | Thứ tự mục: theo thứ tự ghép; node không nối vào node ghép, hoặc workflow không có node ghép, thì theo thứ tự chạy và xếp sau. | |
| BR-13 | Không tự thử lại khi tạo ảnh/video lỗi; không âm thầm tạo ảnh trung gian. | Quy tắc 7 AGENTS.md |
| BR-14 | Ràng buộc model giữ nguyên: Veo nhận đúng 1 ảnh; Omni có giới hạn số ảnh tham chiếu; audio/video tham chiếu nối vào node tạo video bị báo lỗi. | Báo lỗi rõ, không cắt bớt |
| BR-14a | Nút Chạy toàn bộ và Tạo lại không bị khoá khi workflow đang chạy; yêu cầu mới đi theo hàng đợi chạy hiện có. | |
| BR-14b | Đóng cửa sổ "Chạy" không dừng run đang chạy. | |
| BR-14c | Node bị xoá khỏi workflow thì mục/ô tương ứng không còn xuất hiện. | |
| BR-14d | Node đang bị tắt (vẫn còn trong workflow) không xuất hiện trong cửa sổ "Chạy". | Q-01 |
| BR-15 | Mỗi workflow có tối đa một cửa sổ "Chạy"; mở lại thì đưa cửa sổ cũ lên trước. | |
| BR-16 | Cửa sổ "Chạy" mở kích thước 1280x800, không nhớ kích thước/vị trí. | |
| BR-17 | Tên hiển thị: nút "Tải lên", cửa sổ "Chạy"; mọi chuỗi chỉ tiếng Việt, gom một chỗ. | Quy tắc 2 AGENTS.md |
| BR-18 | Không ghi token, captcha, cookie vào log. | Quy tắc 8 AGENTS.md |

## 5. Edge Cases & Error Handling

| ID | Situation | Expected behaviour |
|----|-----------|--------------------|
| EC-01 | Chưa đăng nhập Flow / Gemini khi chạy | Mục lỗi hiện thông báo cần đăng nhập, không thử lại |
| EC-02 | Tab Flow bị mất khi chạy | Hệ thống tự phục hồi như hiện tại; vẫn hỏng thì báo lỗi tiếng Việt chỉ rõ việc cần làm |
| EC-03 | Vi phạm chính sách nội dung / hết quota | Mục lỗi hiện thông báo tương ứng, nút Tạo lại vẫn bấm được |
| EC-04 | Service worker bị tắt khi rảnh hoặc giữa lúc chạy | Cửa sổ tự nối lại, hiện đúng trạng thái đang chạy |
| EC-05 | Bấm Tạo lại khi node tạo ảnh/video phía trước chưa có kết quả | Báo lỗi rõ, không tạo ngầm |
| EC-06 | Tạo lại xong nhưng còn clip không có video | Không ghép; khung cuối hiện "đang chờ đủ clip" |
| EC-07 | Clip nối vào node ghép chỉ có id Flow, không có file | Báo lỗi asset Flow không có file |
| EC-08 | Chọn file khác loại media của ô | Từ chối, báo lỗi, giữ giá trị cũ |
| EC-09 | File asset đã bị xoá khỏi dữ liệu local | Ô hiện trạng thái thiếu file |
| EC-10 | Editor thêm/xoá node Asset hoặc node tạo ảnh/video khi cửa sổ đang mở | Cửa sổ thêm/bớt ô, mục tương ứng |
| EC-11 | Hai bên sửa cùng một field gần như đồng thời | Cả hai bên hiện theo giá trị đang nằm trong workflow (giá trị lưu sau cùng) |
| EC-12 | Workflow bị khoá trong lúc cửa sổ đang mở | Các ô sửa bị khoá ngay |
| EC-13 | Workflow bị xoá trong lúc cửa sổ đang mở | Dừng run, hiện thông báo, khoá mọi thao tác |
| EC-14 | Bấm Chạy toàn bộ hoặc Tạo lại khi workflow đang chạy | Nút không bị khoá; yêu cầu đi theo hàng đợi chạy hiện có |
| EC-15 | Workflow có node chưa hỗ trợ (unknown) hoặc node cũ chưa nâng cấp | Không hiện trong cửa sổ, không làm lỗi màn hình |
| EC-16 | Đóng cửa sổ khi đang chạy | Run vẫn tiếp tục ở nền; mở lại cửa sổ thấy đúng trạng thái |

## 6. Impact on the Existing System

- **Current business flow:** User bấm tên workflow ở side panel → mở editor node → tìm từng node Asset để thay file → sửa prompt trên node → bấm Generate / chạy → xem kết quả trên từng node → mở node Merge để sắp thứ tự, ghép, tải video.
- **Related code areas:**
  - `src/features/sidepanel/SidePanelApp.tsx:43` - mở editor từ item workflow; nơi thêm nút "Tải lên".
  - `src/background/index.ts:231` - mở editor dạng popup 1280x800 và đưa cửa sổ cũ lên trước; hành vi cần có tương tự cho cửa sổ "Chạy".
  - `src/features/editor/EditorApp.tsx:126` - editor đọc workflow một lần lúc mở, giữ trạng thái trong bộ nhớ và lưu nháp; hiện chưa nhận thay đổi từ nơi khác.
  - `src/features/editor/store.ts` - trạng thái editor, gồm cờ khoá.
  - `src/engine/RunManager.ts:158` - các chế độ chạy (toàn bộ, một node, chỉ node này, từ node này).
  - `src/engine/RunManager.ts:488` - service worker ghi kết quả hiển thị gần nhất của node vào workflow.
  - `src/engine/executors.ts:400` - xếp clip theo thứ tự ghép.
  - `src/engine/executors.ts:418` - kiểm tra clip thiếu file trước khi ghép.
  - `src/features/editor/nodes/MergeVideoBody.tsx` - giao diện sắp thứ tự, tiến độ, player, tải video hiện có.
  - `src/features/editor/FlowAssetPicker.tsx` - chọn media từ Google Flow.
  - `src/features/editor/nodes/useMediaUrl.ts` - hook preview media dùng chung (có bẫy đã ghi trong `docs/WORKFLOW.md`).
  - `src/shared/messaging/index.ts` - danh sách message; message mở editor hiện chưa được khai báo ở đây.
- **Data to persist (business level):**
  - Asset, prompt, preset, cấu hình chính, thứ tự ghép do user sửa: lưu vào chính workflow.
  - Kết quả hiển thị gần nhất của từng node: như hiện tại.
  - Không cần lưu thêm thông tin mới nào cho cửa sổ (không nhớ kích thước/vị trí).
- **Constraints & risks:**
  - Đồng bộ hai chiều cần editor nhận thay đổi từ bên ngoài; hiện editor có undo/redo và bản nháp riêng, dễ ghi đè thay đổi của cửa sổ "Chạy" nếu không xử lý.
  - Service worker cũng ghi vào workflow khi chạy xong, là nguồn ghi thứ ba cần tính tới.
  - Workflow cũ và file import phải vẫn mở được trong cửa sổ "Chạy".
  - Tự ghép lại chạy WebCodecs trên máy, mất vài phút CPU với video dài.
  - Message mở editor chưa khai báo trong danh sách message (lệch quy tắc 4 AGENTS.md), nên chỉnh khi thêm message mở cửa sổ "Chạy".

## 7. Assumptions

- Không còn giả định chưa xác nhận; GD-01 đến GD-06 đã được user chốt và chuyển thành BR-06, BR-06a, BR-11, BR-14a, BR-14b, BR-14c.

## 8. Open Questions

- Không còn câu hỏi mở. Q-01 (node bị tắt) đã chốt thành BR-14d.
