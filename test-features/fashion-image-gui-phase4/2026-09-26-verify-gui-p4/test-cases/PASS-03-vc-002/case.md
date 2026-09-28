# 03 — VC-002: GenerateItemList fashionScene đặt forwardRefs false

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-002
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn: GUI plan Phase 4 — chọn `fashionScene` thì tự đặt `forwardRefs: false`; `GenerateItemList.tsx`
- Hành vi mới mong đợi: onChange preset `fashionScene` gửi `{ preset, forwardRefs: false }`
- Phương pháp: static-trace
- Phạm vi: STATIC
- Kết quả mong đợi: nhánh `preset === 'fashionScene' ? { preset, forwardRefs: false } : { preset }`
- Kết quả thực tế: đúng tại dòng ~253–255 `GenerateItemList.tsx`
- Kết luận: Contract VC-002 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED; auth NOT_REQUIRED

## Dữ liệu kiểm thử
- Không cần runtime; đọc source

## Cách tái hiện thủ công
1. Mở `src/features/runner/GenerateItemList.tsx`
2. Tìm `onChange` của select preset
3. Xác nhận khi `preset === 'fashionScene'` gọi `onUpdateField` với `forwardRefs: false`
4. Đối chiếu `evidence/step-01-static-trace.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static GenerateItemList | fashionScene → forwardRefs false | có nhánh đúng | PASS | evidence/step-01-static-trace.txt |

## Trạng thái và side effect
- Không đổi state runtime

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không chứng minh click GUI runner; chỉ wiring source
