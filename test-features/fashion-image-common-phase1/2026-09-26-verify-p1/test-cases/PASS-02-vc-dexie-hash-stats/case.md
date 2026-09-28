# VC-DEXIE-HASH-STATS — Dexie backfill, stats, hashBlobContent

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-DEXIE-HASH-STATS
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: common plan Phase 1 (`db.ts` v2, `getOutputStats`, `hashBlobContent`, `saveOutput.workflowId`)
- Hành vi mới mong đợi: backfill workflowId; getOutputStats đếm đúng; saveOutput ghi workflowId; hash khác nhau cùng size
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC (unit + fake-indexeddb)
- Kết quả mong đợi: 4/4 PASS
- Kết quả thực tế: 4/4 PASS
- Kết luận: Dexie v2 / stats / hash được chứng minh bằng unit test.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- pnpm + vitest; fake-indexeddb trong test env
- Service/auth: NOT_REQUIRED

## Dữ liệu kiểm thử
- Legacy Dexie v1 DB giả trong test; blob Uint8Array cùng size khác byte

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/output-stats.test.ts`
3. Quan sát 4 tests passed
4. Evidence: `evidence/step-01-vitest.txt`
5. Cleanup: không cần (DB test bị delete trong beforeEach)

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | Chạy output-stats.test.ts | backfill + stats + saveOutput + hash | 4 passed | PASS | evidence/step-01-vitest.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`

## Giới hạn và dọn dẹp
- Không chứng minh upgrade trên profile Chrome thật của user
