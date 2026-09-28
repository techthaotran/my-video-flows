# VC-001 — outputEdited sync từ executor

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-001
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: API plan Phase 5 `#25` - `outputEdited` luôn dùng lại; RunManager patch; `force` xoá cờ
- Hành vi cũ: chỉ patch `formattedOutput`/`reuseHash`
- Hành vi mới mong đợi: executor trả `outputEdited`; RunManager ghi vào node; empty+outputEdited bị xoá khi chạy không force
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Kết quả mong đợi: vitest PASS; RunManager patch `outputEdited: !!textOut?.outputEdited`
- Kết quả thực tế: 11 tests PASS (prompt-reuse + run-patch-node-data); patch tại RunManager.ts:632
- Kết luận: Đồng bộ outputEdited từ executor → node đã được kiểm chứng bằng unit test độc lập.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Vitest + fake-indexeddb; không auth

## Dữ liệu kiểm thử
- Fixture trong `tests/unit/prompt-reuse.test.ts`, `tests/unit/run-patch-node-data.test.ts`

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/run-patch-node-data.test.ts tests/unit/prompt-reuse.test.ts`
3. Quan sát 11 passed; đối chiếu `RunManager` patch `outputEdited`
4. Evidence: `evidence/step-01-vitest.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest focused | PASS | 11 passed | PASS | step-01-vitest.txt |
| 2 | tên test outputEdited/force | có | có | PASS | step-02-test-names.txt |
| 3 | static patch path | executor→RunManager | L632 | PASS | step-03-runmanager-patch.txt |

## Trạng thái và side effect
- Fake IndexedDB trong vitest; không đụng data thật

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-test-names.txt`
- `evidence/step-03-runmanager-patch.txt`

## Giới hạn và dọn dẹp
- Không; oracle dựa trên test chấp nhận + static sync path (không mirror implementation-only)
