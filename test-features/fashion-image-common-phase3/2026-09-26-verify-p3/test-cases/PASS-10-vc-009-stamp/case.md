# VC-009 — Export stamp sha256 lên node Asset

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-009
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: common plan Phase 3 — khi export ghi `sha256` vào data từng node Asset local
- Hành vi mới mong đợi: workflowsData node.data.sha256 === AssetRecord.sha256
- Phương pháp: package-test + static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: test «export ghi sha256» pass; transfer:83 gán `sha256 = asset.sha256`
- Kết luận: Export stamp sha256 đạt; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- 1 node asset local + export format json (tránh mất Blob dưới jsdom)

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t 'export ghi sha256'`
3. `rg -n 'sha256 = asset.sha256' src/storage/transfer/index.ts`
4. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-static.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest stamp | pass | 1 passed | PASS | step-01-vitest.txt |
| 2 | static assign | có | line 83 | PASS | step-02-static.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-static.txt`

## Giới hạn và dọn dẹp
- Export zip + blob packing không assert trong case này (jsdom limitation đã ghi trong test)
