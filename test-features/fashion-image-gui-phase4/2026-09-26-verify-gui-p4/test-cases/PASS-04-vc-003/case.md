# 04 — VC-003: promptPresetLabel / strings cho nhãn preset UI

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-003
- Nguồn tạo test case: PLAN | RULE_FORMAT | BUSINESS_NEW
- Trích dẫn: GUI plan Phase 4 + AGENTS.md UI tiếng Việt qua `strings.ts`; `promptPresetLabel`
- Hành vi mới mong đợi: option preset hiện label tiếng Việt, không dùng raw `fashionScene` làm nhãn duy nhất
- Phương pháp: package-test + static-trace
- Phạm vi: STATIC + unit
- Kết quả mong đợi: `promptPresetLabel('fashionScene') === strings.presetFashionScene`; Editor/GenerateItemList dùng `promptPresetLabel`
- Kết quả thực tế: vitest 3/3 pass; Editor `optionLabel={promptPresetLabel}`; GenerateItemList `{promptPresetLabel(opt)}`
- Kết luận: Contract VC-003 thỏa.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- `tests/unit/workflow-output-stats-label.test.ts`

## Cách tái hiện thủ công
1. `pnpm exec vitest run --config vitest.config.ts tests/unit/workflow-output-stats-label.test.ts`
2. Xác nhận `promptPresetLabel('fashionScene')` trả `strings.presetFashionScene` (tiếng Việt)
3. Grep `promptPresetLabel` trong `EditorApp.tsx` và `GenerateItemList.tsx`
4. Đối chiếu evidence

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest label | promptPresetLabel cover presets | 3 passed | PASS | evidence/step-01-vitest.txt |
| 2 | static usage | UI dùng promptPresetLabel | Editor + GenerateItemList | PASS | evidence/step-02-static-and-usage.txt |

## Trạng thái và side effect
- Không

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-static-and-usage.txt`

## Giới hạn và dọn dẹp
- Không screenshot dropdown thật (xem case GUI)
