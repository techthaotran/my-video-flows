# VC-VIDEO-REGRESSION — Hồi quy workflow video (kèm continuation)

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-VIDEO-REGRESSION
- Nguồn tạo test case: PLAN | BUSINESS_OLD | WORKFLOW
- Trích dẫn requirement/invariant: plan API Phase 2 — video-regression; `tests/unit/video-regression.test.ts`
- Hành vi cũ: Asset → Prompt enhance → Generate Video; refs + continuation giữ sau migrate v6
- Hành vi mới mong đợi: migrate v6 không đổi hành vi video; continuation last-frame vẫn forward
- Chức năng liên quan: schema migrate, promptExecutor, generateVideo
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Nhóm rủi ro/coverage: regression COVERED (2 tests gồm continuation); positive COVERED
- Kết quả mong đợi: 2 tests pass, có case continuation
- Kết quả thực tế: 2 passed (migrate graph + continuation)
- Kết luận: Video regression đạt; continuation có trong suite.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Workflow video mẫu trong test (migrate từ shape v5)

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/video-regression.test.ts`
2. Quan sát 2 tests pass; tên case chứa continuation.
3. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-coverage.txt`
4. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest video-regression | 2 pass + continuation | 2 pass | PASS | evidence/step-01-vitest.txt |

## Trạng thái và side effect
- fake-idb trong test

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-coverage.txt` — có dòng continuation

## Giới hạn và dọn dẹp
- Không chạy Flow/Gemini thật
