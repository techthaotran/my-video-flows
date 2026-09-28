# VC-SPR-CAD-SAFE — SPrCad CAPTCHA_SLOT, log sạch, 2K sau ogiZ0b, không maseQ

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-SPR-CAD-SAFE
- Nguồn tạo test case: PLAN | SECURITY | BUSINESS_NEW
- Trích dẫn requirement/invariant: AGENTS.md (không log captcha; Flow asset không upload lại); `RPC_GEN_IMAGE_2K=SPrCad`; `image2kRequest` + `fetchImage2k`
- Hành vi cũ: chỉ ogiZ0b CDN 1K
- Hành vi mới mong đợi: resolution 2K gọi SPrCad sau ogiZ0b; wire dùng CAPTCHA_SLOT; logPayload giữ slot / không lộ token; media id đã gen không qua maseQ
- Chức năng liên quan: `batch.ts`, `generate.ts`, `payloadLog.ts`
- Phương pháp: package-test + static-trace
- Phạm vi được chứng minh: API_ONLY | STATIC
- Nhóm rủi ro/coverage: positive (2K), negative (1K no SPrCad), security (CAPTCHA_SLOT) COVERED; concurrency NOT_APPLICABLE
- Kết quả mong đợi: flow-batch + flow-rpc-generate + flow-payload-log pass; static không maseQ trong fetchImage2k
- Kết quả thực tế: 73 tests pass; image2kRequest context có CAPTCHA_SLOT; fetchImage2k chỉ SPrCad + sourceMediaId
- Kết luận: Contract SPrCad an toàn đạt.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Mock batchexecute envelopes trong unit tests

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/flow-batch.test.ts tests/unit/flow-rpc-generate.test.ts tests/unit/flow-payload-log.test.ts`
2. Quan sát tất cả pass; trong flow-batch: `ctx[10] === [CAPTCHA_SLOT, 1]`; trong generate: test `resolution 2K calls SPrCad after ogiZ0b`.
3. Đọc `src/providers/flow/rpc/generate.ts` hàm `fetchImage2k` — chỉ `image2kRequest` + `rpcPayload(SPrCad)`, không gọi upload/maseQ.
4. Evidence trong `evidence/`.
5. Cleanup: không cần

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 01 | vitest flow batch/rpc/log | 73 pass | 73 pass | PASS | evidence/step-01-vitest.txt |
| 02 | assert CAPTCHA_SLOT + 2K path in tests | có | có | PASS | evidence/step-02-test-assertions.txt |
| 03 | static SPrCad / log | CAPTCHA_SLOT, resolution log | khớp | PASS | evidence/step-03-static-trace.txt |
| 04 | fetchImage2k không maseQ | không upload | không maseQ trong hàm | PASS | evidence/step-04-no-maseq-2k.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-test-assertions.txt`
- `evidence/step-03-static-trace.txt`
- `evidence/step-04-no-maseq-2k.txt`

## Giới hạn và dọn dẹp
- Test 2K text-to-image không assert tường minh `not.toContain('maseQ')` nhưng path `fetchImage2k` không có upload; maseQ chỉ ở nhánh upload ảnh local khác
