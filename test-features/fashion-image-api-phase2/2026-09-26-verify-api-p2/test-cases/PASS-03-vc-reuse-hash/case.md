# VC-REUSE-HASH — Hành vi reuse prompt theo hash nội dung

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-REUSE-HASH
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: plan API Phase 2 — `reuseHash` + `reusePrompt`; `tests/unit/prompt-reuse.test.ts`
- Hành vi cũ: mỗi lần chạy Prompt luôn gọi Gemini
- Hành vi mới mong đợi: cùng hash → không gọi driver; đổi nội dung ảnh cùng size → gọi lại; `reusePrompt: false` → luôn gọi
- Chức năng liên quan: `promptExecutor`, RunManager patch `formattedOutput`/`reuseHash`
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Nhóm rủi ro/coverage: positive/negative/boundary COVERED trong file test; adversarial/concurrency NOT_APPLICABLE
- Kết quả mong đợi: 5 tests pass
- Kết quả thực tế: 5 passed
- Kết luận: Hành vi reuse-hash được chứng minh bởi suite độc lập (mock driver đếm call), contract đạt.
- Screenshot: N/A (non-visual verification)
- Oracle note: test đếm lần gọi driver mock — không mirror implementation branch; WEAK_ORACLE không áp dụng

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Blob ảnh fixture trong test (nội dung khác, size có thể trùng)

## Cách tái hiện thủ công
1. Tại repo root chạy: `pnpm exec vitest run --config vitest.config.ts tests/unit/prompt-reuse.test.ts`
2. Quan sát 5 tests pass (reuse cùng input, đổi blob, reusePrompt false, forwardRefs, scene refs).
3. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-test-names.txt`
4. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest prompt-reuse | 5 pass | 5 pass | PASS | evidence/step-01-vitest.txt |

## Trạng thái và side effect
- Không side effect ngoài fake-idb trong test

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt` — kết quả Vitest
- `evidence/step-02-test-names.txt` — danh sách case trong file

## Giới hạn và dọn dẹp
- Không chứng minh UI bật/tắt reusePrompt
