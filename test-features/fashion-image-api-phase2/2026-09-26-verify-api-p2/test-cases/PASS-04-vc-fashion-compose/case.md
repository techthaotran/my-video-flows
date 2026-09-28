# VC-FASHION-COMPOSE — Ghép prompt thời trang (kèm JSON có fence)

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-FASHION-COMPOSE
- Nguồn tạo test case: PLAN | BUSINESS_NEW | ERROR_HANDLING
- Trích dẫn requirement/invariant: plan API Phase 2 — `composeFashionPrompt`; `tests/unit/fashion-compose.test.ts`
- Hành vi cũ: N/A (preset mới)
- Hành vi mới mong đợi: thứ tự model>outfit>palette>scene; JSON hỏng → lỗi tiếng Việt; thiếu khối vẫn ghép; strip markdown fence
- Chức năng liên quan: `src/engine/presets/fashion.ts`, `promptExecutor` fashionCompose
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Nhóm rủi ro/coverage: positive/negative/boundary COVERED; concurrency NOT_APPLICABLE
- Kết quả mong đợi: 5 tests pass
- Kết quả thực tế: 5 passed
- Kết luận: Fashion compose (kể cả fenced JSON) đạt.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- JSON sample model/outfit/palette/scene trong file test

## Cách tái hiện thủ công
1. Tại repo root: `pnpm exec vitest run --config vitest.config.ts tests/unit/fashion-compose.test.ts`
2. Quan sát 5 tests pass, gồm case `strips markdown fences`.
3. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-fenced-coverage.txt`
4. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest fashion-compose | 5 pass | 5 pass | PASS | evidence/step-01-vitest.txt |

## Trạng thái và side effect
- Không side effect

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt` — Vitest output
- `evidence/step-02-fenced-coverage.txt` — coverage fenced JSON trong test

## Giới hạn và dọn dẹp
- Không gọi Gemini thật
