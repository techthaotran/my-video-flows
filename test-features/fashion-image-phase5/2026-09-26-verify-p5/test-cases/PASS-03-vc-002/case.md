# VC-002 — Asset UI ưu tiên uploadedMediaId hơn lỗi upload kẹt

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-002
- Nguồn tạo test case: PLAN | ERROR_HANDLING | USER_BEHAVIOR
- Trích dẫn requirement/invariant: GUI plan Phase 5 `#27` - nhãn "Đã có trên Flow" / lỗi + Upload lại
- Hành vi mới mong đợi: khi `uploadedMediaId` có sau khi state local đang `error`, UI reset và hiện "Đã có trên Flow", không hiện lỗi
- Phương pháp: static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: effect reset `uploadStatus` khi có uploadedMediaId; error UI chỉ khi `!uploadedOnFlow`
- Kết quả thực tế: `useEffect` reset idle; error block `uploadStatus === 'error' && !uploadedOnFlow`
- Kết luận: UI không kẹt lỗi khi đã có uploadedMediaId.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Đọc source checkout; không runtime GUI

## Cách tái hiện thủ công
1. Mở `src/features/editor/nodes/WorkflowNodeView.tsx` quanh Asset body
2. Xác nhận comment "ưu tiên data" + effect `if (data.uploadedMediaId) setUploadStatus('idle')`
3. Xác nhận nhánh lỗi: `uploadStatus === 'error' && !uploadedOnFlow`
4. Đối chiếu `evidence/step-01-static-trace.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static effect + UI gate | ưu tiên uploaded | đúng | PASS | step-01-static-trace.txt |

## Danh sách bằng chứng gốc
- `evidence/step-01-static-trace.txt`

## Giới hạn và dọn dẹp
- Không chạy playwright cho case này (static đủ theo contract)
