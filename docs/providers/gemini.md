# Gemini provider notes

> Khảo sát UI (M0). Selectors: `src/providers/gemini/selectors.ts`.

## Auth

| Tín hiệu | Cách nhận biết |
|---|---|
| Đã đăng nhập | Google account avatar |
| Chưa đăng nhập | Sign in |

## Actions

| Hành động | Ghi chú |
|---|---|
| New chat | Nút New chat / đoạn chat mới |
| Model | Model picker (Flash / Pro…) |
| Image/Video tool | Tool trong ô nhập hoặc menu “+” |
| Upload | Attach → `input[type=file]` |
| Input | `contenteditable` / rich-textarea |
| Send / Stop | Send ↔ Stop khi đang stream |
| Text response | Message model cuối |
| Media | `img`/`video` trong phản hồi; ưu tiên bản gốc không phải thumbnail |
| Errors | Thông báo can't / policy / quota video |

## PoC checklist

- [ ] Prompt text → lấy phản hồi
- [ ] Generate image → fetch blob
- [ ] Fixture HTML: `tests/fixtures/providers/gemini/`

DEV: `window.__myXFlowsGemini.diagnose()`.
