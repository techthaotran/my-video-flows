# VC-SECRETS — Không log secret; không ship sample 2K

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-SECRETS
- Nguồn tạo test case: SECURITY | RULE_FORMAT
- Trích dẫn: AGENTS.md không log token/captcha/cookie; không ship `.tmp-flow-2k`
- Phương pháp: static-trace / diff grep
- Phạm vi: STATIC
- Kết quả mong đợi: diff không log secret; sample không được track/ship
- Kết quả thực tế: không hit logging; `.tmp-flow-2k` không tồn tại, bị exclude, không tracked
- Kết luận: Contract bảo mật/artifact đạt.
- Screenshot: N/A (non-visual verification)

## Cách tái hiện thủ công
1. `git status --short` — không thấy `.tmp-flow-2k` tracked
2. `git check-ignore -v .tmp-flow-2k/sample-2k.jpg` — phải bị ignore
3. `git diff HEAD -- src tests | rg -i 'captcha|cookie|token'` — không có dump secret
4. Evidence: `evidence/step-01-secrets-scan.txt`

## Các bước và assertion
| Bước | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- |
| Secret logging | không | không hit | PASS | step-01 |
| Sample ship | không | không tồn tại / exclude / untracked | PASS | step-01 |

## Danh sách bằng chứng gốc
- `evidence/step-01-secrets-scan.txt`
