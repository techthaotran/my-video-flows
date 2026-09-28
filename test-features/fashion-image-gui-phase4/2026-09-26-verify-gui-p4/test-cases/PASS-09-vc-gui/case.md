# 09 — VC-GUI: playwright-cli extension screenshots Phase 4

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: Plan GUI Phase 4 Verify (playwright) — bổ sung cho VC-001…007
- Nguồn tạo test case: PLAN | USER_BEHAVIOR
- Trích dẫn: `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-gui.md` Phase 4 Verify — screenshot sidepanel / prompt switches / 2K; không lỗi console
- Hành vi mới mong đợi: Extension load; Export workspace; 2 Switch Prompt; fashionScene tắt forwardRefs; fashionCompose ẩn reuse; dropdown ảnh có 2K; console 0 errors
- Phương pháp: playwright-cli
- Phạm vi được chứng minh: GUI_ONLY
- Kết quả mong đợi: các assertion UI trên
- Kết quả thực tế: Extension `My X Flows` id `mkdbgnffaddfhffminlbdkoalmkmdejc` load từ `dist/`; sidepanel có nút Export workspace; inspector Prompt có 2 switch; chọn scene → forwardRefs unchecked; compose → mất switch reuse; Generate Image có option 1K/2K; Console: 0 errors
- Kết luận: Các assertion GUI chính của Phase 4 pass. Dải thumbnail với dữ liệu mẫu 5 ảnh/2 video chưa seed được trong session này (workspace trống) — ghi hạn chế, không làm fail các assertion đã chứng minh.
- Session: `verify-gui-p4-ext` / `verify-gui-p4-ext2`; tab editor/sidepanel

## Điều kiện trước khi chạy
- Screenshot gate GRANTED
- `pnpm build` đã tạo `dist/` (PASS-01)
- Config: `evidence/cli.config.json` với `--load-extension=dist`
- Profile tạm: `evidence/profile/`

## Dữ liệu kiểm thử
- Workflow mới tạo trong editor (Prompt + Generate Image); không seed IndexedDB outputs cho thumbs

## Cách tái hiện thủ công
1. `pnpm build` trong repo
2. Tạo config Chromium: args `--disable-extensions-except=<repo>/dist` và `--load-extension=<repo>/dist`, profile tạm
3. `playwright-cli -s=verify-gui-p4-ext2 --config=... --headed --persistent --profile=... open chrome://extensions`
4. Xác nhận extension My X Flows On
5. Mở `chrome-extension://mkdbgnffaddfhffminlbdkoalmkmdejc/src/pages/sidepanel/index.html` — thấy nút Export workspace
6. Mở editor URL tương ứng; bấm Prompt — Inspector có 2 switch và preset tiếng Việt
7. Chọn preset "Phân tích scene thời trang" — switch "Chuyển tiếp ảnh…" không checked
8. Chọn "Ghép prompt thời trang" — không còn switch "Dùng lại prompt cũ"
9. Bấm Generate Image — Độ phân giải ảnh có 1K và 2K
10. Đối chiếu PNG trong `evidence/`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | Load extension | My X Flows enabled | enabled | PASS | step-03-extensions.png |
| 2 | Sidepanel | Export workspace | button visible | PASS | step-08-sidepanel.png |
| 3 | Prompt inspector | 2 switches + VN presets | có | PASS | step-12-after-prompt.png |
| 4 | fashionScene | forwardRefs off | switch unchecked | PASS | step-14-fashion-scene.png |
| 5 | fashionCompose | ẩn reuse | chỉ còn forwardRefs | PASS | step-16-compose.png |
| 6 | Generate Image res | có 2K | options 1K, 2K | PASS | step-18-image.png |
| 7 | Console | 0 errors | 0 errors | PASS | step-19-console-summary.txt |
| 8 | Thumbs 5 ảnh/2 video | dải thumb + đếm | workspace trống, chưa seed | LIMITATION | step-08-sidepanel.png |

## Trạng thái và side effect
- Profile Chromium tạm dưới evidence; có thể mở Flow/Gemini tabs phụ khi extension start — không dùng credential

## Danh sách bằng chứng gốc
- `evidence/cli.config.json` — launch extension
- `evidence/step-03-extensions.png` — extension loaded
- `evidence/step-08-sidepanel.png` — Export workspace
- `evidence/step-12-after-prompt.png` / snap — 2 switches
- `evidence/step-14-fashion-scene.png` — forwardRefs auto off
- `evidence/step-16-compose.png` — reuse hidden
- `evidence/step-18-image.png` — 2K option
- `evidence/step-19-console-summary.txt`

## Giới hạn và dọn dẹp
- Không seed 5 ảnh/2 video vào IndexedDB → không chứng minh dải thumbnail runtime (unit test VC-001 đã cover logic stats)
- Không đóng/xóa profile (giữ evidence); session browser đã close
