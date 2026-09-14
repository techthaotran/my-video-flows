# AGENTS.md — My X Flows

> Chrome extension MV3 chạy workflow node-based trên **Google Flow** + **Gemini**. Nội bộ, lưu local, UI tiếng Việt.
> File chung cho mọi agent: Claude Code (qua symlink `CLAUDE.md`), Antigravity (đọc `AGENTS.md` trực tiếp, IDE ≥ 1.20.5), Codex, Cursor… Chỉ sửa `AGENTS.md`.
> Không tạo thêm `GEMINI.md` ở root — Antigravity sẽ nạp cả hai (trùng lặp, thứ tự ưu tiên không rõ).

## Lệnh

| Việc | Lệnh |
|---|---|
| Dev (HMR, port 5001 cố định) | `pnpm dev` → load unpacked `dist/` |
| Test | `pnpm test` (Vitest + jsdom + fake-indexeddb) |
| Typecheck | `pnpm typecheck` |
| Build / release | `pnpm build` / `pnpm release` (zip vào `release/`) |

Trước khi báo xong: chạy `pnpm typecheck` và `pnpm test`. Dùng `pnpm`, không dùng npm/yarn.

## Bản đồ code

```
Editor/SidePanel (React) ──chrome.runtime msg──▶ Service Worker (src/background)
  └ RunManager → scheduler (topo) → executors[nodeType] → provider
       Flow generate: src/providers/flow/rpc/* (batchexecute trong tab Flow, world MAIN)
       Flow auth/list/fetch, Gemini: content script driver (DOM)
```

| Muốn đổi… | Sửa ở |
|---|---|
| Schema node/edge/workflow, migrate | `src/shared/schema/index.ts` (`SCHEMA_VERSION`) |
| Port / luật nối cạnh | `src/nodes/ports.ts` |
| Node UI / toolbar | `src/nodes/registry.ts`, `src/features/editor/nodes/` |
| Logic chạy node | `src/engine/executors.ts`, `resolver.ts` |
| Message UI ↔ SW ↔ content | `src/shared/messaging/index.ts` (union type) |
| Chuỗi UI | `src/shared/strings.ts` |
| IndexedDB (Dexie) | `src/storage/db.ts`, `src/storage/repos/` |

Tài liệu sâu (đọc khi chạm vào phần đó): `docs/WORKFLOW.md` (node, port, pipeline), `docs/providers/flow.md` (RPC id, captcha, lỗi), `docs/providers/gemini.md`, `docs/PLAN.md` (quyết định sản phẩm).

## Quy tắc bắt buộc

1. **Phạm vi đã chốt:** chỉ tab Workflow; provider chỉ `flow` | `gemini`; không cloud/share/backend; không gói/hạn mức. Không thêm tính năng ngoài phạm vi khi chưa được hỏi.
2. **UI chỉ tiếng Việt, mọi chuỗi hiển thị qua `strings.ts`.** Không hardcode text trong component, không thêm thư viện i18n.
3. **Đổi shape dữ liệu đã lưu → tăng `SCHEMA_VERSION` + thêm nhánh trong `migrateWorkflow`.** Workflow cũ trong IndexedDB và file `.xflow.zip/.xflow.json` phải vẫn load được.
4. **Thêm message mới → khai báo trong union ở `shared/messaging`** trước, rồi mới xử lý ở SW/content. Không gửi message không có type.
5. **Flow generate đi qua RPC, không click DOM.** DOM driver chỉ cho checkAuth / diagnose / listMedia / fetchMedia.
6. **Asset Flow (`flowMediaId`) không bao giờ upload lại (`maseQ`).** Mất id → lỗi `FLOW_ASSET_NO_UPLOAD`.
7. **Không tự retry lỗi generate** (mặc định `retry: 0`); báo lỗi rõ ràng thay vì âm thầm fallback tạo ảnh trung gian.
8. **Không log token/captcha/cookie.** Log RPC dùng placeholder `__CAPTCHA__`.
9. **World MAIN** (`providers/flow/injected/mainBridge.ts`): không có `chrome.*`; hàm bridge phải tự chứa (không dùng biến module scope/import) vì SW còn inject lại qua `executeScript({ world: 'MAIN', func })`. Giao tiếp với content script isolated qua `CustomEvent` (`GET_CAPTCHA`, `BATCH_RPC`).
10. Import nội bộ dùng alias `@/…`. TS strict + `noUnusedLocals/Parameters` — không để biến thừa.
11. Test mới đặt ở `tests/unit/*.test.ts`; fixture ở `tests/fixtures/`. Không load `@crxjs/vite-plugin` trong test (đã tách `vitest.config.ts`).

## Bẫy đã biết

- `pnpm dev` cần port 5001 trống (`strictPort`); đổi port phải sửa cả `hmr`.
- `manifest.config.ts` giữ `key` cố định để extension ID ổn định — không xoá/đổi.
- Sau khi sửa content script / manifest phải reload extension và tab Flow/Gemini.

---

## Bảo trì file này (đọc trước khi sửa)

File này là "trọng số" nạp vào mọi phiên agent. Sửa theo kỷ luật, không theo cảm tính
(tham khảo: *Your AGENTS.md is a Neural Net* — Kun Chen).

- **Ngân sách:** tối đa ~2.000 token (Antigravity cắt mỗi file rule ở 12.000 ký tự). Sửa là zero-sum: thêm một dòng thì phải chỉ ra dòng bị xoá, gộp, hoặc chuyển ra `docs/` / skill.
- **Bằng chứng, không giai thoại:** chỉ thêm quy tắc khi lỗi lặp lại ở **≥ 2 phiên** (có trích transcript/PR). Sự cố một lần → không thêm.
- **Bước nhỏ:** mỗi lần cập nhật ≤ 5 thay đổi (thêm / xoá / viết lại / tách). Không viết lại toàn bộ.
- **Cái gì ở lại đây:** quy tắc ảnh hưởng ≥ ~20% phiên, hoặc liên quan an toàn/dữ liệu. Quy tắc hẹp theo ngữ cảnh → `docs/` hoặc skill. Quy tắc không còn trigger → xoá.
- **Tránh 4 trạng thái hỏng:** rỗng (không giúp gì) · phình (quy tắc chôn nhau) · lỗi thời (trỏ tới file/lệnh không còn) · lệch (mâu thuẫn với `docs/`, README).
- Khi đổi lệnh, path, schema version, RPC id → cập nhật dòng tương ứng ở đây trong cùng commit.
