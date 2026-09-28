# VC-008 — Không còn hashIdx / void d

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-008
- Nguồn tạo test case: PLAN | REFACTOR
- Trích dẫn requirement/invariant: common plan Phase 3 — bỏ nhánh gán theo thứ tự (`hashIdx`); bỏ code chết `void d` trong parseImportFile
- Hành vi mới mong đợi: không còn `hashIdx` hay `void d` trong transfer; remap chỉ theo sha256
- Phương pháp: static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả thực tế: NO_hashIdx; NO_void_d; remapMediaAssets dùng Map sha → assetId
- Kết luận: Dead code / positional remap đã loại; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Mã nguồn `src/storage/transfer/index.ts`

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `rg -n 'hashIdx' src/storage/transfer` → không match
3. `rg -n 'void d' src/storage/transfer` → không match
4. Evidence: `evidence/step-01-static-trace.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | grep hashIdx | 0 | NO_hashIdx | PASS | step-01-static-trace.txt |
| 2 | grep void d | 0 | NO_void_d | PASS | step-01-static-trace.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không so diff với commit cũ; chỉ trạng thái working tree hiện tại
