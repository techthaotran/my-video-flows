# Raw Spec: Cửa sổ nhập liệu workflow (Workflow Input Window)

> Status: Draft | Author: Claude (BA Agent) | Date: 2026-09-17

## 1. Overview

- **Vấn đề:** Editor dạng node đòi hỏi user hiểu node, port, cạnh.
Người chỉ muốn thay nhân vật, trang phục, bối cảnh, sửa prompt rồi tạo video phải thao tác trên canvas, khó dùng và dễ sai.
- **Mục tiêu:** Cung cấp một cửa sổ nhập liệu dạng form, sinh ra từ chính workflow, cho phép upload asset, sửa prompt và cấu hình chính, xem kết quả từng node và video ghép cuối, tạo lại từng video lỗi.
Cửa sổ phải hiển thị đầy đủ thông tin liên quan tới các node trong workflow.
- **Phạm vi liên quan:** Side panel tab Workflow (`src/features/sidepanel/SidePanelApp.tsx`), editor (`src/features/editor/`), engine run (`RunManager`, run mode `only`), node `asset`, `prompt`, `generateImage`, `generateVideo`, `mergeVideo`, `autoDownload`.
Tuân thủ phạm vi đã chốt trong `AGENTS.md`: chỉ tab Workflow, provider `flow` | `gemini`, lưu local, UI tiếng Việt qua `strings.ts`.

## 2. Actors

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| User nội bộ | Người dùng extension, có thể là người dựng workflow hoặc chỉ người chạy | Mở cửa sổ nhập liệu, upload/chọn asset, sửa prompt và cấu hình chính, chạy, tạo lại video, mở editor node |
| Service Worker (hệ thống) | `RunManager` chạy node, stream sự kiện `run-events` | Chạy generate qua Flow RPC, ghép video offscreen, cập nhật trạng thái/preview |

Không phân quyền theo vai trò (extension nội bộ, một người dùng / một máy).

## 3. Main Flow (Happy Path)

1. Trong side panel, mỗi item workflow có 2 nút:
   - **Nút 1:** mở editor dạng node (giữ hành vi hiện tại).
   - **Nút 2 (mới) "Tải lên":** mở một cửa sổ nhập liệu tên "Chạy" (window popup, kích thước mặc định) cho workflow đó.
2. Cửa sổ nhập liệu đọc workflow từ IndexedDB và dựng giao diện hai cột.
   Trên cùng có nút **Chạy toàn bộ workflow** và nút **Dừng** (huỷ run đang chạy).
3. **Cột trái - ô upload:** mỗi node `asset` trong workflow là một ô, tên ô theo `assetLabel` (Character, Outfit, Background, Video reference, Video expand, Audio voice...).
   User chọn file local hoặc chọn media từ Google Flow (dùng lại `FlowAssetPicker`).
4. **Cột phải - phần trên:** danh sách preview video của từng node generate, sắp theo thứ tự ghép (`order` của node `mergeVideo`).
   Mỗi item có: preview, trạng thái chạy, id và slug node (read-only), ô sửa prompt, cấu hình chính (model, tỉ lệ, thời lượng, số lượng), nút tạo lại video.
   Ô prompt: hiện **cả hai** khi có, gồm `instruction` của node Prompt nối vào và field `prompt` của chính node generate.
   Node Prompt dùng preset Gemini (khác `custom`): hiện thêm preset và output Gemini.
   User đổi được thứ tự video (nút ↑↓ như `MergeVideoBody`), ghi vào `order` của node Merge.
5. **Cột phải - phần dưới:** preview video cuối cùng sau khi ghép (output của node `mergeVideo`), kèm tiến độ ghép và nút **Tải video**.
6. User bấm Chạy toàn bộ; trạng thái và preview cập nhật realtime qua kênh `run-events`.
   Bấm Dừng thì huỷ run (`run.cancel` / `workflow.cancel`).
7. Một video bị lỗi → user sửa prompt (nếu cần) và bấm **Tạo lại** ở item đó.
   Hệ thống chỉ generate lại node đó (run mode `only`, không tạo lại clip khác).
   Khi mọi clip đầu vào của Merge đều đã có kết quả thì **tự chạy lại node Merge** để cập nhật video cuối; còn clip lỗi / chưa có kết quả thì chờ, không ghép.
8. Cửa sổ có nút **Mở editor node** để chuyển sang sửa workflow dạng node.
9. Kết quả: user có video ghép cuối cùng hiển thị ở phần dưới; nếu workflow có `autoDownload` thì tải về như hiện tại.

## 4. Alternate Flows / Exceptions

- **Workflow không có node `mergeVideo`:** vẫn mở được cửa sổ, ẩn khung video cuối.
- **Workflow không có `generateVideo` nhưng có `generateImage`:** vẫn mở, phần trên preview ảnh thay cho video.
- **Workflow không có node `asset`:** cột trái hiển thị trạng thái rỗng (không có ô upload).
- **Generate lỗi (vd `CONTENT_POLICY`, `AUTH_REQUIRED`, `QUOTA_EXCEEDED`, `TAB_LOST`):** item hiện trạng thái lỗi kèm thông báo tiếng Việt dễ hiểu, nút Tạo lại vẫn bấm được.
Không tự retry (quy tắc 7).
- **Tạo lại khi node generate phía trước chưa từng chạy:** báo lỗi rõ như hành vi run mode `only` hiện tại, không generate ngầm.
- **Tạo lại một clip trong khi clip khác vẫn lỗi / chưa có kết quả:** Merge không tự chạy, chờ đủ clip; khung video cuối hiện trạng thái đang chờ.
- **Asset Flow chỉ có `flowMediaId` nối vào Merge:** lỗi `FLOW_ASSET_NO_UPLOAD`, không tải về / upload lại (quy tắc 6).
- **File khác loại media của ô:** `kind` suy ra bằng `mediaKindOf`; ô không cho đổi loại (ô ảnh chỉ nhận ảnh, ô video chỉ nhận video, ô audio chỉ nhận audio), chọn sai loại thì báo lỗi và giữ giá trị cũ.
- **Service worker bị tắt khi rảnh:** kênh `run-events` tự nối lại, nhận `replayActiveStatuses()` để UI không treo.
- **Workflow đang mở đồng thời ở editor node:** dữ liệu dùng chung; thay đổi ở một bên phải hiện ở bên kia.
- **Workflow bị khoá (`locked`):** xem Open Questions.
- **Workflow bị đổi tên / xoá trong lúc cửa sổ đang mở:** cửa sổ cập nhật theo (đổi tên thì tiêu đề đổi theo; xoá thì cửa sổ phản ánh việc workflow không còn, cách hiển thị cụ thể xem Open Questions).

## 5. Business Rules

- Mỗi node `asset` tương ứng đúng một ô upload; ô tự sinh theo node, không có danh sách label cố định.
- Nguồn asset: file local hoặc media Google Flow, giống node Asset hiện tại.
- Thứ tự preview video ở phần trên theo `orderedClipIds` của node `mergeVideo` (node chưa có trong `order` xếp sau cùng).
Workflow không có Merge: thứ tự do dev đề xuất (xem Open Questions).
- Sửa được: prompt (node Prompt và node generate) + cấu hình chính của node generate (model, `aspectRatio`, `durationSec`, `count`) + thứ tự ghép (`order` của Merge).
Các thông số khác (Merge: logo, audio, fps, bitrate; Auto Download: thư mục, tên file...) chỉ sửa trong editor node.
- Thông tin read-only hiển thị cho mỗi node: id, slug.
- Ô upload không cho đổi loại media (`kind`) của node Asset.
- Merge chỉ tự chạy lại khi mọi clip đầu vào đã có kết quả.
- Cửa sổ mở với kích thước mặc định.
- Mọi thay đổi **lưu thẳng vào workflow** (cùng dữ liệu với editor node), không có bản nháp tách riêng.
- Tạo lại một video = run mode `only` trên node generate đó, các generate phía trước dùng lại `previewOutputId`; sau khi thành công và đủ clip thì tự chạy lại node `mergeVideo` (Merge chỉ ghép, không tạo lại clip khác).
- Không tự retry lỗi generate; không fallback tạo ảnh trung gian.
- Flow generate đi qua RPC, không click DOM.
- Mọi chuỗi hiển thị qua `src/shared/strings.ts`, chỉ tiếng Việt.
- Không log token/captcha/cookie.
- Giới hạn model/ảnh giữ nguyên như engine: Veo chỉ nhận đúng 1 ảnh, Omni tối đa `OMNI_MAX_REFS` ảnh, audio/video reference nối vào Generate Video báo lỗi `refKindUnsupported`.

## 6. Data Requirements

| Thực thể | Thuộc tính chính | Nguồn | Ghi chú |
|---|---|---|---|
| Workflow | `id`, `name`, `nodes`, `edges`, `settings`, `locked` | IndexedDB (`db.workflows`) | Nguồn sự thật duy nhất, dùng chung với editor |
| Node `asset` → ô upload | `assetLabel`, `kind`, `source`, `assetId`, `flowMediaId`, `flowPreviewUrl`, `originalName`, `missing` | User chọn (local / Flow) | Không re-upload asset Flow |
| Node `prompt` → ô prompt | `instruction`, `preset`, `outputFormat`, `continueFrameAssetId`, output Gemini | User nhập + output run | Hiện cùng field `prompt` của node generate khi có cả hai |
| Node `generateVideo` / `generateImage` → item preview | `prompt`, `model`, `aspectRatio`, `durationSec`, `count`, `resolution`, `previewOutputId` | User nhập + output run | `durationSec` Omni: 4/6/8/10 |
| Node `mergeVideo` → video cuối | `order`, `previewOutputId`, tiến độ ghép | User sắp xếp + output run (offscreen) | Sửa được `order`; cấu hình khác sửa ở editor |
| Mọi node hiển thị | `id`, `slug` | Workflow | Read-only |
| Trạng thái chạy | `node.status`, `node.progress`, `node.output`, `run.done`, lỗi | Port `run-events` | Không lưu mới, đọc realtime |
| Output / Asset blob | `assets` table | IndexedDB | Preview qua `useMediaUrl` |

- Không có thay đổi shape dữ liệu đã lưu dự kiến; nếu phát sinh (vd lưu trạng thái cửa sổ) phải tăng `SCHEMA_VERSION` và thêm migrate.
- Message mới (vd mở cửa sổ nhập liệu, tạo lại + ghép lại) phải khai báo trong union ở `src/shared/messaging/index.ts` trước.

## 7. Integrations & Dependencies

- **Service Worker / RunManager:** chạy workflow, run mode `only`, chạy lại node Merge.
- **Google Flow (RPC):** generate ảnh/video; `listFlowMedia` / `signFlowMedia` cho chọn asset Flow.
- **Gemini (DOM driver):** node Prompt có preset khác `custom`.
- **Offscreen document (WebCodecs):** ghép video (`composeVideoInOffscreen`).
- **Chrome APIs:** `chrome.windows.create` (mở cửa sổ popup), `chrome.downloads`.
- **Component tái sử dụng:** `FlowAssetPicker`, `useMediaUrl`, `NodeVideoPlayer`, `MergeVideoBody` (tham khảo).

## 8. Non-Functional Requirements

- **Performance:** preview cập nhật theo `previewOutputId` + `previewRev`, không nạp lại theo trạng thái chạy; revoke object URL sau khi URL mới đã set.
Chưa có con số latency cụ thể (xem Open Questions).
- **Security:** không log token/captcha/cookie; dữ liệu chỉ lưu local.
- **Độ bền:** kênh `run-events` tự nối lại khi SW MV3 bị tắt.
- **Khác:** Chrome extension MV3, UI tiếng Việt, dark theme theo design hiện có (Tailwind + shadcn/ui, accent xanh lime).

## 9. Scope

- **In scope:**
  - Nút "Tải lên" mở cửa sổ "Chạy" trên item workflow ở side panel (bên cạnh nút mở editor node).
  - Nút Chạy toàn bộ và nút Dừng ở trên cùng cửa sổ.
  - Cửa sổ nhập liệu: cột trái ô upload theo node Asset; cột phải preview từng node (trên) và video ghép cuối (dưới) kèm nút Tải video.
  - Sửa prompt (node Prompt và node generate, kể cả preset Gemini) và cấu hình chính của node generate, lưu thẳng vào workflow.
  - Đổi thứ tự ghép video.
  - Hiển thị id, slug của node.
  - Nút tạo lại từng video, tự ghép lại khi đủ clip.
  - Nút mở editor node từ cửa sổ nhập liệu.
  - Hiển thị trạng thái, tiến độ, lỗi của từng node.
- **Out of scope:**
  - Thêm/xoá node hoặc nối cạnh từ cửa sổ nhập liệu (làm ở editor node).
  - Sửa cấu hình Merge (logo, audio, fps...) và Auto Download trong cửa sổ này.
  - Hiển thị cấu hình Merge / Auto Download và node `note` trong cửa sổ này.
  - Đổi loại media của ô upload.
  - Nhớ kích thước / vị trí cửa sổ.
  - Bản nháp / input tạm không ghi vào workflow.
  - Cloud, chia sẻ, backend, gói/hạn mức, provider khác `flow` | `gemini`.

## 10. Acceptance Criteria

- [ ] Mỗi item workflow trong side panel có 2 nút: mở editor node và "Tải lên" (mở cửa sổ "Chạy").
- [ ] Trên cùng cửa sổ có nút Chạy toàn bộ và Dừng; bấm Dừng thì run bị huỷ và trạng thái node cập nhật.
- [ ] Mỗi node hiển thị đúng id và slug.
- [ ] Generate có node Prompt nối vào → hiện cả `instruction` của Prompt và `prompt` của generate; Prompt có preset Gemini → hiện preset và output Gemini.
- [ ] Chọn file khác loại media của ô → bị từ chối, node Asset giữ giá trị cũ.
- [ ] Đổi thứ tự video bằng ↑↓ → `order` của Merge cập nhật, lần ghép sau theo thứ tự mới.
- [ ] Nút Tải video tải về video ghép cuối.
- [ ] Đổi tên workflow ở nơi khác → tiêu đề cửa sổ đổi theo.
- [ ] Workflow có N node `asset` → cột trái hiện đúng N ô, tên theo `assetLabel`.
- [ ] Mỗi ô chọn được file local và chọn được media từ Google Flow; chọn xong node Asset tương ứng trong editor thấy cùng giá trị.
- [ ] Phần trên cột phải liệt kê preview các node generate theo đúng thứ tự `order` của Merge.
- [ ] Phần dưới cột phải hiện video ghép cuối cùng khi Merge chạy xong; workflow không có Merge thì khung này ẩn.
- [ ] Sửa prompt / model / tỉ lệ / thời lượng / số lượng → lưu vào workflow, mở editor node thấy giá trị mới.
- [ ] Bấm Tạo lại ở một item → chỉ node đó gọi Flow (các clip khác không bị generate lại); khi đủ clip thì Merge tự chạy lại và video cuối được cập nhật.
- [ ] Tạo lại xong mà còn clip lỗi / chưa có kết quả → Merge không chạy, khung video cuối hiện trạng thái chờ.
- [ ] Node lỗi hiển thị thông báo tiếng Việt, không tự retry.
- [ ] Bấm Mở editor node → mở (hoặc focus) cửa sổ editor của đúng workflow.
- [ ] SW bị tắt giữa lúc chạy → cửa sổ nối lại và hiện đúng trạng thái đang chạy.
- [ ] Không có chuỗi hiển thị hardcode ngoài `strings.ts`; `pnpm typecheck` và `pnpm test` pass.

## 11. Open Questions

- `count` > 1 (nhiều video mỗi node): preview hiển thị tất cả hay chỉ kết quả đang chọn; user chọn clip nào đưa vào Merge?
- Workflow bị `locked`: cửa sổ "Chạy" cho sửa hay chỉ xem + chạy?
- Workflow bị xoá khi cửa sổ đang mở: đóng cửa sổ, hay hiện thông báo và khoá mọi thao tác?
- Mở nhiều lần cùng workflow: focus cửa sổ cũ (như editor) hay mở cửa sổ mới?
- Workflow không có Merge: thứ tự preview theo gì (topo order, vị trí canvas)?
- Tên nút và cửa sổ: giả định nút 2 là "Tải lên", cửa sổ là "Chạy" (từ câu trả lời "Tải lên, chạy"); cần xác nhận không phải một nhãn chung "Tải lên & chạy".
- Kích thước mặc định cụ thể của cửa sổ (px) chưa định nghĩa.
