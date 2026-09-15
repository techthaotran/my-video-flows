# Kế hoạch: Flow Asset Picker nhanh hơn + phân trang thật

## Vấn đề

Chọn asset từ Google Flow (`FlowAssetPicker`) hiện chậm khi hiển thị ảnh.
Người dùng cần phân trang và preview nhanh hơn.

## Hiện trạng (đã có trong code)

| Lớp | Hành vi |
|---|---|
| UI | `FlowAssetPicker.tsx` — phân trang **client** `PAGE_SIZE = 20` (Trước/Sau) |
| List | `provider.listFlowMedia` → `TabPool.listFlowMedia` |
| RPC list | `listProjectMediaViaRpc` — gọi `Zzl0ze` **hết mọi trang** (tối đa 20 trang / 2000 item) rồi mới trả |
| DOM | Song song quét gallery (`listMedia`) để lấy media mới + URL đã ký trên tab |
| Preview | Mỗi trang UI gọi `provider.signFlowMedia` → `as29s` từng id, concurrency **4** |
| Thumbnail | `thumbUrl = url` full CDN — không có bản nhỏ riêng |

Luồng mở picker hôm nay:

1. `checkAuth`
2. Chờ **toàn bộ** listing RPC (+ DOM)
3. Render trang 1 (20 ô) với placeholder "Đang tải preview…"
4. Sign lần lượt ~20 id → mới hiện ảnh

Phân trang UI **đã có**, nhưng không giúp tốc độ mở lần đầu vì vẫn tải hết danh sách trước.

## Nút thắt chính

1. **Eager listing** — chờ nhiều round-trip `Zzl0ze` trước khi hiện lưới.
2. **Sign tuần tự theo batch** — 20 × `as29s` / concurrency 4 ≈ vài round trước khi đủ 20 ô.
3. **Preview full-res** — trình duyệt tải ảnh gốc cho ô vuông nhỏ.
4. **Khóa chọn** khi `kindKnown === false` — phải chờ sign xong mới click được (đúng khi filter kind, nhưng làm cảm giác chậm hơn).

`IncomingAssets` / node preview không phải gốc của chậm picker; bài này tập trung `FlowAssetPicker` + `listing.ts` + messaging.

## Mục tiêu

- Mở dialog → thấy trang đầu (id + preview) trong **1–2 round** RPC, không chờ cả project.
- Phân trang gắn với **cursor listing** (`pageToken`), không chỉ cắt mảng local.
- Preview trang hiện tại nhanh; trang kế có thể prefetch nền.
- Vẫn chỉ giữ `flowMediaId` khi chọn (không download/upload lại — quy tắc 6).

## Hướng đã chọn

**Phân trang server-side (cursor `Zzl0ze`) + sign theo trang + tối ưu preview.**

Không làm virtualization toàn bộ danh sách trong một lần load (tốn RAM/sign vô ích).
Không đổi sang chỉ DOM scan (thiếu media ngoài viewport Flow).

### Phương án đã loại / để sau

| Ý tưởng | Lý do |
|---|---|
| Chỉ tăng `SIGN_CONCURRENCY` | Giúp một phần, không sửa chờ listing đầy đủ |
| Infinite scroll thuần client trên list đã tải hết | Vẫn chậm lúc mở |
| Cache IndexedDB mọi CDN URL | Signature hết hạn; phức tạp; ngoài phạm vi nếu chưa cần |

---

## Thiết kế

### 1. API listing theo trang

Đổi contract (không đụng schema workflow / `SCHEMA_VERSION`):

```ts
// UiToSw
{ type: 'provider.listFlowMedia'; kind?; pageToken?: string | null; pageSize?: number }

// response
{ items: FlowMediaItem[]; nextPageToken: string | null }
```

Backend:

- `listProjectMediaViaRpc(tabId, { pageToken, pageSize? })` — **một** lần `Zzl0ze`, trả `items` + `nextPageToken`.
- Bỏ vòng `MAX_PAGES` khi phục vụ picker (giữ helper nội bộ nếu poll generate còn cần list đầy đủ — tách rõ tên hàm).
- Envelope: xác nhận slot `pageSize` trong `projectMediaPageRequest` (comment đã nói parent/pageSize/pageToken; hiện `pageSize = null`). Nếu Flow chấp nhận số cố định (vd. 20–50), truyền rõ để khớp UI.

Merge DOM:

- Lần đầu (`pageToken` null): vẫn merge DOM items chưa có trong RPC (media mới trên tab).
- Trang sau: chỉ RPC page; không quét DOM lại (tránh nhảy thứ tự / trùng).

### 2. UI phân trang — **bấm số trang** (đã chốt)

`FlowAssetPicker` không dùng infinite "Tải thêm". Dùng thanh phân trang kiểu:

`«` `1` `2` `3` … `N` `»` (kèm Trước/Sau nếu còn chỗ).

Hành vi:

- Mở / Làm mới: load trang **1** từ Flow → hiện lưới ngay (dù chưa sign xong).
- Bấm số trang đã từng mở: chỉ đổi trang local (không gọi list lại).
- Bấm số / Sau tới trang **chưa có**: gọi list với `nextPageToken` tương ứng, rồi sign trang đó.
- Tổng số trang: ban đầu chỉ biết "có trang sau" (`nextPageToken`); hiện `1` + nút tới trang kế. Khi đã biết hết (hết token) mới khóa `N` cuối. Không bịa tổng nếu Flow chưa trả hết.
- `PAGE_SIZE` UI ≈ pageSize RPC (đề xuất **20**).
- Copy qua `strings.ts` (không hardcode).

State đề xuất (**B — page cache**), vì bấm số cần nhảy trang ổn định:

- `Map<pageIndex, items>` + `pageTokens` (token để **mở** trang `i+1`)
- Prefetch nền trang kế (tuỳ chọn P1) để bấm `2` gần như tức thì

### 3. Sign / preview nhanh hơn

Giữ sign **theo trang đang xem** (đã đúng hướng):

| Việc | Chi tiết |
|---|---|
| Concurrency | Tăng `SIGN_CONCURRENCY` 4 → **8** (đo; tránh spam tab Flow) |
| Prefetch | Khi trang N đã sign xong, nền: list + sign trang N+1 nếu còn token |
| DOM reuse | Giữ merge URL đã ký từ tab (đã có) — ưu tiên không gọi `as29s` nếu đã có `url` có `?` |
| Thumbnail | Trong `as29s` / listing, nếu có URL nhỏ hơn (query size / poster) → gán `thumbUrl`; không thì giữ full URL + `loading="lazy"` (đã có) |
| Video ô lưới | Khi `as29s` trả cả image + video: ưu tiên **image/poster** làm `thumbUrl` lưới; giữ video URL chỉ khi cần phát |
| Chọn khi chưa sign | Cho phép chọn nếu đã có `mediaId`; `kind` filter: nếu `kindKnown === false` và node đang filter image/video — vẫn disable hoặc xác nhận sau sign (giữ an toàn kind) |

Không `fetchMedia` / base64 trong picker (đúng thiết kế hiện tại).

### 4. Messaging / SW

- `background/index.ts`: forward `pageToken` / `pageSize`.
- `shared/messaging`: cập nhật union + kiểu response.
- Không message content-script mới; RPC vẫn SW → MAIN bridge.

### 5. Chuỗi UI (`strings.ts`)

Bổ sung nếu cần, ví dụ:

- Đang tải thêm trang…
- Hết danh sách / Không còn trang sau

Giữ tiếng Việt; không hardcode trong component.

### 6. Docs / test

- `docs/providers/flow.md` và `docs/WORKFLOW.md`: sửa chỗ còn nói picker = DOM `listMedia`.
  Thực tế: inventory chính = `Zzl0ze` phân trang; `as29s` theo trang UI; DOM chỉ bổ sung trang đầu.
- Unit: `readProjectMediaPage` + request có token; mock list một trang / nhiều trang.
- Không bắt buộc E2E extension trong CI; smoke manual: project nhiều media.

### 7. Preview node hết hạn (tuỳ chọn, sau P1)

Canvas/inspector dùng `flowPreviewUrl` đã lưu; hết hạn → ô vỡ / "preview hết hạn".
Có thể thêm re-sign đúng `flowMediaId` khi preview lỗi (không liên quan tốc độ mở picker).

---

## Các bước triển khai

### P0 — Nhanh cảm nhận (1 PR nhỏ, có thể gộp P1)

1. `listProjectMediaViaRpc` chỉ lấy **trang đầu** cho picker (hoặc API có `maxPages = 1` tạm).
2. UI: nút "Tải thêm" / "Sau" gọi trang kế với token.
3. Tăng `SIGN_CONCURRENCY` lên 8.
4. Mở dialog không chờ hết project.

### P1 — Phân trang hoàn chỉnh

1. Contract `listFlowMedia` + `nextPageToken` chính thức.
2. Prefetch trang kế sau khi sign xong trang hiện tại.
3. Đồng bộ `pageSize` RPC ↔ UI.
4. Chuỗi + empty/error từng trang (trang 1 lỗi = lỗi; trang sau lỗi = dừng + thông báo).

### P2 — Preview (nếu vẫn chậm sau P0/P1)

1. Phân tích payload `as29s` / `Zzl0ze` xem có thumb/poster.
2. Nếu có → map vào `thumbUrl`.
3. Nếu không → cân nhắc giới hạn kích thước hiển thị / decode (CSS đã `object-cover`; ít room hơn).

### Ngoài phạm vi (không làm trừ khi hỏi thêm)

- Đổi generate / Omni refs / `IncomingAssets` strip.
- Cache lâu dài signed URL trên đĩa.
- Virtualized grid toàn bộ id chưa sign.

---

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| `pageSize` trong envelope sai → Flow lỗi / bỏ qua | Capture 1 request thật từ UI Flow; so `projectMediaPageRequest`; fallback `null` nếu không chắc |
| Thứ tự newest-first lệch giữa các trang | Tin tưởng thứ tự server; chỉ sort trong **một** page như hiện tại |
| Media mới trên tab không nằm trang 1 RPC | Giữ merge DOM ở lần load đầu |
| Sign 8 song song bị rate-limit | Đo; hạ lại 4–6 nếu lỗi |
| Đổi message làm UI cũ lệch | Extension một bản; không protocol ngoài |

## Tiêu chí xong

- Project ~100+ media: mở picker thấy ô trang 1 trong thời gian ~1 lần `Zzl0ze` + batch sign trang đó (không chờ list hết).
- Nút Sau lấy thêm media chưa từng hiện; Trước không gọi RPC lại nếu đã có trong state.
- Chọn asset vẫn chỉ ghi `flowMediaId` + `previewUrl` session.
- `pnpm typecheck` + `pnpm test` xanh; có test listing phân trang.

## File chạm chính

- `src/features/editor/FlowAssetPicker.tsx`
- `src/providers/flow/rpc/listing.ts`
- `src/providers/flow/rpc/batch.ts` (`projectMediaPageRequest` / pageSize)
- `src/providers/TabPool.ts`
- `src/shared/messaging/index.ts`
- `src/background/index.ts`
- `src/shared/strings.ts`
- `docs/providers/flow.md`
- `tests/unit/*` (listing / messaging picker)

## Quyết định

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Kiểu phân trang UI | **Bấm số trang** (+ Trước/Sau). Không infinite scroll / "Tải thêm". |
| 2 | Page size | Mặc định **20** (trừ khi đo Flow bắt buộc khác). |
| 3 | P2 thumb trong PR đầu? | Chưa chốt — mặc định chỉ **P0+P1**; P2 nếu vẫn chậm. |
