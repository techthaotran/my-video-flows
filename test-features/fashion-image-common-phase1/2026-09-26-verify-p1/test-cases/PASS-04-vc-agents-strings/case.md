# VC-AGENTS-STRINGS — Chuỗi UI và SCHEMA_VERSION

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-AGENTS-STRINGS
- Nguồn tạo test case: RULE_FORMAT | PLAN
- Trích dẫn: AGENTS.md UI qua strings.ts; common plan Phase 1 strings + SCHEMA_VERSION 6
- Phương pháp: static-trace / grep
- Phạm vi: STATIC
- Kết quả mong đợi: nhãn fashion/reuse trong strings.ts; không hardcode trong component mới; SCHEMA_VERSION===6
- Kết quả thực tế: đúng như mong đợi
- Kết luận: Contract strings + version đạt.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `rg -n "export const SCHEMA_VERSION" src/shared/schema/index.ts` → phải = 6
2. `rg -n "presetFashion|reusePrompt:|forwardRefs:|promptFresh" src/shared/strings.ts`
3. `rg -n "Phân tích scene thời trang|Dùng lại prompt cũ|Chuyển tiếp ảnh xuống node sau" src --glob '*.{tsx,ts}'` → chỉ `strings.ts` (comment schema không tính UI)
4. Evidence: `evidence/step-01-grep.txt`

## Các bước và assertion
| Bước | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- |
| SCHEMA_VERSION | 6 | 6 | PASS | step-01 |
| Labels in strings | có | có | PASS | step-01 |
| Hardcode components | không | không (chỉ comment schema) | PASS | step-01 |

## Danh sách bằng chứng gốc
- `evidence/step-01-grep.txt`
