# VC-009 — flowMediaId never maseQ

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-009
- Nguồn tạo test case: PLAN | BUSINESS_OLD | WORKFLOW
- Trích dẫn requirement/invariant: AGENTS.md quy tắc 6; FLOW_ASSET_NO_UPLOAD; plan API upload chỉ local
- Hành vi mong đợi: ref có `flowMediaId` trả mediaId sẵn; không gọi upload/maseQ; assetUpload từ chối flowMediaId
- Phương pháp: static-trace
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: early return mediaId; throw nếu fromFlow thiếu id; assetUpload guard
- Kết quả thực tế: toFlowRef L314; assetUpload L34; upload path chỉ qua `upload` payload local
- Kết luận: flowMediaId không đi đường maseQ.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. Đọc `toFlowRef` trong executors.ts
2. Đọc `uploadAssetNodeToFlow` guard
3. Evidence: step-01-static-trace.txt
