# VC-FORWARD-SCENE — fashionScene forwardRefs:false loại scene khỏi gen refs

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-FORWARD-SCENE
- Nguồn tạo test case: PLAN | BUSINESS_NEW | WORKFLOW
- Trích dẫn requirement/invariant: plan API Phase 2 — `fashionScene` `forwardRefs: false`; template seed; test trong `prompt-reuse.test.ts`
- Hành vi cũ: Prompt luôn forward mọi image refs
- Hành vi mới mong đợi: scene node không đưa media ảnh mẫu vào refs của Generate Image
- Chức năng liên quan: `promptExecutor` forwardRefs, template `tpl-fashion-image`
- Phương pháp: package-test
- Phạm vi được chứng minh: API_ONLY
- Nhóm rủi ro/coverage: positive COVERED; negative (forwardRefs true vẫn forward) COVERED cùng file
- Kết quả mong đợi: test `fashionScene forwardRefs:false keeps scene media out of generateImage refs` pass
- Kết quả thực tế: 1 passed | 4 skipped
- Kết luận: Scene media không lọt vào gen refs khi forwardRefs:false — contract đạt.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Graph Asset(scene)+Prompt fashionScene(forwardRefs:false) → Compose → Generate Image trong test

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/prompt-reuse.test.ts -t 'fashionScene forwardRefs'`
2. Quan sát 1 test pass.
3. Evidence: `evidence/step-01-vitest.txt`, `evidence/step-02-test-body.txt`
4. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest -t fashionScene forwardRefs | 1 pass | 1 pass | PASS | evidence/step-01-vitest.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-test-body.txt` — thân test assertion refs

## Giới hạn và dọn dẹp
- Không chứng minh UI template trên canvas
