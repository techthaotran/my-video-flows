# VC-REV-001 — Draft restore đi qua migrateWorkflow

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-REV-001
- Nguồn tạo test case: BUSINESS_OLD | PLAN | SYSTEM_IMPACT
- Trích dẫn: getDraft + EditorApp restore phải migrate draft schema cũ
- Phương pháp: static-trace + package-test (schema-v6 draft-like)
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: getDraft và nút restore draft gọi migrateWorkflow; test migrate+validate có
- Kết quả thực tế: cả hai path gọi migrateWorkflow; test draft-wf PASS
- Kết luận: Draft migrate path được xác nhận bằng static trace + unit test.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Source checkout hiện tại; không cần service

## Cách tái hiện thủ công
1. Mở `src/storage/repos/workflowRepo.ts` hàm `getDraft` — phải thấy `migrateWorkflow(draft.workflow)`
2. Mở `src/features/editor/EditorApp.tsx` handler restore draft — phải thấy `store.loadWorkflow(migrateWorkflow(draft.workflow))`
3. Chạy `pnpm exec vitest run --config vitest.config.ts tests/unit/schema-v6-migrate.test.ts` — test “migrate rồi validateNodeData” PASS
4. Evidence: `evidence/step-01-static-trace.txt`, `evidence/step-02-schema-v6-migrate.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | Trace getDraft | migrateWorkflow | có dòng 215 | PASS | step-01 |
| 2 | Trace EditorApp restore | migrateWorkflow | có dòng 770 | PASS | step-01 |
| 3 | schema-v6 draft-like | PASS | 4/4 PASS | PASS | step-02 |

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`
- `evidence/step-02-schema-v6-migrate.txt`

## Giới hạn
- Không mở UI extension để bấm restore draft thật
