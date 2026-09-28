# 02 — VC-001: getOutputStats không giữ toàn bộ blob; ≤4 thumbs

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-001
- Nguồn tạo test case: PLAN | PERFORMANCE | BUSINESS_NEW | REFACTOR
- Trích dẫn requirement/invariant: GUI plan Phase 4 — dải tối đa 4 thumbnail; `runRepo.getOutputStats` comment + vòng đếm chỉ id/createdAt
- Hành vi cũ: N/A (API mới)
- Hành vi mới mong đợi: Đếm đủ ảnh/video; hydrate ≤ `thumbLimit` (mặc định 4); vòng `each` không giữ blob
- Chức năng liên quan: SidePanel workflow list thumbs
- Phương pháp: package-test + static-trace
- Phạm vi được chứng minh: STATIC + unit
- Kết quả mong đợi: vitest output-stats pass; code dùng candidate `{id,createdAt}`; thumbs length 4 khi 12 outputs
- Kết quả thực tế: 5/5 tests pass; static trace xác nhận `pushCandidate` chỉ lưu id+createdAt rồi `bulkGet` hydrate
- Kết luận: Contract VC-001 thỏa — không giữ all blobs, ≤4 thumbs hydrated.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED; auth NOT_REQUIRED

## Dữ liệu kiểm thử
- Fixture trong `tests/unit/output-stats.test.ts` (12 outputs, thumbLimit 4)

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/output-stats.test.ts`
3. Đọc `src/storage/repos/runRepo.ts` hàm `getOutputStats`: vòng `each` chỉ gọi `pushCandidate(wfId, row.id, row.createdAt)`; hydrate qua `bulkGet`
4. Đối chiếu evidence

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest output-stats | pass; thumbs length 4 | 5 passed | PASS | evidence/step-01-vitest.txt |
| 2 | static getOutputStats | không giữ blob trong each; default thumbLimit=4 | candidates id+createdAt; bulkGet | PASS | evidence/step-02-static-trace.txt |

## Trạng thái và side effect
- fake-indexeddb trong vitest, không đụng DB thật

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-static-trace.txt`

## Giới hạn và dọn dẹp
- Oracle unit không đo heap runtime; chứng minh bằng cấu trúc code + assert số thumbs
