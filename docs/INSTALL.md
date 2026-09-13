# Cài đặt My X Flows (phát hành nội bộ)

## Yêu cầu

- Google Chrome (hoặc Chromium) bản mới
- Tài khoản Google đã đăng nhập **Google Flow** (`flow.google.com`) và/hoặc **Gemini** (`gemini.google.com`)

## Cài lần đầu (Load unpacked)

1. Giải nén file `my-x-flows-<version>.zip` ra một thư mục cố định (vd `~/Extensions/my-x-flows`).
2. Mở `chrome://extensions`.
3. Bật **Developer mode**.
4. Bấm **Load unpacked** → chọn thư mục vừa giải nén (thư mục có `manifest.json`).
5. Ghim extension; bấm icon để mở **Side panel**.

Extension dùng `key` cố định trong manifest → **ID không đổi** khi cài lại từ thư mục khác. Dữ liệu IndexedDB được giữ nếu ID giữ nguyên.

## Dev

```bash
pnpm install
pnpm dev
```

Load unpacked thư mục `dist/` (chỉ cần một lần). HMR cập nhật side panel / editor; sửa service worker sẽ reload extension.

## Cập nhật phiên bản

1. **Backup** trong Settings → Backup (xuất `.xflow-backup.zip`).
2. Giải nén bản mới **đè lên cùng thư mục** (giữ nguyên `key` trong manifest).
3. Vào `chrome://extensions` → bấm **Reload** trên My X Flows.
4. Nếu lỡ gỡ extension (IndexedDB bị xoá): cài lại → Settings → **Restore** file backup.

## Lưu ý

- Gỡ extension sẽ xoá toàn bộ workflow/media trong IndexedDB.
- Không share / không cloud — mọi dữ liệu nằm local trên máy.
- Tự động hoá UI trên Flow/Gemini có thể bị Google thay đổi; dùng Settings → chẩn đoán provider nếu lỗi selector.
