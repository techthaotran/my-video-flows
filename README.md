# My X Flows

Chrome extension (MV3) chạy workflow node-based trên **Google Flow** và **Gemini**.

Xem kế hoạch chi tiết: [docs/PLAN.md](docs/PLAN.md) · Cài đặt nội bộ: [docs/INSTALL.md](docs/INSTALL.md) · Workflow: [docs/WORKFLOW.md](docs/WORKFLOW.md)

## Dev

```bash
pnpm install
pnpm dev
```

Load unpacked thư mục `dist/` tại `chrome://extensions`.

```bash
pnpm test
pnpm build
pnpm release   # build + zip vào release/
```

## Phạm vi (đã chốt)

- Chỉ tab Workflow (Templates / Workflows)
- Provider: Google Flow + Gemini
- Lưu local (IndexedDB), Export/Import `.xflow.zip` / `.xflow.json`
- UI tiếng Việt
