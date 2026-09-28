# VC-REV-001-FENCE — extractJsonPayload / parse JSON có fence

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-REV-001-FENCE
- Nguồn tạo test case: PLAN | ERROR_HANDLING | BUSINESS_NEW
- Trích dẫn requirement/invariant: `extractJsonPayload` trong `src/shared/utils/index.ts`; `composeFashionPrompt` gọi helper; test `strips markdown fences` trong fashion-compose
- Hành vi cũ: parse JSON thẳng (dễ vỡ với output Gemini có ```json)
- Hành vi mới mong đợi: strip fence/prose trước parse; covered bởi unit test
- Chức năng liên quan: fashion compose, promptExecutor JSON format
- Phương pháp: package-test + static-trace
- Phạm vi được chứng minh: API_ONLY | STATIC
- Nhóm rủi ro/coverage: positive (fenced) COVERED; negative (invalid JSON) COVERED cùng file fashion-compose
- Kết quả mong đợi: focused fence test pass; fashion.ts dùng extractJsonPayload
- Kết quả thực tế: 1 passed (strips markdown fences); static xác nhận import/use
- Kết luận: Fenced JSON parse được cover — PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Chuỗi model/outfit bọc ```json trong test

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/fashion-compose.test.ts -t 'fenced|fence|markdown'`
2. Quan sát 1 test pass: `strips markdown fences (and prose) before parsing`.
3. Đọc `src/engine/presets/fashion.ts` — gọi `extractJsonPayload`.
4. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-static-and-tests.txt`
5. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest fence filter | 1 pass | 1 pass | PASS | evidence/step-01-vitest.txt |
| 02 | static extractJsonPayload wiring | fashion dùng helper | đúng | PASS | evidence/step-02-static-and-tests.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-static-and-tests.txt`

## Giới hạn và dọn dẹp
- Không có unit test riêng file cho `extractJsonPayload` đơn độc; oracle qua composeFashionPrompt (đủ cho contract)
