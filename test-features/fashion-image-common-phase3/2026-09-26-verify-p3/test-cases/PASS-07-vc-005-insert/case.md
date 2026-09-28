# VC-005 — Insert path: putFromHash + remap

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-005
- Nguồn tạo test case: PLAN | BUSINESS_NEW | USER_BEHAVIOR (Editor chèn node)
- Trích dẫn requirement/invariant: Common Phase 3 + Editor ingest dùng `putFromHash` + remap (không giữ assetId ngoại)
- Hành vi mới mong đợi: EditorApp gọi ingestPreviewAssets → remapMediaAssets → remapInsertNodes; ingest dùng putFromHash
- Phương pháp: package-test + static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: test chèn node pass; EditorApp lines 817–822 khớp; putFromHash tại transfer:531
- Kết luận: Insert/ingest path đúng; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Zip insert với foreign assetId + sha256 khớp blob

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t 'chèn node'`
3. `rg -n "ingestPreviewAssets|remapMediaAssets|remapInsertNodes|putFromHash" src/features/editor/EditorApp.tsx src/storage/transfer/index.ts`
4. Quan sát: 1 passed; Editor gọi đúng chuỗi; ingest dùng putFromHash
5. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-static-trace.txt`
6. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest -t 'chèn node' | pass | 1 passed | PASS | step-01-vitest.txt |
| 2 | static Editor + transfer | putFromHash + remap chain | confirmed | PASS | step-02-static-trace.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-static-trace.txt`

## Giới hạn và dọn dẹp
- Không click GUI «Chèn node» thật; chỉ unit + static wiring
