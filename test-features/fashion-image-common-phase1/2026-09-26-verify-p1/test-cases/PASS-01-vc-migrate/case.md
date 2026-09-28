# VC-MIGRATE — Migrate schema v6 (prompt / resolution)

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-MIGRATE
- Nguồn tạo test case: PLAN | BUSINESS_OLD | BUSINESS_NEW
- Trích dẫn requirement/invariant: `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-common.md` Phase 1 (migrate v5→v6)
- Hành vi cũ: prompt thiếu field; generateImage dùng resolution số (720)
- Hành vi mới mong đợi: v5 prompt → reusePrompt false / forwardRefs true; prompt mới → true; 720→'1K'; SCHEMA_VERSION===6; migrate+validateNodeData ổn
- Chức năng liên quan có thể bị ảnh hưởng: load workflow/draft cũ, validate node data
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC (unit)
- Nhóm rủi ro/coverage: positive + regression (migrate path)
- Kết quả mong đợi: 4 test schema-v6-migrate PASS với các assertion trên
- Kết quả thực tế: 4/4 PASS
- Kết luận: Contract migrate v6 được chứng minh bằng unit test độc lập.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Repo `/Users/ggj/MyWork/my-video-flows`, pnpm, vitest
- Screenshot gate: GRANTED (GATE_ONLY)
- Service/auth: NOT_REQUIRED

## Dữ liệu kiểm thử
- Fixture trong `tests/unit/schema-v6-migrate.test.ts` (workflow schemaVersion 5 giả lập)

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. Chạy: `pnpm exec vitest run --config vitest.config.ts tests/unit/schema-v6-migrate.test.ts`
3. Quan sát: 4 tests passed; không FAIL
4. Evidence: `evidence/step-01-vitest.txt`
5. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | Chạy schema-v6-migrate.test.ts | 4 PASS; v5 reusePrompt false; new true; 720→1K; SCHEMA 6; validateNodeData | 4 passed (4) | PASS | evidence/step-01-vitest.txt |

## Trạng thái và side effect
- Không đụng IndexedDB thật / không mutate source

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt` — stdout vitest filtered

## Giới hạn và dọn dẹp
- Không chứng minh load extension thật với dữ liệu “Trước Gương” (manual ngoài contract tự động)
