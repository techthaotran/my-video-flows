# 01 — VC-BUILD: typecheck, test, build

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-BUILD
- Nguồn tạo test case: PLAN | SYSTEM_IMPACT
- Trích dẫn requirement/invariant: `docs/plans/fashion-image/2026-09-26-fashion-image-workflow-gui.md` Phase 4 Verify — `pnpm typecheck` · `pnpm test` · `pnpm build`
- Hành vi cũ: N/A
- Hành vi mới mong đợi: Ba lệnh package pass trên working tree Phase 4
- Chức năng liên quan có thể bị ảnh hưởng: toàn bộ extension build
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC (compile) + package suite
- Nhóm rủi ro/coverage: regression
- Kết quả mong đợi: typecheck exit 0; test 249 passed; build tạo `dist/manifest.json`
- Kết quả thực tế: typecheck EXIT:0; Test Files 30 passed, Tests 249 passed; vite build ✓, `dist/manifest.json` tồn tại
- Kết luận: Ba lệnh VC-BUILD đều pass nên contract được thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Repo `/Users/ggj/MyWork/my-video-flows`, pnpm
- Screenshot gate: GRANTED
- Auth/service: NOT_REQUIRED

## Dữ liệu kiểm thử
- Không cần fixture ngoài source tree hiện tại

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. Chạy `pnpm typecheck` — mong đợi exit 0
3. Chạy `pnpm test` — mong đợi toàn bộ vitest pass
4. Chạy `pnpm build` — mong đợi `dist/manifest.json` được tạo
5. Đối chiếu evidence trong `evidence/`

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | pnpm typecheck | EXIT 0 | EXIT 0 | PASS | evidence/step-01-typecheck.txt |
| 2 | pnpm test | all tests pass | 249 passed | PASS | evidence/step-02-test.txt |
| 3 | pnpm build | dist built | built in 4.16s | PASS | evidence/step-03-build.txt |

## Trạng thái và side effect
- `dist/` được ghi lại bởi build (artifact local)

## Danh sách bằng chứng gốc
- `evidence/step-01-typecheck.txt` — log typecheck
- `evidence/step-02-test.txt` — log vitest 249 passed
- `evidence/step-03-build.txt` — log vite build

## Giới hạn và dọn dẹp
- Không dọn `dist/` (cần cho thử extension screenshot sau)
