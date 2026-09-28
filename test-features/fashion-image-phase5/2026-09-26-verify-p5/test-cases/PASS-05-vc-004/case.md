# VC-004 — stale upload retry chỉ image

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-004
- Nguồn tạo test case: PLAN | ERROR_HANDLING | BUSINESS_NEW
- Trích dẫn requirement/invariant: API plan `#24` media gone → upload lại 1 lần; comment generate.ts "Chỉ ảnh"
- Hành vi mới mong đợi: `generateWithStaleUploadRetry` chỉ khi imageMode; video Media not found không wrap maseQ retry; UI Upload lại chỉ `kind === 'image'`; assetUpload chỉ image/*
- Phương pháp: static-trace (+ test oracle trong flow-upload-reuse)
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: imageMode ? retry : generate(); video test no maseQ wrap
- Kết quả thực tế: generate.ts ~1542–1546; UI gated `kind === 'image'`; mime.startsWith('image/'); test video exists
- Kết luận: Stale upload retry / Upload lại bị giới hạn ảnh.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. Đọc `generate.ts` quanh `imageMode ? await generateWithStaleUploadRetry`
2. Đọc WorkflowNodeView upload status block `kind === 'image'`
3. `pnpm exec vitest run tests/unit/flow-upload-reuse.test.ts` - case video no maseQ
4. Evidence: `evidence/step-01-static-trace.txt`

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | static + test names | image-only | đúng | PASS | step-01-static-trace.txt |

## Giới hạn
- Runtime Flow thật không chạy trong verify này
