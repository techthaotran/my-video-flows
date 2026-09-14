# Plan: Tham chiếu asset bằng media id thay cho link trong prompt

> Trạng thái: bước 1–9 đã triển khai trong code (log, bỏ link, codec MZZa6b, structured prompt, nối luồng, template, docs).
> Bước 7.2 (kiểm chứng live trên Flow) còn mở — ghi kết quả vào `docs/providers/flow.md`.
> Omni có ảnh đi `MZZa6b` + `abra_r2v_*` với ảnh neo trong structured prompt.
> Khoá model và cách neo đã xác nhận từ Flow UI (mục 2.5); fixture submit dự phòng từ sp1007/flowkit (MIT).
> Phạm vi: provider `flow`, các node `prompt`, `generateImage`, `generateVideo`.
> Triệu chứng gốc: Omni Flash không lấy đúng nhân vật / outfit từ asset.

## 1. Yêu cầu bắt buộc

1. **Mọi asset tham chiếu gửi tới Google Flow đi bằng media id nằm trong slot tham chiếu của payload RPC.**
2. **Prompt gửi đi không chứa link `flow-content.google/...`.**
   Không thêm `Tham khảo <url>`, không thay `[Label]` bằng URL.
3. Prompt chỉ giữ `[Label]` và phần mô tả bằng chữ `[Label]: mô tả`.
4. Ref nào không đặt được vào slot media id của model / RPC đang dùng thì **báo lỗi rõ ràng**, không dùng link làm phương án dự phòng (quy tắc 7).
5. Asset đã có trên Flow dùng thẳng `flowMediaId`, không upload lại (quy tắc 6).
   File local upload `maseQ` một lần để lấy media id.
6. Log đầy đủ payload trước khi gửi để kiểm chứng media id nào thực sự vào request.

## 2. Hiện trạng

### 2.1 Link được chèn vào prompt ở 4 chỗ

| Chỗ | File | Việc đang làm |
|---|---|---|
| Node Prompt | `src/engine/executors.ts` (`promptExecutor`, `annotateAssetLabels`) | Nối khối `Danh sách tham chiếu` + `[Label]: Tham khảo <url>` |
| Node Generate | `src/engine/executors.ts` (`annotateAssetLabels` trong generator) | Như trên |
| Driver Flow | `src/providers/flow/rpc/generate.ts` (`resolveRefs`) | Annotate lại sau khi upload để link trỏ tới media id mới |
| Editor preview | `src/features/editor/incomingInputs.ts` | Hiển thị prompt đã có link |

Hàm gốc: `annotateAssetLabels`, `assetAddress`, `restoreAssetLabels`, `stripAssetLegend` trong `src/engine/resolver.ts`.

### 2.2 Media id vào payload tới đâu

| Model / RPC | Slot media id | Ref thừa hiện đi đâu |
|---|---|---|
| Nano Banana `ogiZ0b` | Có (`refMediaIds`) | Đủ, nhưng prompt vẫn kèm link thừa |
| Veo i2v `eb1hJf` | 1 start frame | Ref thứ 2 trở đi chỉ nằm dưới dạng link |
| Omni Flash `YhhmEf` | **Không có** | **Toàn bộ ref chỉ là link**, `imageIds` bị bỏ |
| Ref video / audio | Không có | Chỉ là link hoặc bị bỏ |

Nhánh Omni trong `generateVideoRpc` chỉ dùng `resolved.imageIds.length` để log; `textVideoRequest` (`src/providers/flow/rpc/batch.ts`) chỉ có slot prompt.
Test `Omni Flash with asset links stays on YhhmEf` trong `tests/unit/flow-rpc-generate.test.ts` đang khẳng định hành vi này.

### 2.3 Vì sao link không có tác dụng

1. Model (Omni, Veo, Nano Banana) xử lý prompt như văn bản thuần, không fetch URL.
2. `flow-content.google` yêu cầu cookie đăng nhập; hạ tầng sinh media không mang phiên người dùng.
3. UUID chỉ có nghĩa ở slot media id của payload; trong prompt nó là chuỗi ký tự.
4. Link làm nhiễu prompt và có thể khiến model vẽ chữ hoặc bỏ qua mô tả.
5. Gemini (node Prompt) cũng không xem ảnh qua link; chỉ thấy ảnh đính kèm base64.

### 2.4 Tham chiếu bên ngoài

**Nguồn chính - [sp1007/flowkit](https://github.com/sp1007/flowkit) (MIT), cùng transport batchexecute với repo này:**

- `agent/services/testdata/boq_payloads.json`: payload **capture từ Flow UI** cho 8 rpcid, trong đó `MZZa6b` (video từ ảnh tham chiếu).
- `agent/services/boq_ops.py` (`generate_video_refs`, `structured_prompt_block`) và `agent/boq_rpcids.json` (ghi chú, bằng chứng phát lại).
- Kết luận của họ:
  - Video từ ảnh tham chiếu là **rpcid riêng `MZZa6b`**, không phải `YhhmEf` thêm tham số (4 kiểu đoán trên `YhhmEf` đều `error [3]`).
  - Ảnh được **neo trong prompt** dạng structured prompt: mảnh chữ `["chữ"]`, mảnh ảnh `[null, [[mediaId, tên]]]`.
  - `item[1]` là danh sách `[[null, mediaId], …]` phải liệt kê đủ mọi ảnh đã neo, đúng thứ tự, không trùng.
  - Bẫy: cùng một mediaId neo nhiều lần → lỗi; mảnh chữ bị vụn (không gộp) → lỗi.
  - Sai slot vẫn trả 200 rồi bị bỏ qua: kiểm chứng bằng prompt không mô tả chủ thể.
  - Phát lại đã chạy: 2 ảnh, 5 mảnh, tỉ lệ 1, model `veo_3_1_r2v_lite_low_priority`, file ra 720x1280.

Payload `MZZa6b` capture (rút gọn):

```
[[[ [null, null, [[ ["chiếc "], [null, [["<mediaId A>", "long"]]], [" bay lơ lửng trên đầu con mèo "],
                    [null, [["<mediaId B>", "test-upload-cat.jpg"]]], ["  rồi từ từ hạ xuống đầu nó"] ]]],
    [[null, "<mediaId A>"], [null, "<mediaId B>"]],
    "<model key>", <tỉ lệ 1|2>, null,
    [null, null, null, null, "<UUID>", "<UUID>"] ]],
  [null, 22, null, null, null, "<projectId>", null, null, null, null, ["__CAPTCHA__", 1]],
  ["<batch UUID>", 2]]
```

**Khoá model Omni cho ảnh tham chiếu:** `abra_r2v_{4,6,8,10}s` (FlowKit `models.json` → `omni_flash_models.reference_to_video`; sp1007 đã chạy `abra_r2v_8s` với 3 ảnh qua REST).
Chưa có bằng chứng trực tiếp `MZZa6b` + `abra_r2v_*` qua batchexecute → kiểm chứng ở Bước 7.

### 2.5 Bằng chứng từ Flow UI của tài khoản dự án (2026-09-14)

Người dùng bắt được request `rpcids=WuwhI` khi tạo video Omni có ingredients trên `flow.google.com` (build `boq_labs-ai-sandbox-frontend_20260909.10_p0`).

**`WuwhI` là telemetry, không phải submit.**
Nó ghi 2 sự kiện `ADD_REFERENCE_INGREDIENT` (nguồn `PLUS_BUTTON`) và `MEDIA_GENERATION`.
Không tái tạo RPC này (không gửi telemetry giả).
Nhưng sự kiện `MEDIA_GENERATION` chứa `MEDIA_GENERATION_SETTINGS` là cấu hình UI dùng cho lượt sinh:

```json
{
  "videoModelKey": "abra_r2v_4s",
  "aspectRatio": 1,
  "count": 1,
  "structuredPrompt": {
    "parts": [
      { "text": "- Cánh tay " },
      { "reference": { "entityId": "<ENTITY_ID>" } },
      { "text": "  cầm móc treo chiếc áo " },
      { "reference": { "mediaId": "<MEDIA_ID>" } },
      { "text": " \n- Xuất hiện chuyển cảnh … \n- [Character] Người mẫu không nói chuyện\n- [Chuyển động, góc máy]: … \n- [Audio voice]: …" }
    ]
  }
}
```

Kết luận đã xác nhận:

| Điều | Trạng thái |
|---|---|
| Omni + ingredients dùng khoá `abra_r2v_{d}s` | **Xác nhận** từ UI (`abra_r2v_4s`) |
| Ảnh neo **trong** prompt tại vị trí chèn, xen giữa các mảnh text | **Xác nhận** |
| Mảnh text liền kề được gộp; text giữ nguyên xuống dòng, `[Label]` gõ tay chỉ là chữ | **Xác nhận** |
| `aspectRatio` 1 = dọc (video) | Khớp capture sp1007 |
| Có **2 loại tham chiếu**: `mediaId` (ảnh) và `entityId` (ingredient dạng thực thể, ví dụ nhân vật lưu trong Flow) | **Mới**, chưa có trong capture sp1007 |
| Tài khoản ở tier `PAYGATE_TIER_ONE` | Ghi nhận; không có model `_low_priority` 0 credit |
| rpcid submit thật (dự kiến `MZZa6b`) và vị trí `entityId` trong wire | **Chưa có**, cần request submit (Bước 4) |

**Nguồn phụ:** `kodelyx/flow-agent` gửi Omni kèm ảnh qua REST `batchAsyncGenerateVideoReferenceImages` (`referenceImages: [{ mediaId, imageUsageType }]`); transport khác, chỉ tham khảo.

## 3. Các bước

### Bước 1 - Log payload trước khi gửi Google Flow

**Hiện trạng:** `rpcPayload` chỉ ghi `freq` khi request lỗi; request thành công chỉ có `status`, `bytes`.

1. Tạo module thuần `src/providers/flow/rpc/payloadLog.ts` (không `chrome.*`):
   - `describeSubmit(input)`:

     | Trường | Nội dung |
     |---|---|
     | `rpcid` | `YhhmEf`, `eb1hJf`, `ogiZ0b`, `maseQ`, rpcid mới |
     | `model`, `aspect`, `durationSec`, `count` | Giá trị wire sau khi resolve |
     | `prompt`, `promptLength` | Prompt cuối cùng, đầy đủ |
     | `labelsInPrompt` | Các `[Label]` còn trong prompt |
     | `urlsInPrompt` | Link `flow-content.google` trong prompt; **phải bằng 0** |
     | `refs` | Mỗi ref: `label`, `kind`, `source` (`flow` / `upload`), `mediaId` |
     | `wireMediaIds` | Media id **thực sự** trong `freq`, đọc ngược từ `freq` |
     | `missingRefs` | Ref có media id nhưng không xuất hiện trong `wireMediaIds` |
     | `freq` | `f.req` giải mã JSON, đã làm sạch |

   - `sanitizeFreq(freq)`: giữ `__CAPTCHA__`, thay base64 ảnh bằng `[base64 image/jpeg 182KB]`, không chứa `at`, cookie, header.
2. Gọi ngay trước `runBatchRpc` ở `submitOmniTextVideo`, `submitVideo`, `submitVideoWithFallback`, luồng `ogiZ0b`, `uploadImage`.
   - `info`, scope `rpc`, ví dụ: `payload → ogiZ0b (NARWHAL) ref 2/2 vào wire, 0 link`.
   - `warn` khi `urlsInPrompt > 0` hoặc `missingRefs.length > 0`.
3. `toLogData` cắt chuỗi ở 4000 ký tự (`MAX_STRING`, `src/shared/log`): ghi `prompt` thành mảng đoạn ≤ 4000 ký tự hoặc thêm tuỳ chọn không cắt cho field này.
4. Truyền `runId` / `nodeId` qua `LogContext`.
5. Test `tests/unit/flow-payload-log.test.ts`:
   - `wireMediaIds` đọc đúng từ `imageRequest`, `videoRequest`, `textVideoRequest`.
   - Omni + 2 ref (hiện trạng) → `wireMediaIds = []`, `missingRefs` 2 phần tử, `urlsInPrompt = 2`.
   - `sanitizeFreq` bỏ base64, giữ `__CAPTCHA__`.
   - Prompt > 4000 ký tự log đủ.

**Xong khi:** console editor thấy rõ prompt cuối, media id trong wire, và cảnh báo với workflow Character + Outfit → Omni hiện tại.

### Bước 2 - Bỏ link khỏi prompt ở mọi nơi

1. `src/engine/resolver.ts`:
   - `annotateAssetLabels` không nối `Tham khảo <url>` nữa.
     Chỉ gom khối `[Label]: mô tả` xuống cuối dưới `Danh sách tham chiếu`; label không có mô tả thì không tạo dòng.
   - Bỏ `legendLine` phần URL; `assetAddress` không còn dùng cho prompt.
   - Thêm `stripFlowMediaUrls(content, refs)`: URL có media id khớp ref → `[Label]`; câu `Tham khảo <url>` → bỏ.
     Dùng để làm sạch workflow cũ đã lưu prompt có link.
2. `src/engine/executors.ts`: `promptExecutor` và generator dùng hàm mới; không nhúng URL.
3. `src/providers/flow/rpc/generate.ts`: `resolveRefs` chỉ trả `imageIds` (và ánh xạ `label → mediaId`), không annotate lại prompt bằng URL sau upload.
4. `src/features/editor/incomingInputs.ts`: preview hiển thị `[Label]` + mô tả; trạng thái "đã có trên Flow" lấy từ `flowMediaId` thay vì `assetAddress`.
5. Chốt chặn cuối trong driver, ngay trước submit: nếu prompt còn link `flow-content.google` thì
   - link khớp ref → đổi về `[Label]`;
   - link không khớp ref nào → báo lỗi `Prompt chứa link Flow không gắn asset. Nối asset vào node để gửi bằng media id.` (chuỗi trong `strings.ts`).
6. Tương thích dữ liệu cũ: prompt đã lưu có link vẫn chạy được nhờ bước 1 + 5.
   Không đổi shape dữ liệu nên không tăng `SCHEMA_VERSION`.
7. Test cập nhật trong `tests/unit/core.test.ts`, `tests/unit/node-pipeline.test.ts`:
   - Kỳ vọng mới: không có `Tham khảo https://flow-content.google/...` trong output.
   - Prompt cũ có link → chuyển về `[Label]`, không mất mô tả.
   - Forward qua nhiều node Prompt không trùng khối tham chiếu.
   - Link lạ không khớp ref → lỗi.

**Xong khi:** mọi prompt gửi Flow có `urlsInPrompt = 0` trong log.

### Bước 3 - Báo lỗi khi ref không có slot media id

Sau Bước 2 link không còn làm "phương án dự phòng", nên ref không vào được payload phải báo lỗi.

| Trường hợp | Hành vi |
|---|---|
| Nano Banana có ref ảnh | `refMediaIds` như cũ |
| Veo i2v, 1 ảnh | Start frame như cũ |
| Veo i2v, ≥ 2 ảnh | Lỗi: `Veo chỉ nhận 1 ảnh start frame; bỏ bớt ảnh hoặc chọn Omni Flash` |
| Omni, có ảnh (trước khi xong Bước 5-6) | Lỗi `OMNI_REFS_UNSUPPORTED`: `Omni Flash chưa gửi được ảnh tham chiếu bằng media id ([Character], [Outfit])` |
| continueFrom + ảnh tham chiếu | Frame cuối làm start frame; `[Label]` giữ trong prompt; không gửi media id ảnh (Veo chỉ 1 slot) |
| Ref video / audio với model không có slot | Lỗi: `[Label] là video/audio, model này chưa nhận làm tham chiếu` |
| Omni / Veo chỉ có text | Như cũ |

- Kiểm tra trước captcha và submit để không tốn credit.
- Chuỗi thông báo trong `src/shared/strings.ts`.
- Sửa test `Omni Flash with asset links stays on YhhmEf` thành kỳ vọng lỗi, không gọi `YhhmEf`.
- Thêm test cho Veo ≥ 2 ảnh và ref video.

**Xong khi:** không còn đường nào ref bị bỏ âm thầm; Character + Outfit → Omni báo lỗi đỏ, không submit.

### Bước 4 - Fixture submit Omni có ảnh

Mục 2.5 đã xác nhận khoá model và cách neo ảnh, nhưng `WuwhI` là telemetry.
Cần **request submit** của cùng lượt sinh để có rpcid và vị trí slot thật.

#### 4.1 Lấy request submit từ tài khoản dự án (ưu tiên)

1. `flow.google.com` → DevTools → Network, ô lọc gõ `rpcids=`.
2. Tạo 1 video Omni có **2 ảnh ingredient chọn từ project** (không dùng nhân vật / entity), prompt ngắn có text trước, giữa và sau ảnh.
3. Trong danh sách, tìm request **ngay sau** `WuwhI` (sự kiện `MEDIA_GENERATION`) có `rpcids=` khác `WuwhI`, `jwpduf`, `as29s`, `Zzl0ze` (dự kiến `MZZa6b`).
4. Chỉ copy tab **Payload** (`f.req`) và tab **Response**.
   **Không copy tab Headers** (chứa cookie phiên Google).
5. Làm lại 1 lượt có **1 entity** (nhân vật lưu trong Flow) + 1 ảnh để thấy slot `entityId`.
6. Agent làm sạch trước khi lưu: token captcha → `__CAPTCHA__`, project / media / entity id → placeholder.

#### 4.2 Fixture

1. Nguồn ưu tiên: request 4.1.
   Dự phòng khi chưa có: entry `MZZa6b` trong `agent/services/testdata/boq_payloads.json` của [sp1007/flowkit](https://github.com/sp1007/flowkit) (model Veo, cùng cấu trúc).
2. Lưu `tests/fixtures/providers/flow/mzza6b-r2v.json`:
   - giữ nguyên cấu trúc `args`;
   - thay project id, media id, UUID bằng placeholder cố định (`PROJECT_ID`, `MEDIA_A`, `MEDIA_B`…);
   - giữ `__CAPTCHA__`;
   - trường `_source`: nguồn (4.1: ngày, build `bl=`; hoặc sp1007: URL repo, commit, đường dẫn, MIT), model key.
   - nếu có lượt entity: `tests/fixtures/providers/flow/mzza6b-r2v-entity.json`.
3. Test so khớp `MEDIA_GENERATION_SETTINGS` (mục 2.5) với fixture: cùng thứ tự mảnh text / reference, cùng model key, cùng aspect.
4. Thêm entry `YhhmEf` và `eb1hJf` của sp1007 làm fixture đối chứng cho `textVideoRequest` / `videoRequest` hiện có.
   Nếu builder hiện tại lệch fixture ở slot nào thì ghi rõ trong PR, không tự "sửa cho khớp" khi chưa kiểm chứng live.
5. `docs/providers/flow.md`: thêm `MZZa6b` vào bảng RPC, ghi `WuwhI` là telemetry (không dùng), dẫn nguồn.

**Xong khi:** có fixture submit (4.1 hoặc dự phòng sp1007) và test đối chứng pass (hoặc có ghi chú lệch rõ ràng).
Chưa có 4.1 thì Bước 5-7.1 vẫn làm được trên fixture dự phòng; lượt live 7.2 thay cho 4.1.

### Bước 5 - Codec `MZZa6b` trong `batch.ts`

1. Hằng:
   - `RPC_GEN_VIDEO_REFS = 'MZZa6b'`
   - `omniReferenceVideoModel(durationSec)` → `abra_r2v_{4|6|8|10}s` (snap như `omniTextVideoModel`)
   - `OMNI_MAX_REFS` (tạm 7 theo tài liệu FlowKit fork `namhatinh1288/flowkit` `docs/OMNI_FLASH.md`; xác nhận ở Bước 7)
2. Kiểu dữ liệu:

   ```ts
   export type PromptPart =
     | { type: 'text'; text: string }
     | { type: 'image'; mediaId: string; name: string };
   ```

   - Chỉ hỗ trợ tham chiếu `mediaId` (asset của app luôn là media).
   - `entityId` (mục 2.5) **ngoài phạm vi** lần này: app không tạo ra entity; nếu sau này cần thì thêm biến thể `{ type: 'entity'; entityId }` khi đã có fixture 4.1 bước 5.

3. `structuredPromptBlock(parts: PromptPart[])` → `[null, null, [parts.map(…)]]`
   - text → `[text]`
   - image → `[null, [[mediaId, name]]]`
4. `referenceVideoRequest({ parts, projectId, aspect, model })`:

   ```ts
   const refs = uniqueInOrder(imageParts.map((p) => p.mediaId)).map((id) => [null, id]);
   const item = [structuredPromptBlock(parts), refs, model, resolveVideoAspect(aspect), null,
                 [null, null, null, null, clientUuid(), clientUuid()]];
   return buildEnvelope(RPC_GEN_VIDEO_REFS, [[item], context(projectId), [clientUuid(), 2]]);
   ```

   Kiểm tra bất biến ngay trong hàm (throw `FlowBatchError`):
   - không có 2 mảnh text liền nhau, không có mảnh text rỗng;
   - mỗi `mediaId` chỉ xuất hiện đúng 1 mảnh image;
   - `refs` = danh sách mediaId theo thứ tự xuất hiện của mảnh image.
5. Parser submit: thử `readTextVideoSubmit` (response `YhhmEf` là `[null, credit, [workflow], [media]]`).
   Giữ đường salvage + orphan-poll hiện có nếu shape lệch; ghi log `warn` kèm preview để sửa sau lượt live.
6. `payloadLog.ts`:
   - `extractWireMediaIds('MZZa6b')` đọc `item[1]`;
   - thêm `anchoredMediaIds` đọc từ các mảnh image;
   - `missingRefs` tính theo cả hai; `item[1]` ≠ `anchoredMediaIds` → lỗi (không submit);
   - `prompt` log dạng chữ, mảnh image hiển thị `⟦ảnh [Character] 5ef8…⟧`;
   - `urlsInPrompt` chỉ quét mảnh text.
7. Test `tests/unit/flow-batch.test.ts`:
   - dựng lại fixture `mzza6b-r2v.json` từ `parts` trích từ chính fixture → khớp cấu trúc (bỏ qua UUID sinh ngẫu nhiên);
   - media id trùng → throw; text liền nhau → throw; text rỗng → throw;
   - `omniReferenceVideoModel(5)` → `abra_r2v_4s`, `undefined` → `abra_r2v_8s`, `30` → `abra_r2v_10s`.

### Bước 6 - Dựng structured prompt từ `[Label]`

Hàm thuần mới `buildReferencePromptParts(prompt, orderedRefs)` trong `src/providers/flow/rpc/promptParts.ts` (không `chrome.*`).

Đầu vào: prompt đã qua `cleanPromptForSubmit` (Bước 2: không link, có khối `Danh sách tham chiếu`), `orderedRefs: { label, mediaId }[]`.

Luật:

1. Duyệt prompt tìm `[Label]` (so khớp không phân biệt hoa thường, gộp khoảng trắng như `normalizeLabel`).
2. **Lần xuất hiện đầu tiên** của mỗi label có trong `orderedRefs` → mảnh image `{ mediaId, name: label }`.
   Ưu tiên phần narrative (trước `Danh sách tham chiếu`); nếu label chỉ có trong khối tham chiếu thì neo tại dòng `[Label]:` đó.
3. Các lần xuất hiện sau của cùng label → giữ nguyên chữ `[Label]` (không neo lại, tránh lỗi trùng mediaId).
4. Ref không xuất hiện ở đâu trong prompt → thêm dòng cuối `\n[Label]` rồi neo tại đó (mọi ảnh trong `item[1]` phải được neo).
5. Label trong prompt không có ref → giữ chữ, `warn` trong log (có thể là nhãn mô tả thuần như `[Background]`).
6. Gộp các mảnh text liền nhau; bỏ mảnh text rỗng.
7. Bỏ dòng "Ảnh tham chiếu 1 là…" của bản plan trước: ảnh đã nằm đúng vị trí trong câu.

Ví dụ:

```
Prompt sau Bước 2:
  Video dọc 9:16 dài 4 giây.
  [Character] mặc [Outfit] đi bộ về phía máy quay, [Character] khẽ mỉm cười.

  Danh sách tham chiếu
  [Character]: Cô gái Đông Á 20-25 tuổi, tóc đen ngang vai.

  [Outfit]: Blazer linen màu kem, quần jeans ống rộng xanh nhạt.

Parts:
  text  "Video dọc 9:16 dài 4 giây.\n"
  image 5ef8278f-… "Character"
  text  " mặc "
  image fcf16651-… "Outfit"
  text  " đi bộ về phía máy quay, [Character] khẽ mỉm cười.\n\nDanh sách tham chiếu\n[Character]: Cô gái Đông Á 20-25 tuổi, tóc đen ngang vai.\n\n[Outfit]: Blazer linen màu kem, quần jeans ống rộng xanh nhạt."

item[1]: [[null, "5ef8278f-…"], [null, "fcf16651-…"]]
```

Test `tests/unit/flow-prompt-parts.test.ts`:

- ví dụ trên ra đúng parts và thứ tự refs;
- label lặp → chỉ neo lần đầu;
- label chỉ có trong khối tham chiếu → neo tại dòng đó;
- ref không có label trong prompt → thêm dòng cuối và neo;
- label khác hoa thường / thừa khoảng trắng vẫn khớp;
- prompt bắt đầu bằng `[Character]` → mảnh đầu là image, không có text rỗng;
- không mảnh text nào chứa `flow-content.google` hoặc UUID của ref.

**Câu hỏi mở (trả lời ở Bước 7):** mảnh đầu tiên là image có được Flow nhận không. Capture mẫu bắt đầu bằng chữ.
Nếu bị lỗi, chèn text dẫn ngắn (ví dụ "Video: ") và cập nhật test.

### Bước 7 - Nối vào `generateVideoRpc` + kiểm chứng live

#### 7.1 Luồng mới

| Trường hợp | RPC | Model | Ghi chú |
|---|---|---|---|
| Omni, không ảnh | `YhhmEf` | `abra_t2v_*` | Như cũ |
| Omni, 1..`OMNI_MAX_REFS` ảnh | `MZZa6b` | `abra_r2v_*` | Mới; poll theo mediaId như Omni text |
| Omni, > `OMNI_MAX_REFS` ảnh | - | - | Lỗi rõ ràng, không tự cắt |
| Omni, ref video / audio | - | - | Lỗi (giữ Bước 3) |
| Veo, 1 ảnh | `eb1hJf` | `veo_3_1_i2v_*` | Như cũ (start frame) |
| Veo, ≥ 2 ảnh | - | - | Giữ lỗi Bước 3; Veo r2v qua `MZZa6b` là bước tuỳ chọn 7.4 |
| `continueFrom` + ảnh | `maseQ` + `eb1hJf` | Veo i2v | Frame cuối trên wire; ảnh tham chiếu chỉ trong prompt |
| `continueFrom`, không ảnh | `maseQ` + `eb1hJf` | Veo i2v | Như cũ |

Sửa code:

1. `assertRefsSupported`: bỏ nhánh `OMNI_REFS_UNSUPPORTED` cho ảnh; thêm kiểm tra `> OMNI_MAX_REFS` (đếm theo mediaId/upload duy nhất, trước upload).
2. `generateVideoRpc` nhánh Omni:
   - `resolved.orderedRefs.length === 0` → `submitOmniTextVideo` (như cũ);
   - ngược lại → `submitOmniReferenceVideo(tabId, projectId, scene, model, orderedRefs)`:
     - `parts = buildReferencePromptParts(scene.prompt, orderedRefs)`
     - `freq = referenceVideoRequest({ parts, projectId, aspect, model: omniReferenceVideoModel(durationSec) })`
     - `logPayload` (bắt buộc `missingRefs = []`, `urlsInPrompt = []`)
     - `rpcPayload(tabId, RPC_GEN_VIDEO_REFS, freq, CAPTCHA_VIDEO)`
     - parse như `submitOmniTextVideo` (tách phần parse/salvage dùng chung, không copy).
   - Snapshot `listProjectVideoIds` + orphan-poll dùng chung cho cả hai nhánh Omni.
3. `isModelAccessDenied` cho `abra_r2v_*`: thông báo gợi ý bỏ ảnh hoặc chọn model khác; không tự fallback (quy tắc 7).
4. Chuỗi mới vào `strings.ts`; `OMNI_REFS_UNSUPPORTED` còn dùng cho video/audio thì giữ, không thì xoá code + chuỗi.
5. Test `tests/unit/flow-rpc-generate.test.ts`:
   - Omni + 2 ref Flow → gọi `MZZa6b` đúng 1 lần mỗi `count`, không `YhhmEf` / `ogiZ0b` / `eb1hJf` / `maseQ`;
   - model trong freq là `abra_r2v_{d}s` theo `durationSec`;
   - `item[1]` và mảnh image đúng thứ tự `orderedRefs`;
   - Omni + 1 ref local → `maseQ` 1 lần rồi `MZZa6b` với media id vừa upload;
   - Omni + 8 ảnh → lỗi trước `maseQ` và captcha;
   - Omni không ảnh → vẫn `YhhmEf`;
   - response lệch shape → orphan-poll lấy được video (như test Omni text hiện có).

#### 7.2 Kiểm chứng live (bắt buộc trước khi merge)

Chạy trong app (extension đã ở Chrome đăng nhập Flow), đọc log payload Bước 1. Mỗi lượt Omni 720p 4s tốn khoảng 7 credit (bảng giá sp1007 đo).

| # | Thiết lập | Mục đích | Đạt khi |
|---|---|---|---|
| L1 | Omni 4s, `Video: [Character] đi bộ về phía máy quay.` + 1 asset, **không mô tả chủ thể** | `MZZa6b` + `abra_r2v_4s` được nhận (khoá model đã xác nhận ở 2.5, còn rpcid / slot) | HTTP 200, có video, gương mặt giống ảnh |
| L2 | Như L1 nhưng không nối asset (Omni text) | Đối chứng | Nhân vật khác ảnh rõ rệt |
| L3 | Character + Outfit, prompt Bước 6 | Ca thật | Đúng mặt và outfit |
| L4 | Prompt bắt đầu bằng `[Character]` | Câu hỏi mở Bước 6 | Nhận hoặc biết cần text dẫn |
| L5 | 7 và 8 ảnh (nếu có sẵn asset) | Xác nhận `OMNI_MAX_REFS` | 7 chạy, 8 bị app chặn |

- L1 lỗi `error [3]` hoặc 200 nhưng video không giống ảnh → dừng, lấy request submit theo 4.1 và so với payload của app trong log.
- Đối chiếu log payload của app với `MEDIA_GENERATION_SETTINGS` trong `WuwhI` mà UI tự gửi khi tạo cùng prompt: thứ tự mảnh và model key phải giống.
- Ghi kết quả (ảnh chụp + log payload rút gọn) vào `docs/providers/flow.md` mục kiểm chứng.

#### 7.3 Nguyên tắc viết prompt

- Không dán link hay media id Flow vào prompt; nối asset vào node.
- Đặt `[Label]` đúng chỗ muốn ảnh xuất hiện trong câu; lần nhắc đầu tiên là chỗ neo ảnh.
- Mỗi nhãn có mô tả hình ảnh cụ thể trong `[Label]: mô tả`, bổ trợ cho ảnh.
- Ghi rõ điều cấm (đổi màu, thêm / bớt phụ kiện, đổi tóc).
- Tách hành động / góc máy / ánh sáng / bối cảnh.
- Không yêu cầu "thay nhân vật trong video mẫu" (cần `jIps6` sửa video, ngoài phạm vi).

Prompt mẫu:

```
Video dọc 9:16 dài 4 giây, phong cách quay thực tế.
[Character] mặc [Outfit] đi bộ về phía máy quay trên con phố đầy nắng, khẽ mỉm cười.
Giữ nguyên gương mặt, kiểu tóc và từng chi tiết trang phục như ảnh tham chiếu; không thêm, bớt hay đổi màu quần áo và phụ kiện.
Góc máy: toàn thân đến trung cảnh, máy lùi chậm.
Ánh sáng: nắng tự nhiên buổi sáng, mềm.

Danh sách tham chiếu
[Character]: Cô gái Đông Á 20-25 tuổi, mặt trái xoan, da sáng, tóc đen thẳng ngang vai rẽ ngôi lệch trái, trang điểm nhẹ.

[Outfit]: Áo blazer linen màu kem dáng rộng, áo ba lỗ trắng ôm, quần jeans ống rộng lưng cao xanh nhạt, sneaker trắng, dây chuyền vàng mảnh. Không túi, không mũ, không kính.
```

#### 7.4 (Tuỳ chọn, sau khi 7.2 đạt) Veo nhiều ảnh qua `MZZa6b`

- Model `veo_3_1_r2v_*` (capture mẫu dùng `veo_3_1_r2v_lite_low_priority`; FlowKit `models.json` có `veo_3_1_r2v_fast`, `veo_3_1_r2v_fast_portrait`, `veo_3_1_r2v_fast_landscape_ultra_relaxed`).
- Veo ≥ 2 ảnh → `MZZa6b` thay vì lỗi; Veo 1 ảnh vẫn `eb1hJf` (start frame khác nghĩa với tham chiếu).
- Cần ánh xạ label UI → khoá r2v theo tier + tỉ lệ, kiểm chứng live riêng. Chỉ làm khi được yêu cầu.

### Bước 8 - Template và node Prompt

1. Đổi instruction trong `src/templates/seed/index.ts` sang mẫu tiếng Việt ở 7.3, bỏ `[Video reference]`.
2. `templateRepo.syncBuiltIns` upsert mọi template `builtIn` theo id mỗi lần khởi động (DB trống cũng được seed).
   - Chỉ ghi đè bản ghi `builtIn: true`; template người dùng tự lưu không bị đụng.
   - Giữ `createdAt` cũ, cập nhật `updatedAt`.
   - Template `builtIn` đã bị bỏ khỏi seed thì xoá khỏi DB.
   - Test với `fake-indexeddb`: DB có template cũ → sau sync có instruction mới, template người dùng giữ nguyên.
3. Prompt preset ≠ `custom` (Gemini rewrite):
   - system yêu cầu giữ nguyên `[Label]` (đúng vị trí trong câu) và khối `[Label]: mô tả`, không chèn URL;
   - output mất nhãn có trong input hoặc chứa link Flow → lỗi rõ ràng; có test.

### Bước 9 - Tài liệu (cùng commit với code)

- `docs/WORKFLOW.md`: mục 2.7 (Omni có ảnh → `MZZa6b`), bảng RPC 3.2 (thêm `MZZa6b`), model mapping 3.3 (`abra_r2v_*`), pipeline video 3.4.
- `docs/providers/flow.md`: bảng RPC, dòng Video, "Không hỗ trợ", checklist E2E, kết quả kiểm chứng 7.2, nguồn capture (sp1007/flowkit, MIT), cách đọc log payload.
- Docblock `RPC_GEN_VIDEO_TEXT` / `RPC_GEN_VIDEO_REFS` (`batch.ts`), `generateVideoRpc` (`generate.ts`), `buildReferencePromptParts` (`promptParts.ts`).

### Bước 10 - Kiểm tra

1. `pnpm typecheck` và `pnpm test` pass, stderr sạch.
2. `pnpm build`, reload extension và tab Flow.
3. E2E trên Flow thật, đối chiếu log payload:

   | Ca | Kỳ vọng trong log | Kỳ vọng kết quả |
   |---|---|---|
   | Nano Banana + Character | `ogiZ0b`, `wireMediaIds` 1 id, `urlsInPrompt 0` | Ảnh đúng nhân vật |
   | Omni text-only | `YhhmEf`, `wireMediaIds []` | Có video |
   | Character + Outfit (asset Flow) → Prompt → Omni | `MZZa6b`, `abra_r2v_*`, `item[1]` = mảnh image = 2 id đúng thứ tự, `urlsInPrompt 0`, không `maseQ` | Đúng mặt và outfit |
   | Character + Outfit (file local) → Omni | `maseQ` mỗi ảnh 1 lần (base64 ẩn), rồi `MZZa6b` | Đúng mặt và outfit |
   | Omni > `OMNI_MAX_REFS` ảnh | Không submit | Lỗi rõ ràng |
   | Veo + 2 ảnh | Không submit | Lỗi rõ ràng (trừ khi làm 7.4) |
   | Omni + asset video | Không submit | Lỗi rõ ràng |
   | `continueFrom` + ảnh | `maseQ` frame cuối + `eb1hJf`; không upload Character/Outfit | Chạy; `[Label]` trong prompt |
   | Workflow cũ có link trong prompt | Link đã đổi về `[Label]` rồi neo ảnh | Chạy bình thường |
   | Scene tiếp (`continueFrom`, không ảnh) | `maseQ` + `eb1hJf` | Như cũ |

## 4. Quyết định đã chốt

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Link Flow không khớp asset nào trong prompt (Bước 2.5) | Báo lỗi để người dùng sửa, không tự chuyển thành media id |
| 2 | Cập nhật template có sẵn cho người dùng cũ (Bước 8.2) | Có: upsert template `builtIn` theo id mỗi lần khởi động |
| 3 | Nguồn payload Omni có ảnh (Bước 4) | Ưu tiên request submit từ tài khoản dự án (4.1, chỉ Payload + Response); dự phòng capture `MZZa6b` của sp1007/flowkit (MIT); luôn kiểm chứng live 7.2 |
| 5 | Loại tham chiếu hỗ trợ | Chỉ `mediaId`; `entityId` ngoài phạm vi |
| 6 | RPC `WuwhI` | Telemetry của UI, chỉ dùng làm bằng chứng; không tái tạo |
| 4 | Ảnh gắn với nhãn thế nào | Neo ảnh tại lần xuất hiện đầu của `[Label]` trong structured prompt; bỏ dòng "Ảnh tham chiếu 1 là…" |

## 5. Ngoài phạm vi

- Thay nhân vật trong video mẫu / bắt chước chuyển động (`[Video reference]`): cần sửa video (`jIps6`, `abra_edit*`, theo sp1007/flowkit). Tách plan khác khi được yêu cầu.
- Veo nhiều ảnh qua `MZZa6b` (7.4) và các RPC khác trong bộ capture (`nprQif` hai khung, `fZytfe` nối dài, `p0UkFb` upscale): chỉ làm khi được yêu cầu.

## 6. Thứ tự thực hiện

1. Bước 1-3: đã xong (log, bỏ link, báo lỗi).
2. Bước 4 (fixture) → Bước 5 (codec) → Bước 6 (structured prompt): toàn unit test, không tốn credit.
3. Bước 7.1 (nối luồng) → 7.2 (kiểm chứng live, khoảng 5 lượt Omni 4s). L1 không đạt thì dừng.
4. Bước 8 → 9 → 10.
